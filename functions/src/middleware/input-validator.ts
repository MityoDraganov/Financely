/**
 * Input validation utilities with strict limits and truncation.
 * 
 * These utilities help prevent abuse by:
 * - Enforcing maximum lengths on all string inputs
 * - Truncating values safely before use
 * - Validating formats where applicable
 * - Sanitizing identifiers
 */

/**
 * Maximum lengths for common input fields.
 */
export const MAX_LENGTHS = {
  organizationId: 100,
  widgetId: 100,
  eventName: 100,
  email: 255,
  name: 200,
  firstName: 100,
  lastName: 100,
  phone: 50,
  company: 200,
  jobTitle: 200,
  message: 10000, // 10 KB for messages
  customFieldKey: 100,
  customFieldValue: 1000,
  pagePath: 2000,
  pageTitle: 500,
  referrer: 2000,
  clientId: 200,
  userAgent: 500,
  siteId: 100,
  brandName: 200,
} as const;

/**
 * Normalize and validate an organization ID.
 */
export function normalizeOrganizationId(orgId: unknown): string | null {
  if (typeof orgId !== "string") {
    return null;
  }

  const trimmed = orgId.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTHS.organizationId) {
    return null;
  }

  // Basic format validation: alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Normalize and validate an email address.
 */
export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTHS.email) {
    return null;
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Truncate a string to a maximum length, preserving safety.
 */
export function truncateString(
  value: unknown,
  maxLength: number,
  suffix = "..."
): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  // Truncate and add suffix if needed
  const truncateLength = maxLength - suffix.length;
  return trimmed.substring(0, truncateLength) + suffix;
}

/**
 * Normalize a name field (first name, last name, or full name).
 */
export function normalizeName(name: unknown, maxLength?: number): string {
  if (typeof name !== "string") {
    return "";
  }

  const limit = maxLength ?? MAX_LENGTHS.name;
  return truncateString(name.trim(), limit, "");
}

/**
 * Normalize a phone number.
 */
export function normalizePhone(phone: unknown): string {
  if (typeof phone !== "string") {
    return "";
  }

  // Remove common formatting characters, keep only digits, +, spaces, hyphens, parentheses
  const cleaned = phone.replace(/[^\d+\s\-()]/g, "");
  return truncateString(cleaned.trim(), MAX_LENGTHS.phone, "");
}

/**
 * Validate and normalize form data object.
 * 
 * - Truncates all string values to safe lengths
 * - Removes unexpected fields
 * - Validates known field formats
 */
export function normalizeFormData(
  data: unknown,
  allowedFields?: Set<string>
): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    // Skip if field is not allowed
    if (allowedFields && !allowedFields.has(key)) {
      continue;
    }

    // Truncate key length
    const safeKey = truncateString(key, MAX_LENGTHS.customFieldKey, "");

    // Normalize value based on type
    if (value === null || value === undefined) {
      continue; // Skip null/undefined
    } else if (typeof value === "string") {
      // Truncate string values
      const maxValueLength = MAX_LENGTHS.customFieldValue;
      normalized[safeKey] = truncateString(value, maxValueLength, "");
    } else if (typeof value === "number" || typeof value === "boolean") {
      normalized[safeKey] = value;
    } else if (Array.isArray(value)) {
      // Truncate array to reasonable size and normalize items
      const maxArrayLength = 100;
      normalized[safeKey] = value
        .slice(0, maxArrayLength)
        .map((item) =>
          typeof item === "string"
            ? truncateString(item, MAX_LENGTHS.customFieldValue, "")
            : item
        );
    } else if (typeof value === "object") {
      // Recursively normalize nested objects (with depth limit)
      normalized[safeKey] = normalizeFormData(value, undefined);
    }
  }

  return normalized;
}

/**
 * Validate analytics event properties object.
 * 
 * Limits:
 * - Maximum number of keys
 * - Maximum key length
 * - Maximum value length
 * - Allowed value types
 */
export function validateAnalyticsProperties(
  properties: unknown,
  maxKeys = 50,
  maxKeyLength = 100,
  maxValueLength = 1000
): Record<string, unknown> | null {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }

  const obj = properties as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Check key count
  if (keys.length > maxKeys) {
    return null;
  }

  const validated: Record<string, unknown> = {};

  for (const key of keys) {
    // Validate key length
    if (key.length > maxKeyLength) {
      continue; // Skip invalid keys
    }

    const value = obj[key];

    // Only allow primitive types and arrays of primitives
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      // Truncate string values
      if (typeof value === "string" && value.length > maxValueLength) {
        validated[key] = truncateString(value, maxValueLength, "...");
      } else {
        validated[key] = value;
      }
    } else if (Array.isArray(value)) {
      // Validate array (max 100 items, all primitives)
      const validatedArray = value
        .slice(0, 100)
        .filter(
          (item) =>
            item === null ||
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
        )
        .map((item) =>
          typeof item === "string" && item.length > maxValueLength
            ? truncateString(item, maxValueLength, "...")
            : item
        );
      validated[key] = validatedArray;
    }
    // Skip objects and other types
  }

  return validated;
}

/**
 * Validate event name for analytics events.
 * 
 * Only allows alphanumeric, hyphens, underscores, and dots.
 */
export function validateEventName(eventName: unknown): string | null {
  if (typeof eventName !== "string") {
    return null;
  }

  const trimmed = eventName.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LENGTHS.eventName) {
    return null;
  }

  // Allow alphanumeric, hyphens, underscores, dots, and colons
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

