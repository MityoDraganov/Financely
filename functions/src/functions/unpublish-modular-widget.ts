import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";

interface UnpublishModularWidgetPayload {
	organizationId: string;
	widgetId: string;
}

/**
 * Unpublishes a widget: sets definition.status = draft and definition.publishedVersionId = null. Callable.
 */
export const unpublishModularWidget = onCall<UnpublishModularWidgetPayload>(
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
		await widgetDefinitionRepository.update({
			id: widgetId,
			data: {
				status: "draft",
				publishedVersionId: null,
			},
		});
		return { success: true, widgetId };
	}
);
