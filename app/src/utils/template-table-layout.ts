import type { TemplateElement } from "@/core/entities/template";
import { getEditableTableColumnWidth } from "./table-column-width";
import {
	normalizeTableTextBehavior,
	type TableTextBehavior,
} from "./table-text-behavior";
import { formatValue, getByPath } from "./template-preview-utils";

const DEFAULT_FONT_SIZE_PX = 10;
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.5;
const CELL_HORIZONTAL_PADDING_PX = 8;
const CELL_VERTICAL_PADDING_PX = 12;
const CELL_DESCENT_GUARD_PX = 4;
const ROW_BORDER_ALLOWANCE_PX = 1;
const WRAP_HORIZONTAL_SAFETY_PX = 6;
const WRAP_VERTICAL_SAFETY_PX = 4;
const MIN_CELL_CONTENT_WIDTH_PX = 8;

type TableElement = Extract<TemplateElement, { type: "table" }>;
type TableColumn = TableElement["columns"][number];

type TextMeasurementOptions = {
	fontFamily: string;
	fontSizePx: number;
	fontWeight: number;
	lineHeightMultiplier: number;
};

export type TableRuntimeLayout = {
	columnWidths: number[];
	rowHeights: number[];
	headerHeight: number;
	totalRowHeight: number;
	hasTotalingRow: boolean;
	totalHeight: number;
};

type TableRuntimeLayoutOptions = {
	layoutWidth?: number;
};

let measurementCanvasContext: CanvasRenderingContext2D | null | undefined;
let measurementElement: HTMLDivElement | null | undefined;

function getMeasurementContext(): CanvasRenderingContext2D | null {
	if (measurementCanvasContext !== undefined) return measurementCanvasContext;
	if (typeof document === "undefined") {
		measurementCanvasContext = null;
		return measurementCanvasContext;
	}

	const canvas = document.createElement("canvas");
	measurementCanvasContext = canvas.getContext("2d");
	return measurementCanvasContext;
}

function getMeasurementElement(): HTMLDivElement | null {
	if (measurementElement !== undefined) return measurementElement;
	if (typeof document === "undefined") {
		measurementElement = null;
		return measurementElement;
	}

	const el = document.createElement("div");
	el.setAttribute("aria-hidden", "true");
	el.style.position = "fixed";
	el.style.left = "-10000px";
	el.style.top = "0";
	el.style.visibility = "hidden";
	el.style.pointerEvents = "none";
	el.style.zIndex = "-1";
	el.style.boxSizing = "border-box";
	el.style.padding = "0";
	el.style.margin = "0";
	el.style.border = "0";
	el.style.minWidth = "0";
	el.style.maxWidth = "none";
	el.style.width = "0";
	el.style.lineHeight = "normal";
	document.body.appendChild(el);
	measurementElement = el;
	return measurementElement;
}

function normalizeFontWeight(value: unknown): number {
	if (value === "semibold") return 600;
	if (value === "medium") return 500;
	if (value === "bold") return 700;
	return 400;
}

function measureTextWidth(text: string, options: TextMeasurementOptions): number {
	const context = getMeasurementContext();
	if (!context) {
		return text.length * options.fontSizePx * 0.55;
	}
	context.font = `${options.fontWeight} ${options.fontSizePx}px ${options.fontFamily}`;
	return context.measureText(text).width;
}

function applyTextBehaviorStyles(
	element: HTMLDivElement,
	behavior: TableTextBehavior
): void {
	// Reset relevant properties before applying behavior.
	element.style.display = "block";
	element.style.whiteSpace = "normal";
	element.style.wordBreak = "normal";
	element.style.overflowWrap = "normal";
	element.style.textOverflow = "clip";
	element.style.overflow = "visible";
	element.style.setProperty("-webkit-box-orient", "initial");
	element.style.setProperty("-webkit-line-clamp", "initial");

	switch (behavior.mode) {
		case "nowrap":
			element.style.whiteSpace = "nowrap";
			element.style.overflow = "hidden";
			break;
		case "break-words":
			element.style.whiteSpace = "normal";
			element.style.wordBreak = "normal";
			element.style.overflowWrap = "anywhere";
			break;
		case "ellipsis":
			element.style.whiteSpace = "nowrap";
			element.style.overflow = "hidden";
			element.style.textOverflow = "ellipsis";
			break;
		case "clamp":
			element.style.display = "-webkit-box";
			element.style.whiteSpace = "normal";
			element.style.wordBreak = "normal";
			element.style.overflowWrap = "anywhere";
			element.style.overflow = "hidden";
			element.style.setProperty("-webkit-box-orient", "vertical");
			element.style.setProperty(
				"-webkit-line-clamp",
				String(behavior.clampLines ?? 2)
			);
			break;
		case "wrap":
		default:
			element.style.whiteSpace = "normal";
			element.style.wordBreak = "normal";
			element.style.overflowWrap = "normal";
			break;
	}
}

