import { logger } from "firebase-functions";

interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  baseDomain: string;
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
  private readonly apiBaseUrl = "https://api.cloudflare.com/client/v4";

  constructor(config: CloudflareConfig) {
    this.apiToken = config.apiToken;
    this.zoneId = config.zoneId;
    this.baseDomain = config.baseDomain;
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

    // Remove any existing records (CNAME, A, AAAA) for this subdomain
    await this.deleteExistingRecords(fullSubdomain, ["CNAME", "A", "AAAA"]);

    // Create new record
    const record: DnsRecord = {
      type: "CNAME",
      name: fullSubdomain,
      content: target,
      proxied: true,
      ttl: 1,
    };

    const endpoint = `/zones/${this.zoneId}/dns_records`;
    const response = await this.makeRequest<{ id: string }>(
      "POST",
      endpoint,
      record,
    );

    if (!response.success) {
      const errors = response.errors || [];
      throw new Error(
        `Failed to create subdomain: ${errors.map((e) => e.message).join(", ")}`,
      );
    }

    logger.info("Subdomain created successfully", {
      subdomain: fullSubdomain,
      recordId: response.result.id,
    });

    return `https://${fullSubdomain}`;
  }

  async createCustomDomainRecord(
    domain: string,
    target: string,
  ): Promise<string> {
    await this.deleteExistingRecords(domain, ["CNAME", "A", "AAAA"]);

    const record: DnsRecord = {
      type: "CNAME",
      name: domain,
      content: target,
      proxied: true,
      ttl: 1,
    };

    const endpoint = `/zones/${this.zoneId}/dns_records`;
    const response = await this.makeRequest<{ id: string }>(
      "POST",
      endpoint,
      record,
    );

    if (!response.success) {
      const errors = response.errors || [];
      throw new Error(
        `Failed to create custom domain record: ${errors.map((e) => e.message).join(", ")}`,
      );
    }

    logger.info("Custom domain record created successfully", {
      domain,
      recordId: response.result.id,
    });

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

  private async deleteExistingRecords(name: string, types?: string[]): Promise<void> {
    try {
      logger.info("Checking for existing DNS records to delete", {
        name,
        types: types || ["all"],
      });

      // List all DNS records (without name filter) and filter client-side for exact match
      // This ensures we find records even if Cloudflare's name filter doesn't work as expected
      const allRecords = await this.listDnsRecords();
      
      // Filter for exact name match (case-insensitive)
      const matchingRecords = allRecords.filter(
        (record) => record.name.toLowerCase() === name.toLowerCase()
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
        records: filteredRecords.map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
        })),
      });

      // Delete all matching records
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
          logger.error("Failed to delete existing Cloudflare DNS record", {
            name,
            recordId: record.id,
            recordType: record.type,
            error:
              deleteError instanceof Error
                ? deleteError.message
                : "Unknown error",
          });
          // Continue deleting other records even if one fails
        }
      }

      // Wait a bit to ensure Cloudflare has processed the deletions
      // This helps prevent race conditions where we try to create before deletion completes
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify deletion by checking again
      const verifyRecords = await this.listDnsRecords();
      const remainingRecords = verifyRecords.filter(
        (record) =>
          record.name.toLowerCase() === name.toLowerCase() &&
          (!types || types.length === 0 || types.includes(record.type))
      );

      if (remainingRecords.length > 0) {
        logger.warn("Some DNS records still exist after deletion attempt", {
          name,
          remainingCount: remainingRecords.length,
          remainingRecords: remainingRecords.map((r) => ({
            id: r.id,
            type: r.type,
            name: r.name,
          })),
        });
      } else {
        logger.info("All DNS records successfully deleted", { name });
      }
    } catch (error) {
      logger.error("Failed to delete existing Cloudflare DNS records", {
        name,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - we'll try to create anyway and let Cloudflare error if needed
    }
  }
}

