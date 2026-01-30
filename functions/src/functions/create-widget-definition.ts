import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";

interface CreateWidgetDefinitionPayload {
	organizationId: string;
	name: string;
}

/**
 * Creates a new modular widget definition (draft). Callable.
 */
export const createWidgetDefinition = onCall<CreateWidgetDefinitionPayload>(
	{
		region: "us-central1",
		cors: true,
		timeoutSeconds: 60,
	},
	async (request) => {
		const { organizationId, name } = request.data ?? {};
		if (!organizationId || typeof name !== "string" || !name.trim()) {
			throw new HttpsError(
				"invalid-argument",
				"organizationId and name are required"
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
		const id = await widgetDefinitionRepository.create({
			data: {
				orgId: organizationId,
				name: name.trim(),
				status: "draft",
				publishedVersionId: null,
			},
		});
		return { success: true, widgetId: id };
	}
);
