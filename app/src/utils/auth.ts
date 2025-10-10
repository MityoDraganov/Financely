import { User, UserRole } from "@/core";

export function hasRole(user: User, organizationId: string, role: UserRole): boolean {
    const userRole = user.organizationRoles[organizationId];
    if (!userRole) return false;
    
    const roleHierarchy: UserRole[] = ["viewer", "member", "admin", "owner"];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    
    return userRoleIndex >= requiredRoleIndex;
  }
  export function isMemberOf(user: User, organizationId: string): boolean {
    return organizationId in user.organizationRoles;
  }
  export function getUserOrganizations(user: User): string[] {
    return Object.keys(user.organizationRoles);
  }
  export function getRoleInOrganization(user: User, organizationId: string): UserRole | undefined {
    return user.organizationRoles[organizationId];
  }
  
  