function getMeasurementWidth(
	availableWidth: number,
	behavior: TableTextBehavior
): number {
	const horizontalSafety =
		behavior.mode === "wrap" || behavior.mode === "break-words"
			? WRAP_HORIZONTAL_SAFETY_PX
			: 0;
	return Math.max(MIN_CELL_CONTENT_WIDTH_PX, availableWidth - horizontalSafety);
}

function countLinesByWordWrap(
	text: string,
	availableWidth: number,
	options: TextMeasurementOptions
): number {
	if (!text) return 1;
	const paragraphs = text.split(/\r?\n/);
	let lines = 0;
	const spaceWidth = measureTextWidth(" ", options);

	for (const paragraph of paragraphs) {
		if (!paragraph.trim()) {
			lines += 1;
			continue;
		}

		const words = paragraph.trim().split(/\s+/);
		let lineWidth = 0;
		let paragraphLines = 1;

		for (const word of words) {
			const wordWidth = measureTextWidth(word, options);
			const gap = lineWidth === 0 ? 0 : spaceWidth;
			if (lineWidth > 0 && lineWidth + gap + wordWidth > availableWidth) {
				paragraphLines += 1;
				lineWidth = wordWidth;
			} else {
				lineWidth = lineWidth + gap + wordWidth;
			}
		}

		lines += paragraphLines;
	}

	return Math.max(1, lines);
}

function countLinesByCharacterWrap(
	text: string,
	availableWidth: number,
	options: TextMeasurementOptions
): number {
	if (!text) return 1;
	const paragraphs = text.split(/\r?\n/);
	let lines = 0;

	for (const paragraph of paragraphs) {
		if (!paragraph) {
			lines += 1;
			continue;
		}

		let paragraphLines = 1;
		let currentWidth = 0;
		for (const char of paragraph) {
			const charWidth = measureTextWidth(char, options);
			if (currentWidth > 0 && currentWidth + charWidth > availableWidth) {
				paragraphLines += 1;
				currentWidth = 0;
				if (char.trim() === "") continue;
			}
			currentWidth += charWidth;
		}

		lines += paragraphLines;
	}

	return Math.max(1, lines);
}

function estimateCellLineCountFallback(
	text: string,
	availableWidth: number,
	behavior: TableTextBehavior,
	options: TextMeasurementOptions
): number {
	if (!text) return 1;
	if (availableWidth <= 0) return 1;
	if (behavior.mode === "nowrap" || behavior.mode === "ellipsis") return 1;

	const wrappedLines =
		behavior.mode === "break-words" || behavior.mode === "clamp"
			? countLinesByCharacterWrap(text, availableWidth, options)
			: countLinesByWordWrap(text, availableWidth, options);

	if (behavior.mode === "clamp") {
		return Math.max(1, Math.min(wrappedLines, behavior.clampLines ?? 2));
	}

	return wrappedLines;
}

