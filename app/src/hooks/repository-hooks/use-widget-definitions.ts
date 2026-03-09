import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWidgetDefinitionRepository } from "@/repositories/widget-definition-repository";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const widgetDefinitionRepository = getWidgetDefinitionRepository(databaseService);
export type { WidgetDefinitionListItem } from "@/repositories/widget-definition-repository";

/**
 * Fetches widget definitions for an organization.
 */
export function useWidgetDefinitions(organizationId: string) {
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: ["widget-definitions", organizationId],
		queryFn: () => widgetDefinitionRepository.listByOrganization(organizationId),
		enabled: Boolean(organizationId),
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["widget-definitions", organizationId] });
	};

	return { ...query, invalidate };
}
