import { useCurrentOrganization as useCurrentOrganizationFromContext } from "@/contexts/organization-context";
export function useCurrentOrganization() {
  return useCurrentOrganizationFromContext();
}
