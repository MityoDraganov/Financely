import { EmailTemplate } from "@/core";
import { getEmailTemplateRealtimeRepository } from "@/repositories/email-template-realtime-repository";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const emailTemplateRepository = getEmailTemplateRealtimeRepository();

/**
 * Hook for email templates with real-time synchronization
 * Automatically updates when templates change in the database (collaborative editing)
 */
export const useEmailTemplates = (orgId: string = "") => {
	const queryClient = useQueryClient();
	const [isSubscribed, setIsSubscribed] = useState(false);

	// Initial fetch
	const query = useQuery({
		queryKey: ["email-templates", orgId],
		queryFn: async () => {
			console.log("[USE-EMAIL-TEMPLATES] Initial fetch for orgId:", orgId);
			const result = await emailTemplateRepository.getAll({
				queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
			});
			console.log("[USE-EMAIL-TEMPLATES] Initial fetch result:", result);
			return result;
		},
		enabled: Boolean(orgId),
	});

	// Real-time subscription for collaborative updates
	useEffect(() => {
		if (!orgId) {
			console.log("[USE-EMAIL-TEMPLATES] No orgId provided, skipping subscription");
			return;
		}

		console.log("[USE-EMAIL-TEMPLATES] Setting up subscription for orgId:", orgId);
		setIsSubscribed(true);

		let unsubscribe: (() => void) | null = null;
		
		try {
			unsubscribe = emailTemplateRepository.subscribeToAll(
				orgId,
				(templates: EmailTemplate[]) => {
					const timestamp = new Date().toISOString();
					console.log("[USE-EMAIL-TEMPLATES] Real-time update received:", {
						timestamp,
						templatesCount: templates.length,
						templateIds: templates.map(t => t.id),
						orgId,
					});
					
					// Log each template's block count
					templates.forEach(template => {
						console.log("[USE-EMAIL-TEMPLATES] Template in update:", {
							id: template.id,
							name: template.name,
							blocksCount: template.blocks?.length ?? 0,
							blocks: template.blocks?.map(b => ({ id: b.id, type: b.type, section: b.section })) ?? [],
						});
					});
					
					// Update the React Query cache with real-time data
					const previousData = queryClient.getQueryData<EmailTemplate[]>(["email-templates", orgId]);
					console.log("[USE-EMAIL-TEMPLATES] Updating React Query cache:", {
						previousCount: previousData?.length ?? 0,
						newCount: templates.length,
						previousIds: previousData?.map(t => t.id) ?? [],
						newIds: templates.map(t => t.id),
					});
					
					queryClient.setQueryData(["email-templates", orgId], templates);
					
					console.log("[USE-EMAIL-TEMPLATES] React Query cache updated successfully");
				}
			);
			console.log("[USE-EMAIL-TEMPLATES] Subscription established successfully");
		} catch (error) {
			console.error("[USE-EMAIL-TEMPLATES] Failed to set up subscription:", error);
			setIsSubscribed(false);
		}

		return () => {
			console.log("[USE-EMAIL-TEMPLATES] Cleaning up subscription for orgId:", orgId);
			if (unsubscribe) {
				unsubscribe();
			}
			setIsSubscribed(false);
		};
	}, [orgId, queryClient]);

	return {
		...query,
		isSubscribed,
	};
};


