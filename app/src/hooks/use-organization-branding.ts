import { useEffect } from "react";
import { useCurrentOrganization } from "@/contexts/organization-context";
import { 
  applyBrandColors, 
  applyOrganizationFavicon,
  getOrganizationName,
  getOrganizationLogo,
  hasCustomBranding 
} from "@/utils/branding";

/**
 * Hook to manage organization branding across the application
 * Automatically applies brand colors, favicon, and other branding elements
 */
export function useOrganizationBranding() {
  const { data: organization, isLoading } = useCurrentOrganization();

  useEffect(() => {
    if (!isLoading && organization) {
      // Apply brand colors to CSS custom properties
      applyBrandColors(organization);
      
      // Apply custom favicon
      applyOrganizationFavicon(organization);
      
      // Update document title with organization name
      const orgName = getOrganizationName(organization);
      if (orgName !== "Financely") {
        document.title = `${orgName} - Invoice Management`;
      } else {
        document.title = "Financely - Invoice Management";
      }
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
