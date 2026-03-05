import { logger } from "firebase-functions";
import { DataContext } from "../core/entities/data-context";
import { resolveBinding } from "./binding-resolver";

/**
 * Centralized email template processing utility
 * Handles placeholder replacement, HTML escaping, and data binding
 * 
 * This utility is designed to be reusable across all email template use cases:
 * - Invoice emails
 * - Workflow emails
 * - Proposal emails
 * - Lead emails
 * - Contact emails
 * - Any other email template scenarios
 * 
 * @example
 * ```typescript
 * import { processEmailTemplate } from "../utils/email-template-processor";
 * 
 * const template = {
 *   html: "<h1>Hello {{customerName}}</h1>",
 *   subject: "Invoice for {{customerName}}",
 *   preheader: "Invoice #{{invoiceNumber}}"
 * };
 * 
 * const mappings = {
 *   customerName: "customer.name",
 *   invoiceNumber: "invoiceNumber"
 * };
 * 
 * const data = {
 *   customer: { name: "John Doe" },
 *   invoiceNumber: "INV-001"
 * };
 * 
 * const processed = processEmailTemplate(template, mappings, data);
 * // Result:
 * // {
 * //   html: "<h1>Hello John Doe</h1>",
 * //   subject: "Invoice for John Doe",
 * //   preheader: "Invoice #INV-001"
 * // }
 * ```
 */

/**
 * Generic data value type for template processing
 * Using unknown for the object type to avoid circular reference issues while maintaining type safety
 */
export type TemplateDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateDataValue[]
  | Record<string, unknown>;

/**
 * Result of processing an email template
 */
export interface ProcessedEmailTemplate {
  html: string;
  subject: string;
  preheader: string;
}

/**
 * Configuration for processing email templates
 */
export interface EmailTemplateProcessorConfig {
  /**
   * Whether to escape HTML entities in values (default: true)
   * Set to false if you want to allow HTML in placeholder values
   */
  escapeHtml?: boolean;
  
  /**
   * Whether to log processing details (default: false)
   */
  enableLogging?: boolean;
}

/**
 * Escape HTML entities to prevent breaking HTML structure
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const toKebabCaseCssProperty = (property: string): string =>
  property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/**
 * Normalize inline style declarations from camelCase (React-style) to kebab-case (CSS),
 * so legacy templates render consistently in email clients.
 */
export function normalizeInlineStylePropertyNames(html: string): string {
  if (!html || !html.includes("style=")) return html;

  const normalizeStyleValue = (styleValue: string): string =>
    styleValue.replace(/(^|;)\s*([a-z][a-zA-Z0-9]*)\s*:/g, (full, prefix: string, prop: string) => {
      if (prop.startsWith("--") || prop.includes("-")) {
        return `${prefix}${prop}:`;
      }
      return `${prefix}${toKebabCaseCssProperty(prop)}:`;
    });

  return html.replace(/style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote: string, styleValue: string) => {
    const normalized = normalizeStyleValue(styleValue);
    return `style=${quote}${normalized}${quote}`;
  });
}

/**
 * Get a value from data using a binding path (supports dot notation and array indexing)
 * Examples:
 *   - "customer.name" -> data.customer.name
 *   - "items[0].description" -> data.items[0].description
 *   - "items[0]" -> data.items[0]
 * 
 * @deprecated Use resolveBinding with DataContext instead
 */
export function getBindingValue(
  data: Record<string, TemplateDataValue | unknown>,
  binding: string
): TemplateDataValue | undefined {
  const parts: string[] = [];
  let currentPart = "";
  let inBrackets = false;
  
  for (let i = 0; i < binding.length; i++) {
    const char = binding[i];
    if (char === "[") {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
      inBrackets = true;
      currentPart += char;
    } else if (char === "]") {
      currentPart += char;
      parts.push(currentPart);
      currentPart = "";
      inBrackets = false;
    } else if (char === "." && !inBrackets) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
    } else {
      currentPart += char;
    }
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  let current: TemplateDataValue | unknown = data;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    
    if (part.startsWith("[") && part.endsWith("]")) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      const index = parseInt(part.slice(1, -1), 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      if (Array.isArray(current) || !(part in current)) {
        return undefined;
      }
      current = (current as Record<string, TemplateDataValue | unknown>)[part];
    }
  }

  if (
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean" ||
    current === null ||
    current === undefined ||
    Array.isArray(current) ||
    (typeof current === "object" && current !== null)
  ) {
    return current as TemplateDataValue;
  }

  return undefined;
}

