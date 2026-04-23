import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplateService } from "@/services/email-template-service";
import type { EmailTemplate } from "@/core/entities/email-template";

export const useDuplicateEmailTemplate = (orgId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: EmailTemplate) => {
      return emailTemplateService.create({
        orgId: template.orgId,
        name: `${template.name} Copy`,
        description: template.description,
        subject: template.subject,
        preheader: template.preheader,
        status: "draft",
        version: 1,
        isSystemDefault: false,
        isLocked: false,
        allowedContexts: template.allowedContexts ?? [],
        htmlContent: template.htmlContent ?? "",
        blocks: template.blocks ?? [],
        designTokens: template.designTokens ?? {},
        placeholders: template.placeholders ?? [],
        ...(template.brandId !== undefined && { brandId: template.brandId }),
        ...(template.sections !== undefined && { sections: template.sections }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-templates", orgId] });
    },
  });
};
