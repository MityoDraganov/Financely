import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";

interface ListWidgetDefinitionsPayload {
	organizationId: string;
}

/**
 * Returns all modular widget definitions for an organization. Callable.
 */
export const listWidgetDefinitions = onCall<ListWidgetDefinitionsPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 30,
	},
	async (request) => {
		const { organizationId } = request.data ?? {};
		if (!organizationId) {
			throw new HttpsError(
				"invalid-argument",
				"organizationId is required"
			);
		}
		const databaseService = getDatabaseService();
		const organizationRepository = getOrganizationRepository(databaseService);
		const org = await organizationRepository.get({ id: organizationId });
		if (!org) {
			throw new HttpsError("not-found", "Organization not found");
		}
		const widgetDefinitionRepository =
			getWidgetDefinitionRepository(databaseService);
		const all = await widgetDefinitionRepository.getAll({
			queryConstraints: [{ field: "orgId", operator: "==", value: organizationId }],
			pagination: { limit: 100 },
		});
		const definitions = all.map((d) => ({
			id: (d as { id: string }).id,
			orgId: (d as { orgId: string }).orgId,
			name: (d as { name: string }).name,
			status: (d as { status: string }).status,
			publishedVersionId: (d as { publishedVersionId: string | null })
				.publishedVersionId,
		}));
		return { definitions };
	}
);