/**
 * Get a value from DataContext using a binding path
 */
export function getBindingValueFromContext(
  context: DataContext,
  binding: string
): TemplateDataValue | undefined {
  const value = resolveBinding(context, binding);
  return value === null ? undefined : value;
}

/**
 * Format a value for display in email
 * HTML entities are escaped by default to preserve the email template structure
 * 
 * For objects, attempts to extract a human-readable representation:
 * - Tries common fields like: name, title, description, label, text, value
 * - Falls back to JSON.stringify if no common field is found
 * - Logs a warning for objects to help debug mapping issues
 */
export function formatValueForEmail(
  value: TemplateDataValue | undefined,
  escapeHtmlEntities: boolean = true
): string {
  if (value === undefined || value === null) {
    return "";
  }
  
  let formatted: string = "";
  
  if (typeof value === "string") {
    formatted = value;
  } else if (typeof value === "number") {
    formatted = value.toString();
  } else if (typeof value === "boolean") {
    formatted = value ? "Yes" : "No";
  } else if (Array.isArray(value)) {
    // For arrays, format each item and join with commas
    formatted = value.map((item) => {
      if (typeof item === "object" && item !== null) {
        // Try to extract a readable value from object items
        const obj = item as Record<string, unknown>;
        const readableFields = ["name", "title", "description", "label", "text", "value", "content"];
        for (const field of readableFields) {
          if (field in obj && typeof obj[field] === "string") {
            return obj[field] as string;
          }
        }
        // Fallback to JSON for complex objects
        return JSON.stringify(item);
      }
      return String(item);
    }).join(", ");
  } else if (typeof value === "object") {
    // For objects, try to extract a human-readable field
    const obj = value as Record<string, unknown>;
    
    // Try common readable fields in order of preference
    const readableFields = ["name", "title", "description", "label", "text", "value", "content", "message"];
    for (const field of readableFields) {
      if (field in obj) {
        const fieldValue = obj[field];
        if (fieldValue != null && typeof fieldValue === "string") {
          formatted = fieldValue;
          break;
        } else if (fieldValue != null && typeof fieldValue === "number") {
          formatted = fieldValue.toString();
          break;
        }
      }
    }
    
    // If no readable field found, log warning and return empty string
    // This helps identify mapping issues where objects are mapped directly
    if (!formatted) {
      logger.warn("Email template placeholder mapped to object without readable field", {
        objectKeys: Object.keys(obj),
        suggestion: "Map to a specific field like 'items[0].description' instead of the entire object",
      });
      formatted = ""; // Return empty string instead of JSON to avoid breaking email
    }
  } else {
    formatted = String(value);
  }
  
  // Escape HTML entities to prevent breaking the email template HTML structure
  return escapeHtmlEntities ? escapeHtml(formatted) : formatted;
}

/**
 * Process an email template by replacing placeholders with data values from DataContext
 * 
 * @param template - The email template with placeholders
 * @param mappings - Map of placeholder keys to data binding paths
 * @param context - The DataContext to extract values from
 * @param config - Optional configuration
 * @returns Processed template with all placeholders replaced
 */
