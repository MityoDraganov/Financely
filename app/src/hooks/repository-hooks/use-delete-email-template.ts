import { useMutation, useQueryClient } from "@tanstack/react-query";
import { emailTemplateService } from "@/services/email-template-service";
import { toast } from "sonner";

export function useDeleteEmailTemplate(orgId?: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (templateId: string) => {
			await emailTemplateService.delete(templateId, orgId);
		},
		onSuccess: () => {
			if (orgId) {
				queryClient.invalidateQueries({ queryKey: ["email-templates", orgId] });
			}
			toast.success("Email template deleted");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to delete email template: ${message}`);
		},
	});
}

