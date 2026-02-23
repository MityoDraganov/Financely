import { getByPath } from "@/utils/template-preview-utils";

const IMAGE_SOURCE_ALIASES = new Set([
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

function asNonEmptyString(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.trim();
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

export function resolveTemplateImageSource(
	src: string | null | undefined,
	context: unknown,
	fallbackLogoUrl?: string
): string {
	const normalized = asNonEmptyString(src);
	if (!normalized) return "";
	if (!IMAGE_SOURCE_ALIASES.has(normalized.toLowerCase())) return normalized;

	const contextLogo = resolveLogoUrlFromContext(context);
	if (contextLogo) return contextLogo;

	const fallback = asNonEmptyString(fallbackLogoUrl);
	return fallback;
}