function measureCellContentHeight(
	text: string,
	availableWidth: number,
	behavior: TableTextBehavior,
	options: TextMeasurementOptions
): number {
	if (!text) {
		return options.fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;
	}
	if (availableWidth <= 0) {
		return options.fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;
	}

	const element = getMeasurementElement();
	if (element) {
		const measuredWidth = getMeasurementWidth(availableWidth, behavior);
		element.style.width = `${Math.max(1, measuredWidth)}px`;
		element.style.fontFamily = options.fontFamily;
		element.style.fontSize = `${options.fontSizePx}px`;
		element.style.fontWeight = String(options.fontWeight);
		element.style.lineHeight = String(options.lineHeightMultiplier);
		applyTextBehaviorStyles(element, behavior);
		element.textContent = text;
		const rectHeight = element.getBoundingClientRect().height;
		const measured =
			behavior.mode === "clamp"
				? rectHeight
				: Math.max(rectHeight, element.scrollHeight);
		element.textContent = "";
		if (Number.isFinite(measured) && measured > 0) {
			return Math.ceil(measured + CELL_DESCENT_GUARD_PX);
		}
	}

	const lineCount = estimateCellLineCountFallback(
		text,
		availableWidth,
		behavior,
		options
	);
	const lineHeightPx = options.fontSizePx * options.lineHeightMultiplier;
	return Math.ceil(lineCount * lineHeightPx + CELL_DESCENT_GUARD_PX);
}

function resolveColumnWidths(tableWidth: number, columns: TableColumn[]): number[] {
	if (columns.length === 0) return [tableWidth];

	const parsed = columns.map((column) => getEditableTableColumnWidth(column.width));
	const percentTotal = parsed.reduce(
		(sum, width) => (width.unit === "%" ? sum + width.value : sum),
		0
	);
	const percentScale = percentTotal > 100 ? 100 / percentTotal : 1;

	const percentWidths = parsed.map((width) =>
		width.unit === "%" ? (width.value * percentScale * tableWidth) / 100 : 0
	);
	const usedByPercent = percentWidths.reduce((sum, width) => sum + width, 0);

	const totalFr = parsed.reduce(
		(sum, width) => (width.unit === "fr" ? sum + width.value : sum),
		0
	);
	const remaining = Math.max(0, tableWidth - usedByPercent);

	return parsed.map((width, index) => {
		if (width.unit === "%") return percentWidths[index];
		if (totalFr <= 0) return 0;
		return (width.value / totalFr) * remaining;
	});
}

function formatTableCellText(column: TableColumn, row: Record<string, unknown>): string {
	const columnBinding = column.binding || column.id;
	const raw = getByPath<unknown>(row, columnBinding);

	if (column.type === "currency") {
		if (raw != null) {
			const num = Number(raw);
			if (Number.isFinite(num)) {
				const currency = column.currency || column.format?.currency || "USD";
				const formatter = new Intl.NumberFormat(undefined, {
					style: "currency",
					currency,
				});
				return formatter.format(num);
			}
			return formatValue(raw, "none");
		}
		return "";
	}

	return formatValue(
		raw,
		column.format?.kind ?? "none",
		column.format?.currency,
		column.format?.dateFormat
	);
}

function calculateRowHeight(
	table: TableElement,
	row: Record<string, unknown>,
	columnWidths: number[],
	behavior: TableTextBehavior,
	options: TextMeasurementOptions,
	cache: Map<string, number>
): number {
	let rowHeight = table.rowHeight;

	for (let columnIndex = 0; columnIndex < table.columns.length; columnIndex += 1) {
		const column = table.columns[columnIndex];
		const cellText = formatTableCellText(column, row);
		const availableWidth = Math.max(
			MIN_CELL_CONTENT_WIDTH_PX,
			columnWidths[columnIndex] - CELL_HORIZONTAL_PADDING_PX
		);
		const key = [
			cellText,
			availableWidth,
			behavior.mode,
			behavior.clampLines ?? "",
			options.fontFamily,
			options.fontSizePx,
			options.fontWeight,
		].join("|");
		let contentHeight = cache.get(key);
		if (contentHeight == null) {
			contentHeight = measureCellContentHeight(
				cellText,
				availableWidth,
				behavior,
				options
			);
			cache.set(key, contentHeight);
		}
		const wrapVerticalSafety =
			behavior.mode === "wrap" || behavior.mode === "break-words"
				? WRAP_VERTICAL_SAFETY_PX
				: 0;
		const cellHeight = Math.ceil(
			contentHeight +
				CELL_VERTICAL_PADDING_PX +
				ROW_BORDER_ALLOWANCE_PX +
				wrapVerticalSafety
		);
		rowHeight = Math.max(rowHeight, cellHeight);
	}

	return rowHeight;
}

