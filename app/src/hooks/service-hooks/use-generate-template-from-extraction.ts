import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateData } from "@/core";
import { functionsService } from "@/services/functions/functions-service";
import { templateService } from "@/services/template-service";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { generateUniqueTemplateName } from "@/utils/template-naming";

/**
 * Hook to generate an invoice template from extracted invoice data
 */
export const useGenerateTemplateFromExtraction = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      editedData,
      options,
      createTemplate = true,
    }: {
      jobId: string;
      editedData?: Record<string, unknown>;
      options?: {
        style?: "modern" | "classic" | "minimal" | "professional";
        templateName?: string;
        strategy?: "layout_fusion_v2" | "legacy";
        qualityTarget?: "pixel";
      };
      createTemplate?: boolean;
    }): Promise<{
      template: TemplateData;
      templateId?: string;
      quality: { overall: number; layout: number; text: number; table: number; font: number };
      needsReview: boolean;
      reviewReasons: string[];
    }> => {
      // Generate template from extraction
      const result = await functionsService.generateTemplateFromExtraction({
        jobId,
        editedData,
        options,
      });

      const template = result.template as TemplateData;

      // Ensure unique template name if creating template
      if (createTemplate) {
        // Get existing templates for the organization
        const existingTemplates = queryClient.getQueryData<Array<{ id: string; name?: string }>>([
          "templates",
          template.orgId,
        ]) || [];

        // Generate unique name
        const baseName = options?.templateName || template.name || "Template from Extraction";
        const uniqueName = generateUniqueTemplateName(baseName, existingTemplates);
        template.name = uniqueName;
      }

      // Create template in database if requested
      let templateId: string | undefined;
      if (createTemplate) {
        templateId = await templateService.createDraft(template);
        // Invalidate templates query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["templates", template.orgId] });
      }

      return {
        template,
        templateId,
        quality: result.quality,
        needsReview: result.needsReview,
        reviewReasons: result.reviewReasons,
      };
    },
    onSuccess: (data) => {
      if (data.templateId) {
        // Navigate to template designer
        navigate(`/designer/${data.templateId}`);
        toast.success("Template generated and created successfully");
      } else {
        toast.success("Template generated successfully");
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to generate template from extraction", {
        description: error.message,
      });
    },
  });
};
