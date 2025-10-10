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
		queryFn: () => templateRepository.getAll({
			queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
		}),
	});

	// Real-time subscription for collaborative updates
	useEffect(() => {
		if (!orgId) return;

		setIsSubscribed(true);

		const unsubscribe = templateRepository.subscribeToAll(
			orgId,
			(templates: Template[]) => {
				// Update the React Query cache with real-time data
				queryClient.setQueryData(["templates", orgId], templates);
			}
		);

		return () => {
			unsubscribe();
			setIsSubscribed(false);
		};
	}, [orgId, queryClient]);

	return {
		...query,
		isSubscribed,
	};
};
