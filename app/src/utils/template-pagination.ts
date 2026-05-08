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
	backgroundElements: TemplateElement[];
	tableSlices: Record<string, TableSlice>;
	elementSlices: Record<string, ElementSlice>;
	elementPositions: Record<string, number>;
};

type TableGrowthMeta = {
	table: Extract<TemplateElement, { type: "table" }>;
	layout: ReturnType<typeof computeTableRuntimeLayout>;
	originalHeight: number;
	actualHeight: number;
	heightDiff: number;
};

type PlacedExpandedTable = {
	table: Extract<TemplateElement, { type: "table" }>;
	tableOrder: number;
	originalTop: number;
	originalHeight: number;
	actualHeight: number;
	top: number;
	bottom: number;
};

type ResolvedElementY = {
	adjustedY: number;
	cumulativeGrowthShift: number;
	overlapPush: number;
};

function getTableBaselineHeight(
	table: Extract<TemplateElement, { type: "table" }>
): number {
	const minimumContentHeight = table.headerHeight + table.rowHeight;
	const configuredHeight =
		typeof table.height === "number" && Number.isFinite(table.height)
			? table.height
			: minimumContentHeight;
	return Math.max(minimumContentHeight, configuredHeight);
}

function getEffectiveElementWidth(
	element: TemplateElement,
	pageSize: { w: number; h: number },
	margins: { top: number; right: number; bottom: number; left: number }
): number {
	const clampedX = Math.max(
		margins.left,
		Math.min(element.x, pageSize.w - margins.right)
	);
	const maxWidth = Math.max(0, pageSize.w - margins.right - clampedX);
	return Math.max(0, Math.min(element.width, maxWidth));
}

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

	return backgroundOrder <= foregroundOrder;
}

