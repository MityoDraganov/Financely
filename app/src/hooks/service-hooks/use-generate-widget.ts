/**
 * React Query hook for generating widget styling and configuration using AI
 */

import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export function useGenerateWidget() {
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      widgetType: "contactForm" | "invoiceRequest" | "quoteRequest";
      options?: {
        style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
        context?: string;
      };
    }) => {
      return functionsService.generateWidget(payload);
    },
  });
}


