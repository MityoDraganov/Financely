import { getStorage } from "firebase-admin/storage";
import { loggerService } from "./logger-service";

/**
 * Service for storing and retrieving large brand site content from Cloud Storage
 * to avoid Firestore's 1MB document size limit.
 */
export class BrandSiteStorageService {
  private bucket;

  constructor() {
    this.bucket = getStorage().bucket();
  }

  /**
   * Store HTML content in Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param html - The HTML content to store
   * @returns The storage path
   */
  async storeHtml(brandSiteId: string, html: string): Promise<string> {
    const path = `brand-sites/${brandSiteId}/html.html`;
    const file = this.bucket.file(path);

    await file.save(html, {
      metadata: {
        contentType: "text/html",
        metadata: {
          brandSiteId,
          storedAt: new Date().toISOString(),
        },
      },
    });

    loggerService.debug("Stored HTML in Cloud Storage", { brandSiteId, path });
    return path;
  }

  /**
   * Retrieve HTML content from Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param path - Optional storage path (for backward compatibility)
   * @returns The HTML content or null if not found
   */
  async getHtml(brandSiteId: string, path?: string): Promise<string | null> {
    const storagePath = path || `brand-sites/${brandSiteId}/html.html`;
    const file = this.bucket.file(storagePath);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return content.toString("utf-8");
    } catch (error) {
      loggerService.warn("Failed to retrieve HTML from storage", {
        brandSiteId,
        path: storagePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Store files object in Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param files - The files object (path -> content)
   * @returns The storage path
   */
  async storeFiles(
    brandSiteId: string,
    files: Record<string, string>,
  ): Promise<string> {
    const path = `brand-sites/${brandSiteId}/files.json`;
    const file = this.bucket.file(path);

    const filesJson = JSON.stringify(files);

    await file.save(filesJson, {
      metadata: {
        contentType: "application/json",
        metadata: {
          brandSiteId,
          storedAt: new Date().toISOString(),
          fileCount: Object.keys(files).length,
        },
      },
    });

    loggerService.debug("Stored files in Cloud Storage", {
      brandSiteId,
      path,
      fileCount: Object.keys(files).length,
    });
    return path;
  }

  /**
   * Retrieve files object from Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param path - Optional storage path (for backward compatibility)
   * @returns The files object or null if not found
   */
  async getFiles(
    brandSiteId: string,
    path?: string,
  ): Promise<Record<string, string> | null> {
    const storagePath = path || `brand-sites/${brandSiteId}/files.json`;
    const file = this.bucket.file(storagePath);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString("utf-8"));
    } catch (error) {
      loggerService.warn("Failed to retrieve files from storage", {
        brandSiteId,
        path: storagePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Store version content in Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param version - The version number
   * @param html - The HTML content
   * @param files - Optional files object
   * @returns The storage path
   */
  async storeVersion(
    brandSiteId: string,
    version: number,
    html: string,
    files?: Record<string, string>,
  ): Promise<string> {
    const path = `brand-sites/${brandSiteId}/versions/v${version}.json`;
    const file = this.bucket.file(path);

    const versionData = {
      html,
      files: files || {},
    };

    await file.save(JSON.stringify(versionData), {
      metadata: {
        contentType: "application/json",
        metadata: {
          brandSiteId,
          version: version.toString(),
          storedAt: new Date().toISOString(),
        },
      },
    });

    loggerService.debug("Stored version in Cloud Storage", { brandSiteId, version, path });
    return path;
  }

  /**
   * Retrieve version content from Cloud Storage
   * @param brandSiteId - The brand site ID
   * @param version - The version number
   * @returns The version data (html and files) or null if not found
   */
  async getVersion(
    brandSiteId: string,
    version: number,
  ): Promise<{ html: string; files?: Record<string, string> } | null> {
    const path = `brand-sites/${brandSiteId}/versions/v${version}.json`;
    const file = this.bucket.file(path);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString("utf-8"));
    } catch (error) {
      loggerService.warn("Failed to retrieve version from storage", {
        brandSiteId,
        version,
        path,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Delete all content for a brand site (cleanup)
   * @param brandSiteId - The brand site ID
   */
  async deleteAll(brandSiteId: string): Promise<void> {
    const prefix = `brand-sites/${brandSiteId}/`;
    try {
      const [files] = await this.bucket.getFiles({ prefix });
      await Promise.all(files.map((file) => file.delete()));
      loggerService.debug("Deleted all brand site content from storage", { brandSiteId });
    } catch (error) {
      loggerService.warn("Failed to delete brand site content from storage", {
        brandSiteId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Check if content should be stored in Cloud Storage based on size
   * @param data - The data to check
   * @returns True if data should be stored in Cloud Storage (approximate check)
   */
  shouldStoreInCloudStorage(data: unknown): boolean {
    const jsonString = JSON.stringify(data);
    // Use 900KB as threshold to leave room for other fields
    return jsonString.length > 900 * 1024;
  }
}

