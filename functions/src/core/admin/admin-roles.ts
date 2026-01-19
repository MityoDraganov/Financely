/**
 * Admin Role System (Backend)
 * 
 * Admin roles are separate from organization roles and are stored in Clerk metadata.
 * These roles grant platform-wide administrative access.
 * 
 * NOTE: This should match the frontend admin role system in app/src/core/admin/admin-roles.ts
 */

/**
 * Available admin roles
 */
export const ADMIN_ROLES = {
  SUPERADMIN: "superadmin",
  BILLING_ADMIN: "billing_admin",
  SUPPORT_ADMIN: "support_admin",
  READ_ONLY_ADMIN: "read_only_admin",
} as const;

/**
 * Type for admin role values
 */
export type AdminRole = typeof ADMIN_ROLES[keyof typeof ADMIN_ROLES];

/**
 * Array of all valid admin role values
 */
export const VALID_ADMIN_ROLES: readonly AdminRole[] = [
  ADMIN_ROLES.SUPERADMIN,
  ADMIN_ROLES.BILLING_ADMIN,
  ADMIN_ROLES.SUPPORT_ADMIN,
  ADMIN_ROLES.READ_ONLY_ADMIN,
] as const;

/**
 * Admin role hierarchy levels
 */
export const ADMIN_ROLE_HIERARCHY: Record<AdminRole, number> = {
  [ADMIN_ROLES.SUPERADMIN]: 4,
  [ADMIN_ROLES.BILLING_ADMIN]: 3,
  [ADMIN_ROLES.SUPPORT_ADMIN]: 3,
  [ADMIN_ROLES.READ_ONLY_ADMIN]: 1,
} as const;

/**
 * Admin role permissions map
 */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  [ADMIN_ROLES.SUPERADMIN]: [
    "organizations.read",
    "organizations.write",
    "users.read",
    "users.write",
    "billing.read",
    "billing.write",
    "usage.read",
    "usage.write",
    "settings.read",
    "settings.write",
    "logs.read",
    "impersonation",
    "marketplace.moderate",
  ],
  [ADMIN_ROLES.BILLING_ADMIN]: [
    "organizations.read",
    "billing.read",
    "billing.write",
    "usage.read",
    "usage.write",
    "logs.read",
  ],
  [ADMIN_ROLES.SUPPORT_ADMIN]: [
    "organizations.read",
    "organizations.write",
    "users.read",
    "users.write",
    "usage.read",
    "logs.read",
    "marketplace.moderate",
  ],
  [ADMIN_ROLES.READ_ONLY_ADMIN]: [
    "organizations.read",
    "users.read",
    "billing.read",
    "usage.read",
    "logs.read",
  ],
};

/**
 * Check if a role value is a valid admin role
 */
export function isValidAdminRole(role: string): role is AdminRole {
  return VALID_ADMIN_ROLES.includes(role as AdminRole);
}

/**
 * Check if an admin role has a specific permission
 */
export function hasAdminPermission(
  adminRole: AdminRole,
  permission: string
): boolean {
  const permissions = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
  return permissions.includes(permission);
}

/**
 * Check if an admin role has at least the required role level
 */
export function hasMinimumAdminRole(
  userRole: AdminRole,
  requiredRole: AdminRole
): boolean {
  return ADMIN_ROLE_HIERARCHY[userRole] >= ADMIN_ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if admin role is superadmin
 */
export function isSuperAdmin(role: AdminRole): boolean {
  return role === ADMIN_ROLES.SUPERADMIN;
}

/**
 * Check if admin role can write (not read-only)
 */
export function canAdminWrite(role: AdminRole): boolean {
  return role !== ADMIN_ROLES.READ_ONLY_ADMIN;
}

/**
 * Get all permissions for an admin role
 */
export function getAdminPermissions(role: AdminRole): string[] {
  return ADMIN_ROLE_PERMISSIONS[role] || [];
}

