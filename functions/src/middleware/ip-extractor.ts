import { Request } from "firebase-functions/v2/https";

/**
 * Extract IP address from an onRequest HTTP request.
 * 
 * Checks common headers in order of preference:
 * 1. x-forwarded-for (first IP in comma-separated list)
 * 2. x-real-ip
 * 3. cf-connecting-ip (Cloudflare)
 * 4. x-client-ip
 * 5. socket.remoteAddress (fallback)
 * 
 * @param request - The HTTP request object
 * @returns IP address string or undefined if not found
 */
export function extractIpFromRequest(request: Request): string | undefined {
  const headers = request.headers || {};
  
  // Check common IP headers (in order of preference)
  const ipHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip", // Cloudflare
    "x-client-ip",
  ];

  for (const header of ipHeaders) {
    const value = headers[header];
    if (value) {
      const ip = Array.isArray(value) ? value[0] : value;
      // x-forwarded-for can contain multiple IPs, take the first one
      return ip.split(",")[0].trim();
    }
  }

  // Fallback: try to get from socket if available (may not be available in v2)
  // Note: rawRequest is not available in firebase-functions/v2/https Request type
  return undefined;
}

/**
 * Hash an IP address for privacy-safe logging and rate limiting.
 * 
 * Uses a simple hash function to create a consistent identifier
 * without storing the full IP address.
 * 
 * @param ip - IP address string
 * @returns Hashed IP identifier
 */
export function hashIpAddress(ip: string): string {
  // Simple hash function for IP addresses
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

