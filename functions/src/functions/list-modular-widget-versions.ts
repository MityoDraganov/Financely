import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";

interface ListModularWidgetVersionsPayload {
	organizationId: string;
	widgetId: string;
}

/**
 * Returns all versions for a modular widget (for version history UI). Callable.
 */
export const listModularWidgetVersions = onCall<ListModularWidgetVersionsPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 30,
	},
	async (request) => {
		const { organizationId, widgetId } = request.data ?? {};
		if (!organizationId || !widgetId) {
			throw new HttpsError(
				"invalid-argument",
				"organizationId and widgetId are required"
			);
		}
		const databaseService = getDatabaseService();
		const widgetDefinitionRepository =
			getWidgetDefinitionRepository(databaseService);
		const definition = await widgetDefinitionRepository.get({ id: widgetId });
		if (!definition) {
			throw new HttpsError("not-found", "Widget not found");
		}
		const defOrgId = (definition as { orgId: string }).orgId;
		if (defOrgId !== organizationId) {
			throw new HttpsError(
				"permission-denied",
				"Widget does not belong to this organization"
			);
		}
		const widgetVersionRepository = getWidgetVersionRepository(databaseService);
		const versions = await widgetVersionRepository.getAll({
			queryConstraints: [{ field: "widgetId", operator: "==", value: widgetId }],
			pagination: { limit: 100 },
		});
		const sorted = versions
			.map((v) => ({
				id: (v as { id: string }).id,
				versionNumber: (v as { versionNumber: number }).versionNumber,
				createdAt: (v as { createdAt?: string }).createdAt,
			}))
			.sort((a, b) => b.versionNumber - a.versionNumber);
		return { versions: sorted };
	}
);
