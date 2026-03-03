import { getByPath } from "@/utils/template-preview-utils";

export type OrganizationImageAssetRef = "organization.logo" | "organization.favicon";
export type TemplateImageResolutionMode = "resolve-org-assets" | "preserve-original";

const LOGO_SOURCE_ALIASES = new Set([
	"logo",
	"brand_logo",
	"brand-logo",
	"company_logo",
	"company-logo",
	"org_logo",
	"org-logo",
	"organization_logo",
	"organization-logo",
]);

const FAVICON_SOURCE_ALIASES = new Set([
	"favicon",
	"brand_favicon",
	"brand-favicon",
	"company_favicon",
	"company-favicon",
	"org_favicon",
	"org-favicon",
	"organization_favicon",
	"organization-favicon",
]);

function asNonEmptyString(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.trim();
}

function resolveFaviconUrlFromContext(context: unknown): string {
	const pathCandidates = [
		"__brandFaviconUrl",
		"organization.settings.branding.customFavicon",
		"branding.customFavicon",
		"faviconUrl",
		"favicon",
	];

	for (const path of pathCandidates) {
		const resolved = asNonEmptyString(getByPath<unknown>(context, path));
		if (resolved) return resolved;
	}

	return "";
}

function resolveLogoUrlFromContext(context: unknown): string {
	const pathCandidates = [
		"__brandLogoUrl",
		"organization.settings.branding.customLogo",
		"organization.logoUrl",
		"branding.customLogo",
		"branding.logoUrl",
		"logoUrl",
		"logo",
	];

	for (const path of pathCandidates) {
		const resolved = asNonEmptyString(getByPath<unknown>(context, path));
		if (resolved) return resolved;
	}

	return "";
}

function resolveAliasedAssetRef(src: string): OrganizationImageAssetRef | undefined {
	const normalized = src.toLowerCase();
	if (LOGO_SOURCE_ALIASES.has(normalized)) return "organization.logo";
	if (FAVICON_SOURCE_ALIASES.has(normalized)) return "organization.favicon";
	return undefined;
}

function resolveOrganizationAssetUrl(
	assetRef: OrganizationImageAssetRef,
	context: unknown,
	fallbackLogoUrl?: string,
	fallbackFaviconUrl?: string
): string {
	if (assetRef === "organization.logo") {
		const contextLogo = resolveLogoUrlFromContext(context);
		if (contextLogo) return contextLogo;
		return asNonEmptyString(fallbackLogoUrl);
	}

	const contextFavicon = resolveFaviconUrlFromContext(context);
	if (contextFavicon) return contextFavicon;
	return asNonEmptyString(fallbackFaviconUrl);
}

export function resolveTemplateImageSource(
	src: string | null | undefined,
	context: unknown,
	fallbackLogoUrl?: string,
	options?: {
		assetRef?: OrganizationImageAssetRef | null;
		fallbackFaviconUrl?: string;
		mode?: TemplateImageResolutionMode;
	}
): string {
	const normalized = asNonEmptyString(src);
	if (!normalized) return "";

	const inferredAssetRef = resolveAliasedAssetRef(normalized);
	const explicitAssetRef = options?.assetRef ?? undefined;
	const assetRef = explicitAssetRef ?? inferredAssetRef;
	const mode = options?.mode ?? "resolve-org-assets";

	if (!assetRef) return normalized;

	if (mode === "preserve-original") {
		// For explicit dynamic assets we keep creator fallback `src`.
		// Legacy alias-only sources have no real original URL, so return empty.
		return explicitAssetRef ? normalized : "";
	}

	const resolvedAsset = resolveOrganizationAssetUrl(
		assetRef,
		context,
		fallbackLogoUrl,
		options?.fallbackFaviconUrl
	);
	if (resolvedAsset) return resolvedAsset;

	return explicitAssetRef ? normalized : "";
}
