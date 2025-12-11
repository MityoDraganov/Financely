import { createClerkClient } from "@clerk/backend";
import { getAuth } from "firebase-admin/auth";
import { isValidAdminRole } from "../core/admin/admin-roles";
import { loggerService } from "../services/logger-service";

/**
 * Get admin role from Clerk user's publicMetadata
 * Uses the admin Clerk instance (separate from main app Clerk)
 * 
 * @param clerkUserId - The Clerk user ID
 * @param adminClerkSecret - The admin Clerk API secret
 * @returns The admin role or null
 */
export async function getAdminRoleFromClerk(
  clerkUserId: string,
  adminClerkSecret: string
): Promise<string | null> {
  try {
    const clerk = createClerkClient({ secretKey: adminClerkSecret });
    const clerkUser = await clerk.users.getUser(clerkUserId);
    
    const adminRole = (clerkUser.publicMetadata as any)?.adminRole;
    
    if (adminRole && typeof adminRole === "string" && isValidAdminRole(adminRole)) {
      loggerService.info("Found admin role in Clerk metadata:", {
        userId: clerkUserId,
        adminRole,
      });
      return adminRole;
    }
    
    return null;
  } catch (error) {
    loggerService.warn("Failed to fetch admin role from Clerk API:", {
      userId: clerkUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Sync admin role to Firebase Auth custom claims
 * Note: This requires the user to already exist in Firebase Auth
 * If the user doesn't exist yet, the custom claims in the token will work instead
 * 
 * @param userId - The Firebase user ID (same as Clerk user ID)
 * @param adminRole - The admin role to set
 */
export async function syncAdminRoleToFirebaseAuth(
  userId: string,
  adminRole: string
): Promise<void> {
  try {
    const auth = getAuth();
    
    // Check if user exists first
    try {
      await auth.getUser(userId);
    } catch (error) {
      // User doesn't exist yet - that's okay, the token will create them with claims
      loggerService.info("User does not exist in Firebase Auth yet, will be created on sign-in:", {
        userId,
      });
      return;
    }
    
    // User exists, set custom claims
    await auth.setCustomUserClaims(userId, {
      adminRole: adminRole,
    });
    loggerService.info("Synced admin role to Firebase Auth custom claims:", {
      userId,
      adminRole,
    });
  } catch (error) {
    // Don't throw - this is not critical since the token has the claims
    loggerService.warn("Could not sync admin role to Firebase Auth custom claims:", {
      userId,
      adminRole,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

