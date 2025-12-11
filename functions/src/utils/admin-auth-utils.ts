import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  AdminRole,
  isValidAdminRole,
  hasAdminPermission,
  canAdminWrite,
} from "../core/admin/admin-roles";
import { loggerService } from "../services/logger-service";

/**
 * Result of admin authentication check
 */
export interface AdminAuthResult {
  userId: string;
  adminRole: AdminRole;
  canWrite: boolean;
}

/**
 * Options for admin authorization checks
 */
export interface AdminAuthOptions {
  /**
   * Required permission for the operation
   * If not specified, any admin role can perform the operation
   */
  requiredPermission?: string;
  
  /**
   * If true, requires write permission (not read-only admin)
   */
  requireWrite?: boolean;
  
  /**
   * If true, requires superadmin role
   */
  requireSuperAdmin?: boolean;
}

/**
 * Get admin role from Clerk user metadata
 * Admin roles are stored in Clerk's publicMetadata.adminRole
 * 
 * Note: Clerk metadata is synced to Firebase Auth custom claims via webhook
 * We check customClaims first, then fall back to checking Firestore user document
 */
async function getAdminRoleFromClerk(userId: string): Promise<AdminRole | null> {
  try {
    const auth = getAuth();
    const user = await auth.getUser(userId);
    
    // Check customClaims first (synced from Clerk via webhook)
    const adminRoleFromClaims = user.customClaims?.adminRole;
    
    if (typeof adminRoleFromClaims === "string" && isValidAdminRole(adminRoleFromClaims)) {
      return adminRoleFromClaims;
    }

    // Fallback: Check Firestore user document for adminRole
    // This allows setting admin role directly in Firestore if needed
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const adminRoleFromFirestore = userData?.adminRole;
      
      if (typeof adminRoleFromFirestore === "string" && isValidAdminRole(adminRoleFromFirestore)) {
        return adminRoleFromFirestore;
      }
    }

    return null;
  } catch (error) {
    loggerService.error("Failed to get admin role from Clerk", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Verify admin authentication and authorization
 * 
 * @param request - The callable request
 * @param options - Authorization options
 * @returns AdminAuthResult with admin info and permissions
 * @throws HttpsError if authentication or authorization fails
 */
export async function verifyAdminAuth(
  request: CallableRequest<any>,
  options: AdminAuthOptions = {}
): Promise<AdminAuthResult> {
  // Check authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const userId = request.auth.uid;
  const db = getFirestore();

  // Get user document to verify it exists
  const userDoc = await db.collection("users").doc(userId).get();
  
  if (!userDoc.exists) {
    throw new HttpsError(
      "not-found",
      "User not found"
    );
  }

  const userData = userDoc.data();
  if (!userData) {
    throw new HttpsError(
      "not-found",
      "User data not found"
    );
  }

  // Check user status
  if (userData.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "User account is not active"
    );
  }

  // Get admin role from Clerk metadata
  const adminRole = await getAdminRoleFromClerk(userId);

  if (!adminRole) {
    throw new HttpsError(
      "permission-denied",
      "User does not have admin privileges"
    );
  }

  // Check if write permission is required
  if (options.requireWrite && !canAdminWrite(adminRole)) {
    throw new HttpsError(
      "permission-denied",
      "This operation requires write permissions"
    );
  }

  // Check if superadmin is required
  if (options.requireSuperAdmin && adminRole !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "This operation requires superadmin role"
    );
  }

  // Check if specific permission is required
  if (options.requiredPermission) {
    if (!hasAdminPermission(adminRole, options.requiredPermission)) {
      throw new HttpsError(
        "permission-denied",
        `This operation requires permission: ${options.requiredPermission}`
      );
    }
  }

  loggerService.info("Admin auth verified", {
    userId,
    adminRole,
    requiredPermission: options.requiredPermission,
  });

  return {
    userId,
    adminRole,
    canWrite: canAdminWrite(adminRole),
  };
}

/**
 * Assert that the request is from an admin (throws if not)
 * Convenience function for inline checks
 */
export async function assertAdmin(
  request: CallableRequest<any>,
  options: AdminAuthOptions = {}
): Promise<AdminAuthResult> {
  return verifyAdminAuth(request, options);
}

