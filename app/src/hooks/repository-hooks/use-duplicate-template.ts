import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateService } from "@/services/template-service";
import { useTemplates } from "./use-templates";
import { generateUniqueTemplateName } from "@/utils/template-naming";
import type { Template } from "@/core";

export const useDuplicateTemplate = (orgId: string | undefined) => {
  const queryClient = useQueryClient();
  const { data: templates = [] } = useTemplates(orgId);

  return useMutation({
    mutationFn: async (template: Template) => {
      const uniqueName = generateUniqueTemplateName(`${template.name} Copy`, templates);
      return templateService.createDraft({
        orgId: template.orgId,
        name: uniqueName,
        description: template.description,
        pageSize: template.pageSize,
        brand: template.brand,
        elements: template.elements,
        backgroundElements: template.backgroundElements ?? [],
        status: "draft",
        ...(template.compliance !== undefined && { compliance: { ...template.compliance, complianceValidated: false } }),
        ...(template.productTableConfig !== undefined && { productTableConfig: template.productTableConfig }),
        ...(template.pageSettings !== undefined && { pageSettings: template.pageSettings }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
    },
  });
};
