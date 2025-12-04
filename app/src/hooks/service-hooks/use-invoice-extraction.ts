import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { toast } from "sonner";
import { useUploadFile } from "./use-upload-file";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import type { ExtractionJob } from "@/repositories/extraction-job-repository";
import { useEffect } from "react";
import { DatabaseCollection } from "@/repositories/config";

const databaseService = serviceHost.getDatabaseService();

/**
 * Hook to upload an invoice file and create an extraction job
 */
export function useUploadInvoiceFile() {
  const queryClient = useQueryClient();
  const uploadFile = useUploadFile();

  const { data: currentOrganization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!currentOrganization?.id) {
        throw new Error("Organization ID is required");
      }

      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload file to Firebase Storage
      const uploadResult = await uploadFile.mutateAsync({
        organizationId: currentOrganization.id,
        fileName: file.name,
        fileData,
        contentType: file.type,
        path: `organizations/${currentOrganization.id}/invoice-extractions/${Date.now()}-${file.name}`,
      });

      // Determine file type
      const fileType = file.type === "application/pdf" 
        ? "pdf" 
        : file.type as "image/jpeg" | "image/png" | "image/jpg" | "image/webp";

      // Create extraction job
      const result = await functionsService.uploadInvoiceFile({
        orgId: currentOrganization.id,
        fileUrl: uploadResult.url,
        fileName: file.name,
        fileType,
        fileSizeBytes: file.size,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extraction-jobs"] });
      toast.success("Invoice file uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to upload invoice file", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to extract invoice data from an uploaded file
 */
export function useExtractInvoiceData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      return functionsService.extractInvoiceData({ jobId });
    },
    onSuccess: async (result, jobId) => {
      // Immediately update the cache with the returned job data
      queryClient.setQueryData(["extraction-job", jobId], result.job);
      
      // Invalidate and refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["extraction-jobs"] });
      await queryClient.refetchQueries({ queryKey: ["extraction-job", jobId] });
      
      if (result.job.status === "extracted") {
        toast.success("Invoice data extracted successfully");
      } else if (result.job.status === "failed") {
        toast.error("Failed to extract invoice data", {
          description: result.job.errorMessage,
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to extract invoice data", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to get extraction jobs for an organization
 */
export function useExtractionJobs(orgId?: string) {
  return useQuery({
    queryKey: ["extraction-jobs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const extractionJobRepository = repositoryHost.getExtractionJobRepository(databaseService);
      
      return extractionJobRepository.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId }
        ],
        orderBy: { field: "createdAt", direction: "desc" }
      });
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to get an extraction job by ID with real-time updates
 */
export function useExtractionJob(jobId: string | null) {
  const queryClient = useQueryClient();
  
  // Initial query
  const query = useQuery({
    queryKey: ["extraction-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const extractionJobRepository = repositoryHost.getExtractionJobRepository(databaseService);
      
      return extractionJobRepository.get({ id: jobId });
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data as ExtractionJob | null | undefined;
      // Poll every 2 seconds if job is processing or pending
      if (job?.status === "processing" || job?.status === "pending") {
        return 2000;
      }
      // Continue polling briefly after extraction completes to catch any delayed updates
      // This helps catch the transition from processing -> extracted
      if (job?.status === "extracted" || job?.status === "validated" || job?.status === "completed") {
        // Poll for 10 more seconds (5 more times) to ensure we catch the update
        const lastFetchTime = query.state.dataUpdatedAt;
        const timeSinceLastFetch = Date.now() - (lastFetchTime || 0);
        if (timeSinceLastFetch < 10000) {
          return 2000;
        }
      }
      // Stop polling for terminal states after grace period
      return false;
    },
    // Refetch on window focus to catch updates
    refetchOnWindowFocus: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
  });

  // Set up real-time subscription for immediate updates
  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = databaseService.subscribe<ExtractionJob>(
      DatabaseCollection.EXTRACTION_JOBS,
      jobId,
      (updatedJob) => {
        if (updatedJob) {
          // Update React Query cache with real-time data
          queryClient.setQueryData(["extraction-job", jobId], updatedJob);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [jobId, queryClient]);

  return query;
}

