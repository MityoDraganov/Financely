/**
 * Frontend URL validation utilities
 * Provides client-side warnings for potentially unsafe URLs
 * Note: Full SSRF protection is enforced on the backend
 */

export interface UrlValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Check if a URL string matches unsafe patterns
 */
export function validateUrlForSSRF(urlString: string): UrlValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!urlString || urlString.trim() === "") {
    return {
      isValid: false,
      warnings: [],
      errors: ["URL is required"],
    };
  }

  // Try to parse the URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return {
      isValid: false,
      warnings: [],
      errors: ["Invalid URL format"],
    };
  }

  // Check protocol
  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    errors.push("Only HTTP and HTTPS protocols are allowed");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Check for localhost variations
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0"
  ) {
    warnings.push("Localhost URLs are blocked for security reasons");
  }

  // Check for private IP ranges (basic pattern matching)
  const privateIpPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
  ];

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      warnings.push("Private/internal IP addresses are blocked for security reasons");
      break;
    }
  }

  // Check for metadata endpoints
  if (
    hostname === "169.254.169.254" ||
    hostname.includes("metadata") ||
    hostname === "metadata.google.internal"
  ) {
    warnings.push("Cloud metadata endpoints are blocked for security reasons");
  }

  // Check for common unsafe patterns
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    warnings.push("Localhost URLs are blocked for security reasons");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

