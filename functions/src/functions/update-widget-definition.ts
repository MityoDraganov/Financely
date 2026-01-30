import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";

interface UpdateWidgetDefinitionPayload {
	organizationId: string;
	widgetId: string;
	name: string;
}

/**
 * Updates a modular widget definition (e.g. name). Callable.
 */
export const updateWidgetDefinition = onCall<UpdateWidgetDefinitionPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 60,
	},
	async (request) => {
		const { organizationId, widgetId, name } = request.data ?? {};
		if (!organizationId || !widgetId || typeof name !== "string" || !name.trim()) {
			throw new HttpsError(
				"invalid-argument",
				"organizationId, widgetId and name are required"
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
		const definition = await widgetDefinitionRepository.get({ id: widgetId });
		if (!definition || definition.orgId !== organizationId) {
			throw new HttpsError("not-found", "Widget not found");
		}
		await widgetDefinitionRepository.update({
			id: widgetId,
			data: { name: name.trim() },
		});
		return { success: true, widgetId };
	}
);
