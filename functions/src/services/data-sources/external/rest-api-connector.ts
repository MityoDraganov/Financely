import { ExternalConnectorBase } from "./external-connector-base";
import { DataContextValue } from "../../../core/entities/data-context";

export class RestApiConnector extends ExternalConnectorBase {
  async fetch(): Promise<Record<string, DataContextValue>> {
    const url = this.buildUrl();
    const method = this.config.query ? "POST" : "GET";

    const rawData = await this.retryWithBackoff(async () => {
      return await this.makeRequest(url, {
        method,
        body: this.config.query ? { query: this.config.query } : undefined,
      });
    });

    return this.normalizeData(rawData, this.config.schemaMapping);
  }

  private buildUrl(): string {
    let url = this.config.endpoint;

    if (this.config.query && this.config.type === "rest-api") {
      const params = new URLSearchParams();
      try {
        const queryObj = typeof this.config.query === "string" 
          ? JSON.parse(this.config.query) 
          : this.config.query;
        Object.entries(queryObj).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        const queryString = params.toString();
        if (queryString) {
          url += (url.includes("?") ? "&" : "?") + queryString;
        }
      } catch {
      }
    }

    return url;
  }
}

