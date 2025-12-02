import { logger } from "firebase-functions";
import { StepDefinition, ActionExecutor } from "../core/entities/workflow-execution";
import { validateAndNormalizeUrl, isUrlValidationError } from "../utils/url-validator";

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

/**
 * Get nested value from context using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    return current && typeof current === "object" ? 
      (current as Record<string, unknown>)[key] : undefined;
  }, obj);
}

/**
 * Resolve template variables in a string
 */
function resolveTemplateString(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = getNestedValue(context, key);
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Resolve template variables in an object
 */
function resolveTemplateObject(obj: unknown, context: Record<string, unknown>): unknown {
  if (typeof obj === "string") {
    return resolveTemplateString(obj, context);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => resolveTemplateObject(item, context));
  }
  
  if (obj && typeof obj === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveTemplateObject(value, context);
    }
    return resolved;
  }
  
  return obj;
}

/**
 * Resolve template variables in configuration
 */
function resolveTemplateVariables(
  config: HttpRequestConfig, 
  context: Record<string, unknown>
): HttpRequestConfig {
  const resolved = { ...config };

  // Resolve URL template variables
  resolved.url = resolveTemplateString(config.url, context);

  // Resolve headers template variables
  if (config.headers) {
    resolved.headers = {};
    for (const [key, value] of Object.entries(config.headers)) {
      resolved.headers[key] = resolveTemplateString(value, context);
    }
  }

  // Resolve body template variables
  if (config.body) {
    resolved.body = resolveTemplateObject(config.body, context) as Record<string, unknown>;
  }

  // Resolve auth template variables
  if (config.auth) {
    resolved.auth = { ...config.auth };
    if (config.auth.token) {
      resolved.auth.token = resolveTemplateString(config.auth.token, context);
    }
    if (config.auth.username) {
      resolved.auth.username = resolveTemplateString(config.auth.username, context);
    }
    if (config.auth.password) {
      resolved.auth.password = resolveTemplateString(config.auth.password, context);
    }
  }

  return resolved;
}

/**
 * Prepare headers with authentication
 */
function prepareHeaders(config: HttpRequestConfig): Record<string, string> {
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

/**
 * Execute an HTTP request action
 */
async function executeHttpRequest(
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
    const resolvedConfig = resolveTemplateVariables(config, context);

    // Validate and normalize URL to prevent SSRF attacks
    let validatedUrl: string;
    try {
      validatedUrl = await validateAndNormalizeUrl(resolvedConfig.url);
    } catch (error) {
      if (isUrlValidationError(error)) {
        logger.warn("HTTP request blocked by URL validation", {
          runId,
          stepId: step.id,
          url: resolvedConfig.url,
          error: error.message,
        });
        throw error;
      }
      // Re-throw unexpected errors
      throw error;
    }

    // Prepare headers
    const headers = prepareHeaders(resolvedConfig);

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

    // Record start time for duration tracking
    const startTime = Date.now();
    context._httpRequestStartTime = startTime;
    
    // Make the HTTP request using the validated URL
    const response = await fetch(validatedUrl, requestOptions);
    
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
      url: validatedUrl,
      method: resolvedConfig.method,
    };

    logger.info("HTTP request completed successfully", { 
      runId, 
      stepId: step.id, 
      status: response.status 
    });

    // Record usage event
    try {
      const orgId = context.orgId as string || context.tenantId as string;
      if (orgId) {
        const startTime = context._httpRequestStartTime as number;
        const durationMs = startTime ? Date.now() - startTime : undefined;
        
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId,
          userId: null, // Workflow actions are system-triggered
          featureId: USAGE_FEATURES.WORKFLOW_ACTION_HTTP_REQUEST,
          metadata: {
            context: "automation",
            durationMs,
            sizeBytes: typeof responseData === "string" ? responseData.length : undefined,
          },
        });
      }
    } catch (usageError) {
      logger.warn("Failed to record usage event for HTTP request", {
        error: usageError instanceof Error ? usageError.message : String(usageError),
      });
    }

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
 * HTTP Request Executor - implements ActionExecutor interface
 */
export const HttpRequestExecutor: ActionExecutor = {
  type: "http_request",
  execute: executeHttpRequest,
};
