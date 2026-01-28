interface SSRFValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a URL for potential SSRF (Server-Side Request Forgery) vulnerabilities.
 * This is a client-side validation for user feedback; actual SSRF prevention
 * should be implemented server-side.
 */
export function validateUrlForSSRF(url: string): SSRFValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!url) {
    return { isValid: true, errors, warnings };
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost and loopback addresses
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost")
    ) {
      warnings.push("Localhost URLs may be blocked in production");
    }

    // Check for private IP ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      
      // 10.0.0.0/8
      if (a === 10) {
        warnings.push("Private IP addresses (10.x.x.x) may be blocked");
      }
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) {
        warnings.push("Private IP addresses (172.16-31.x.x) may be blocked");
      }
      // 192.168.0.0/16
      if (a === 192 && b === 168) {
        warnings.push("Private IP addresses (192.168.x.x) may be blocked");
      }
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) {
        warnings.push("Link-local addresses (169.254.x.x) may be blocked");
      }
    }

    // Check for cloud metadata endpoints
    const metadataEndpoints = [
      "169.254.169.254",
      "metadata.google.internal",
      "metadata.goog",
    ];
    if (metadataEndpoints.some((ep) => hostname.includes(ep))) {
      errors.push("Cloud metadata endpoints are not allowed");
    }

    // Check protocol
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push("Only HTTP and HTTPS protocols are allowed");
    }

  } catch {
    if (url.trim()) {
      errors.push("Invalid URL format");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
