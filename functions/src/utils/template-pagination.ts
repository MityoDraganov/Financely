/**
 * Pagination logic for template rendering (PDF and preview)
 * Simple approach: process elements in order, place on pages based on their Y position
 */

import type { Template, TemplateData, TemplateElement } from "../core/entities/template";

export type TableSlice = {
	start: number;
	end: number;
	isLastSlice: boolean;
};

export type RenderPage = {
	pageIndex: number;
	elements: TemplateElement[];
	backgroundElements: TemplateElement[];
	tableSlices: Record<string, TableSlice>;
	elementPositions: Record<string, number>;
};

type TableMeta = {
	table: Extract<TemplateElement, { type: "table" }>;
	originalHeight: number;
	actualHeight: number;
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

const DEBUG_PREFIX = "[template-pagination-debug]";

function shouldDebugPagination(): boolean {
	return process.env.TEMPLATE_PAGINATION_DEBUG === "1";
}

function debugPaginationLog(
	level: "log" | "warn",
	message: string,
	payload: Record<string, unknown>
): void {
	if (!shouldDebugPagination()) return;
	console[level](DEBUG_PREFIX, message, payload);
}

/**
 * Helper to get value from nested object using dot-notation path
 */
function getByPath<T>(obj: unknown, path: string): T | null {
	if (!obj || !path) return null;
	
	const parts = path.split(".");
	let current: unknown = obj;
	
	for (const key of parts) {
		if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
			current = (current as Record<string, unknown>)[key];
		} else {
			return null;
		}
	}
	
	return current as T;
}

/**
 * Calculate actual table height based on content
 */
function getTableActualHeight(
	tbl: Extract<TemplateElement, { type: "table" }>,
	context: unknown
): number {
	const items = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
	const headerHeight = tbl.headerHeight;
	const rowHeight = tbl.rowHeight;
	const hasTotalingRow = tbl.columns.some((c) => c.showTotal);
	
	return headerHeight + (items.length * rowHeight) + (hasTotalingRow ? rowHeight : 0);
}

function getTableBaselineHeight(
	tbl: Extract<TemplateElement, { type: "table" }>
): number {
	const minimumContentHeight = tbl.headerHeight + tbl.rowHeight;
	const configuredHeight =
		typeof tbl.height === "number" && Number.isFinite(tbl.height)
			? tbl.height
			: minimumContentHeight;
	return Math.max(minimumContentHeight, configuredHeight);
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
		const overlaps = adjustedY < placedTable.bottom && elementBottom > placedTable.top;
		if (!overlaps) continue;
		const push = placedTable.bottom - adjustedY;
		if (push <= 0) continue;
		adjustedY += push;
		overlapPush += push;
	}

	return { adjustedY, cumulativeGrowthShift, overlapPush };
}

/**
 * Calculate how many table rows fit in the available height
 */
function rowsThatFit(
	tbl: Extract<TemplateElement, { type: "table" }>,
	availableHeight: number
): number {
	const header = tbl.headerHeight;
	if (availableHeight <= header) return 0;
	
	const usable = availableHeight - header;
	return Math.max(0, Math.floor(usable / tbl.rowHeight));
}

/**
 * Simple pagination: process elements in order, place on pages
 */
