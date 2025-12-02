/**
 * Centralized Role Management System
 * 
 * This module provides a single source of truth for all role definitions,
 * permissions, and hierarchy. All role-related code should import from here.
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
 * Role metadata including display name and description
 */
export interface RoleMetadata {
  value: OrganizationRole;
  displayName: string;
  description: string;
  level: number;
  permissions: RolePermissions;
}

/**
 * Permissions for each role
 */
export interface RolePermissions {
  // Organization management
  canManageOrganization: boolean;
  canManageMembers: boolean;
  canManageBilling: boolean;
  canInviteMembers: boolean;
  canRevokeMembers: boolean;
  
  // Resource management
  canCreateInvoices: boolean;
  canUpdateInvoices: boolean;
  canDeleteInvoices: boolean;
  canCreateWorkflows: boolean;
  canUpdateWorkflows: boolean;
  canDeleteWorkflows: boolean;
  canCreateProducts: boolean;
  canUpdateProducts: boolean;
  canDeleteProducts: boolean;
  canCreateTemplates: boolean;
  canUpdateTemplates: boolean;
  canDeleteTemplates: boolean;
  canCreateProposals: boolean;
  canUpdateProposals: boolean;
  canDeleteProposals: boolean;
  canCreateLeads: boolean;
  canUpdateLeads: boolean;
  canDeleteLeads: boolean;
  canCreateContacts: boolean;
  canUpdateContacts: boolean;
  canDeleteContacts: boolean;
  canCreateBrandSites: boolean;
  canUpdateBrandSites: boolean;
  canDeleteBrandSites: boolean;
  
  // Read permissions (all roles can read if they're members)
  canReadAll: boolean;
}

/**
 * Role definitions with permissions
 */
