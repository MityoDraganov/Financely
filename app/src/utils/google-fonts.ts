export type GoogleFontCategory =
	| "sans-serif"
	| "serif"
	| "display"
	| "handwriting"
	| "monospace";

export type GoogleFontOption = {
	family: string;
	category: GoogleFontCategory;
	popular?: boolean;
};

export const GOOGLE_FONT_CATEGORIES: Array<{ value: "all" | GoogleFontCategory; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "sans-serif", label: "Sans Serif" },
	{ value: "serif", label: "Serif" },
	{ value: "display", label: "Display" },
	{ value: "handwriting", label: "Handwriting" },
	{ value: "monospace", label: "Monospace" },
];

export const GOOGLE_FONT_OPTIONS: GoogleFontOption[] = [
	{ family: "Inter", category: "sans-serif", popular: true },
	{ family: "Roboto", category: "sans-serif", popular: true },
	{ family: "Open Sans", category: "sans-serif", popular: true },
	{ family: "Lato", category: "sans-serif", popular: true },
	{ family: "Poppins", category: "sans-serif", popular: true },
	{ family: "Montserrat", category: "sans-serif", popular: true },
	{ family: "Nunito", category: "sans-serif", popular: true },
	{ family: "Raleway", category: "sans-serif" },
	{ family: "Work Sans", category: "sans-serif" },
	{ family: "Rubik", category: "sans-serif" },
	{ family: "Manrope", category: "sans-serif" },
	{ family: "Quicksand", category: "sans-serif" },
	{ family: "Mulish", category: "sans-serif" },
	{ family: "Cabin", category: "sans-serif" },
	{ family: "Karla", category: "sans-serif" },
	{ family: "Noto Sans", category: "sans-serif" },
	{ family: "Figtree", category: "sans-serif" },
	{ family: "DM Sans", category: "sans-serif" },
	{ family: "IBM Plex Sans", category: "sans-serif" },
	{ family: "Source Sans 3", category: "sans-serif" },
	{ family: "Playfair Display", category: "serif", popular: true },
	{ family: "Merriweather", category: "serif", popular: true },
	{ family: "Lora", category: "serif", popular: true },
	{ family: "PT Serif", category: "serif" },
	{ family: "Libre Baskerville", category: "serif" },
	{ family: "Cormorant Garamond", category: "serif" },
	{ family: "Bitter", category: "serif" },
	{ family: "Source Serif 4", category: "serif" },
	{ family: "Crimson Text", category: "serif" },
	{ family: "Alegreya", category: "serif" },
	{ family: "Oswald", category: "display", popular: true },
	{ family: "Bebas Neue", category: "display", popular: true },
	{ family: "Anton", category: "display" },
	{ family: "Barlow Condensed", category: "display" },
	{ family: "Abril Fatface", category: "display" },
	{ family: "Archivo Black", category: "display" },
	{ family: "Sora", category: "display" },
	{ family: "League Spartan", category: "display" },
	{ family: "Righteous", category: "display" },
	{ family: "Permanent Marker", category: "handwriting" },
	{ family: "Caveat", category: "handwriting" },
	{ family: "Pacifico", category: "handwriting" },
	{ family: "Dancing Script", category: "handwriting" },
	{ family: "Satisfy", category: "handwriting" },
	{ family: "Shadows Into Light", category: "handwriting" },
	{ family: "Great Vibes", category: "handwriting" },
	{ family: "Indie Flower", category: "handwriting" },
	{ family: "Fira Code", category: "monospace", popular: true },
	{ family: "Source Code Pro", category: "monospace", popular: true },
	{ family: "JetBrains Mono", category: "monospace", popular: true },
	{ family: "IBM Plex Mono", category: "monospace" },
	{ family: "Space Mono", category: "monospace" },
	{ family: "Inconsolata", category: "monospace" },
	{ family: "Courier Prime", category: "monospace" },
];

let fetchedCatalogCache: GoogleFontOption[] | null = null;

const loadedFamilies = new Set<string>();

function encodeFamily(family: string): string {
	return encodeURIComponent(family.trim()).replace(/%20/g, "+");
}

export function buildGoogleFontsCssHref(families: string[]): string {
	const unique = Array.from(
		new Set(
			families
				.map((family) => family.trim())
				.filter((family) => family.length > 0)
		)
	);
	if (unique.length === 0) return "";

	const familyParams = unique
		.map((family) => `family=${encodeFamily(family)}:wght@400;500;600;700`)
		.join("&");
	return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

export function loadGoogleFonts(families: string[]): void {
	if (typeof document === "undefined") return;

	const pending = families
		.filter((family): family is string => typeof family === "string")
		.map((family) => family.trim())
		.filter((family) => family.length > 0 && !loadedFamilies.has(family));
	if (pending.length === 0) return;

	const chunkSize = 12;
	for (let i = 0; i < pending.length; i += chunkSize) {
		const chunk = pending.slice(i, i + chunkSize);
		const href = buildGoogleFontsCssHref(chunk);
		if (!href) continue;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = href;
		link.dataset.googleFonts = chunk.join("|");
		document.head.appendChild(link);
	}

	pending.forEach((family) => loadedFamilies.add(family));
}

function mapApiCategory(input: string): GoogleFontCategory {
	if (input === "serif") return "serif";
	if (input === "display") return "display";
	if (input === "handwriting") return "handwriting";
	if (input === "monospace") return "monospace";
	return "sans-serif";
}

export async function fetchGoogleFontsCatalog(): Promise<GoogleFontOption[]> {
	if (fetchedCatalogCache) return fetchedCatalogCache;

	const apiKey = (import.meta.env.VITE_GOOGLE_FONTS_API_KEY as string | undefined)?.trim();
	if (!apiKey) {
		fetchedCatalogCache = GOOGLE_FONT_OPTIONS;
		return fetchedCatalogCache;
	}

	try {
		const response = await fetch(
			`https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(apiKey)}&sort=popularity`
		);
		if (!response.ok) {
			fetchedCatalogCache = GOOGLE_FONT_OPTIONS;
			return fetchedCatalogCache;
		}

		const data = (await response.json()) as {
			items?: Array<{ family?: string; category?: string }>;
		};
		const items = Array.isArray(data.items) ? data.items : [];
		const mapped = items
			.filter((item): item is { family: string; category?: string } => typeof item.family === "string")
			.slice(0, 350)
			.map((item, index) => ({
				family: item.family.trim(),
				category: mapApiCategory(item.category || "sans-serif"),
				popular: index < 60,
			}))
			.filter((item) => item.family.length > 0);

		fetchedCatalogCache = mapped.length > 0 ? mapped : GOOGLE_FONT_OPTIONS;
		return fetchedCatalogCache;
	} catch {
		fetchedCatalogCache = GOOGLE_FONT_OPTIONS;
		return fetchedCatalogCache;
	}
}
