import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";

interface DeleteWidgetDefinitionPayload {
	organizationId: string;
	widgetId: string;
}

/**
 * Deletes a modular widget definition. Callable.
 */
export const deleteWidgetDefinition = onCall<DeleteWidgetDefinitionPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 60,
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
		const organizationRepository = getOrganizationRepository(databaseService);
		const org = await organizationRepository.get({ id: organizationId });
		if (!org) {
			throw new HttpsError("not-found", "Organization not found");
		}
		const widgetDefinitionRepository =
			getWidgetDefinitionRepository(databaseService);
		const definition = await widgetDefinitionRepository.get({ id: widgetId });
		if (!definition || (definition as { orgId: string }).orgId !== organizationId) {
			throw new HttpsError("not-found", "Widget not found");
		}
		await widgetDefinitionRepository.delete({ id: widgetId });
		return { success: true, widgetId };
	}
);
