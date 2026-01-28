import { useState, useCallback } from "react";
import { storageService } from "@/services/storage/storage-service";

export interface UseFileUploadResult {
  uploadFile: (file: File, path: string) => Promise<string | null>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

export function useFileUpload(): UseFileUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File, path: string): Promise<string | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("File size must be less than 20MB");
      }

      setUploadProgress(25);

      const url = await storageService.uploadFile({
        file,
        path,
        metadata: {
          contentType: file.type,
          customMetadata: {
            uploadedAt: new Date().toISOString(),
          },
        },
      });

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

