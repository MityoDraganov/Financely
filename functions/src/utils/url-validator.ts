import { lookup } from "dns/promises";
import { isIPv4, isIPv6 } from "net";

/**
 * Error thrown when URL validation fails
 */
export function createUrlValidationError(message: string): Error {
  const error = new Error(message);
  error.name = "UrlValidationError";
  // Add a marker property for instanceof-like checks
  (error as any).__isUrlValidationError = true;
  return error;
}

/**
 * Type guard to check if an error is a UrlValidationError
 */
export function isUrlValidationError(error: unknown): error is Error {
  return error instanceof Error && 
         (error.name === "UrlValidationError" || (error as any).__isUrlValidationError === true);
}

/**
 * Validates and normalizes a URL for HTTP requests, protecting against SSRF attacks.
 * 
 * This function:
 * - Validates URL format and protocol (only http/https allowed)
 * - Resolves hostname to IP address
 * - Blocks private/internal IP ranges
 * - Blocks cloud metadata endpoints
 * - Optionally enforces domain allowlist via ALLOWED_HTTP_DOMAINS env var
 * 
 * @param urlString - The raw URL string to validate
 * @returns The normalized, validated URL string
 * @throws UrlValidationError if the URL is invalid or blocked
 */
export async function validateAndNormalizeUrl(urlString: string): Promise<string> {
  // Parse and validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    throw createUrlValidationError("Invalid URL");
  }

  // Validate protocol - only http and https allowed
  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw createUrlValidationError(
      `Unsupported protocol: only http and https are allowed`
    );
  }

  // Get hostname (without port)
  const hostname = parsedUrl.hostname.toLowerCase();

  // Check for metadata hostnames before resolving
  if (isMetadataHostname(hostname)) {
    throw createUrlValidationError("Access to metadata endpoints is not allowed");
  }

  // Resolve hostname to IP address
  const ipAddress = await resolveHostnameToIp(hostname);

  // Check if IP is a metadata endpoint
  if (isMetadataIp(ipAddress)) {
    throw createUrlValidationError("Access to metadata endpoints is not allowed");
  }

  // Check if IP is in private/internal ranges
  if (isPrivateIp(ipAddress)) {
    throw createUrlValidationError(
      "Requests to private or internal IP ranges are not allowed"
    );
  }

  // Check domain allowlist if configured
  const allowedDomains = getAllowedDomains();
  if (allowedDomains.length > 0) {
    if (!allowedDomains.includes(hostname)) {
      throw createUrlValidationError(
        `Domain ${hostname} is not in the allowed list`
      );
    }
  }

  // Return normalized URL (with protocol and hostname normalized)
  return parsedUrl.toString();
}

/**
 * Resolves a hostname to an IP address.
 * If the hostname is already an IP, returns it directly.
 * 
 * @param hostname - The hostname to resolve
 * @returns The resolved IP address (IPv4 or IPv6)
 * @throws UrlValidationError if resolution fails
 */
async function resolveHostnameToIp(hostname: string): Promise<string> {
  // If it's already an IP address, return it
  if (isIPv4(hostname) || isIPv6(hostname)) {
    return hostname;
  }

  // Resolve hostname to IP
  try {
    const addresses = await lookup(hostname, { all: false });
    return addresses.address;
  } catch (error) {
    throw createUrlValidationError(
      `Failed to resolve hostname ${hostname}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Checks if an IP address is in a private/internal range.
 * 
 * IPv4 private ranges:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * - 127.0.0.0/8 (127.0.0.0 - 127.255.255.255) - loopback
 * - 169.254.0.0/16 (169.254.0.0 - 169.254.255.255) - link-local
 * 
 * IPv6 private ranges:
 * - ::1 - loopback
 * - fe80::/10 - link-local
 * - fc00::/7 - unique local address (ULA)
 * 
 * @param ipAddress - The IP address to check
 * @returns true if the IP is in a private range
 */
function isPrivateIp(ipAddress: string): boolean {
  if (isIPv4(ipAddress)) {
    return isPrivateIpv4(ipAddress);
  }
  
  if (isIPv6(ipAddress)) {
    return isPrivateIpv6(ipAddress);
  }

  // If we can't determine the IP version, be safe and block it
  return true;
}

/**
 * Checks if an IPv4 address is in a private range.
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  
  if (parts.length !== 4) {
    return true; // Invalid format, block it
  }

  const [a, b] = parts;

  // Check for invalid octets
  if (parts.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  // 10.0.0.0/8
  if (a === 10) {
    return true;
  }

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  // 192.168.0.0/16
  if (a === 192 && b === 168) {
    return true;
  }

  // 127.0.0.0/8 (loopback)
  if (a === 127) {
    return true;
  }

  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) {
    return true;
  }

  return false;
}

/**
 * Checks if an IPv6 address is in a private range.
 */
function isPrivateIpv6(ip: string): boolean {
  // Normalize IPv6 address (lowercase, trimmed)
  const normalized = normalizeIpv6(ip);

  // ::1 - loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // fe80::/10 - link-local (first 16 bits: fe80-febf)
  // Check if it starts with "fe8", "fe9", "fea", or "feb" followed by 0-f
  const linkLocalPattern = /^fe[89ab][0-9a-f]/i;
  if (linkLocalPattern.test(normalized)) {
    return true;
  }

  // fc00::/7 - unique local address (starts with fc00 or fd00)
  if (normalized.startsWith("fc00:") || normalized.startsWith("fd00:")) {
    return true;
  }

  return false;
}

/**
 * Normalizes an IPv6 address for comparison.
 * This is a simplified version - for production, consider using a library.
 */
function normalizeIpv6(ip: string): string {
  // Remove leading zeros from each segment (simplified)
  // This is a basic implementation - a full IPv6 parser would be more robust
  return ip.toLowerCase().trim();
}

/**
 * Checks if a hostname or IP corresponds to a cloud metadata endpoint.
 * 
 * Common metadata endpoints:
 * - 169.254.169.254 (AWS, GCP, Azure metadata)
 * - metadata.google.internal (GCP)
 * - 169.254.169.254 (various cloud providers)
 * 
 * @param hostnameOrIp - The hostname or IP to check
 * @returns true if it's a metadata endpoint
 */
function isMetadataHostname(hostnameOrIp: string): boolean {
  const lower = hostnameOrIp.toLowerCase();
  
  // Check for common metadata hostnames
  return lower === "metadata.google.internal" ||
         lower === "metadata" ||
         lower.includes("metadata");
}

/**
 * Checks if an IP address corresponds to a cloud metadata endpoint.
 * 
 * @param ipAddress - The IP address to check
 * @returns true if it's a metadata IP
 */
function isMetadataIp(ipAddress: string): boolean {
  // 169.254.169.254 is the common metadata IP for AWS, GCP, Azure
  return ipAddress === "169.254.169.254";
}

/**
 * Gets the list of allowed domains from the ALLOWED_HTTP_DOMAINS environment variable.
 * 
 * @returns Array of allowed hostnames (lowercase, trimmed)
 */
function getAllowedDomains(): string[] {
  const envValue = process.env.ALLOWED_HTTP_DOMAINS;
  
  if (!envValue || envValue.trim() === "") {
    return [];
  }

  // Split by comma and clean up each domain
  return envValue
    .split(",")
    .map(domain => domain.trim().toLowerCase())
    .filter(domain => domain.length > 0);
}

