import { useMutation } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { toast } from "sonner";

export function useUploadFile() {
  return useMutation({
    mutationFn: async (payload: {
      organizationId: string;
      fileName: string;
      fileData: string; // Base64 encoded
      contentType: string;
      path?: string;
    }) => {
      return await functionsService.uploadFile(payload);
    },
    onError: (error: Error) => {
      toast.error("Failed to upload file", {
        description: error.message,
      });
    },
  });
}

