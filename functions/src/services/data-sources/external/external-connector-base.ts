import { logger } from "firebase-functions";
import { ExternalSourceConfig, AuthConfig } from "../../../core/entities/external-source-config";
import { DataContextValue } from "../../../core/entities/data-context";

export interface ExternalConnectorResult {
  data: Record<string, DataContextValue>;
  cached: boolean;
  timestamp: string;
}

export abstract class ExternalConnectorBase {
  protected config: ExternalSourceConfig;

  constructor(config: ExternalSourceConfig) {
    this.config = config;
  }

  abstract fetch(): Promise<Record<string, DataContextValue>>;

  protected async makeRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Promise<unknown> {
    const headers = this.buildHeaders(options.headers);
    const { method = "GET", body } = options;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      logger.error(`External connector request failed`, {
        sourceId: this.config.id,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  protected buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.headers || {}),
      ...customHeaders,
    };

    const authHeaders = this.buildAuthHeaders(this.config.authConfig);
    Object.assign(headers, authHeaders);

    return headers;
  }

  protected buildAuthHeaders(authConfig: AuthConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (authConfig.type) {
      case "none":
        // No authentication headers needed
        break;
      case "api-key":
        if (authConfig.apiKeyHeader && authConfig.apiKeyValue) {
          headers[authConfig.apiKeyHeader] = authConfig.apiKeyValue;
        }
        break;
      case "basic":
        if (authConfig.username && authConfig.password) {
          const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString("base64");
          headers.Authorization = `Basic ${credentials}`;
        }
        break;
      case "bearer":
        if (authConfig.token) {
          headers.Authorization = `Bearer ${authConfig.token}`;
        }
        break;
      case "oauth2":
        if (authConfig.token) {
          headers.Authorization = `Bearer ${authConfig.token}`;
        }
        break;
    }

    return headers;
  }

  protected normalizeData(
    rawData: unknown,
    schemaMapping?: Record<string, { path: string; transform?: string }>
  ): Record<string, DataContextValue> {
    if (!schemaMapping) {
      return this.defaultNormalize(rawData);
    }

    const normalized: Record<string, DataContextValue> = {};

    for (const [key, mapping] of Object.entries(schemaMapping)) {
      const value = this.getNestedValue(rawData, mapping.path);
      if (value !== undefined) {
        normalized[key] = this.applyTransform(value, mapping.transform);
      }
    }

    return normalized;
  }

  protected defaultNormalize(rawData: unknown): Record<string, DataContextValue> {
    if (typeof rawData === "object" && rawData !== null && !Array.isArray(rawData)) {
      return rawData as Record<string, DataContextValue>;
    }
    return { data: rawData as DataContextValue };
  }

  protected getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object" && !Array.isArray(current) && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  protected applyTransform(value: unknown, transform?: string): DataContextValue {
    if (!transform) {
      return value as DataContextValue;
    }

    switch (transform) {
      case "string":
        return String(value);
      case "number":
        return typeof value === "number" ? value : parseFloat(String(value)) || 0;
      case "boolean":
        return Boolean(value);
      default:
        return value as DataContextValue;
    }
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Retry failed");
  }
}

