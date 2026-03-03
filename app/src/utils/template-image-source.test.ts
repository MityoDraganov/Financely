import { describe, expect, it } from "vitest";
import { resolveTemplateImageSource } from "./template-image-source";

describe("resolveTemplateImageSource", () => {
	it("returns static URL as-is", () => {
		expect(resolveTemplateImageSource("https://cdn.example.com/image.png", {})).toBe(
			"https://cdn.example.com/image.png",
		);
	});

	it("resolves legacy logo alias from context", () => {
		const context = {
			organization: {
				settings: {
					branding: {
						customLogo: "https://cdn.example.com/logo.png",
					},
				},
			},
		};

		expect(resolveTemplateImageSource("organization_logo", context)).toBe(
			"https://cdn.example.com/logo.png",
		);
	});

	it("resolves explicit organization asset reference", () => {
		const context = {
			organization: {
				settings: {
					branding: {
						customFavicon: "https://cdn.example.com/favicon.ico",
					},
				},
			},
		};

		expect(
			resolveTemplateImageSource("https://creator.example.com/fallback.ico", context, undefined, {
				assetRef: "organization.favicon",
			}),
		).toBe("https://cdn.example.com/favicon.ico");
	});

	it("preserves creator fallback URL for explicit dynamic assets in original mode", () => {
		expect(
			resolveTemplateImageSource("https://creator.example.com/logo.png", {}, undefined, {
				assetRef: "organization.logo",
				mode: "preserve-original",
			}),
		).toBe("https://creator.example.com/logo.png");
	});

	it("hides legacy alias in preserve-original mode", () => {
		expect(
			resolveTemplateImageSource("organization_logo", {}, undefined, {
				mode: "preserve-original",
			}),
		).toBe("");
	});

	it("falls back to provided favicon fallback URL", () => {
		expect(
			resolveTemplateImageSource("https://creator.example.com/fallback.ico", {}, undefined, {
				assetRef: "organization.favicon",
				fallbackFaviconUrl: "https://viewer.example.com/favicon.ico",
			}),
		).toBe("https://viewer.example.com/favicon.ico");
	});
});
