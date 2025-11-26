import { useMutation } from "@tanstack/react-query";
import { EmailTemplateData } from "@/core";
import { functionsService } from "@/services/functions/functions-service";

/**
 * Hook to generate an email template using AI
 */
export const useGenerateEmailTemplate = () => {
  return useMutation({
    mutationFn: async ({
      organizationId,
      options,
    }: {
      organizationId: string;
      options?: {
        style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
        customPrompt?: string;
        images?: Array<{
          url: string;
          purpose: "reference" | "use-in-template";
          description?: string;
        }>;
        context?: {
          products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
          organizationName?: string;
          organizationSettings?: Record<string, unknown>;
          galleryImages?: string[];
        };
        generateCustomHtml?: boolean;
        targetSection?: "header" | "body" | "footer" | "full";
      };
    }): Promise<EmailTemplateData> => {
      const result = await functionsService.generateEmailTemplate({
        organizationId,
        options,
      });
      return result as EmailTemplateData;
    },
  });
};

