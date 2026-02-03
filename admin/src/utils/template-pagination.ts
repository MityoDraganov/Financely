/**
 * Pagination logic for template preview
 */

import type { Template, TemplateElement } from "@/core/entities/template";
import { getByPath } from "./template-preview-utils";

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

function rowsThatFit(
  tbl: Extract<TemplateElement, { type: "table" }>,
  availableHeight: number
): number {
  const header = tbl.headerHeight;
  if (availableHeight <= header) return 0;
  const usable = availableHeight - header;
  return Math.max(0, Math.floor(usable / tbl.rowHeight));
}

export function paginateTemplate(
  template: Template,
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
  const margins = template.brand?.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
  const topMargin = margins.top;
  const bottomMargin = margins.bottom;
  const usableHeight = pageHeight - topMargin - bottomMargin;

  const sortedElements = [...(template.elements ?? [])]
    .filter((el) => el.visible)
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return (a.zIndex ?? 0) - (b.zIndex ?? 0);
    });

  let currentDocumentY = 0;

  for (const el of sortedElements) {
    if (el.type === "table") {
      const tbl = el;
      const allItems = getByPath<Array<Record<string, unknown>>>(context, tbl.itemsBinding) || [];
      const tableActualHeight = getTableActualHeight(tbl, context);
      let tableStartY = el.y;

      for (const prevEl of sortedElements) {
        if (prevEl.id === el.id) break;
        if (prevEl.type === "table" && prevEl.y < el.y) {
          const prevTbl = prevEl;
          const prevOriginalHeight = prevTbl.headerHeight + prevTbl.rowHeight;
          const prevActualHeight = getTableActualHeight(prevTbl, context);
          const prevTableBottom = prevEl.y + prevOriginalHeight;
          if (el.y >= prevTableBottom) {
            tableStartY += prevActualHeight - prevOriginalHeight;
          }
        }
      }

      let tablePageIndex = 0;
      let tablePageStartY = 0;
      while (tableStartY >= tablePageStartY + usableHeight) {
        tablePageStartY += usableHeight;
        tablePageIndex += 1;
      }

      let rowStart = 0;
      let currentTablePageIndex = tablePageIndex;
      let currentTablePageY = tablePageStartY;

      while (rowStart < allItems.length || rowStart === 0) {
        const yInPage = tableStartY - currentTablePageY;
        if (yInPage >= usableHeight) {
          currentTablePageY += usableHeight;
          currentTablePageIndex += 1;
          continue;
        }

        const page = ensurePage(currentTablePageIndex);
        const availableHeight = usableHeight - yInPage;
        const rowsFit = rowsThatFit(tbl, availableHeight);

        if (rowsFit === 0) {
          currentTablePageY += usableHeight;
          currentTablePageIndex += 1;
          if (rowStart === 0) continue;
          break;
        }

        const rowEnd = Math.min(allItems.length, rowStart + rowsFit);
        const sliceHeight = tbl.headerHeight + (rowEnd - rowStart) * tbl.rowHeight;
        const hasTotalingRow = tbl.columns.some((c) => c.showTotal) && rowEnd >= allItems.length;
        const totalSliceHeight = sliceHeight + (hasTotalingRow ? tbl.rowHeight : 0);

        if (yInPage + totalSliceHeight > usableHeight) {
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
            currentTablePageY += usableHeight;
            currentTablePageIndex += 1;
            continue;
          }
        } else {
          page.elements.push(tbl);
          page.tableSlices[tbl.id] = {
            start: rowStart,
            end: rowEnd,
            isLastSlice: rowEnd >= allItems.length,
          };
          rowStart = rowEnd;
        }

        if (rowStart >= allItems.length) break;
        currentTablePageY += usableHeight;
        currentTablePageIndex += 1;
      }

      tableStartY += tableActualHeight;
      currentDocumentY = Math.max(currentDocumentY, tableStartY);
    } else {
      let elementY = el.y;
      for (const prevEl of sortedElements) {
        if (prevEl.id === el.id) break;
        if (prevEl.type === "table" && prevEl.y < el.y) {
          const prevTbl = prevEl;
          const prevOriginalHeight = prevTbl.headerHeight + prevTbl.rowHeight;
          const prevActualHeight = getTableActualHeight(prevTbl, context);
          const prevTableBottom = prevEl.y + prevOriginalHeight;
          if (el.y >= prevTableBottom) {
            elementY += prevActualHeight - prevOriginalHeight;
          }
        }
      }

      let targetPageIndex = 0;
      let pageStartY = 0;
      while (elementY >= pageStartY + usableHeight) {
        pageStartY += usableHeight;
        targetPageIndex += 1;
      }

      const elementHeight = el.height;
      const elementBottom = elementY + elementHeight;
      const pageEndY = pageStartY + usableHeight;
      if (elementBottom > pageEndY) {
        targetPageIndex += 1;
      }
      ensurePage(targetPageIndex).elements.push(el);
    }
  }

  if (pages.length === 0) {
    ensurePage(0);
  }
  return pages;
}
