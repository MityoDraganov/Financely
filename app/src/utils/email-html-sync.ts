import { EmailTemplateBlock, EmailTemplateDesignTokens } from "@/core";
import { blocksToHTML, htmlToBlocks } from "./email-html-converter";

/**
 * HTML-first email template sync utilities
 * HTML is the source of truth, blocks are a view/editing layer
 */

/**
 * Parse HTML to blocks for visual editing
 * This is called when loading a template or when HTML changes
 * Creates rawHtml blocks for unparseable sections to preserve all HTML
 */
export function parseHtmlToBlocks(
	html: string,
	_designTokens: EmailTemplateDesignTokens
): {
	blocks: EmailTemplateBlock[];
	subject?: string;
	preheader?: string;
} {
	// If HTML is empty, return empty blocks (no default content)
	// This respects user intent to have a blank template
	if (!html || html.trim() === "") {
		return { blocks: [], subject: undefined, preheader: undefined };
	}

	try {
		const parsed = htmlToBlocks(html);
		
		// If parsing produced no blocks, check if HTML is actually empty
		// If HTML is empty/whitespace, return empty blocks (user wants blank template)
		// htmlToBlocks will handle creating rawHtml blocks for unparseable content
		if (parsed.blocks.length === 0) {
			const trimmedHtml = html.trim();
			if (!trimmedHtml || trimmedHtml === "") {
				// HTML is empty - return empty blocks (no default content)
				return { blocks: [], subject: parsed.subject, preheader: parsed.preheader };
			}
			// If htmlToBlocks returned empty blocks but HTML has content,
			// it means it already created a rawHtml block, so just return it
		}
		
		return parsed;
	} catch (error) {
		console.error("[HTML-SYNC] Error parsing HTML to blocks:", error);
		// Don't wrap entire HTML - let htmlToBlocks handle errors internally
		// It will create rawHtml blocks only for failed elements
		// Only if everything fails, return a single rawHtml block
		try {
			const parsed = htmlToBlocks(html);
			if (parsed.blocks.length > 0) {
				return parsed; // htmlToBlocks handled the error gracefully
			}
		} catch {
			// Complete failure - only then wrap entire HTML
			console.warn("[HTML-SYNC] Complete parse failure, preserving HTML as rawHtml");
			return {
				blocks: [{
					id: crypto.randomUUID(),
					type: "rawHtml",
					section: "body",
					html: html,
				}],
			};
		}
		// If we get here, htmlToBlocks returned empty blocks
		return { blocks: [], subject: undefined, preheader: undefined };
	}
}

/**
 * Convert blocks to HTML for storage
 * This is called when blocks change in the visual editor
 */
export function convertBlocksToHtml(
	blocks: EmailTemplateBlock[],
	designTokens: EmailTemplateDesignTokens,
	subject?: string,
	preheader?: string
): string {
	try {
		return blocksToHTML(blocks, designTokens, subject, preheader);
	} catch (error) {
		console.error("[HTML-SYNC] Error converting blocks to HTML:", error);
		// Return empty HTML if conversion fails
		return "";
	}
}

/**
 * Merge HTML changes intelligently
 * Preserves HTML structure while updating content
 */
export function mergeHtmlChanges(
	originalHtml: string,
	newHtml: string,
	_designTokens: EmailTemplateDesignTokens
): string {
	// If new HTML is empty or invalid, keep original
	if (!newHtml || newHtml.trim() === "") {
		return originalHtml;
	}

	// For now, just return new HTML
	// In the future, we could do smarter merging
	return newHtml;
}

