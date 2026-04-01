import { useMutation } from "@tanstack/react-query";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase } from "@/infrastructure/firebase";

interface GetTemplatePreviewHtmlResult {
  html: string;
  type: "invoice" | "email";
}

export function useAdminGetTemplatePreviewHtml() {
  return useMutation({
    mutationFn: async (templateId: string): Promise<GetTemplatePreviewHtmlResult> => {
      const callable = httpsCallable<{ templateId: string }, GetTemplatePreviewHtmlResult>(
        getFunctions(firebase.app),
        "getTemplatePreviewHtml",
      );
      const result = await callable({ templateId });
      return result.data;
    },
  });
}
