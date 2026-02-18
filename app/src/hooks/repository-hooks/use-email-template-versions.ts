import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emailTemplateService } from "@/services/email-template-service";
import { toast } from "sonner";

export function useEmailTemplateVersions(templateId: string | undefined) {
	return useQuery({
		queryKey: ["emailTemplateVersions", templateId],
		queryFn: async () => {
			if (!templateId) return [];
			return emailTemplateService.listVersions(templateId);
		},
		enabled: Boolean(templateId),
	});
}

export function useSaveEmailTemplateVersion() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			templateId,
			userId,
			description,
		}: {
			templateId: string;
			userId?: string;
			description?: string;
			silent?: boolean;
		}) => {
			return emailTemplateService.saveVersion(templateId, userId, description);
		},
		onSuccess: (result, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["emailTemplateVersions", variables.templateId],
			});
			if (!variables.silent) {
				toast.success(`Version ${result.version} saved`);
			}
		},
		onError: (error: unknown, variables) => {
			if (variables?.silent) return;
			const message = error instanceof Error ? error.message : "Failed to save version";
			toast.error(message);
		},
	});
}

export function useRestoreEmailTemplateVersion() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			templateId,
			version,
		}: {
			templateId: string;
			version: number;
		}) => {
			return emailTemplateService.restoreVersion(templateId, version);
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["emailTemplateVersions", variables.templateId],
			});
			queryClient.invalidateQueries({
				queryKey: ["email-templates"],
			});
			toast.success(`Version ${variables.version} restored`);
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Failed to restore version";
			toast.error(message);
		},
	});
}
