import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";

interface GetModularWidgetDraftPayload {
	organizationId: string;
	widgetId: string;
}

/**
 * Returns the widget definition and latest (draft) version for a modular widget. Callable.
 */
export const getModularWidgetDraft = onCall<GetModularWidgetDraftPayload>(
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
		const latest = versions
			.sort(
				(a, b) =>
					(b as { versionNumber: number }).versionNumber -
					(a as { versionNumber: number }).versionNumber
			)[0] ?? null;
		return {
			definition: {
				id: (definition as { id: string }).id,
				orgId: defOrgId,
				name: (definition as { name: string }).name,
				status: (definition as { status: string }).status,
				publishedVersionId: (definition as { publishedVersionId: string | null })
					.publishedVersionId,
			},
			version: latest
				? {
						id: (latest as { id: string }).id,
						widgetId: (latest as { widgetId: string }).widgetId,
						versionNumber: (latest as { versionNumber: number }).versionNumber,
						schema: (latest as { schema: unknown }).schema,
						actions: (latest as { actions: unknown }).actions,
					}
				: null,
		};
	}
);
