import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";
import {
	widgetBlockTreeSchema,
	widgetVersionActionsSchema,
	type WidgetBlockSchema,
	type WidgetVersionActions,
} from "../core/entities/widget-block-schema";

interface SaveModularWidgetVersionPayload {
	organizationId: string;
	widgetId: string;
	schema: WidgetBlockSchema;
	actions: WidgetVersionActions;
}

/**
 * Saves a new draft version for a modular widget. Callable.
 */
export const saveModularWidgetVersion = onCall<SaveModularWidgetVersionPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 60,
	},
	async (request) => {
		const { organizationId, widgetId, schema, actions } = request.data ?? {};
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
		const parsedSchema = widgetBlockTreeSchema.safeParse(schema);
		if (!parsedSchema.success) {
			throw new HttpsError(
				"invalid-argument",
				"Invalid schema: " + parsedSchema.error.message
			);
		}
		const parsedActions = widgetVersionActionsSchema.safeParse(actions ?? {});
		const safeActions = parsedActions.success ? parsedActions.data : {};
		const widgetVersionRepository = getWidgetVersionRepository(databaseService);
		const existingVersions = await widgetVersionRepository.getAll({
			queryConstraints: [{ field: "widgetId", operator: "==", value: widgetId }],
			pagination: { limit: 500 },
		});
		const maxVersion = existingVersions.length
			? Math.max(
					...existingVersions.map(
						(v) => (v as { versionNumber: number }).versionNumber
					)
				)
			: 0;
		const versionNumber = maxVersion + 1;
		const versionId = await widgetVersionRepository.create({
			data: {
				widgetId,
				versionNumber,
				schema: parsedSchema.data,
				actions: safeActions,
			},
		});
		return {
			success: true,
			widgetId,
			versionId,
			versionNumber,
		};
	}
);
