import { DynamicIcon, iconNames } from "lucide-react/dynamic";

export { DynamicIcon, iconNames };

/** Lucide icon names are kebab-case. Use this for display (e.g. "file-text" → "File text"). */
export function formatIconNameForDisplay(name: string): string {
	return name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

const ICON_NAMES_SET = new Set<string>(iconNames as readonly string[]);

/**
 * PascalCase (e.g. "FileText") to kebab-case (e.g. "file-text") for backwards compatibility.
 */
function pascalToKebab(s: string): string {
	return s
		.replace(/([A-Z])/g, "-$1")
		.toLowerCase()
		.replace(/^-/, "");
}

/**
 * Returns a valid Lucide icon name for use with DynamicIcon.
 * Accepts kebab-case or legacy PascalCase; falls back to "file-text" if unknown.
 */
export function normalizeIconName(name: string): string {
	if (!name || typeof name !== "string") return "file-text";
	const trimmed = name.trim();
	if (ICON_NAMES_SET.has(trimmed)) return trimmed;
	const kebab = pascalToKebab(trimmed);
	if (ICON_NAMES_SET.has(kebab)) return kebab;
	return "file-text";
}
