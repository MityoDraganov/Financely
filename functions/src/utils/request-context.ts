import { CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { AuditLogUserContext } from "../core/entities/audit-log";
import { loggerService } from "../services/logger-service";

/**
 * Extract user context from Firebase request
 * Attempts to get user info from auth token, falls back to Firestore user lookup
 */
export async function extractUserContextFromRequest(
  request: CallableRequest<any>
): Promise<AuditLogUserContext | null> {
  try {
    // Try to get user from auth token
    if (request.auth) {
      const authUser = await getAuth().getUser(request.auth.uid);
      
      // Try to get additional info from Firestore
      const db = getFirestore();
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();

      return {
        userId: request.auth.uid,
        clerkId: userData?.clerkId || request.auth.uid,
        email: authUser.email || userData?.email || "",
        name: authUser.displayName || userData?.name || "",
        role: userData?.role || undefined,
        ipAddress: extractIpAddress(request),
        userAgent: extractUserAgent(request),
      };
    }

    // If no auth, try to get from userContext in payload (fallback for frontend calls)
    if ((request.data as any)?.userContext) {
      const userContext = (request.data as any).userContext;
      return {
        userId: userContext.userId || "",
        clerkId: userContext.clerkId || userContext.userId || "",
        email: userContext.email || "",
        name: userContext.name || "",
        role: userContext.role,
        ipAddress: extractIpAddress(request),
        userAgent: extractUserAgent(request),
      };
    }

    return null;
  } catch (error) {
    loggerService.warn("Failed to extract user context from request", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract IP address from request
 */
export function extractIpAddress(request: CallableRequest<any>): string | undefined {
  // Try various headers for IP address
  const forwarded = request.rawRequest?.headers?.["x-forwarded-for"];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0].trim();
  }
  
  const realIp = request.rawRequest?.headers?.["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return request.rawRequest?.socket?.remoteAddress;
}

/**
 * Extract user agent from request
 */
export function extractUserAgent(request: CallableRequest<any>): string | undefined {
  return request.rawRequest?.headers?.["user-agent"];
}

