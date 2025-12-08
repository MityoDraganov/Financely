/**
 * Centralized Role Management System (Frontend)
 * 
 * This module provides a single source of truth for all role definitions,
 * permissions, and hierarchy. All role-related code should import from here.
 * 
 * NOTE: This should match the backend role system in functions/src/core/roles/role-system.ts
 */

/**
 * Available organization roles
 * 
 * Hierarchy (from highest to lowest):
 * - owner: Full control, can manage everything including billing and members
 * - admin: Can manage most resources, but cannot manage owners or billing
 * - member: Can create and manage invoices, proposals, leads, contacts
 * - viewer: Read-only access to all resources
 */
export const ORGANIZATION_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer",
} as const;

/**
 * Type for organization role values
 */
export type OrganizationRole = typeof ORGANIZATION_ROLES[keyof typeof ORGANIZATION_ROLES];

/**
 * Array of all valid role values (for validation)
 */
export const VALID_ROLES: readonly OrganizationRole[] = [
  ORGANIZATION_ROLES.OWNER,
  ORGANIZATION_ROLES.ADMIN,
  ORGANIZATION_ROLES.MEMBER,
  ORGANIZATION_ROLES.VIEWER,
] as const;

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  [ORGANIZATION_ROLES.OWNER]: 4,
  [ORGANIZATION_ROLES.ADMIN]: 3,
  [ORGANIZATION_ROLES.MEMBER]: 2,
  [ORGANIZATION_ROLES.VIEWER]: 1,
} as const;

/**
 * Check if a role value is valid
 */
export function isValidRole(role: string): role is OrganizationRole {
  return VALID_ROLES.includes(role as OrganizationRole);
}

/**
 * Check if a user role has at least the required role level
 * 
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if user role is equal or higher than required role
 */
export function hasMinimumRole(
  userRole: OrganizationRole,
  requiredRole: OrganizationRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user role is owner
 */
export function isOwner(role: OrganizationRole): boolean {
  return role === ORGANIZATION_ROLES.OWNER;
}

/**
 * Check if user role is admin or owner
 */
export function isAdminOrOwner(role: OrganizationRole): boolean {
  return role === ORGANIZATION_ROLES.ADMIN || role === ORGANIZATION_ROLES.OWNER;
}

/**
 * Check if user role is member or higher (member, admin, owner)
 */
export function isMemberOrHigher(role: OrganizationRole): boolean {
  return hasMinimumRole(role, ORGANIZATION_ROLES.MEMBER);
}

/**
 * Type guard to check if a value is a valid OrganizationRole
 */
export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && isValidRole(value);
}






