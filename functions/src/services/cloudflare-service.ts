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

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Cloudflare API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(
          `Cloudflare API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as CloudflareApiResponse<T>;
      return data;
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
}

