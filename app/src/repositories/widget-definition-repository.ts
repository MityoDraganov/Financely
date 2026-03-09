import type {
	DatabaseService,
	QueryConstraint,
	WidgetDefinition,
	WidgetDefinitionData,
} from "@/core";
import type { GenericRepository } from "@/core/ports/repositories/generic-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

export type WidgetDefinitionListItem = {
	id: string;
	orgId: string;
	name: string;
	status: WidgetDefinition["status"];
	publishedVersionId: string | null;
};

export type WidgetDefinitionRepository = GenericRepository<
	WidgetDefinition,
	WidgetDefinitionData
> & {
	listByOrganization: (organizationId: string) => Promise<WidgetDefinitionListItem[]>;
};

export function getWidgetDefinitionRepository(
	databaseService: DatabaseService,
): WidgetDefinitionRepository {
	const repository = getGenericRepository<WidgetDefinition, WidgetDefinitionData>(
		() => DatabaseCollection.WIDGET_DEFINITIONS,
		databaseService,
	);

	return {
		...repository,
		async listByOrganization(organizationId) {
			const queryConstraints: QueryConstraint[] = [
				{ field: "orgId", operator: "==", value: organizationId },
			];

			const definitions = await repository.getAll({
				queryConstraints,
				pagination: { limit: 100 },
			});

			return definitions.map((definition) => ({
				id: definition.id,
				orgId: definition.orgId,
				name: definition.name,
				status: definition.status,
				publishedVersionId: definition.publishedVersionId,
			}));
		},
	};
}
