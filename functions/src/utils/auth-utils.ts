import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {
  OrganizationRole,
  hasMinimumRole,
  isOwner,
  isAdminOrOwner,
  isValidRole,
} from "../core/roles";
import { loggerService } from "../services/logger-service";

/**
 * Result of authentication and authorization check
 */
export interface AuthResult {
  userId: string;
  userRole: OrganizationRole | null;
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isOwnerOrAdmin: boolean;
}

/**
 * Options for authorization checks
 */
export interface AuthOptions {
  /**
   * Required role for the operation (owner, admin, member, or viewer)
   * If not specified, any member can perform the operation
   */
  requiredRole?: OrganizationRole;
  
  /**
   * If true, requires owner or admin role
   */
  requireOwnerOrAdmin?: boolean;
  
  /**
   * If true, requires owner role
   */
  requireOwner?: boolean;
  
  /**
   * If true, requires active subscription for write operations.
   * When set, past_due subscriptions will be blocked (read-only mode).
   * Canceled/unpaid subscriptions are always blocked regardless of this flag.
   */
  requireWriteAccess?: boolean;
  
  /**
   * If true, skip billing checks entirely (use for billing-related endpoints)
   */
  skipBillingCheck?: boolean;
}

/**
 * Verify authentication and organization membership
 * 
 * @param request - The callable request
 * @param orgId - The organization ID to check membership for
 * @param options - Authorization options
 * @returns AuthResult with user info and permissions
 * @throws HttpsError if authentication or authorization fails
 */
export async function verifyAuthAndOrgMembership(
  request: CallableRequest<any>,
  orgId: string,
  options: AuthOptions = {}
): Promise<AuthResult> {
  // Check authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const userId = request.auth.uid;
  const db = getFirestore();

  // Get user document
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

  // Get organization document
  const orgDoc = await db.collection("organizations").doc(orgId).get();
  
  if (!orgDoc.exists) {
    throw new HttpsError(
      "not-found",
      "Organization not found"
    );
  }

  const orgData = orgDoc.data();
  if (!orgData) {
    throw new HttpsError(
      "not-found",
      "Organization data not found"
    );
  }

  // Check organization status
  if (orgData.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Organization is not active"
    );
  }

  // Check billing/subscription status (unless explicitly skipped)
  if (!options.skipBillingCheck) {
    const billingStatus = orgData.billing?.status as string | undefined;
    
    // Full lock for canceled, unpaid, or no subscription
    if (billingStatus === "canceled" || billingStatus === "unpaid" || !billingStatus || billingStatus === "incomplete") {
      throw new HttpsError(
        "permission-denied",
        "Active subscription required. Please update your billing."
      );
    }
    
    // Read-only mode for past_due when write access is required
    if (billingStatus === "past_due" && options.requireWriteAccess) {
      throw new HttpsError(
        "permission-denied",
        "Payment past due. Your account is in read-only mode. Please update your payment method."
      );
    }
  }

  // Check if user is a member
  const memberIds = orgData.memberIds || [];
  const isMember = memberIds.includes(userId);

  if (!isMember) {
    throw new HttpsError(
      "permission-denied",
      "User is not a member of this organization"
    );
  }

  // Get user's role in the organization
  const organizationRoles = userData.organizationRoles || {};
  const userRoleValue = organizationRoles[orgId] as string | undefined;

  if (!userRoleValue) {
    throw new HttpsError(
      "permission-denied",
      "User does not have a role in this organization"
    );
  }

  // Validate role is a valid OrganizationRole
  if (!isValidRole(userRoleValue)) {
    throw new HttpsError(
      "internal",
      `Invalid role value: ${userRoleValue}`
    );
  }

  const userRole: OrganizationRole = userRoleValue;

  // Use centralized role checking functions
  const isOwnerRole = isOwner(userRole);
  const isAdminRole = isAdminOrOwner(userRole);
  const isOwnerOrAdminRole = isAdminRole;

  // Check required role using centralized function
  if (options.requiredRole) {
    if (!hasMinimumRole(userRole, options.requiredRole)) {
      throw new HttpsError(
        "permission-denied",
        `This operation requires ${options.requiredRole} role or higher. Current role: ${userRole}`
      );
    }
  }

  // Check if owner or admin is required
  if (options.requireOwnerOrAdmin && !isOwnerOrAdminRole) {
    throw new HttpsError(
      "permission-denied",
      "This operation requires owner or admin role"
    );
  }

  // Check if owner is required
  if (options.requireOwner && !isOwnerRole) {
    throw new HttpsError(
      "permission-denied",
      "This operation requires owner role"
    );
  }

  loggerService.info("Auth and org membership verified", {
    userId,
    orgId,
    userRole,
    isMember,
    isOwner: isOwnerRole,
    isAdmin: isAdminRole,
  });

  return {
    userId,
    userRole,
    isMember,
    isOwner: isOwnerRole,
    isAdmin: isAdminRole,
    isOwnerOrAdmin: isOwnerOrAdminRole,
  };
}

/**
 * Verify authentication only (without org membership check)
 * 
 * @param request - The callable request
 * @returns User ID
 * @throws HttpsError if authentication fails
 */
export async function verifyAuth(
  request: CallableRequest<any>
): Promise<string> {
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

  return userId;
}

