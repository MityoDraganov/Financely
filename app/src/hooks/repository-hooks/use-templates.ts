import { Template } from "@/core";
import { getTemplateRealtimeRepository } from "@/repositories/template-realtime-repository";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const templateRepository = getTemplateRealtimeRepository();

/**
 * Hook for templates with real-time synchronization
 * Automatically updates when templates change in the database (collaborative editing)
 */
export const useTemplates = (orgId: string = "demo-org") => {
	const queryClient = useQueryClient();
	const [isSubscribed, setIsSubscribed] = useState(false);

	// Initial fetch
	const query = useQuery({
		queryKey: ["templates", orgId],
		queryFn: async () => {
			console.log("[USE-TEMPLATES] Initial fetch for orgId:", orgId);
			const result = await templateRepository.getAll({
				queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
			});
			console.log("[USE-TEMPLATES] Initial fetch result:", result);
			return result;
		},
	});

	// Real-time subscription for collaborative updates
	useEffect(() => {
		if (!orgId) {
			console.log("[USE-TEMPLATES] No orgId provided, skipping subscription");
			return;
		}

		console.log("[USE-TEMPLATES] Setting up subscription for orgId:", orgId);
		setIsSubscribed(true);

		let unsubscribe: (() => void) | null = null;
		
		try {
			unsubscribe = templateRepository.subscribeToAll(
				orgId,
				(templates: Template[]) => {
					console.log("[USE-TEMPLATES] Real-time update received:", templates.length, "templates");
					// Update the React Query cache with real-time data
					queryClient.setQueryData(["templates", orgId], templates);
				}
			);
		} catch (error) {
			console.error("[USE-TEMPLATES] Failed to set up subscription:", error);
			setIsSubscribed(false);
		}

		return () => {
			console.log("[USE-TEMPLATES] Cleaning up subscription for orgId:", orgId);
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
