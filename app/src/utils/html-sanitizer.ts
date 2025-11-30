/**
 * HTML Sanitization Utility
 * 
 * This utility provides centralized HTML sanitization using DOMPurify to prevent XSS attacks.
 * All usage of dangerouslySetInnerHTML MUST go through this utility to ensure security.
 * 
 * Security guarantees:
 * - Strips script tags and inline event handlers
 * - Removes JavaScript URLs and dangerous protocols
 * - Preserves safe formatting and layout tags
 * - Configurable strictness levels for different use cases
 */

import DOMPurify from "dompurify";

/**
 * Sanitization mode for different content sources
 */
export type SanitizationMode = 
  | "strict"      // For untrusted user content (email designer, site builder, user input)
  | "moderate"    // For translation strings and CMS content (trusted but may contain HTML)
  | "permissive"; // For known-safe internal content (use with caution)

/**
 * Configuration options for HTML sanitization
 */
export interface SanitizeOptions {
  /**
   * Sanitization mode - determines how strict the sanitization is
   * @default "strict"
   */
  mode?: SanitizationMode;
  
  /**
   * Allow specific HTML tags beyond the default set
   * Only used in strict mode
   */
  allowedTags?: string[];
  
  /**
   * Allow specific HTML attributes beyond the default set
   * Only used in strict mode
   */
  allowedAttributes?: string[];
}

/**
 * Default DOMPurify configuration for strict mode (untrusted content)
 * This is the most restrictive configuration for user-generated or AI-generated content
 */
const STRICT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "u", "b", "i", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "a", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "td", "th",
  ],
  ALLOWED_ATTR: [
    "href", "title", "alt", "class",
    // Note: 'style' is intentionally excluded in strict mode to prevent CSS-based XSS
    // If style is needed, it should be sanitized separately or use moderate mode
    "colspan", "rowspan", "align",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Strip all event handlers and JavaScript
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  // Sanitize URLs to prevent javascript: and data: protocols
  SAFE_FOR_TEMPLATES: false,
  SAFE_FOR_DATA_ATTR: false,
};

/**
 * Default DOMPurify configuration for moderate mode (translation strings, CMS)
 * More permissive than strict but still removes dangerous content
 */
const MODERATE_CONFIG: DOMPurify.Config = {
  ...STRICT_CONFIG,
  ALLOWED_TAGS: [
    ...STRICT_CONFIG.ALLOWED_TAGS!,
    "img", "figure", "figcaption",
    "sub", "sup", "mark", "del", "ins",
    "dl", "dt", "dd",
  ],
  ALLOWED_ATTR: [
    ...STRICT_CONFIG.ALLOWED_ATTR!,
    "src", "width", "height", "loading",
  ],
  // Still forbid scripts and dangerous attributes
  FORBID_TAGS: STRICT_CONFIG.FORBID_TAGS,
  FORBID_ATTR: STRICT_CONFIG.FORBID_ATTR,
};

/**
 * Default DOMPurify configuration for permissive mode (known-safe internal content)
 * Use with extreme caution - only for content you fully control
 */
const PERMISSIVE_CONFIG: DOMPurify.Config = {
  ...MODERATE_CONFIG,
  // Allow more tags but still strip scripts
  FORBID_TAGS: ["script", "iframe", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

/**
 * Sanitize HTML string to prevent XSS attacks
 * 
 * @param html - Raw HTML string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized HTML string safe for use with dangerouslySetInnerHTML
 * 
 * @example
 * ```tsx
 * // For user-generated content (email designer, site builder)
 * const safeHtml = sanitizeHtml(userHtml, { mode: "strict" });
 * <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
 * 
 * // For translation strings
 * const safeHtml = sanitizeHtml(t("key"), { mode: "moderate" });
 * <p dangerouslySetInnerHTML={{ __html: safeHtml }} />
 * ```
 */
export function sanitizeHtml(
  html: string | null | undefined,
  options: SanitizeOptions = {}
): string {
  // Handle null/undefined/empty input
  if (!html || typeof html !== "string") {
    return "";
  }

  const { mode = "strict", allowedTags, allowedAttributes } = options;

  // Select base configuration based on mode
  let config: DOMPurify.Config;
  switch (mode) {
    case "strict":
      config = { ...STRICT_CONFIG };
      break;
    case "moderate":
      config = { ...MODERATE_CONFIG };
      break;
    case "permissive":
      config = { ...PERMISSIVE_CONFIG };
      break;
    default:
      config = { ...STRICT_CONFIG };
  }

  // Merge custom allowed tags/attributes if provided
  if (allowedTags && allowedTags.length > 0) {
    config.ALLOWED_TAGS = [...(config.ALLOWED_TAGS || []), ...allowedTags];
  }

  if (allowedAttributes && allowedAttributes.length > 0) {
    config.ALLOWED_ATTR = [...(config.ALLOWED_ATTR || []), ...allowedAttributes];
  }

  try {
    // Sanitize the HTML
    const sanitized = DOMPurify.sanitize(html, config);
    return sanitized;
  } catch (error) {
    // If sanitization fails, return empty string to fail safely
    console.error("[HTML Sanitizer] Sanitization failed:", error);
    return "";
  }
}

/**
 * Sanitize HTML specifically for email designer content
 * Email designer content is user-generated and may contain HTML
 * 
 * @param html - Raw HTML from email designer
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  return sanitizeHtml(html, {
    mode: "strict",
    // Email HTML may need more tags for layout
    allowedTags: ["table", "tbody", "tr", "td", "th", "thead", "tfoot"],
    allowedAttributes: ["colspan", "rowspan", "align", "valign", "bgcolor"],
  });
}

/**
 * Sanitize HTML specifically for site builder content
 * Site builder content is AI-generated or user-generated
 * 
 * @param html - Raw HTML from site builder
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeSiteBuilderHtml(html: string | null | undefined): string {
  return sanitizeHtml(html, {
    mode: "strict",
  });
}

/**
 * Sanitize HTML from translation strings or CMS
 * These are typically trusted but may contain HTML formatting
 * 
 * @param html - Raw HTML from translation/CMS
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeTranslationHtml(html: string | null | undefined): string {
  return sanitizeHtml(html, {
    mode: "moderate",
  });
}

