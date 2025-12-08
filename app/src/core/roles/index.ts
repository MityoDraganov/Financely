/**
 * Centralized Role System Exports (Frontend)
 * 
 * This is the single source of truth for all role-related types and utilities.
 * Import from here to ensure type safety and consistency.
 */

export {
  ORGANIZATION_ROLES,
  VALID_ROLES,
  ROLE_HIERARCHY,
  type OrganizationRole,
  isValidRole,
  hasMinimumRole,
  isOwner,
  isAdminOrOwner,
  isMemberOrHigher,
  isOrganizationRole,
} from "./role-system";