function calculateTotalsRowHeight(
	table: TableElement,
	allItems: Array<Record<string, unknown>>,
	columnWidths: number[],
	behavior: TableTextBehavior,
	baseOptions: TextMeasurementOptions,
	cache: Map<string, number>
): number {
	let totalsRowHeight = table.rowHeight;

	for (let columnIndex = 0; columnIndex < table.columns.length; columnIndex += 1) {
		const column = table.columns[columnIndex];
		let text = "";
		if (column.showTotal && (column.type === "number" || column.type === "currency")) {
			const columnBinding = column.binding || column.id;
			const sum = allItems
				.map((row) => {
					const value = getByPath<unknown>(row, columnBinding);
					const num = Number(value);
					return Number.isFinite(num) ? num : 0;
				})
				.reduce((acc, value) => acc + value, 0);
			text = formatValue(
				sum,
				column.format?.kind ?? "none",
				column.currency || column.format?.currency,
				column.format?.dateFormat
			);
		}

		const availableWidth = Math.max(
			MIN_CELL_CONTENT_WIDTH_PX,
			columnWidths[columnIndex] - CELL_HORIZONTAL_PADDING_PX
		);
		const fontSizePx = column.totalStyle?.fontSize ?? baseOptions.fontSizePx;
		const options = {
			...baseOptions,
			fontSizePx,
		};
		const key = [
			text,
			availableWidth,
			behavior.mode,
			behavior.clampLines ?? "",
			options.fontFamily,
			options.fontSizePx,
			options.fontWeight,
		].join("|");
		let contentHeight = cache.get(key);
		if (contentHeight == null) {
			contentHeight = measureCellContentHeight(
				text,
				availableWidth,
				behavior,
				options
			);
			cache.set(key, contentHeight);
		}
		const wrapVerticalSafety =
			behavior.mode === "wrap" || behavior.mode === "break-words"
				? WRAP_VERTICAL_SAFETY_PX
				: 0;
		const cellHeight = Math.ceil(
			contentHeight +
				CELL_VERTICAL_PADDING_PX +
				ROW_BORDER_ALLOWANCE_PX +
				wrapVerticalSafety
		);
		totalsRowHeight = Math.max(totalsRowHeight, cellHeight);
	}

	return totalsRowHeight;
}

export function computeTableRuntimeLayout(
	table: TableElement,
	context: unknown,
	options?: TableRuntimeLayoutOptions
): TableRuntimeLayout {
	const items = getByPath<Array<Record<string, unknown>>>(context, table.itemsBinding) || [];
	const effectiveWidth =
		typeof options?.layoutWidth === "number" && Number.isFinite(options.layoutWidth)
			? Math.max(0, options.layoutWidth)
			: table.width;
	const columnWidths = resolveColumnWidths(effectiveWidth, table.columns);
	const rowBehavior = normalizeTableTextBehavior(table.rowStyle?.textBehavior, "wrap");
	const textOptions: TextMeasurementOptions = {
		fontFamily: table.rowStyle?.fontFamily || "Inter",
		fontSizePx: table.rowStyle?.fontSize || DEFAULT_FONT_SIZE_PX,
		fontWeight: normalizeFontWeight(table.rowStyle?.fontWeight),
		lineHeightMultiplier: DEFAULT_LINE_HEIGHT_MULTIPLIER,
	};
	const measurementCache = new Map<string, number>();

	const rowHeights = items.map((row) =>
		calculateRowHeight(
			table,
			row,
			columnWidths,
			rowBehavior,
			textOptions,
			measurementCache
		)
	);
	const hasTotalingRow = table.columns.some((column) => column.showTotal);
	const totalRowHeight = hasTotalingRow
		? calculateTotalsRowHeight(
				table,
				items,
				columnWidths,
				rowBehavior,
				textOptions,
				measurementCache
			)
		: 0;
	const bodyHeight = rowHeights.reduce((sum, height) => sum + height, 0);
	const totalHeight = table.headerHeight + bodyHeight + totalRowHeight;

	return {
		columnWidths,
		rowHeights,
		headerHeight: table.headerHeight,
		totalRowHeight,
		hasTotalingRow,
		totalHeight,
	};
}
