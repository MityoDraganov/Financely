/**
 * Pagination logic for template preview
 * Simple approach: process elements in order, place on pages based on their Y position
 */

import type { Template, TemplateElement } from "@/core/entities/template";
import { resolveTemplateMarginsPx } from "./print-margins";
import { computeTableRuntimeLayout } from "./template-table-layout";

export type TableSlice = {
	start: number;
	end: number;
	isLastSlice: boolean;
};

export type ElementSlice = {
	offsetY: number;
	height: number;
};

export type RenderPage = {
	pageIndex: number;
	elements: TemplateElement[];
	tableSlices: Record<string, TableSlice>;
	elementSlices: Record<string, ElementSlice>;
};

type TableGrowthMeta = {
	table: Extract<TemplateElement, { type: "table" }>;
	layout: ReturnType<typeof computeTableRuntimeLayout>;
	originalHeight: number;
	actualHeight: number;
	heightDiff: number;
};

const BACKGROUND_MATCH_TOLERANCE = 4;
const BACKGROUND_MAX_VERTICAL_PADDING = 96;
const BACKGROUND_MAX_HORIZONTAL_PADDING = 120;
const BACKGROUND_BOTTOM_ALIGNMENT_TOLERANCE = 24;
const BACKGROUND_MIN_HORIZONTAL_OVERLAP_PX = 24;
const BACKGROUND_MIN_VERTICAL_OVERLAP_PX = 12;

function isBehindByZIndex(
	background: TemplateElement,
	backgroundOrder: number,
	foreground: TemplateElement,
	foregroundOrder: number
): boolean {
	const backgroundZ = background.zIndex ?? 0;
	const foregroundZ = foreground.zIndex ?? 0;

	if (backgroundZ !== foregroundZ) {
		return backgroundZ < foregroundZ;
	}

	// Equal z-index layers are common in saved templates; treat them as eligible.
	return backgroundOrder <= foregroundOrder;
}

