import { logger } from "firebase-functions";
import { StepDefinition } from "../core/entities/workflow-execution";

export interface HttpRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  auth?: {
    type: "bearer" | "basic" | "none";
    token?: string;
    username?: string;
    password?: string;
  };
  timeoutMs?: number;
}

export class HttpRequestExecutor {
  /**
   * Execute an HTTP request action
   */
  async execute(
    step: StepDefinition,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = step.config as unknown as HttpRequestConfig;
    
    try {
      logger.info("Executing HTTP request", { 
        runId, 
        stepId: step.id, 
        url: config.url,
        method: config.method 
      });

      // Resolve template variables in URL and config
      const resolvedConfig = this.resolveTemplateVariables(config, context);

      // Prepare headers
      const headers = this.prepareHeaders(resolvedConfig);

      // Prepare request options
      const requestOptions: RequestInit = {
        method: resolvedConfig.method,
        headers,
        signal: resolvedConfig.timeoutMs ? 
          AbortSignal.timeout(resolvedConfig.timeoutMs) : undefined,
      };

      // Add body for non-GET requests
      if (resolvedConfig.method !== "GET" && resolvedConfig.body) {
        requestOptions.body = JSON.stringify(resolvedConfig.body);
        headers["Content-Type"] = "application/json";
      }

      // Make the HTTP request
      const response = await fetch(resolvedConfig.url, requestOptions);
      
      // Parse response
      const responseText = await response.text();
      let responseData: unknown;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Check if request was successful
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        url: resolvedConfig.url,
        method: resolvedConfig.method,
      };

      logger.info("HTTP request completed successfully", { 
        runId, 
        stepId: step.id, 
        status: response.status 
      });

      return result;

    } catch (error) {
      logger.error("HTTP request failed", { 
        runId, 
        stepId: step.id, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  /**
   * Resolve template variables in configuration
   */
  private resolveTemplateVariables(
    config: HttpRequestConfig, 
    context: Record<string, unknown>
  ): HttpRequestConfig {
    const resolved = { ...config };

    // Resolve URL template variables
    resolved.url = this.resolveTemplateString(config.url, context);

    // Resolve headers template variables
    if (config.headers) {
      resolved.headers = {};
      for (const [key, value] of Object.entries(config.headers)) {
        resolved.headers[key] = this.resolveTemplateString(value, context);
      }
    }

    // Resolve body template variables
    if (config.body) {
      resolved.body = this.resolveTemplateObject(config.body, context) as Record<string, unknown>;
    }

    // Resolve auth template variables
    if (config.auth) {
      resolved.auth = { ...config.auth };
      if (config.auth.token) {
        resolved.auth.token = this.resolveTemplateString(config.auth.token, context);
      }
      if (config.auth.username) {
        resolved.auth.username = this.resolveTemplateString(config.auth.username, context);
      }
      if (config.auth.password) {
        resolved.auth.password = this.resolveTemplateString(config.auth.password, context);
      }
    }

    return resolved;
  }

  /**
   * Resolve template variables in a string
   */
  private resolveTemplateString(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve template variables in an object
   */
  private resolveTemplateObject(obj: unknown, context: Record<string, unknown>): unknown {
    if (typeof obj === "string") {
      return this.resolveTemplateString(obj, context);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveTemplateObject(item, context));
    }
    
    if (obj && typeof obj === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveTemplateObject(value, context);
      }
      return resolved;
    }
    
    return obj;
  }

  /**
   * Get nested value from context using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      return current && typeof current === "object" ? 
        (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  /**
   * Prepare headers with authentication
   */
  private prepareHeaders(config: HttpRequestConfig): Record<string, string> {
    const headers: Record<string, string> = { ...config.headers };

    // Add authentication headers
    if (config.auth) {
      switch (config.auth.type) {
        case "bearer":
          if (config.auth.token) {
            headers["Authorization"] = `Bearer ${config.auth.token}`;
          }
          break;
        case "basic":
          if (config.auth.username && config.auth.password) {
            const credentials = Buffer.from(
              `${config.auth.username}:${config.auth.password}`
            ).toString("base64");
            headers["Authorization"] = `Basic ${credentials}`;
          }
          break;
      }
    }

    return headers;
  }
}
