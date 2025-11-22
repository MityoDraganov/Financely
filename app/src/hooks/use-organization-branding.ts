import { useEffect } from "react";
import { useCurrentOrganization } from "@/contexts/organization-context";
import { 
  applyBrandColors, 
  getOrganizationName,
  getOrganizationLogo,
  hasCustomBranding 
} from "@/utils/branding";

/**
 * Hook to manage organization branding across the application
 * Automatically applies brand colors
 */
export function useOrganizationBranding() {
  const { data: organization, isLoading } = useCurrentOrganization();

  useEffect(() => {
    if (!isLoading && organization) {
      // Apply brand colors to CSS custom properties
      applyBrandColors(organization);
    }
  }, [organization, isLoading]);

  return {
    organization,
    isLoading,
    hasCustomBranding: hasCustomBranding(organization),
    organizationName: getOrganizationName(organization),
    organizationLogo: getOrganizationLogo(organization),
  };
}
