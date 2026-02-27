import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";
import {
	extractIpFromRequest,
	normalizeOrganizationId,
} from "../middleware";
import { getRateLimiter } from "../middleware";
import { getConfigCache } from "../middleware/config-cache";

/**
 * Public API: get modular widget config by organizationId and widgetId.
 * GET /getModularWidgetConfig?organizationId=xxx&widgetId=yyy&widgetVersionId=zzz (optional)
 * Returns branding + widget (schema, actions, versionId). If widgetVersionId omitted, uses published version.
 */
export const getModularWidgetConfig = onRequest(
	{
		region: "us-central1",
		cors: true,
		invoker: "public",
		ingressSettings: "ALLOW_ALL",
	},
	async (request, response) => {
		const ipAddress = extractIpFromRequest(request);
		try {
			if (request.method !== "GET") {
				response.status(405).json({ error: "Method not allowed" });
				return;
			}
			const rawOrgId = request.query.organizationId;
			const rawWidgetId = request.query.widgetId;
			const rawVersionId = request.query.widgetVersionId;
			const organizationId = normalizeOrganizationId(
				typeof rawOrgId === "string" ? rawOrgId : undefined
			);
			const widgetId =
				typeof rawWidgetId === "string" && rawWidgetId.trim()
					? rawWidgetId.trim()
					: null;
			const widgetVersionId =
				typeof rawVersionId === "string" && rawVersionId.trim()
					? rawVersionId.trim()
					: null;
			if (!organizationId || !widgetId) {
				response.status(400).json({
					error: "organizationId and widgetId query parameters are required",
				});
				return;
			}
			const rateLimiter = getRateLimiter();
			const rateLimitResult = await rateLimiter.checkLimit(
				"get-modular-widget-config",
				ipAddress,
				organizationId
			);
			if (!rateLimitResult.allowed) {
				response.status(429).json({
					error: "Rate limit exceeded",
					retryAfter: rateLimitResult.resetIn,
				});
				return;
			}
			const databaseService = getDatabaseService();
			const organizationRepository = getOrganizationRepository(databaseService);
			const widgetDefinitionRepository =
				getWidgetDefinitionRepository(databaseService);
			const widgetVersionRepository = getWidgetVersionRepository(databaseService);
			const organization = await organizationRepository.get({
				id: organizationId,
			});
			if (!organization) {
				response.status(404).json({ error: "Organization not found" });
				return;
			}
			if (organization.status !== "active") {
				response.status(403).json({
					error: "Organization is not active",
				});
				return;
			}
			const definition = await widgetDefinitionRepository.get({
				id: widgetId,
			});
			if (!definition) {
				response.status(404).json({ error: "Widget not found" });
				return;
			}
			const defOrgId = (definition as { orgId: string }).orgId;
			if (defOrgId !== organizationId) {
				response.status(403).json({
					error: "Widget does not belong to this organization",
				});
				return;
			}
			const status = (definition as { status: string }).status;
			const publishedVersionId = (definition as { publishedVersionId: string | null })
				.publishedVersionId;
			const versionIdToLoad =
				widgetVersionId ?? (status === "published" ? publishedVersionId : null);
			const cacheKey = `modular-widget:${organizationId}:${widgetId}:${versionIdToLoad ?? "none"}`;
			const cache = getConfigCache();
			const cached = versionIdToLoad ? cache.get<unknown>(cacheKey) : null;
			if (cached) {
				response.setHeader("Cache-Control", "public, max-age=300");
				response.setHeader("X-Cache", "HIT");
				response.status(200).json(cached);
				return;
			}
			if (!versionIdToLoad) {
				const branding404 = organization.settings?.branding;
				const brandColors404 = organization.settings?.brandColors ?? {
					primary: "#2563eb",
					secondary: "#6b7280",
					accent: "#10b981",
				};
				response.status(404).json({
					error: "Widget has no published version",
					branding: {
						logo: branding404?.customLogo ?? (organization as { logoUrl?: string }).logoUrl ?? null,
						companyName: branding404?.companyName ?? organization.name,
						colors: brandColors404,
					},
					pageConfig: (definition as { pageConfig?: unknown }).pageConfig ?? null,
				});
				return;
			}
			const version = await widgetVersionRepository.get({
				id: versionIdToLoad,
			});
			if (!version) {
				response.status(404).json({ error: "Widget version not found" });
				return;
			}
			const versionWidgetId = (version as { widgetId: string }).widgetId;
			if (versionWidgetId !== widgetId) {
				response.status(400).json({
					error: "Version does not belong to this widget",
				});
				return;
			}
			const branding = organization.settings?.branding;
			const brandColors = organization.settings?.brandColors ?? {
				primary: "#2563eb",
				secondary: "#6b7280",
				accent: "#10b981",
			};
			const config = {
				organizationId: organization.id,
				branding: {
					logo: branding?.customLogo ?? organization.logoUrl ?? null,
					companyName: branding?.companyName ?? organization.name,
					colors: brandColors,
				},
				pageConfig: (definition as { pageConfig?: unknown }).pageConfig ?? null,
				widget: {
					widgetId,
					name: (definition as { name: string }).name,
					versionId: (version as { id: string }).id,
					pages: (version as { pages: unknown }).pages,
					actions: (version as { actions: unknown }).actions,
					multiStepOptions: (version as { multiStepOptions?: unknown }).multiStepOptions,
				},
			};
			cache.set(cacheKey, config, 300);
			response.setHeader("Cache-Control", "public, max-age=300");
			response.setHeader("X-Cache", "MISS");
			response.status(200).json(config);
		} catch (error) {
			logger.error("Error fetching modular widget config", {
				error: error instanceof Error ? error.message : "Unknown error",
				query: request.query,
			});
			response.status(500).json({
				error: "Internal server error",
			});
		}
	}
);
