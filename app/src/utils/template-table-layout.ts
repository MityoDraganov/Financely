import type { TemplateElement } from "@/core/entities/template";
import { getEditableTableColumnWidth } from "./table-column-width";
import { normalizeTableTextBehavior, type TableTextBehavior } from "./table-text-behavior";
import { formatValue, getByPath } from "./template-preview-utils";

const DEFAULT_FONT_SIZE_PX = 10;
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.2;
const CELL_HORIZONTAL_PADDING_PX = 8;
const CELL_VERTICAL_PADDING_PX = 8;
const MIN_CELL_CONTENT_WIDTH_PX = 8;

type TableElement = Extract<TemplateElement, { type: "table" }>;

type TableColumn = TableElement["columns"][number];

type TextMeasurementOptions = {
	fontFamily: string;
	fontSizePx: number;
	fontWeight: number;
};

export type TableRuntimeLayout = {
	columnWidths: number[];
	rowHeights: number[];
	headerHeight: number;
	totalRowHeight: number;
	hasTotalingRow: boolean;
	totalHeight: number;
};

let measurementContext: CanvasRenderingContext2D | null | undefined;

function getMeasurementContext(): CanvasRenderingContext2D | null {
	if (measurementContext !== undefined) return measurementContext;
	if (typeof document === "undefined") {
		measurementContext = null;
		return measurementContext;
	}

	const canvas = document.createElement("canvas");
	measurementContext = canvas.getContext("2d");
	return measurementContext;
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
		// SSR/test fallback: good-enough approximation.
		return text.length * options.fontSizePx * 0.55;
	}
	context.font = `${options.fontWeight} ${options.fontSizePx}px ${options.fontFamily}`;
	return context.measureText(text).width;
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

function estimateCellLineCount(
	text: string,
	availableWidth: number,
	behavior: TableTextBehavior,
	options: TextMeasurementOptions
): number {
	if (!text) return 1;
	if (availableWidth <= 0) return 1;

	if (behavior.mode === "nowrap" || behavior.mode === "ellipsis") {
		return 1;
	}

	const wrappedLines =
		behavior.mode === "break-words" || behavior.mode === "clamp"
			? countLinesByCharacterWrap(text, availableWidth, options)
			: countLinesByWordWrap(text, availableWidth, options);

	if (behavior.mode === "clamp") {
		return Math.max(1, Math.min(wrappedLines, behavior.clampLines ?? 2));
	}

	return wrappedLines;
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
	options: TextMeasurementOptions
): number {
	let rowHeight = table.rowHeight;

	for (let columnIndex = 0; columnIndex < table.columns.length; columnIndex += 1) {
		const column = table.columns[columnIndex];
		const cellText = formatTableCellText(column, row);
		const availableWidth = Math.max(
			MIN_CELL_CONTENT_WIDTH_PX,
			columnWidths[columnIndex] - CELL_HORIZONTAL_PADDING_PX
		);
		const lineCount = estimateCellLineCount(cellText, availableWidth, behavior, options);
		const lineHeightPx = options.fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;
		const cellHeight = Math.ceil(lineCount * lineHeightPx + CELL_VERTICAL_PADDING_PX);
		rowHeight = Math.max(rowHeight, cellHeight);
	}

	return rowHeight;
}

function calculateTotalsRowHeight(
	table: TableElement,
	allItems: Array<Record<string, unknown>>,
	columnWidths: number[],
	behavior: TableTextBehavior,
	baseOptions: TextMeasurementOptions
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
		const lineCount = estimateCellLineCount(text, availableWidth, behavior, {
			...baseOptions,
			fontSizePx,
		});
		const lineHeightPx = fontSizePx * DEFAULT_LINE_HEIGHT_MULTIPLIER;
		const cellHeight = Math.ceil(lineCount * lineHeightPx + CELL_VERTICAL_PADDING_PX);
		totalsRowHeight = Math.max(totalsRowHeight, cellHeight);
	}

	return totalsRowHeight;
}

export function computeTableRuntimeLayout(
	table: TableElement,
	context: unknown
): TableRuntimeLayout {
	const items = getByPath<Array<Record<string, unknown>>>(context, table.itemsBinding) || [];
	const columnWidths = resolveColumnWidths(table.width, table.columns);
	const rowBehavior = normalizeTableTextBehavior(table.rowStyle?.textBehavior, "wrap");
	const textOptions: TextMeasurementOptions = {
		fontFamily: table.rowStyle?.fontFamily || "Inter",
		fontSizePx: table.rowStyle?.fontSize || DEFAULT_FONT_SIZE_PX,
		fontWeight: normalizeFontWeight(table.rowStyle?.fontWeight),
	};

	const rowHeights = items.map((row) =>
		calculateRowHeight(table, row, columnWidths, rowBehavior, textOptions)
	);
	const hasTotalingRow = table.columns.some((column) => column.showTotal);
	const totalRowHeight = hasTotalingRow
		? calculateTotalsRowHeight(table, items, columnWidths, rowBehavior, textOptions)
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
