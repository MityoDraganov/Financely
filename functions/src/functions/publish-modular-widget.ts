import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";

interface PublishModularWidgetPayload {
	organizationId: string;
	widgetId: string;
	versionId: string;
}

/**
 * Publishes a widget version: sets definition.status = published and definition.publishedVersionId = versionId. Callable.
 */
export const publishModularWidget = onCall<PublishModularWidgetPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 30,
	},
	async (request) => {
		const { organizationId, widgetId, versionId } = request.data ?? {};
		if (!organizationId || !widgetId || !versionId) {
			throw new HttpsError(
				"invalid-argument",
				"organizationId, widgetId, and versionId are required"
			);
		}
		const databaseService = getDatabaseService();
		const widgetDefinitionRepository =
			getWidgetDefinitionRepository(databaseService);
		const widgetVersionRepository = getWidgetVersionRepository(databaseService);
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
		const version = await widgetVersionRepository.get({ id: versionId });
		if (!version) {
			throw new HttpsError("not-found", "Version not found");
		}
		const versionWidgetId = (version as { widgetId: string }).widgetId;
		if (versionWidgetId !== widgetId) {
			throw new HttpsError(
				"invalid-argument",
				"Version does not belong to this widget"
			);
		}
		await widgetDefinitionRepository.update({
			id: widgetId,
			data: {
				status: "published",
				publishedVersionId: versionId,
			},
		});
		return { success: true, widgetId, versionId };
	}
);