export function processEmailTemplateFromContext(
  template: {
    html: string;
    subject: string;
    preheader?: string;
  },
  mappings: Record<string, string>,
  context: DataContext,
  config: EmailTemplateProcessorConfig = {}
): ProcessedEmailTemplate {
  const {
    escapeHtml: shouldEscapeHtml = true,
    enableLogging = false,
  } = config;

  let processedHtml = normalizeInlineStylePropertyNames(template.html);
  let processedSubject = template.subject;
  let processedPreheader = template.preheader || "";

  if (enableLogging) {
    logger.info("Processing email template from DataContext", {
      htmlLength: processedHtml.length,
      mappingsCount: Object.keys(mappings).length,
      mappings: Object.keys(mappings),
    });
  }

  for (const [placeholderKey, bindingPath] of Object.entries(mappings)) {
    const placeholderPattern = new RegExp(`\\{\\{${escapeRegex(placeholderKey)}\\}\\}`, "g");
    
    let resolvedBindingPath = bindingPath;
    if (bindingPath.includes("[*]")) {
      resolvedBindingPath = bindingPath.replace("[*]", "[0]");
    }
    
    const rawValue = getBindingValueFromContext(context, resolvedBindingPath);
    const value = formatValueForEmail(rawValue, shouldEscapeHtml);
    
    processedHtml = processedHtml.replace(placeholderPattern, value);
    processedSubject = processedSubject.replace(placeholderPattern, value);
    processedPreheader = processedPreheader.replace(placeholderPattern, value);
  }

  return {
    html: processedHtml,
    subject: processedSubject,
    preheader: processedPreheader,
  };
}

/**
 * Process an email template by replacing placeholders with data values
 * 
 * @param template - The email template with placeholders
 * @param mappings - Map of placeholder keys to data binding paths
 * @param data - The data object to extract values from
 * @param config - Optional configuration
 * @returns Processed template with all placeholders replaced
 * 
 * @deprecated Use processEmailTemplateFromContext with DataContext instead
 */
