/**
 * React Query hook for generating consent banner styling using AI
 */

import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { ConsentBannerStyling } from "@/core/entities/analytics-config";

export function useGenerateConsentBanner() {
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      options?: {
        style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
        context?: string;
        existingStyling?: Partial<ConsentBannerStyling>;
      };
    }) => {
      return functionsService.generateConsentBanner(payload);
    },
  });
}
