import { useQuery, useQueryClient } from "@tanstack/react-query";
import { functionsService } from "@/services/functions/functions-service";

export type WidgetDefinitionListItem = {
	id: string;
	orgId: string;
	name: string;
	status: string;
	publishedVersionId: string | null;
};

/**
 * Fetches widget definitions for an organization.
 */
export function useWidgetDefinitions(organizationId: string) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["widget-definitions", organizationId],
		queryFn: async () => {
			const result = await functionsService.listWidgetDefinitions({
				organizationId,
			});
			return result.definitions as WidgetDefinitionListItem[];
		},
		enabled: Boolean(organizationId),
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["widget-definitions", organizationId] });
	};

	return { ...query, invalidate };
}
