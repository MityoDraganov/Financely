import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export interface BusinessInterpretationResult {
  businessType: string;
  industry: string;
  suggestedServices: string[];
  documentTypes: string[];
  templateKeywords: string[];
}

export const useInterpretBusinessDescription = () => {
  return useMutation({
    mutationFn: async (description: string): Promise<BusinessInterpretationResult> => {
      return functionsService.interpretBusinessDescription({ description });
    },
  });
};
