import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { widgetPageConfigSchema } from "../core/entities/widget-definition";

interface UpdateWidgetDefinitionPayload {
	organizationId: string;
	widgetId: string;
	name?: string;
	pageConfig?: unknown;
}

/**
 * Updates a modular widget definition (name and/or pageConfig). Callable.
 */
export const updateWidgetDefinition = onCall<UpdateWidgetDefinitionPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 60,
	},
	async (request) => {
		const { organizationId, widgetId, name, pageConfig } = request.data ?? {};
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
		if (!definition || definition.orgId !== organizationId) {
			throw new HttpsError("not-found", "Widget not found");
		}

		const updateData: Record<string, unknown> = {};

		if (typeof name === "string" && name.trim()) {
			updateData.name = name.trim();
		}

		if (pageConfig !== undefined) {
			if (pageConfig === null) {
				updateData.pageConfig = null;
			} else {
				const parsed = widgetPageConfigSchema.safeParse(pageConfig);
				if (!parsed.success) {
					throw new HttpsError("invalid-argument", "Invalid pageConfig: " + parsed.error.message);
				}
				updateData.pageConfig = parsed.data;
			}
		}

		if (Object.keys(updateData).length === 0) {
			return { success: true, widgetId };
		}

		await widgetDefinitionRepository.update({
			id: widgetId,
			data: updateData,
		});
		return { success: true, widgetId };
	}
);
