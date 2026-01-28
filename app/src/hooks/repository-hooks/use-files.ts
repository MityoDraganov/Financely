import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fileService } from "@/services/file-service";
import { CreateFileInput, UpdateFileInput } from "@/core";

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