export function paginateTemplate(
	template: Template | TemplateData,
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
				elementPositions: {},
			});
		}
		return pages[i];
	};

	const pageHeight = pageSize.h;
	const margins = template.pageSettings?.margins ?? template.brand?.margins ?? { top: 96, right: 96, bottom: 96, left: 96 };
	const topMargin = margins.top;
	const bottomMargin = margins.bottom;
	const usableHeight = pageHeight - topMargin - bottomMargin;

	// Sort all content elements by Y position, excluding group containers (visual-only)
	const sortedElements = [...(template.elements ?? [])]
		.filter((el) => el.visible && el.type !== "group")
		.sort((a, b) => {
			if (a.y !== b.y) return a.y - b.y;
			return (a.zIndex ?? 0) - (b.zIndex ?? 0);
		});
	const elementOrderById = new Map<string, number>(
		(template.elements ?? []).map((el, index) => [el.id, index])
	);
	const tableMetaById = new Map<string, TableMeta>();
	for (const el of sortedElements) {
		if (el.type !== "table") continue;
		const originalHeight = getTableBaselineHeight(el);
		const actualHeight = getTableActualHeight(el, context);
		tableMetaById.set(el.id, {
			table: el,
			originalHeight,
			actualHeight,
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
			const tableMeta = tableMetaById.get(tbl.id);
			const allItems = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
			const tableActualHeight = tableMeta?.actualHeight ?? getTableActualHeight(tbl, context);
			const tableOriginalHeight = tableMeta?.originalHeight ?? getTableBaselineHeight(tbl);
			const tableOrder = elementOrderById.get(el.id) ?? Number.MAX_SAFE_INTEGER;
			const resolvedTableY = resolveYWithExpandedTables(
				el,
				tableOrder,
				el.y,
				tableActualHeight,
				placedExpandedTables,
				{ respectZIndexForOverlap: false }
			);
			const tableStartY = resolvedTableY.adjustedY;
			if (resolvedTableY.cumulativeGrowthShift > 0) {
				debugPaginationLog("log", "table-shift-applied", {
					targetTableId: el.id,
					originalY: el.y,
					totalGrowthShift: resolvedTableY.cumulativeGrowthShift,
					adjustedY: tableStartY,
				});
			}
			if (resolvedTableY.overlapPush > 0) {
				debugPaginationLog("log", "table-overlap-push-applied", {
					targetTableId: el.id,
					originalY: el.y,
					overlapPush: resolvedTableY.overlapPush,
					adjustedY: tableStartY,
				});
			}
			
			// Find which page the table starts on
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
			
			while (rowStart < allItems.length || rowStart === 0) {
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
				const rowsFit = rowsThatFit(tbl, availableHeight);
				
				if (rowsFit === 0) {
					// No rows fit, move to next page
					currentTablePageY += usableHeight;
					currentTablePageIndex += 1;
					if (rowStart === 0) continue;
					break;
				}
				
				const rowEnd = Math.min(allItems.length, rowStart + rowsFit);
				const sliceHeight = tbl.headerHeight + ((rowEnd - rowStart) * tbl.rowHeight);
				const hasTotalingRow = tbl.columns.some((c) => c.showTotal) && rowEnd >= allItems.length;
				const totalSliceHeight = sliceHeight + (hasTotalingRow ? tbl.rowHeight : 0);
				
				// Check if slice fits
				if (yInPage + totalSliceHeight > usableHeight) {
					// Reduce rows to fit exactly
					const maxHeight = usableHeight - yInPage;
					const maxRowsFit = rowsThatFit(tbl, maxHeight);
					
					if (maxRowsFit > 0) {
						const adjustedEnd = Math.min(allItems.length, rowStart + maxRowsFit);
						page.elements.push(tbl);
						page.tableSlices[tbl.id] = {
							start: rowStart,
							end: adjustedEnd,
							isLastSlice: adjustedEnd >= allItems.length,
						};
						page.elementPositions[tbl.id] = tableStartY;
						rowStart = adjustedEnd;
					} else {
						// Can't fit, move to next page
						currentTablePageY += usableHeight;
						currentTablePageIndex += 1;
						continue;
					}
				} else {
					// Fits completely
					page.elements.push(tbl);
					page.tableSlices[tbl.id] = {
						start: rowStart,
						end: rowEnd,
						isLastSlice: rowEnd >= allItems.length,
					};
					page.elementPositions[tbl.id] = tableStartY;
					rowStart = rowEnd;
				}
				
				if (rowStart >= allItems.length) break;
				
				// Move to next page for remaining rows
				currentTablePageY += usableHeight;
				currentTablePageIndex += 1;
			}
			
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
			const elementOrder = elementOrderById.get(el.id) ?? Number.MAX_SAFE_INTEGER;
			const elementHeight = el.height;
			const resolvedElementY = resolveYWithExpandedTables(
				el,
				elementOrder,
				el.y,
				elementHeight,
				placedExpandedTables
			);
			const elementY = resolvedElementY.adjustedY;
			if (resolvedElementY.cumulativeGrowthShift > 0) {
				debugPaginationLog("log", "element-shift-applied", {
					elementId: el.id,
					originalY: el.y,
					totalGrowthShift: resolvedElementY.cumulativeGrowthShift,
					adjustedY: elementY,
				});
			}
			if (resolvedElementY.overlapPush > 0) {
				debugPaginationLog("log", "element-overlap-push-applied", {
					elementId: el.id,
					originalY: el.y,
					overlapPush: resolvedElementY.overlapPush,
					adjustedY: elementY,
				});
			}
			
			// Find which page this element belongs to
			let targetPageIndex = 0;
			let pageStartY = topMargin;
			
			// Find the page where elementY falls
			while (elementY >= pageStartY + usableHeight) {
				pageStartY += usableHeight;
				targetPageIndex += 1;
			}
			
			// Check if element fits on this page
			const elementBottom = elementY + elementHeight;
			const pageEndY = pageStartY + usableHeight;
			
			// If element doesn't fit, move to next page
			if (elementBottom > pageEndY) {
				targetPageIndex += 1;
			}
			for (const placedTable of placedExpandedTables) {
				if (
					isBehindByZIndex(
						el,
						elementOrder,
						placedTable.table,
						placedTable.tableOrder
					)
				) {
					continue;
				}
				const overlaps = elementY < placedTable.bottom && elementBottom > placedTable.top;
				if (!overlaps) continue;
				debugPaginationLog("warn", "overlap-detected", {
					elementId: el.id,
					elementType: el.type,
					elementOriginalY: el.y,
					elementAdjustedY: elementY,
					elementHeight,
					elementBottom,
					tableId: placedTable.table.id,
					tableOriginalY: placedTable.table.y,
					tableAdjustedY: placedTable.top,
					tableOriginalHeight: placedTable.originalHeight,
					tableActualHeight: placedTable.actualHeight,
					tableBottom: placedTable.bottom,
				});
			}

			targetPageIndex += forcedPageShift;
			
			// Place element on appropriate page
			const page = ensurePage(targetPageIndex);
			page.elements.push(el);
			page.elementPositions[el.id] = elementY;
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