function resolveYWithExpandedTables(
	element: TemplateElement,
	elementOrder: number,
	originalY: number,
	elementHeight: number,
	placedExpandedTables: PlacedExpandedTable[],
	options?: { respectZIndexForOverlap?: boolean }
): ResolvedElementY {
	let adjustedY = originalY;
	let cumulativeGrowthShift = 0;
	let overlapPush = 0;

	for (const placedTable of placedExpandedTables) {
		if (originalY <= placedTable.originalTop) continue;
		const shift = Math.max(0, placedTable.actualHeight - placedTable.originalHeight);
		if (shift <= 0) continue;
		adjustedY += shift;
		cumulativeGrowthShift += shift;
	}

	for (const placedTable of placedExpandedTables) {
		if (originalY <= placedTable.originalTop) continue;
		if (
			options?.respectZIndexForOverlap !== false &&
			isBehindByZIndex(
				element,
				elementOrder,
				placedTable.table,
				placedTable.tableOrder
			)
		) {
			continue;
		}
		const elementBottom = adjustedY + elementHeight;
		const overlaps =
			adjustedY < placedTable.bottom && elementBottom > placedTable.top;
		if (!overlaps) continue;
		const push = placedTable.bottom - adjustedY;
		if (push <= 0) continue;
		adjustedY += push;
		overlapPush += push;
	}

	return { adjustedY, cumulativeGrowthShift, overlapPush };
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
					backgroundElements: [],
					tableSlices: {},
					elementSlices: {},
					elementPositions: {},
				});
		}
		return pages[i];
	};

	const pageHeight = pageSize.h;
	const margins = resolveTemplateMarginsPx(template.pageSettings?.margins, template.brand?.margins);
	const topMargin = margins.top;
	const bottomMargin = margins.bottom;
	const usableHeight = pageHeight - topMargin - bottomMargin;

	// Sort all content elements by Y position (groups included — backdrop must paginate with layout)
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
		const layoutWidth = getEffectiveElementWidth(el, pageSize, margins);
		const layout = computeTableRuntimeLayout(el, context, { layoutWidth });
		const originalHeight = getTableBaselineHeight(el);
		const actualHeight = layout.totalHeight;
		tableGrowthById.set(el.id, {
			table: el,
			layout,
			originalHeight,
			actualHeight,
			heightDiff: actualHeight - originalHeight,
		});
	}

	let forcedPageShift = 0;
	const placedExpandedTables: PlacedExpandedTable[] = [];

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
			const tableLayout =
				tableMeta?.layout ??
				computeTableRuntimeLayout(tbl, context, {
					layoutWidth: getEffectiveElementWidth(tbl, pageSize, margins),
				});
			const rowHeights = tableLayout.rowHeights;
			const itemCount = rowHeights.length;
			const hasTotalingRow = tableLayout.hasTotalingRow;
			const totalRowHeight = tableLayout.totalRowHeight;
			const tableOrder = elementOrderById.get(el.id) ?? Number.MAX_SAFE_INTEGER;
			const resolvedTableY = resolveYWithExpandedTables(
				el,
				tableOrder,
				el.y,
				tableMeta?.actualHeight ?? tableLayout.totalHeight,
				placedExpandedTables,
				{ respectZIndexForOverlap: false }
			);
			const tableStartY = resolvedTableY.adjustedY;

			// Find which page the table starts on.
			// Element coordinates are page-absolute (not margin-relative), so the
			// first usable page segment starts at topMargin.
			let tablePageIndex = 0;
			let tablePageStartY = topMargin;

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
				// Only the first slice starts at the table's original Y offset.
				// Continuation slices always start from the top of the next page.
				const yInPage = rowStart === 0 ? tableStartY - currentTablePageY : 0;

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

				// If no row fits in the remaining area but the next row can fit on a fresh page,
				// push it to the next page instead of clipping it at the current page bottom.
				const nextRowHeight = rowHeights[rowStart] ?? tbl.rowHeight;
				if (
					itemCount > rowStart &&
					rowEnd === rowStart &&
					yInPage > 0 &&
					nextRowHeight <= Math.max(0, usableHeight - tbl.headerHeight)
				) {
					currentTablePageY += usableHeight;
					currentTablePageIndex += 1;
					continue;
				}

				// Safety fallback: force one row to avoid deadlocks on very tall content rows.
				if (itemCount > rowStart && rowEnd === rowStart) {
					rowEnd = rowStart + 1;
					usedRowsHeight = nextRowHeight;
				}

				const isLastSlice = rowEnd >= itemCount;
				page.elements.push(tbl);
				page.tableSlices[tbl.id] = {
					start: rowStart,
					end: rowEnd,
					isLastSlice,
				};
				page.elementPositions[tbl.id] = tableStartY;
				emittedAtLeastOneSlice = true;
				rowStart = rowEnd;

				if (rowStart >= itemCount) break;

				// Move to next page for remaining rows
				currentTablePageY += usableHeight;
				currentTablePageIndex += 1;
			}

			const tableOriginalHeight = tableMeta?.originalHeight ?? getTableBaselineHeight(tbl);
			const tableActualHeight = tableMeta?.actualHeight ?? tableLayout.totalHeight;
			if (tableActualHeight > tableOriginalHeight) {
				placedExpandedTables.push({
					table: tbl,
					tableOrder,
					originalTop: tbl.y,
					originalHeight: tableOriginalHeight,
					actualHeight: tableActualHeight,
					top: tableStartY,
					bottom: tableStartY + tableActualHeight,
				});
			}

		} else {
			// Handle non-table elements
			const renderElement = el;
			const elementHeight = renderElement.height;
			const elementOrder = elementOrderById.get(el.id) ?? Number.MAX_SAFE_INTEGER;
			const resolvedElementY = resolveYWithExpandedTables(
				renderElement,
				elementOrder,
				el.y,
				elementHeight,
				placedExpandedTables
			);
			const elementY = resolvedElementY.adjustedY;

			const elementBottom = elementY + elementHeight;

			// Background effects should continue across page boundaries instead of
			// jumping to just the next page.
			if (
				renderElement.type === "box" ||
				renderElement.type === "path" ||
				renderElement.type === "group"
			) {
				let pageIndex = 0;
				let pageStartY = topMargin;

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
						page.elementPositions[renderElement.id] = elementY;
					}

					pageStartY += usableHeight;
					pageIndex += 1;
				}
				continue;
			}

			// Find which page this element belongs to.
			// Element coordinates are page-absolute, so segments start at topMargin.
			let targetPageIndex = 0;
			let pageStartY = topMargin;

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
			const page = ensurePage(targetPageIndex);
			page.elements.push(renderElement);
			page.elementPositions[renderElement.id] = elementY;
		}
	}

	// Ensure at least one page exists
	if (pages.length === 0) {
		ensurePage(0);
	}

	// Stamp background elements onto every page — they repeat identically, never paginated
	const bgElements = template.backgroundElements ?? [];
	if (bgElements.length > 0) {
		for (const page of pages) {
			page.backgroundElements = bgElements;
		}
	}

	return pages;
}
