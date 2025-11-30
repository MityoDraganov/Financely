import { User } from "@/core";
import { OrganizationRole, hasMinimumRole, isValidRole } from "@/core/roles";

/**
 * Check if user has at least the required role in the organization
 * Uses centralized role system for type safety
 */
export function hasRole(
  user: User,
  organizationId: string,
  role: OrganizationRole
): boolean {
  const userRole = user.organizationRoles[organizationId];
  if (!userRole) return false;
  
  // Validate role is valid
  if (!isValidRole(userRole)) {
    return false;
  }
  
  // Use centralized role checking
  return hasMinimumRole(userRole, role);
}

/**
 * Check if user is a member of the organization
 */
export function isMemberOf(user: User, organizationId: string): boolean {
  return organizationId in user.organizationRoles;
}
/**
 * Get all organization IDs the user belongs to
 */
export function getUserOrganizations(user: User): string[] {
  return Object.keys(user.organizationRoles);
}

/**
 * Get user's role in a specific organization
 * Uses centralized role system for type safety
 */
export function getRoleInOrganization(
  user: User,
  organizationId: string
): OrganizationRole | undefined {
  const role = user.organizationRoles[organizationId];
  if (!role || !isValidRole(role)) {
    return undefined;
  }
  return role;
}
  
  