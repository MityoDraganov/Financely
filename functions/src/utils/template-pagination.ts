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
	tableSlices: Record<string, TableSlice>;
};

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
			pages.push({ pageIndex: pages.length, elements: [], tableSlices: {} });
		}
		return pages[i];
	};

	const pageHeight = pageSize.h;
	const margins = template.pageSettings?.margins ?? template.brand?.margins ?? { top: 96, right: 96, bottom: 96, left: 96 };
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

	// Track current position in the document (absolute Y)
	let currentDocumentY = 0;
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
			const allItems = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
			const tableActualHeight = getTableActualHeight(tbl, context);
			
			// Calculate where table starts in document (accounting for previous elements pushing it down)
			let tableStartY = el.y;
			
			// Adjust for elements that came before and expanded (like other tables)
			for (const prevEl of sortedElements) {
				if (prevEl.id === el.id) break; // Stop at current element
				
					if (prevEl.type === "table" && prevEl.y < el.y) {
						const prevTbl = prevEl;
						const prevOriginalHeight = getTableBaselineHeight(prevTbl);
						const prevActualHeight = getTableActualHeight(prevTbl, context);
						const prevTableBottom = prevEl.y + prevOriginalHeight;
					
					// If this table is below the previous table, add the expansion
					if (el.y >= prevTableBottom) {
						tableStartY += (prevActualHeight - prevOriginalHeight);
					}
				}
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
					rowStart = rowEnd;
				}
				
				if (rowStart >= allItems.length) break;
				
				// Move to next page for remaining rows
				currentTablePageY += usableHeight;
				currentTablePageIndex += 1;
			}
			
			// Update current document position to after this table
			tableStartY += tableActualHeight;
			currentDocumentY = Math.max(currentDocumentY, tableStartY);
			
		} else {
			// Handle non-table elements
			let elementY = el.y;
			
			// Adjust for tables that came before and expanded
			for (const prevEl of sortedElements) {
				if (prevEl.id === el.id) break;
				
					if (prevEl.type === "table" && prevEl.y < el.y) {
						const prevTbl = prevEl;
						const prevOriginalHeight = getTableBaselineHeight(prevTbl);
						const prevActualHeight = getTableActualHeight(prevTbl, context);
						const prevTableBottom = prevEl.y + prevOriginalHeight;
					
					// If this element is below the previous table, add the expansion
					if (el.y >= prevTableBottom) {
						elementY += (prevActualHeight - prevOriginalHeight);
					}
				}
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
			const elementHeight = el.height;
			const elementBottom = elementY + elementHeight;
			const pageEndY = pageStartY + usableHeight;
			
			// If element doesn't fit, move to next page
			if (elementBottom > pageEndY) {
				targetPageIndex += 1;
			}

			targetPageIndex += forcedPageShift;
			
			// Place element on appropriate page
			ensurePage(targetPageIndex).elements.push(el);
		}
	}

	// Ensure at least one page exists
	if (pages.length === 0) {
		ensurePage(0);
	}

	return pages;
}