function calculateBackgroundHeightGrowth(
	background: Extract<TemplateElement, { type: "box" | "path" }>,
	backgroundOrder: number,
	tableGrowth: TableGrowthMeta[],
	elementOrderById: Map<string, number>,
	pageSize: { w: number; h: number },
	usableHeight: number
): number {
	const backgroundLeft = background.x;
	const backgroundRight = background.x + background.width;
	const backgroundTop = background.y;
	const backgroundBottom = background.y + background.height;
	let growth = 0;

	for (const meta of tableGrowth) {
		if (meta.heightDiff <= 0) continue;

		const table = meta.table;
		const tableOrder = elementOrderById.get(table.id) ?? Number.MAX_SAFE_INTEGER;
		if (!isBehindByZIndex(background, backgroundOrder, table, tableOrder)) {
			continue;
		}

		const tableLeft = table.x;
		const tableRight = table.x + table.width;
		const tableTop = table.y;
		const tableBottom = table.y + meta.originalHeight;
		const overlapLeft = Math.max(backgroundLeft, tableLeft);
		const overlapRight = Math.min(backgroundRight, tableRight);
		const horizontalOverlap = Math.max(0, overlapRight - overlapLeft);
		const fullyCoversTable =
			backgroundLeft <= tableLeft + BACKGROUND_MATCH_TOLERANCE &&
			backgroundRight >= tableRight - BACKGROUND_MATCH_TOLERANCE &&
			backgroundTop <= tableTop + BACKGROUND_MATCH_TOLERANCE &&
			backgroundBottom >= tableBottom - BACKGROUND_MATCH_TOLERANCE;
		const coversTableHorizontally =
			backgroundLeft <= tableLeft + BACKGROUND_MATCH_TOLERANCE &&
			backgroundRight >= tableRight - BACKGROUND_MATCH_TOLERANCE;
		const coversTableVertically =
			backgroundTop <= tableTop + BACKGROUND_MATCH_TOLERANCE &&
			backgroundBottom >= tableBottom - BACKGROUND_MATCH_TOLERANCE;

		// Avoid stretching broad page wrappers: we only auto-grow tightly framed table backgrounds.
		const topPadding = Math.max(0, tableTop - backgroundTop);
		const bottomPadding = Math.max(0, backgroundBottom - tableBottom);
		const leftPadding = Math.max(0, tableLeft - backgroundLeft);
		const rightPadding = Math.max(0, backgroundRight - tableRight);
		const tightlyFramed =
			topPadding <= BACKGROUND_MAX_VERTICAL_PADDING &&
			bottomPadding <= BACKGROUND_MAX_VERTICAL_PADDING &&
			leftPadding <= BACKGROUND_MAX_HORIZONTAL_PADDING &&
			rightPadding <= BACKGROUND_MAX_HORIZONTAL_PADDING;
		const verticalOverlap = Math.max(
			0,
			Math.min(backgroundBottom, tableBottom) -
				Math.max(backgroundTop, tableTop)
		);
		const looseCover =
			horizontalOverlap >= BACKGROUND_MIN_HORIZONTAL_OVERLAP_PX &&
			verticalOverlap >= BACKGROUND_MIN_VERTICAL_OVERLAP_PX &&
			backgroundTop <= tableTop + BACKGROUND_MATCH_TOLERANCE;
		const bottomAnchored =
			horizontalOverlap >= BACKGROUND_MIN_HORIZONTAL_OVERLAP_PX &&
			backgroundTop <= tableBottom + BACKGROUND_MATCH_TOLERANCE &&
			backgroundBottom >= tableTop &&
			Math.abs(backgroundBottom - tableBottom) <=
				BACKGROUND_BOTTOM_ALIGNMENT_TOLERANCE;
		const likelyPageWrapper =
			backgroundLeft <= BACKGROUND_MATCH_TOLERANCE &&
			backgroundTop <= BACKGROUND_MATCH_TOLERANCE &&
			background.width >= pageSize.w * 0.8 &&
			background.height >= usableHeight * 0.6;

		const coverMatch = fullyCoversTable && tightlyFramed;
		const wideCoverMatch =
			coversTableHorizontally &&
			coversTableVertically &&
			Math.abs(backgroundBottom - tableBottom) <=
				BACKGROUND_BOTTOM_ALIGNMENT_TOLERANCE;

		if (!coverMatch && !wideCoverMatch && !bottomAnchored && !looseCover) {
			continue;
		}
		if (likelyPageWrapper && !coverMatch && !wideCoverMatch && !bottomAnchored) {
			continue;
		}

		growth += meta.heightDiff;
	}

	return growth;
}

/**
 * Simple pagination: process elements in order, place on pages
 */
