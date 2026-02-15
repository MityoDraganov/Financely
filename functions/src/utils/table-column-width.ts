type TableColumnLike = {
	id?: string;
	width?: unknown;
};

export type TableColumnWidthUnit = "%" | "fr";

export type EditableTableColumnWidth = {
	value: number;
	unit: TableColumnWidthUnit;
};

const WIDTH_TOKEN_REGEX = /^([0-9]*\.?[0-9]+)\s*(%|fr)$/i;

function roundTo(value: number, places = 2): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

function parseWidthToken(width: unknown): EditableTableColumnWidth | null {
	if (typeof width === "number" && Number.isFinite(width) && width > 0) {
		// Legacy numeric widths are interpreted as fractional tracks.
		return { value: width, unit: "fr" };
	}
	if (typeof width !== "string") return null;
	const trimmed = width.trim().toLowerCase();
	if (!trimmed) return null;

	const match = WIDTH_TOKEN_REGEX.exec(trimmed);
	if (match) {
		const value = Number(match[1]);
		if (Number.isFinite(value) && value > 0) {
			return { value, unit: match[2] as TableColumnWidthUnit };
		}
	}

	const numeric = Number(trimmed);
	if (Number.isFinite(numeric) && numeric > 0) {
		return { value: numeric, unit: "fr" };
	}

	return null;
}

export function formatTableColumnWidth(width: EditableTableColumnWidth): string {
	const normalizedValue = roundTo(Math.max(0, width.value));
	return `${normalizedValue}${width.unit}`;
}

export function getEditableTableColumnWidth(width: unknown): EditableTableColumnWidth {
	return parseWidthToken(width) ?? { value: 1, unit: "fr" };
}

export function getTableColumnTrack(width: unknown): string {
	const parsed = getEditableTableColumnWidth(width);
	if (parsed.unit === "fr") {
		return `minmax(0, ${formatTableColumnWidth(parsed)})`;
	}
	return formatTableColumnWidth(parsed);
}

export function getTableGridTemplateColumns(columns: TableColumnLike[]): string {
	if (!Array.isArray(columns) || columns.length === 0) {
		return "1fr";
	}
	const parsed = columns.map((column) => getEditableTableColumnWidth(column.width));
	const percentTotal = parsed.reduce(
		(sum, width) => (width.unit === "%" ? sum + width.value : sum),
		0
	);
	const percentScale = percentTotal > 100 ? 100 / percentTotal : 1;

	return parsed
		.map((width) =>
			width.unit === "%"
				? formatTableColumnWidth({ value: width.value * percentScale, unit: "%" })
				: `minmax(0, ${formatTableColumnWidth(width)})`
		)
		.join(" ");
}
