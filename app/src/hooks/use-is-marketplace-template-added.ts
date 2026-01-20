import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MarketplaceTemplate } from "@/core";
import { useTemplates } from "./repository-hooks/use-templates";
import { useEmailTemplates } from "./repository-hooks/use-email-templates";

/**
 * Hook to check if a marketplace template has already been added to an organization
 * Uses the marketplaceTemplateId field stored in imported templates
 * Reactively checks by using the actual query hooks to ensure data is loaded
 */
export function useIsMarketplaceTemplateAdded(
  template: MarketplaceTemplate | null | undefined,
  orgId: string | undefined
): boolean {
  const queryClient = useQueryClient();
  
  // Use the actual query hooks to ensure templates are loaded and reactive
  // Only call hooks when orgId is available to avoid unnecessary queries
  const { data: templates } = useTemplates(orgId || "demo-org");
  const { data: emailTemplates } = useEmailTemplates(orgId || "");

  return useMemo(() => {
    if (!template || !orgId) {
      return false;
    }

    const marketplaceTemplateId = template.id;

    // Check invoice templates
    if (template.type === "invoice") {
      // First try to get from the reactive query data
      const templateList = templates || queryClient.getQueryData<Array<{ marketplaceTemplateId?: string }>>([
        "templates",
        orgId,
      ]);

      if (!templateList || !Array.isArray(templateList)) {
        return false;
      }

      // Check if any template has this marketplace template ID
      return templateList.some(
        (t) => t.marketplaceTemplateId === marketplaceTemplateId
      );
    } else {
      // Check email templates
      // First try to get from the reactive query data
      const emailTemplateList = emailTemplates || queryClient.getQueryData<Array<{ marketplaceTemplateId?: string }>>([
        "email-templates",
        orgId,
      ]);

      if (!emailTemplateList || !Array.isArray(emailTemplateList)) {
        return false;
      }

      // Check if any email template has this marketplace template ID
      return emailTemplateList.some(
        (t) => t.marketplaceTemplateId === marketplaceTemplateId
      );
    }
  }, [template, orgId, templates, emailTemplates, queryClient]);
}
