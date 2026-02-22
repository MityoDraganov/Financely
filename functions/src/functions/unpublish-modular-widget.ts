import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import {
	logAuditFailureForRequest,
	logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

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
		const startTime = Date.now();
		try {
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

			await logAuditSuccessForRequest({
				request,
				operationName: "unpublishModularWidget",
				organizationId,
				action: "template.archived",
				resource: {
					type: "widget",
					id: widgetId,
					name: (definition as { name?: string }).name,
				},
				durationMs: Date.now() - startTime,
				metadata: {
					source: "api",
					sourceDetails: "unpublishModularWidget",
				},
			});

			return { success: true, widgetId };
		} catch (error) {
			const errorPayload = request.data as UnpublishModularWidgetPayload | undefined;
			await logAuditFailureForRequest({
				request,
				operationName: "unpublishModularWidget",
				organizationId: errorPayload?.organizationId,
				action: "template.archived",
				error: error instanceof Error ? error : new Error(String(error)),
				resource: errorPayload?.widgetId
					? {
							type: "widget",
							id: errorPayload.widgetId,
						}
					: undefined,
				metadata: {
					source: "api",
					sourceDetails: "unpublishModularWidget",
				},
			});

			if (error instanceof HttpsError) {
				throw error;
			}

			throw new HttpsError(
				"internal",
				error instanceof Error
					? error.message
					: "Failed to unpublish modular widget"
			);
		}
	}
);