export function processEmailTemplate(
  template: {
    html: string;
    subject: string;
    preheader?: string;
  },
  mappings: Record<string, string>,
  data: Record<string, TemplateDataValue | unknown>,
  config: EmailTemplateProcessorConfig = {}
): ProcessedEmailTemplate {
  const {
    escapeHtml: shouldEscapeHtml = true,
    enableLogging = false,
  } = config;

  let processedHtml = normalizeInlineStylePropertyNames(template.html);
  let processedSubject = template.subject;
  let processedPreheader = template.preheader || "";

  if (enableLogging) {
    logger.info("Processing email template", {
      htmlLength: processedHtml.length,
      hasDoctype: processedHtml.includes("<!DOCTYPE"),
      hasHtmlTag: processedHtml.includes("<html"),
      hasHeadTag: processedHtml.includes("<head"),
      hasBodyTag: processedHtml.includes("<body"),
      hasStyleTag: processedHtml.includes("<style"),
      mappingsCount: Object.keys(mappings).length,
      mappings: Object.keys(mappings),
      mappingsDetails: Object.entries(mappings).map(([key, value]) => ({
        placeholderKey: key,
        bindingPath: value,
      })),
      templateHtmlPreview: processedHtml.substring(0, 500),
    });
  }

  const normalizePath = (path: string) =>
    path.includes("[*]") ? path.replace(/\[\*\]/g, "[0]") : path;

  const getScopedValue = (
    token: string,
    scope: Record<string, unknown>,
  ): TemplateDataValue | undefined => {
    if (!token) return undefined;
    if (token === "@index") {
      const indexValue = scope["@index"];
      if (typeof indexValue === "number") return indexValue;
      return undefined;
    }

    const tokenParts = token.split(".");
    const scopeKey = tokenParts[0];
    const scopedRoot = scope[scopeKey];

    if (scopedRoot !== undefined) {
      const remaining = tokenParts.slice(1).join(".");
      if (!remaining) {
        return scopedRoot as TemplateDataValue;
      }
      return getBindingValue(
        { [scopeKey]: scopedRoot } as Record<string, TemplateDataValue | unknown>,
        `${scopeKey}.${remaining}`,
      );
    }

    return undefined;
  };

  const resolveTokenValue = (
    token: string,
    scope: Record<string, unknown>,
  ): TemplateDataValue | undefined => {
    const trimmedToken = token.trim();
    if (!trimmedToken) return undefined;

    const scopedValue = getScopedValue(trimmedToken, scope);
    if (scopedValue !== undefined) {
      return scopedValue;
    }

    const mappedPath = mappings[trimmedToken];
    if (mappedPath) {
      return getBindingValue(data, normalizePath(mappedPath));
    }

    // Support direct path-first tokens (e.g. {{email.invoice.number}})
    const directPathValue = getBindingValue(data, normalizePath(trimmedToken));
    if (directPathValue !== undefined) {
      return directPathValue;
    }

    // Inside loops allow shorthand row fields like {{description}}
    const scopeValues = Object.values(scope).filter(
      (value) => value && typeof value === "object" && !Array.isArray(value),
    );
    for (const value of scopeValues) {
      const rowCandidate = (value as Record<string, unknown>)[trimmedToken];
      if (rowCandidate !== undefined) {
        return rowCandidate as TemplateDataValue;
      }
    }

    return undefined;
  };

  const renderTokensInText = (
    input: string,
    scope: Record<string, unknown> = {},
    preserveUnresolved: boolean = true,
  ): string =>
    input.replace(/{{\s*(?![#/])([^{}]+?)\s*}}/g, (match, rawToken: string) => {
      const token = rawToken.trim();
      const value = resolveTokenValue(token, scope);
      if (value === undefined) {
        return preserveUnresolved ? match : "";
      }
      return formatValueForEmail(value, shouldEscapeHtml);
    });

  const renderLoops = (
    input: string,
    scope: Record<string, unknown> = {},
  ): string =>
    input.replace(
      /{{#each\s+([^\s}]+)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\s*}}([\s\S]*?){{\/each}}/g,
      (_match, rawPath: string, alias: string, body: string) => {
        const loopPath = rawPath.trim();
        const resolvedLoopSource = resolveTokenValue(loopPath, scope);

        if (resolvedLoopSource == null) {
          return "";
        }
        if (!Array.isArray(resolvedLoopSource)) {
          throw new Error(`Invalid loop path "${loopPath}" - expected array`);
        }

        return resolvedLoopSource
          .map((item, index) => {
            const scopedValues: Record<string, unknown> = {
              ...scope,
              [alias]: item,
              "@index": index,
            };
            const loopContent = renderLoops(body, scopedValues);
            return renderTokensInText(loopContent, scopedValues, false);
          })
          .join("");
      },
    );

  const processTemplateText = (input: string): string => {
    const expanded = renderLoops(input);
    if (expanded.includes("{{#each") || expanded.includes("{{/each}}")) {
      throw new Error("Invalid loop syntax in template");
    }
    return renderTokensInText(expanded);
  };

  processedHtml = processTemplateText(processedHtml);
  processedSubject = processTemplateText(processedSubject);
  processedPreheader = processTemplateText(processedPreheader);

  if (enableLogging) {
    logger.info("Email template processed", {
      processedHtmlLength: processedHtml.length,
      processedSubject: processedSubject,
      processedPreheader: processedPreheader,
    });
  }

  return {
    html: processedHtml,
    subject: processedSubject,
    preheader: processedPreheader,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract all placeholder keys from a template string
 * Useful for validation or discovering required mappings
 * 
 * @param template - Template string with placeholders
 * @param pattern - Placeholder pattern (default: /\{\{([^}]+)\}\}/g)
 * @returns Set of placeholder keys found in the template
 */
export function extractPlaceholderKeys(
  template: string,
  pattern: RegExp = /\{\{([^}]+)\}\}/g
): Set<string> {
  const keys = new Set<string>();
  let match;
  
  // Reset regex lastIndex to ensure we start from the beginning
  pattern.lastIndex = 0;
  
  while ((match = pattern.exec(template)) !== null) {
    if (match[1]) {
      keys.add(match[1].trim());
    }
  }
  
  return keys;
}

/**
 * Validate that all placeholders in a template have corresponding mappings
 * 
 * @param template - The email template
 * @param mappings - Map of placeholder keys to data binding paths
 * @returns Array of missing placeholder keys
 */
export function validateTemplateMappings(
  template: {
    html: string;
    subject: string;
    preheader?: string;
  },
  mappings: Record<string, string>
): string[] {
  const allPlaceholders = new Set<string>();
  
  // Extract placeholders from all template parts
  extractPlaceholderKeys(template.html).forEach(key => allPlaceholders.add(key));
  extractPlaceholderKeys(template.subject).forEach(key => allPlaceholders.add(key));
  if (template.preheader) {
    extractPlaceholderKeys(template.preheader).forEach(key => allPlaceholders.add(key));
  }
  
  // Find missing mappings
  const missing: string[] = [];
  for (const placeholder of allPlaceholders) {
    if (!(placeholder in mappings)) {
      missing.push(placeholder);
    }
  }
  
  return missing;
}
