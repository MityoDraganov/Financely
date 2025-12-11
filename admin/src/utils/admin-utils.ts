import { useUser } from "@clerk/clerk-react";
import { AdminRole, isValidAdminRole, ADMIN_ROLES } from "@/core/admin/admin-roles";

/**
 * Get admin role from Clerk user metadata
 * Admin roles are stored in Clerk's publicMetadata.adminRole
 * 
 * If no explicit adminRole is set, all authenticated Clerk users are granted superadmin access
 * (since this is a standalone admin app where all Clerk users are admins)
 */
export function getAdminRoleFromClerk(
  clerkUser: { publicMetadata?: Record<string, unknown> } | null | undefined
): AdminRole | null {
  // If no user, return null
  if (!clerkUser) {
    return null;
  }

  // Check for explicit adminRole in metadata
  if (clerkUser.publicMetadata?.adminRole) {
    const adminRole = clerkUser.publicMetadata.adminRole;
    
    if (typeof adminRole === "string" && isValidAdminRole(adminRole)) {
      return adminRole;
    }
  }

  // Default: All authenticated Clerk users are superadmins
  // This is for standalone admin app where all Clerk users should have admin access
  return ADMIN_ROLES.SUPERADMIN;
}

/**
 * Hook to get current user's admin role
 * Returns superadmin by default for all authenticated users
 */
export function useAdminRole(): AdminRole | null {
  const { user, isLoaded } = useUser();
  
  // Return null while loading
  if (!isLoaded) {
    return null;
  }
  
  // If user exists, they're an admin (default to superadmin)
  return user ? getAdminRoleFromClerk(user) : null;
}

/**
 * Check if current user has any admin role
 */
export function useIsAdmin(): boolean {
  const adminRole = useAdminRole();
  return adminRole !== null;
}

