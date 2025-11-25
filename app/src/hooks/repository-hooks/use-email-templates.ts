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
					console.log("[USE-EMAIL-TEMPLATES] Real-time update received:", templates.length, "templates");
					// Update the React Query cache with real-time data
					queryClient.setQueryData(["email-templates", orgId], templates);
				}
			);
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


