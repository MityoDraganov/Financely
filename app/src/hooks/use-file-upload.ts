import { useState, useCallback } from "react";
import { storageService } from "@/services/storage/storage-service";
import { functionsService } from "@/services/functions/functions-service";

export interface UseFileUploadResult {
  uploadFile: (
    file: File,
    path: string,
    options?: {
      validationMode?: "default" | "image" | "video" | "any";
    },
  ) => Promise<string | null>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

export function useFileUpload(): UseFileUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (
    file: File,
    path: string,
    options?: {
      validationMode?: "default" | "image" | "video" | "any";
    },
  ): Promise<string | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("File size must be less than 20MB");
      }

      setUploadProgress(25);

      const organizationIdMatch = path.match(/organizations\/([^/]+)/);
      const organizationId = organizationIdMatch?.[1];
      let url: string;

      if (organizationId) {
        const contentType = file.type || "application/octet-stream";
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
              reject(new Error("Failed to read file"));
              return;
            }
            const raw = result.includes(",") ? result.split(",")[1] : result;
            resolve(raw);
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        setUploadProgress(60);
        const response = await functionsService.uploadFile({
          organizationId,
          fileName: file.name,
          fileData: base64Data,
          contentType,
          path,
          validationMode: options?.validationMode,
        });
        url = response.url;
      } else {
        url = await storageService.uploadFile({
          file,
          path,
          metadata: {
            contentType: file.type,
            customMetadata: {
              uploadedAt: new Date().toISOString(),
            },
          },
        });
      }

      setUploadProgress(100);
      setIsUploading(false);
      return url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload file";
      setError(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
      return null;
    }
  }, []);

  return {
    uploadFile,
    isUploading,
    uploadProgress,
    error,
  };
}
