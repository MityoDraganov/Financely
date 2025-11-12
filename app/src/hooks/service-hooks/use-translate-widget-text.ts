/**
 * React Query hook for translating widget text using AI
 */

import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export function useTranslateWidgetText() {
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      languageCode: string;
      languageName: string;
      translations: Array<{
        key: string;
        english: string;
      }>;
    }) => {
      return functionsService.translateWidgetText(payload);
    },
  });
}

