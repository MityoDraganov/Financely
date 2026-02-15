import type { TemplateElement } from "@/core";

export const ELEMENT_BOX_MODEL_UNITS = ["px", "%", "rem", "em", "vw", "vh"] as const;

export type ElementBoxModelUnit = (typeof ELEMENT_BOX_MODEL_UNITS)[number];

export type ElementMeasuredLength = {
	value: number;
	unit: ElementBoxModelUnit;
};

export type ElementBoxModelValues = {
	top: ElementMeasuredLength;
	right: ElementMeasuredLength;
	bottom: ElementMeasuredLength;
	left: ElementMeasuredLength;
};

export type ElementBoxModelStyle = {
	mode: "all" | "custom";
	all: ElementMeasuredLength;
	values: ElementBoxModelValues;
};

export const DEFAULT_MEASURED_LENGTH: ElementMeasuredLength = {
	value: 0,
	unit: "px",
};

export const DEFAULT_BOX_MODEL_STYLE: ElementBoxModelStyle = {
	mode: "all",
	all: { ...DEFAULT_MEASURED_LENGTH },
	values: {
		top: { ...DEFAULT_MEASURED_LENGTH },
		right: { ...DEFAULT_MEASURED_LENGTH },
		bottom: { ...DEFAULT_MEASURED_LENGTH },
		left: { ...DEFAULT_MEASURED_LENGTH },
	},
};

function normalizeUnit(unit: string | undefined): ElementBoxModelUnit {
	if (unit && (ELEMENT_BOX_MODEL_UNITS as readonly string[]).includes(unit)) {
		return unit as ElementBoxModelUnit;
	}
	return "px";
}

function normalizeMeasuredLength(length: Partial<ElementMeasuredLength> | undefined): ElementMeasuredLength {
	return {
		value: Number.isFinite(length?.value) ? Number(length?.value) : 0,
		unit: normalizeUnit(length?.unit),
	};
}

export function normalizeBoxModelStyle(style: Partial<ElementBoxModelStyle> | undefined): ElementBoxModelStyle {
	const all = normalizeMeasuredLength(style?.all);
	const values = style?.values;
	return {
		mode: style?.mode === "custom" ? "custom" : "all",
		all,
		values: {
			top: normalizeMeasuredLength(values?.top ?? all),
			right: normalizeMeasuredLength(values?.right ?? all),
			bottom: normalizeMeasuredLength(values?.bottom ?? all),
			left: normalizeMeasuredLength(values?.left ?? all),
		},
	};
}

function measuredLengthToCss(length: ElementMeasuredLength): string {
	return `${length.value}${length.unit}`;
}

export function boxModelStyleToCss(style: Partial<ElementBoxModelStyle> | undefined): string | undefined {
	if (!style) return undefined;
	const normalized = normalizeBoxModelStyle(style);
	if (normalized.mode === "all") {
		return measuredLengthToCss(normalized.all);
	}
	const { top, right, bottom, left } = normalized.values;
	return [
		measuredLengthToCss(top),
		measuredLengthToCss(right),
		measuredLengthToCss(bottom),
		measuredLengthToCss(left),
	].join(" ");
}

export function getElementPaddingCss(element: TemplateElement): string | undefined {
	return boxModelStyleToCss(element.paddingStyle as Partial<ElementBoxModelStyle> | undefined);
}

export function getElementBorderRadiusCss(element: TemplateElement): string | undefined {
	return boxModelStyleToCss(element.borderRadiusStyle as Partial<ElementBoxModelStyle> | undefined);
}
