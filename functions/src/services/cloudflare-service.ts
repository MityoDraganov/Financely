import { logger } from "firebase-functions";

interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  baseDomain: string;
  accountId?: string; // Optional: needed for Workers routes
}

interface DnsRecord {
  type: "CNAME" | "A";
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

export class CloudflareService {
  private readonly apiToken: string;
  private readonly zoneId: string;
  private readonly baseDomain: string;
  private readonly accountId?: string;
  private readonly apiBaseUrl = "https://api.cloudflare.com/client/v4";

  constructor(config: CloudflareConfig) {
    this.apiToken = config.apiToken;
    this.zoneId = config.zoneId;
    this.baseDomain = config.baseDomain;
    this.accountId = config.accountId;
  }

  private async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    body?: unknown,
  ): Promise<CloudflareApiResponse<T>> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseText = await response.text();
      let responseData: CloudflareApiResponse<T> | null = null;
      
      try {
        responseData = JSON.parse(responseText) as CloudflareApiResponse<T>;
      } catch {
        // If response is not JSON, use the text as error
      }

      if (!response.ok) {
        const errorDetails = responseData?.errors || [];
        const errorMessages = errorDetails.map((e) => e.message).join(", ");
        const errorMessage = errorMessages || responseText || response.statusText;
        
        logger.error("Cloudflare API error", {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          error: errorMessage,
          errors: errorDetails,
          responseBody: responseText,
        });
        
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText}${errorMessage ? ` - ${errorMessage}` : ""}`,
        );
      }

      if (!responseData) {
        throw new Error("Invalid JSON response from Cloudflare API");
      }

      return responseData;
    } catch (error) {
      logger.error("Cloudflare API request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        endpoint,
      });
      throw error;
    }
  }

  async createSubdomain(subdomain: string, target: string): Promise<string> {
    const fullSubdomain = `${subdomain}.${this.baseDomain}`;

    // Ensure all existing records are deleted before creating
    // This is critical to prevent "already exists" errors
    await this.ensureRecordsDeleted(fullSubdomain, ["CNAME", "A", "AAAA"]);

    // Wait a bit more to ensure Cloudflare has fully processed the deletions
    // This helps with eventual consistency issues
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Use idempotent creation: check if record exists, update if needed, create if missing
    // The method handles race conditions and retries automatically
    return await this.createOrUpdateDnsRecord(
      fullSubdomain,
      "CNAME",
      target,
      true, // proxied
      1, // ttl
    );
  }

  async createCustomDomainRecord(
    domain: string,
    target: string,
  ): Promise<string> {
    // Ensure all existing records are deleted before creating
    await this.ensureRecordsDeleted(domain, ["CNAME", "A", "AAAA"]);

    // Use idempotent creation: check if record exists, update if needed, create if missing
    await this.createOrUpdateDnsRecord(
      domain,
      "CNAME",
      target,
      true, // proxied
      1, // ttl
    );

    return domain;
  }

  async deleteDnsRecord(recordId: string): Promise<void> {
    const endpoint = `/zones/${this.zoneId}/dns_records/${recordId}`;
    const response = await this.makeRequest<{ id: string }>(
      "DELETE",
      endpoint,
    );

    if (!response.success) {
      const errors = response.errors || [];
      throw new Error(
        `Failed to delete DNS record: ${errors.map((e) => e.message).join(", ")}`,
      );
    }

    logger.info("DNS record deleted successfully", { recordId });
  }

  async listDnsRecords(
    name?: string,
    type?: string,
  ): Promise<Array<{ id: string; name: string; type: string; content: string }>> {
    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (type) params.append("type", type);

    const endpoint = `/zones/${this.zoneId}/dns_records${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await this.makeRequest<Array<{
      id: string;
      name: string;
      type: string;
      content: string;
    }>>("GET", endpoint);

    if (!response.success) {
      const errors = response.errors || [];
      throw new Error(
        `Failed to list DNS records: ${errors.map((e) => e.message).join(", ")}`,
      );
    }

    return response.result;
  }

  /**
   * Public method to delete all DNS records for a given subdomain/domain.
   * This is used during site deletion to ensure complete cleanup.
   * Uses retry logic with exponential backoff to handle Cloudflare's eventual consistency.
   * Throws if records cannot be deleted after all retries.
   * 
   * @param name - The full subdomain or domain name (e.g., "example.financely.app")
   * @param types - Array of record types to delete (e.g., ["CNAME", "A", "AAAA"])
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @throws Error if records cannot be deleted after all retries
   */
  async deleteAllDnsRecords(
    name: string,
    types: string[],
    maxRetries = 3,
  ): Promise<void> {
    return this.ensureRecordsDeleted(name, types, maxRetries);
  }

