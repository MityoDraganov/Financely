import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplateService } from "@/services/email-template-service";
import { toast } from "sonner";

export function useBulkDeleteEmailTemplates(orgId?: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (templateIds: string[]) => {
			await Promise.all(templateIds.map((templateId) => emailTemplateService.delete(templateId)));
		},
		onSuccess: () => {
			if (orgId) {
				queryClient.invalidateQueries({ queryKey: ["email-templates", orgId] });
			}
		},
		onError: (error: unknown, templateIds) => {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error(
				`Failed to delete ${templateIds.length} email template${
					templateIds.length === 1 ? "" : "s"
				}: ${message}`,
			);
		},
	});
}


