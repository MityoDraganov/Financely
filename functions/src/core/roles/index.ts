/**
 * Centralized Role System Exports
 * 
 * This is the single source of truth for all role-related types and utilities.
 * Import from here to ensure type safety and consistency.
 */

export {
  ORGANIZATION_ROLES,
  VALID_ROLES,
  ROLE_HIERARCHY,
  ROLE_DEFINITIONS,
  type OrganizationRole,
  type RoleMetadata,
  type RolePermissions,
  isValidRole,
  getRoleMetadata,
  getRolePermissions,
  hasMinimumRole,
  isOwner,
  isAdminOrOwner,
  isMemberOrHigher,
  hasPermission,
  getRolesWithPermission,
  isOrganizationRole,
} from "./role-system";