export function paginateTemplate(
	template: Template,
	context: unknown,
	pageSize: { w: number; h: number }
): RenderPage[] {
	const pages: RenderPage[] = [];
	const ensurePage = (i: number): RenderPage => {
		while (pages.length <= i) {
			pages.push({
				pageIndex: pages.length,
				elements: [],
				tableSlices: {},
				elementSlices: {},
			});
		}
		return pages[i];
	};

	const pageHeight = pageSize.h;
	const margins = resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins);
	const topMargin = margins.top;
	const bottomMargin = margins.bottom;
	const usableHeight = pageHeight - topMargin - bottomMargin;

	// Sort all elements by Y position
	const sortedElements = [...(template.elements ?? [])]
		.filter((el) => el.visible)
		.sort((a, b) => {
			if (a.y !== b.y) return a.y - b.y;
			return (a.zIndex ?? 0) - (b.zIndex ?? 0);
		});

	const elementOrderById = new Map<string, number>(
		(template.elements ?? []).map((el, index) => [el.id, index])
	);
	const tableGrowthById = new Map<string, TableGrowthMeta>();
	for (const el of sortedElements) {
		if (el.type !== "table") continue;
		const layout = computeTableRuntimeLayout(el, context);
		const originalHeight = el.headerHeight + el.rowHeight;
		const actualHeight = layout.totalHeight;
		tableGrowthById.set(el.id, {
			table: el,
			layout,
			originalHeight,
			actualHeight,
			heightDiff: actualHeight - originalHeight,
		});
	}

	const backgroundGrowthById = new Map<string, number>();
	const tableGrowth = Array.from(tableGrowthById.values());
	for (const el of sortedElements) {
		if (el.type !== "box" && el.type !== "path") continue;
		const growth = calculateBackgroundHeightGrowth(
			el,
			elementOrderById.get(el.id) ?? Number.MAX_SAFE_INTEGER,
			tableGrowth,
			elementOrderById,
			pageSize,
			usableHeight
		);
		if (growth > 0) {
			backgroundGrowthById.set(el.id, growth);
		}
	}

	let forcedPageShift = 0;

	// Process each element in order
	for (const el of sortedElements) {
		if (el.type === "pageBreak") {
			forcedPageShift += 1;
			continue;
		}

		if (el.type === "table") {
			// Handle table pagination
			const tbl = el;
			const tableMeta = tableGrowthById.get(tbl.id);
			const tableLayout = tableMeta?.layout ?? computeTableRuntimeLayout(tbl, context);
			const rowHeights = tableLayout.rowHeights;
			const itemCount = rowHeights.length;
			const hasTotalingRow = tableLayout.hasTotalingRow;
			const totalRowHeight = tableLayout.totalRowHeight;
			// Calculate where table starts in document (accounting for previous elements pushing it down)
			let tableStartY = el.y;

			// Adjust for elements that came before and expanded (like other tables)
			for (const prevEl of sortedElements) {
				if (prevEl.id === el.id) break; // Stop at current element

				if (prevEl.type === "table" && prevEl.y < el.y) {
					const prevTbl = prevEl;
					const prevMeta = tableGrowthById.get(prevTbl.id);
					const prevOriginalHeight =
						prevMeta?.originalHeight ?? (prevTbl.headerHeight + prevTbl.rowHeight);
					const prevActualHeight =
						prevMeta?.actualHeight ?? computeTableRuntimeLayout(prevTbl, context).totalHeight;
					const prevTableBottom = prevEl.y + prevOriginalHeight;

					// If this table is below the previous table, add the expansion
					if (el.y >= prevTableBottom) {
						tableStartY += prevActualHeight - prevOriginalHeight;
					}
				}
			}

			// Find which page the table starts on
			let tablePageIndex = 0;
			let tablePageStartY = 0;

			// Find the page where tableStartY falls
			while (tableStartY >= tablePageStartY + usableHeight) {
				tablePageStartY += usableHeight;
				tablePageIndex += 1;
			}

			// Paginate table across pages
			let rowStart = 0;
			let currentTablePageIndex = tablePageIndex + forcedPageShift;
			let currentTablePageY = tablePageStartY;
			let emittedAtLeastOneSlice = false;

			while (rowStart < itemCount || !emittedAtLeastOneSlice) {
				// Calculate Y position within current page
				const yInPage = tableStartY - currentTablePageY;

				// If table start is beyond current page, move to next page
				if (yInPage >= usableHeight) {
					currentTablePageY += usableHeight;
					currentTablePageIndex += 1;
					continue;
				}

				const page = ensurePage(currentTablePageIndex);
				const availableHeight = usableHeight - yInPage;
				if (availableHeight < tbl.headerHeight) {
					// Header itself does not fit, move to next page.
					currentTablePageY += usableHeight;
					currentTablePageIndex += 1;
					continue;
				}

				const availableForRows = Math.max(0, availableHeight - tbl.headerHeight);
				let rowEnd = rowStart;
				let usedRowsHeight = 0;
				while (rowEnd < itemCount) {
					const nextRowHeight = rowHeights[rowEnd] ?? tbl.rowHeight;
					if (usedRowsHeight + nextRowHeight > availableForRows) {
						break;
					}
					usedRowsHeight += nextRowHeight;
					rowEnd += 1;
				}

				// If all remaining rows are in this slice, ensure totaling row also fits.
				if (
					rowEnd >= itemCount &&
					hasTotalingRow &&
					usedRowsHeight + totalRowHeight > availableForRows
				) {
					while (
						rowEnd > rowStart &&
						usedRowsHeight + totalRowHeight > availableForRows
					) {
						rowEnd -= 1;
						usedRowsHeight -= rowHeights[rowEnd] ?? tbl.rowHeight;
					}
				}

				// Safety fallback: force one row to avoid deadlocks on very tall content rows.
				if (itemCount > rowStart && rowEnd === rowStart) {
					rowEnd = rowStart + 1;
				}

				const isLastSlice = rowEnd >= itemCount;
				page.elements.push(tbl);
				page.tableSlices[tbl.id] = {
					start: rowStart,
					end: rowEnd,
					isLastSlice,
				};
				emittedAtLeastOneSlice = true;
				rowStart = rowEnd;

				if (rowStart >= itemCount) break;

				// Move to next page for remaining rows
				currentTablePageY += usableHeight;
				currentTablePageIndex += 1;
			}

		} else {
			// Handle non-table elements
			let elementY = el.y;

			// Adjust for tables that came before and expanded
			for (const prevEl of sortedElements) {
				if (prevEl.id === el.id) break;

				if (prevEl.type === "table" && prevEl.y < el.y) {
					const prevTbl = prevEl;
					const prevMeta = tableGrowthById.get(prevTbl.id);
					const prevOriginalHeight =
						prevMeta?.originalHeight ?? (prevTbl.headerHeight + prevTbl.rowHeight);
					const prevActualHeight =
						prevMeta?.actualHeight ?? computeTableRuntimeLayout(prevTbl, context).totalHeight;
					const prevTableBottom = prevEl.y + prevOriginalHeight;

					// If this element is below the previous table, add the expansion
					if (el.y >= prevTableBottom) {
						elementY += prevActualHeight - prevOriginalHeight;
					}
				}
			}

			const backgroundGrowth =
				el.type === "box" || el.type === "path"
					? backgroundGrowthById.get(el.id) ?? 0
					: 0;
			const renderElement: TemplateElement =
				backgroundGrowth > 0 ? { ...el, height: el.height + backgroundGrowth } : el;
			const elementHeight = renderElement.height;
			const elementBottom = elementY + elementHeight;

			// Background effects should continue across page boundaries instead of
			// jumping to just the next page.
			if (renderElement.type === "box" || renderElement.type === "path") {
				let pageIndex = 0;
				let pageStartY = 0;

				while (elementY >= pageStartY + usableHeight) {
					pageStartY += usableHeight;
					pageIndex += 1;
				}

				while (pageStartY < elementBottom) {
					const sliceStart = Math.max(elementY, pageStartY);
					const sliceEnd = Math.min(elementBottom, pageStartY + usableHeight);

					if (sliceEnd > sliceStart) {
						const targetPageIndex = pageIndex + forcedPageShift;
						const page = ensurePage(targetPageIndex);
						page.elements.push(renderElement);
						page.elementSlices[renderElement.id] = {
							offsetY: sliceStart - elementY,
							height: sliceEnd - sliceStart,
						};
					}

					pageStartY += usableHeight;
					pageIndex += 1;
				}
				continue;
			}

			// Find which page this element belongs to
			let targetPageIndex = 0;
			let pageStartY = 0;

			// Find the page where elementY falls
			while (elementY >= pageStartY + usableHeight) {
				pageStartY += usableHeight;
				targetPageIndex += 1;
			}

			const pageEndY = pageStartY + usableHeight;

			// If element doesn't fit, move to next page
			if (elementBottom > pageEndY) {
				targetPageIndex += 1;
			}

			targetPageIndex += forcedPageShift;

			// Place element on appropriate page
			ensurePage(targetPageIndex).elements.push(renderElement);
		}
	}

	// Ensure at least one page exists
	if (pages.length === 0) {
		ensurePage(0);
	}

	return pages;
}