  /**
   * Ensures all DNS records matching the name and types are deleted.
   * Uses retry logic with exponential backoff to handle Cloudflare's eventual consistency.
   * Throws if records cannot be deleted after all retries.
   */
  private async ensureRecordsDeleted(
    name: string,
    types: string[],
    maxRetries = 3,
  ): Promise<void> {
    const normalizedName = name.toLowerCase();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info("Checking for existing DNS records to delete", {
        name,
          types,
          attempt,
      });

        // List all DNS records and filter client-side for exact match
      // This ensures we find records even if Cloudflare's name filter doesn't work as expected
      const allRecords = await this.listDnsRecords();
      
      // Filter for exact name match (case-insensitive)
      const matchingRecords = allRecords.filter(
          (record) => record.name.toLowerCase() === normalizedName,
      );

      // Further filter by type if specified
      const filteredRecords =
        types && types.length > 0
          ? matchingRecords.filter((record) => types.includes(record.type))
          : matchingRecords;

      if (filteredRecords.length === 0) {
        logger.info("No existing DNS records found to delete", { name });
        return;
      }

      logger.info("Found existing DNS records to delete", {
        name,
        count: filteredRecords.length,
          attempt,
        records: filteredRecords.map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
        })),
      });

      // Delete all matching records
        const deleteErrors: Array<{ recordId: string; error: string }> = [];
      for (const record of filteredRecords) {
        try {
          await this.deleteDnsRecord(record.id);
          logger.info("Deleted existing Cloudflare DNS record", {
            name,
            recordId: record.id,
            recordType: record.type,
            recordName: record.name,
          });
        } catch (deleteError) {
            const errorMessage =
              deleteError instanceof Error
                ? deleteError.message
                : "Unknown error";
            deleteErrors.push({
              recordId: record.id,
              error: errorMessage,
          });
            logger.error("Failed to delete existing Cloudflare DNS record", {
              name,
              recordId: record.id,
              recordType: record.type,
              error: errorMessage,
            });
        }
      }

        // If all deletions failed, throw
        if (deleteErrors.length === filteredRecords.length) {
          throw new Error(
            `Failed to delete any DNS records: ${deleteErrors.map((e) => `${e.recordId}: ${e.error}`).join(", ")}`,
          );
        }

        // Wait for Cloudflare to process deletions (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Verify deletion by checking again
      const verifyRecords = await this.listDnsRecords();
      const remainingRecords = verifyRecords.filter(
        (record) =>
            record.name.toLowerCase() === normalizedName &&
            (!types || types.length === 0 || types.includes(record.type)),
      );

        if (remainingRecords.length === 0) {
          logger.info("All DNS records successfully deleted", { name, attempt });
          return;
        }

        // If this is the last attempt, throw error
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to delete all DNS records after ${maxRetries} attempts. Remaining records: ${remainingRecords.map((r) => `${r.type}:${r.name} (${r.id})`).join(", ")}`,
          );
        }

        logger.warn("Some DNS records still exist after deletion attempt, retrying", {
          name,
          remainingCount: remainingRecords.length,
          attempt,
          maxRetries,
          remainingRecords: remainingRecords.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
          })),
        });
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error("Failed to delete existing Cloudflare DNS records after all retries", {
            name,
            types,
            attempt,
            maxRetries,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          throw error;
        }
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Idempotent DNS record creation/update.
   * Checks if a record exists with the same name and type.
   * If it exists and matches, returns the existing record URL.
   * If it exists but doesn't match, updates it.
   * If it doesn't exist, creates it.
   * Handles race conditions and Cloudflare's eventual consistency.
   */
  private async createOrUpdateDnsRecord(
    name: string,
    type: "CNAME" | "A",
    content: string,
    proxied: boolean,
    ttl: number,
    retryCount = 0,
  ): Promise<string> {
    const normalizedName = name.toLowerCase();
    const maxRetries = 3;

    // Wait a bit before checking to allow Cloudflare's eventual consistency to catch up
    if (retryCount > 0) {
      const waitTime = Math.min(500 * retryCount, 2000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    // Check if a record already exists - list all records and filter client-side
    // This is more reliable than using Cloudflare's name filter
    const allRecords = await this.listDnsRecords();
    const existingRecord = allRecords.find(
      (record) =>
        record.name.toLowerCase() === normalizedName && record.type === type,
    );

    const record: DnsRecord = {
      type,
      name,
      content,
      proxied,
      ttl,
    };

    if (existingRecord) {
      // Record exists - check if it matches
      if (existingRecord.content === content) {
        logger.info("DNS record already exists and matches, skipping creation", {
          name,
          type,
          recordId: existingRecord.id,
          content: existingRecord.content,
        });
        return `https://${name}`;
      }

      // Record exists but doesn't match - update it
      logger.info("DNS record exists but doesn't match, updating", {
        name,
        type,
        recordId: existingRecord.id,
        oldContent: existingRecord.content,
        newContent: content,
      });

      const endpoint = `/zones/${this.zoneId}/dns_records/${existingRecord.id}`;
      const response = await this.makeRequest<{ id: string }>(
        "PUT",
        endpoint,
        record,
      );

      if (!response.success) {
        const errors = response.errors || [];
        throw new Error(
          `Failed to update DNS record: ${errors.map((e) => e.message).join(", ")}`,
        );
      }

      logger.info("DNS record updated successfully", {
        name,
        type,
        recordId: response.result.id,
      });

      return `https://${name}`;
    }

    // Record doesn't exist - try to create it
    logger.info("Creating new DNS record", { name, type, content, retryCount });

    const endpoint = `/zones/${this.zoneId}/dns_records`;
    let response: CloudflareApiResponse<{ id: string }>;
    
    try {
      response = await this.makeRequest<{ id: string }>(
        "POST",
        endpoint,
        record,
      );
    } catch (error) {
      // Check if error is "record already exists" - this can happen due to race conditions
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        (errorMessage.includes("already exists") ||
          errorMessage.includes("duplicate") ||
          errorMessage.includes("81053")) && // Cloudflare error code for duplicate record
        retryCount < maxRetries
      ) {
        logger.warn("DNS record creation failed due to race condition, retrying", {
          name,
          type,
          error: errorMessage,
          retryCount,
          maxRetries,
      });
        // Retry by checking again (with delay for eventual consistency)
        return await this.createOrUpdateDnsRecord(
          name,
          type,
          content,
          proxied,
          ttl,
          retryCount + 1,
        );
      }
      throw error;
    }

    if (!response.success) {
      const errors = response.errors || [];
      const errorMessage = errors.map((e) => e.message).join(", ");
      
      // Check if error is "record already exists" - retry if we haven't exceeded max retries
      if (
        (errorMessage.includes("already exists") ||
          errorMessage.includes("duplicate") ||
          errors.some((e) => e.code === 81053)) && // Cloudflare error code for duplicate record
        retryCount < maxRetries
      ) {
        logger.warn("DNS record creation failed due to race condition, retrying", {
          name,
          type,
          error: errorMessage,
          retryCount,
          maxRetries,
        });
        // Retry by checking again (with delay for eventual consistency)
        return await this.createOrUpdateDnsRecord(
          name,
          type,
          content,
          proxied,
          ttl,
          retryCount + 1,
        );
      }
      throw new Error(`Failed to create DNS record: ${errorMessage}`);
    }

    logger.info("DNS record created successfully", {
      name,
      type,
      recordId: response.result.id,
    });

    return `https://${name}`;
  }

  /**
   * Create or update a Cloudflare Workers route for a custom domain
   * Reference: https://developers.cloudflare.com/api/operations/worker-routes-create-route
   */
  async createWorkerRoute(
    pattern: string, // e.g., "bloomora.serveirc.com/*"
    script: string, // e.g., "financely-sites-worker"
  ): Promise<void> {
    if (!this.accountId) {
      throw new Error("Account ID is required for creating Worker routes");
    }

    // First, check if route already exists
    const existingRoutes = await this.listWorkerRoutes();
    const existingRoute = existingRoutes.find(
      (route) => route.pattern === pattern && route.script === script,
    );

    if (existingRoute) {
      logger.info("Worker route already exists", {
        pattern,
        script,
        routeId: existingRoute.id,
      });
      return;
    }

    // Create new route
    const endpoint = `/accounts/${this.accountId}/workers/routes`;
    const body = {
      pattern,
      script,
    };

    try {
      const response = await this.makeRequest<{ id: string }>("POST", endpoint, body);
      logger.info("Worker route created successfully", {
        pattern,
        script,
        routeId: response.result.id,
      });
    } catch (error) {
      logger.error("Failed to create Worker route", {
        pattern,
        script,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * List all Worker routes for the account
   */
  private async listWorkerRoutes(): Promise<Array<{ id: string; pattern: string; script: string }>> {
    if (!this.accountId) {
      throw new Error("Account ID is required for listing Worker routes");
    }

    const endpoint = `/accounts/${this.accountId}/workers/routes`;
    try {
      const response = await this.makeRequest<Array<{ id: string; pattern: string; script: string }>>(
        "GET",
        endpoint,
      );
      return response.result || [];
    } catch (error) {
      logger.error("Failed to list Worker routes", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Delete a Worker route
   */
  async deleteWorkerRoute(pattern: string): Promise<void> {
    if (!this.accountId) {
      throw new Error("Account ID is required for deleting Worker routes");
    }

    const routes = await this.listWorkerRoutes();
    const route = routes.find((r) => r.pattern === pattern);

    if (!route) {
      logger.info("Worker route not found, nothing to delete", { pattern });
      return;
    }

    const endpoint = `/accounts/${this.accountId}/workers/routes/${route.id}`;
    try {
      await this.makeRequest("DELETE", endpoint);
      logger.info("Worker route deleted successfully", {
        pattern,
        routeId: route.id,
      });
    } catch (error) {
      logger.error("Failed to delete Worker route", {
        pattern,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Add a custom hostname for Workers (required for SSL on external domains)
   * Reference: https://developers.cloudflare.com/api/operations/workers-custom-domains-create-custom-hostname
   */
  async addCustomHostname(
    hostname: string, // e.g., "bloomora.serveirc.com"
    workerName: string, // e.g., "financely-sites-worker"
  ): Promise<void> {
    if (!this.accountId) {
      throw new Error("Account ID is required for adding custom hostnames");
    }

    // Check if custom hostname already exists
    const existingHostnames = await this.listCustomHostnames(workerName);
    const existing = existingHostnames.find((h) => h.hostname === hostname);

    if (existing) {
      logger.info("Custom hostname already exists", {
        hostname,
        hostnameId: existing.id,
        status: existing.status,
      });
      return;
    }

    // Add custom hostname
    // Note: For Workers, custom domains are added at the account level, not service level
    // The endpoint format may vary - trying the account-level endpoint first
    const endpoint = `/accounts/${this.accountId}/workers/custom-domains`;
    const body = {
      hostname,
      service: workerName,
    };

    try {
      const response = await this.makeRequest<{ id: string; hostname: string; status: string }>(
        "POST",
        endpoint,
        body,
      );
      logger.info("Custom hostname added successfully", {
        hostname,
        hostnameId: response.result.id,
        status: response.result.status,
      });
    } catch (error) {
      logger.error("Failed to add custom hostname", {
        hostname,
        workerName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * List custom hostnames for a Worker
   */
  private async listCustomHostnames(workerName: string): Promise<Array<{ id: string; hostname: string; status: string }>> {
    if (!this.accountId) {
      throw new Error("Account ID is required for listing custom hostnames");
    }

    // List all custom hostnames at account level, then filter by service
    const endpoint = `/accounts/${this.accountId}/workers/custom-domains`;
    try {
      const response = await this.makeRequest<Array<{ id: string; hostname: string; status: string; service?: string }>>(
        "GET",
        endpoint,
      );
      // Filter by service if provided, otherwise return all
      const allHostnames = response.result || [];
      return allHostnames.filter((h) => !workerName || h.service === workerName).map((h) => ({
        id: h.id,
        hostname: h.hostname,
        status: h.status,
      }));
    } catch (error) {
      logger.error("Failed to list custom hostnames", {
        workerName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Delete a custom hostname
   */
  async deleteCustomHostname(hostname: string, workerName: string): Promise<void> {
    if (!this.accountId) {
      throw new Error("Account ID is required for deleting custom hostnames");
    }

    const hostnames = await this.listCustomHostnames(workerName);
    const hostnameRecord = hostnames.find((h) => h.hostname === hostname);

    if (!hostnameRecord) {
      logger.info("Custom hostname not found, nothing to delete", { hostname });
      return;
    }

    const endpoint = `/accounts/${this.accountId}/workers/custom-domains/${hostnameRecord.id}`;
    try {
      await this.makeRequest("DELETE", endpoint);
      logger.info("Custom hostname deleted successfully", {
        hostname,
        hostnameId: hostnameRecord.id,
      });
    } catch (error) {
      logger.error("Failed to delete custom hostname", {
        hostname,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

