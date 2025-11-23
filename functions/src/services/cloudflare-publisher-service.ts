import { logger } from "firebase-functions";

/**
 * Configuration for Cloudflare Publisher Service
 */
export interface CloudflarePublisherConfig {
  accountId: string;
  apiToken: string;
  r2BucketName: string;
  kvNamespaceId: string;
  workerUrl?: string; // Optional: URL of the Cloudflare Worker if using external API
}

/**
 * File to upload to R2
 */
export interface R2File {
  path: string; // e.g., "index.html" or "assets/style.css"
  content: string | Buffer;
  contentType?: string;
}

/**
 * Result of publishing a site version
 */
export interface PublishResult {
  brandSiteId: string;
  versionId: string;
  publishedDomains: string[];
  r2Keys: string[];
}

/**
 * Service for publishing brand sites to Cloudflare (R2 + KV)
 * 
 * This service handles:
 * - Uploading static files (HTML, CSS, JS, images) to R2
 * - Updating KV namespace with hostname -> brandSiteId:versionId mappings
 * 
 * Uses Cloudflare API v4 for both R2 and KV operations.
 */
export class CloudflarePublisherService {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly r2BucketName: string;
  private readonly kvNamespaceId: string;

  constructor(config: CloudflarePublisherConfig) {
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.r2BucketName = config.r2BucketName;
    this.kvNamespaceId = config.kvNamespaceId;

    if (!this.accountId || !this.apiToken || !this.r2BucketName || !this.kvNamespaceId) {
      throw new Error(
        "CloudflarePublisherService requires accountId, apiToken, r2BucketName, and kvNamespaceId"
      );
    }
  }

  /**
   * Upload site version files to R2
   * 
   * @param brandSiteId - The brand site ID
   * @param versionId - The version ID (e.g., nanoid or timestamp-based)
   * @param files - Array of files to upload
   * @returns Array of R2 keys that were uploaded
   */
  async uploadSiteVersionToR2(
    brandSiteId: string,
    versionId: string,
    files: R2File[]
  ): Promise<string[]> {
    const uploadedKeys: string[] = [];

    for (const file of files) {
      // Normalize path: remove leading slash, ensure consistent format
      const normalizedPath = file.path.startsWith("/")
        ? file.path.substring(1)
        : file.path;

      // Build R2 key: sites/{brandSiteId}/{versionId}/{path}
      const r2Key = `sites/${brandSiteId}/${versionId}/${normalizedPath}`;

      // Determine content type
      const contentType =
        file.contentType || this.inferContentType(normalizedPath);

      // Convert content to Buffer if needed
      const contentBuffer =
        typeof file.content === "string"
          ? Buffer.from(file.content, "utf-8")
          : file.content;

      try {
        // Upload to R2 using Cloudflare API
        await this.uploadToR2(r2Key, contentBuffer, contentType);
        uploadedKeys.push(r2Key);

        logger.debug("Uploaded file to R2", {
          brandSiteId,
          versionId,
          r2Key,
          size: contentBuffer.length,
          contentType,
        });
      } catch (error) {
        logger.error("Failed to upload file to R2", {
          brandSiteId,
          versionId,
          r2Key,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new Error(
          `Failed to upload ${normalizedPath} to R2: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    logger.info("Uploaded site version to R2", {
      brandSiteId,
      versionId,
      fileCount: files.length,
      uploadedKeys,
    });

    return uploadedKeys;
  }

  /**
   * Update KV namespace with hostname mapping
   * 
   * @param hostname - The hostname (e.g., "acme-finance.com")
   * @param brandSiteId - The brand site ID
   * @param versionId - The version ID
   */
  async updateSiteHostMapping(
    hostname: string,
    brandSiteId: string,
    versionId: string
  ): Promise<void> {
    const normalizedHostname = hostname.toLowerCase().trim();
    const mapping = `${brandSiteId}:${versionId}`;

    try {
      await this.putKV(normalizedHostname, mapping);

      logger.info("Updated KV hostname mapping", {
        hostname: normalizedHostname,
        brandSiteId,
        versionId,
        mapping,
      });
    } catch (error) {
      logger.error("Failed to update KV hostname mapping", {
        hostname: normalizedHostname,
        brandSiteId,
        versionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        `Failed to update KV mapping for ${normalizedHostname}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Update multiple hostname mappings at once
   * 
   * @param mappings - Array of {hostname, brandSiteId, versionId} tuples
   */
  async updateSiteHostMappings(
    mappings: Array<{ hostname: string; brandSiteId: string; versionId: string }>
  ): Promise<void> {
    const promises = mappings.map((m) =>
      this.updateSiteHostMapping(m.hostname, m.brandSiteId, m.versionId)
    );

    await Promise.all(promises);

    logger.info("Updated multiple KV hostname mappings", {
      count: mappings.length,
    });
  }

  /**
   * Delete a hostname mapping from KV
   * 
   * @param hostname - The hostname to remove
   */
  async deleteSiteHostMapping(hostname: string): Promise<void> {
    const normalizedHostname = hostname.toLowerCase().trim();

    try {
      await this.deleteKV(normalizedHostname);

      logger.info("Deleted KV hostname mapping", {
        hostname: normalizedHostname,
      });
    } catch (error) {
      logger.error("Failed to delete KV hostname mapping", {
        hostname: normalizedHostname,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get current mapping for a hostname
   * 
   * @param hostname - The hostname to look up
   * @returns The mapping (brandSiteId:versionId) or null if not found
   */
  async getSiteHostMapping(hostname: string): Promise<string | null> {
    const normalizedHostname = hostname.toLowerCase().trim();

    try {
      const mapping = await this.getKV(normalizedHostname);
      return mapping;
    } catch (error) {
      logger.warn("Failed to get KV hostname mapping", {
        hostname: normalizedHostname,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  // Private helper methods

  /**
   * Upload a file to R2 using Cloudflare API
   */
  private async uploadToR2(
    key: string,
    content: Buffer,
    contentType: string
  ): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.r2BucketName}/objects/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": contentType,
      },
      body: content as unknown as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `R2 upload failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Put a value in KV namespace
   */
  private async putKV(key: string, value: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "text/plain",
      },
      body: value,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `KV put failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Get a value from KV namespace
   */
  private async getKV(key: string): Promise<string | null> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `KV get failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.text();
  }

  /**
   * Delete a value from KV namespace
   */
  private async deleteKV(key: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `KV delete failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Infer content type from file path
   */
  private inferContentType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase();

    const contentTypes: Record<string, string> = {
      html: "text/html; charset=utf-8",
      htm: "text/html; charset=utf-8",
      css: "text/css; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      json: "application/json; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      eot: "application/vnd.ms-fontobject",
    };

    return contentTypes[ext || ""] || "application/octet-stream";
  }
}

