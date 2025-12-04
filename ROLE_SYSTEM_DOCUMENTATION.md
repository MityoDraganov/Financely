# Centralized Role Management System

## Overview

The role management system has been centralized to provide a single source of truth for all role definitions, permissions, and hierarchy. This ensures type safety, consistency, and makes it easy to add or modify roles in the future.

## Architecture

### Backend (`functions/src/core/roles/`)
- **`role-system.ts`** - Complete role definitions with permissions
- **`index.ts`** - Exports for easy importing

### Frontend (`app/src/core/roles/`)
- **`role-system.ts`** - Frontend role definitions (matches backend)
- **`index.ts`** - Exports for easy importing

## Available Roles

### 1. Owner
- **Level:** 4 (highest)
- **Description:** Full control over the organization, including billing and member management
- **Permissions:** All permissions enabled

### 2. Admin
- **Level:** 3
- **Description:** Can manage most resources but cannot manage owners or billing
- **Permissions:** Can manage resources, invite members, but cannot:
  - Manage organization settings
  - Revoke members
  - Manage billing

### 3. Member
- **Level:** 2
- **Description:** Can create and manage invoices, proposals, leads, and contacts
- **Permissions:** Can create invoices, proposals, leads, contacts. Cannot:
  - Update/delete invoices
  - Create workflows, products, templates
  - Update/delete proposals, leads, contacts

### 4. Viewer
- **Level:** 1 (lowest)
- **Description:** Read-only access to all resources
- **Permissions:** Can only read resources, no write permissions

## Usage

### Importing Roles

```typescript
// Backend
import { 
  OrganizationRole, 
  ORGANIZATION_ROLES,
  hasMinimumRole,
  isOwner,
  isAdminOrOwner 
} from "../core/roles";

// Frontend
import { 
  OrganizationRole, 
  ORGANIZATION_ROLES,
  hasMinimumRole,
  isOwner,
  isAdminOrOwner 
} from "@/core/roles";
```

### Type Safety

```typescript
// Strongly typed role values
const role: OrganizationRole = ORGANIZATION_ROLES.OWNER; // ✅ Valid
const invalidRole: OrganizationRole = "superadmin"; // ❌ TypeScript error

// Type guard
if (isValidRole(someValue)) {
  // someValue is now typed as OrganizationRole
}
```

### Checking Permissions

```typescript
// Check if user has minimum role
if (hasMinimumRole(userRole, ORGANIZATION_ROLES.ADMIN)) {
  // User is admin or owner
}

// Convenience functions
if (isOwner(userRole)) {
  // User is owner
}

if (isAdminOrOwner(userRole)) {
  // User is admin or owner
}

if (isMemberOrHigher(userRole)) {
  // User is member, admin, or owner
}
```

### In Cloud Functions

```typescript
import { verifyAuthAndOrgMembership, ORGANIZATION_ROLES } from "../utils/auth-utils";

// Require member role or higher
await verifyAuthAndOrgMembership(request, orgId, {
  requiredRole: ORGANIZATION_ROLES.MEMBER,
});

// Require owner or admin
await verifyAuthAndOrgMembership(request, orgId, {
  requireOwnerOrAdmin: true,
});

// Require owner only
await verifyAuthAndOrgMembership(request, orgId, {
  requireOwner: true,
});
```

### In Frontend Components

```typescript
import { hasRole, OrganizationRole, ORGANIZATION_ROLES } from "@/utils/auth";
import { User } from "@/core";

function MyComponent({ user }: { user: User }) {
  const orgId = "org123";
  
  // Check if user has admin role or higher
  if (hasRole(user, orgId, ORGANIZATION_ROLES.ADMIN)) {
    // Show admin features
  }
}
```

## Role Hierarchy

The role hierarchy is defined numerically:
- Owner: 4
- Admin: 3
- Member: 2
- Viewer: 1

When checking permissions, a user with a higher level role automatically has all permissions of lower level roles.

## Adding New Roles

To add a new role:

1. **Update `role-system.ts`** (both backend and frontend):
   ```typescript
   export const ORGANIZATION_ROLES = {
     OWNER: "owner",
     ADMIN: "admin",
     MEMBER: "member",
     VIEWER: "viewer",
     NEW_ROLE: "newrole", // Add here
   } as const;
   ```

2. **Add to `VALID_ROLES` array**:
   ```typescript
   export const VALID_ROLES: readonly OrganizationRole[] = [
     // ... existing roles
     ORGANIZATION_ROLES.NEW_ROLE,
   ] as const;
   ```

3. **Add to `ROLE_HIERARCHY`**:
   ```typescript
   export const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
     // ... existing roles
     [ORGANIZATION_ROLES.NEW_ROLE]: 2.5, // Set appropriate level
   } as const;
   ```

4. **Update Zod schema** in `user.ts` (both backend and frontend):
   ```typescript
   export const userRoleSchema = z.enum(VALID_ROLES as [OrganizationRole, ...OrganizationRole[]]);
   ```

5. **Update Firestore rules** if needed (role hierarchy is hardcoded there)

6. **Update permission definitions** in `ROLE_DEFINITIONS` (backend only)

## Migration Notes

- `UserRole` type is now deprecated in favor of `OrganizationRole`
- Old code using `UserRole` will still work but should be migrated
- All role checking should use the centralized functions for consistency

## Benefits

1. **Type Safety**: TypeScript enforces valid role values at compile time
2. **Single Source of Truth**: All role definitions in one place
3. **Easy to Extend**: Adding new roles is straightforward
4. **Consistent**: Same role system used across backend and frontend
5. **Documented**: Permissions are clearly defined for each role
6. **Testable**: Role checking functions are pure and easy to test





