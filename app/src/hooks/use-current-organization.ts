import { useOrganizationContext } from "./use-organization-context";

export function useCurrentOrganization() {
  const { currentOrganization, isLoading } = useOrganizationContext();
  return { data: currentOrganization, isLoading };
}