export const ROLE_DEFINITIONS: Record<OrganizationRole, RoleMetadata> = {
  [ORGANIZATION_ROLES.OWNER]: {
    value: ORGANIZATION_ROLES.OWNER,
    displayName: "Owner",
    description: "Full control over the organization, including billing and member management",
    level: ROLE_HIERARCHY[ORGANIZATION_ROLES.OWNER],
    permissions: {
      canManageOrganization: true,
      canManageMembers: true,
      canManageBilling: true,
      canInviteMembers: true,
      canRevokeMembers: true,
      canCreateInvoices: true,
      canUpdateInvoices: true,
      canDeleteInvoices: true,
      canCreateWorkflows: true,
      canUpdateWorkflows: true,
      canDeleteWorkflows: true,
      canCreateProducts: true,
      canUpdateProducts: true,
      canDeleteProducts: true,
      canCreateTemplates: true,
      canUpdateTemplates: true,
      canDeleteTemplates: true,
      canCreateProposals: true,
      canUpdateProposals: true,
      canDeleteProposals: true,
      canCreateLeads: true,
      canUpdateLeads: true,
      canDeleteLeads: true,
      canCreateContacts: true,
      canUpdateContacts: true,
      canDeleteContacts: true,
      canCreateBrandSites: true,
      canUpdateBrandSites: true,
      canDeleteBrandSites: true,
      canReadAll: true,
    },
  },
  [ORGANIZATION_ROLES.ADMIN]: {
    value: ORGANIZATION_ROLES.ADMIN,
    displayName: "Admin",
    description: "Can manage most resources but cannot manage owners or billing",
    level: ROLE_HIERARCHY[ORGANIZATION_ROLES.ADMIN],
    permissions: {
      canManageOrganization: false, // Cannot change org settings
      canManageMembers: false, // Cannot manage members (only invite)
      canManageBilling: false,
      canInviteMembers: true,
      canRevokeMembers: false, // Cannot revoke members
      canCreateInvoices: true,
      canUpdateInvoices: true,
      canDeleteInvoices: true,
      canCreateWorkflows: true,
      canUpdateWorkflows: true,
      canDeleteWorkflows: true,
      canCreateProducts: true,
      canUpdateProducts: true,
      canDeleteProducts: true,
      canCreateTemplates: true,
      canUpdateTemplates: true,
      canDeleteTemplates: true,
      canCreateProposals: true,
      canUpdateProposals: true,
      canDeleteProposals: true,
      canCreateLeads: true,
      canUpdateLeads: true,
      canDeleteLeads: true,
      canCreateContacts: true,
      canUpdateContacts: true,
      canDeleteContacts: true,
      canCreateBrandSites: true,
      canUpdateBrandSites: true,
      canDeleteBrandSites: true,
      canReadAll: true,
    },
  },
  [ORGANIZATION_ROLES.MEMBER]: {
    value: ORGANIZATION_ROLES.MEMBER,
    displayName: "Member",
    description: "Can create and manage invoices, proposals, leads, and contacts",
    level: ROLE_HIERARCHY[ORGANIZATION_ROLES.MEMBER],
    permissions: {
      canManageOrganization: false,
      canManageMembers: false,
      canManageBilling: false,
      canInviteMembers: false,
      canRevokeMembers: false,
      canCreateInvoices: true,
      canUpdateInvoices: false, // Cannot update/delete invoices
      canDeleteInvoices: false,
      canCreateWorkflows: false,
      canUpdateWorkflows: false,
      canDeleteWorkflows: false,
      canCreateProducts: false,
      canUpdateProducts: false,
      canDeleteProducts: false,
      canCreateTemplates: false,
      canUpdateTemplates: false,
      canDeleteTemplates: false,
      canCreateProposals: true,
      canUpdateProposals: false,
      canDeleteProposals: false,
      canCreateLeads: true,
      canUpdateLeads: false,
      canDeleteLeads: false,
      canCreateContacts: true,
      canUpdateContacts: false,
      canDeleteContacts: false,
      canCreateBrandSites: false,
      canUpdateBrandSites: false,
      canDeleteBrandSites: false,
      canReadAll: true,
    },
  },
  [ORGANIZATION_ROLES.VIEWER]: {
    value: ORGANIZATION_ROLES.VIEWER,
    displayName: "Viewer",
    description: "Read-only access to all resources",
    level: ROLE_HIERARCHY[ORGANIZATION_ROLES.VIEWER],
    permissions: {
      canManageOrganization: false,
      canManageMembers: false,
      canManageBilling: false,
      canInviteMembers: false,
      canRevokeMembers: false,
      canCreateInvoices: false,
      canUpdateInvoices: false,
      canDeleteInvoices: false,
      canCreateWorkflows: false,
      canUpdateWorkflows: false,
      canDeleteWorkflows: false,
      canCreateProducts: false,
      canUpdateProducts: false,
      canDeleteProducts: false,
      canCreateTemplates: false,
      canUpdateTemplates: false,
      canDeleteTemplates: false,
      canCreateProposals: false,
      canUpdateProposals: false,
      canDeleteProposals: false,
      canCreateLeads: false,
      canUpdateLeads: false,
      canDeleteLeads: false,
      canCreateContacts: false,
      canUpdateContacts: false,
      canDeleteContacts: false,
      canCreateBrandSites: false,
      canUpdateBrandSites: false,
      canDeleteBrandSites: false,
      canReadAll: true,
    },
  },
} as const;

/**
 * Check if a role value is valid
 */
export function isValidRole(role: string): role is OrganizationRole {
  return VALID_ROLES.includes(role as OrganizationRole);
}

/**
 * Get role metadata
 */
export function getRoleMetadata(role: OrganizationRole): RoleMetadata {
  return ROLE_DEFINITIONS[role];
}

/**
 * Get role permissions
 */
export function getRolePermissions(role: OrganizationRole): RolePermissions {
  return ROLE_DEFINITIONS[role].permissions;
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
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: OrganizationRole,
  permission: keyof RolePermissions
): boolean {
  return ROLE_DEFINITIONS[role].permissions[permission];
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesWithPermission(
  permission: keyof RolePermissions
): OrganizationRole[] {
  return VALID_ROLES.filter((role) => hasPermission(role, permission));
}

/**
 * Type guard to check if a value is a valid OrganizationRole
 */
export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && isValidRole(value);
}


