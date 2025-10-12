import { useCurrentOrganization as useCurrentOrganizationFromContext } from "@/contexts/organization-context";

/**
 * Convenience hook for getting current organization
 * Re-exports from organization context for easier imports
 */
export function useCurrentOrganization() {
  return useCurrentOrganizationFromContext();
}
