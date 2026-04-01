import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { firebase } from "@/infrastructure/firebase";

export type GenerateOfficialTemplatePackPayload = {
  dryRun?: boolean;
  overwriteExisting?: boolean;
  blueprintIds?: string[];
};

export type GenerateOfficialTemplatePackResult = {
  runId: string;
  summary: {
    requested: number;
    generated: number;
    qaPassed: number;
    failed: number;
    stored: number;
  };
  results: Array<{
    blueprintId: string;
    type: "invoice" | "email";
    language: "en" | "bg";
    status: "ok" | "failed";
    qaScore?: number;
    checks?: Record<string, boolean>;
    qaWarnings?: string[];
    styleProfileId?: string;
    errors: string[];
    templateId?: string;
  }>;
};

export function useAdminGenerateOfficialTemplatePack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: GenerateOfficialTemplatePackPayload,
    ): Promise<GenerateOfficialTemplatePackResult> => {
      const callable = httpsCallable<
        GenerateOfficialTemplatePackPayload,
        GenerateOfficialTemplatePackResult
      >(
        getFunctions(firebase.app),
        "generateOfficialTemplatePack",
      );
      const result = await callable(payload);
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      if (variables.dryRun) {
        toast.success(
          `Dry run completed: ${data.summary.generated}/${data.summary.requested} generated`,
        );
        return;
      }
      toast.success(
        `Generated drafts: stored ${data.summary.stored}, QA passed ${data.summary.qaPassed}`,
      );
    },
    onError: (error) => {
      toast.error(
        `Official template generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    },
  });
}
