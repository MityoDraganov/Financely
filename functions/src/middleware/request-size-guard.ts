import { Request } from "firebase-functions/v2/https";
import { getRequestSizeLimit } from "./rate-limit-config";
import { logger } from "firebase-functions";

/**
 * Check if request body size exceeds the configured limit.
 * 
 * @param request - The HTTP request
 * @param functionName - Name of the function being called
 * @returns Object with isValid flag and error message if invalid
 */
export function checkRequestSize(
  request: Request,
  functionName: string
): { isValid: boolean; error?: string } {
  const limit = getRequestSizeLimit(functionName);

  // Get content length from headers
  const contentLength = request.headers["content-length"];
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > limit) {
      logger.warn("Request size limit exceeded", {
        functionName,
        size,
        limit,
        ipHash: request.headers["x-forwarded-for"]
          ? "present"
          : undefined,
      });

      return {
        isValid: false,
        error: `Request body too large. Maximum size: ${limit} bytes`,
      };
    }
  }

  // Note: In Firebase Functions v2, the body is already parsed.
  // Content-Length header check above should be sufficient.
  // If needed, we could check request.body size, but that would require
  // JSON.stringify which is expensive. Content-Length is the standard approach.

  return { isValid: true };
}

