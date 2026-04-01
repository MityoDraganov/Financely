import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { firebase } from "@/infrastructure/firebase";

export type PublishOfficialTemplatePackPayload = {
  templateIds: string[];
  requireQaPass?: boolean;
};

export type PublishOfficialTemplatePackResult = {
  published: number;
  skipped: number;
  failed: number;
  details: Array<{
    templateId: string;
    status: "published" | "skipped" | "failed";
    reason?: string;
  }>;
};

export function useAdminPublishOfficialTemplatePack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: PublishOfficialTemplatePackPayload,
    ): Promise<PublishOfficialTemplatePackResult> => {
      const callable = httpsCallable<
        PublishOfficialTemplatePackPayload,
        PublishOfficialTemplatePackResult
      >(
        getFunctions(firebase.app),
        "publishOfficialTemplatePack",
      );
      const result = await callable(payload);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "templates"] });
      toast.success(
        `Publish finished: ${data.published} published, ${data.skipped} skipped, ${data.failed} failed`,
      );
    },
    onError: (error) => {
      toast.error(
        `Official template publish failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    },
  });
}

