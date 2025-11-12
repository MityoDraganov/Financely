import { useMutation } from "@tanstack/react-query";
import { TemplateData } from "@/core";
import { functionsService } from "@/services/functions/functions-service";

/**
 * Hook to generate an invoice template using AI
 */
export const useGenerateInvoiceTemplate = () => {
  return useMutation({
    mutationFn: async ({
      organizationId,
      region,
      options,
    }: {
      organizationId: string;
      region?: "US" | "EU" | "CA" | "AU" | "UK";
      options?: {
        style?: "modern" | "classic" | "minimal" | "professional";
        includeLogo?: boolean;
        customPrompt?: string;
      };
    }): Promise<TemplateData> => {
      const result = await functionsService.generateInvoiceTemplate({
        organizationId,
        region,
        options,
      });
      return result as TemplateData;
    },
  });
};

