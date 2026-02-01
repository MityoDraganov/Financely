import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";
import {
	widgetPagesSchema,
	widgetVersionActionsSchema,
	type WidgetPage,
	type WidgetVersionActions,
} from "../core/entities/widget-block-schema";
import { multiStepOptionsSchema } from "../core/entities/widget-version";

interface SaveModularWidgetVersionPayload {
	organizationId: string;
	widgetId: string;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
	multiStepOptions?: { showProgressBar?: boolean; progressStyle?: string; nextLabel?: string; backLabel?: string; submitLabel?: string };
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
		const { organizationId, widgetId, pages, actions, multiStepOptions } =
			request.data ?? {};
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
		const parsedPages = widgetPagesSchema.safeParse(pages);
		if (!parsedPages.success) {
			throw new HttpsError(
				"invalid-argument",
				"Invalid pages: " + parsedPages.error.message
			);
		}
		const parsedActions = widgetVersionActionsSchema.safeParse(actions ?? {});
		const safeActions = parsedActions.success ? parsedActions.data : {};
		const parsedMultiStep =
			multiStepOptions != null
				? multiStepOptionsSchema.safeParse(multiStepOptions)
				: { success: true as const, data: undefined };
		const safeMultiStep =
			parsedMultiStep.success ? parsedMultiStep.data : undefined;
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
				pages: parsedPages.data,
				actions: safeActions,
				...(safeMultiStep != null && Object.keys(safeMultiStep).length > 0
					? { multiStepOptions: safeMultiStep }
					: {}),
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
