import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fileService } from "@/services/file-service";
import { storageService } from "@/services/storage/storage-service";
import { CreateFileInput, UpdateFileInput, File as AppFile } from "@/core";

export function useFiles(orgId: string | undefined, params?: { fileType?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["files", orgId, params],
    queryFn: async () => {
      if (!orgId) return [];
      const result = await fileService.listFiles(orgId, params);
      return result || [];
    },
    enabled: !!orgId,
  });
}

export function useFile(id: string | undefined) {
  return useQuery({
    queryKey: ["file", id],
    queryFn: () => fileService.getFile(id || ""),
    enabled: !!id,
  });
}

export function useCreateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFileInput) => fileService.createFile(data),
    onSuccess: () => {
      // Invalidate all files queries - this will match ["files", orgId] and ["files", orgId, params]
      queryClient.invalidateQueries({ 
        queryKey: ["files"],
        exact: false, // Match all queries that start with ["files"]
      });
    },
  });
}

export function useUpdateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFileInput }) =>
      fileService.updateFile(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["file", id] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fileService.deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}

function getFileTypeFromContentType(contentType: string): AppFile["fileType"] {
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";
  if (contentType.includes("model") || contentType.includes("3d")) return "MODEL_3D";
  return "GENERIC";
}

export function useOrganizationStorageFiles(orgId: string | undefined) {
  return useQuery({
    queryKey: ["organization-storage-files", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const storageFiles = await storageService.listFiles(`organizations/${orgId}`);
      return storageFiles.map<AppFile>((storageFile) => ({
        id: storageFile.path,
        organizationId: orgId,
        filename: storageFile.name,
        originalFilename: storageFile.name,
        url: storageFile.url,
        contentType: storageFile.contentType,
        fileSize: storageFile.size,
        fileStatus: "READY",
        fileType: getFileTypeFromContentType(storageFile.contentType),
        metadata: {
          storagePath: storageFile.path,
          ...storageFile.customMetadata,
        },
        createdAt: storageFile.createdAt,
        updatedAt: storageFile.updatedAt,
      }));
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useDeleteOrganizationStorageFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (path: string) => storageService.deleteFile(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-storage-files"] });
    },
  });
}
