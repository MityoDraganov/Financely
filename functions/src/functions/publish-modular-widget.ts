import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";
import {
	logAuditFailureForRequest,
	logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

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
		const startTime = Date.now();
		try {
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

			await logAuditSuccessForRequest({
				request,
				operationName: "publishModularWidget",
				organizationId,
				action: "template.published",
				resource: {
					type: "widget",
					id: widgetId,
					name: (definition as { name?: string }).name,
				},
				durationMs: Date.now() - startTime,
				metadata: {
					source: "api",
					sourceDetails: "publishModularWidget",
					customFields: {
						versionId,
					},
				},
			});

			return { success: true, widgetId, versionId };
		} catch (error) {
			const errorPayload = request.data as PublishModularWidgetPayload | undefined;
			await logAuditFailureForRequest({
				request,
				operationName: "publishModularWidget",
				organizationId: errorPayload?.organizationId,
				action: "template.published",
				error: error instanceof Error ? error : new Error(String(error)),
				resource: errorPayload?.widgetId
					? {
							type: "widget",
							id: errorPayload.widgetId,
						}
					: undefined,
				metadata: {
					source: "api",
					sourceDetails: "publishModularWidget",
					customFields: {
						versionId: errorPayload?.versionId,
					},
				},
			});

			if (error instanceof HttpsError) {
				throw error;
			}

			throw new HttpsError(
				"internal",
				error instanceof Error ? error.message : "Failed to publish modular widget"
			);
		}
	}
);
