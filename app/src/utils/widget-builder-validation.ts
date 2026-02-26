import type {
	WidgetBlock,
	WidgetPage,
} from "@/core/entities/widget-block-schema";
import type { ContactMetafieldDefinition } from "@/core";
import { getEntityDynamicSourceFields, type DynamicSourceValueType } from "@/utils/dynamic-sources";
import { parseBudgetInput } from "@/utils/budget";

export type WidgetSelectOption = {
	label: string;
	value: string;
};

export type WidgetFieldTypeMap = Record<string, DynamicSourceValueType>;

export type WidgetValidationIssue = {
	pageId: string;
	blockId: string;
	message: string;
	optionIndex?: number;
};

type ContactMetafieldDefinitionLike = Pick<
	ContactMetafieldDefinition,
	"id" | "name" | "type" | "description"
>;

const DYNAMIC_SOURCE_VALUE_TYPES: DynamicSourceValueType[] = [
	"string",
	"number",
	"boolean",
	"date",
	"array",
	"object",
	"unknown",
];

const isDynamicSourceValueType = (value: unknown): value is DynamicSourceValueType =>
	typeof value === "string" &&
	DYNAMIC_SOURCE_VALUE_TYPES.includes(value as DynamicSourceValueType);

const toOptionString = (value: unknown): string => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
};

export function normalizeSelectOptions(rawOptions: unknown): WidgetSelectOption[] {
	if (!Array.isArray(rawOptions)) return [];

	return rawOptions.flatMap((rawOption) => {
		if (typeof rawOption === "string") {
			return [{ label: rawOption, value: rawOption }];
		}

		if (rawOption && typeof rawOption === "object") {
			const optionObj = rawOption as {
				label?: unknown;
				value?: unknown;
			};
			const label = toOptionString(optionObj.label ?? optionObj.value);
			const value = toOptionString(optionObj.value ?? optionObj.label);
			return [{ label, value }];
		}

		return [];
	});
}

function getSelectOptionTypeError(
	value: string,
	targetType: DynamicSourceValueType | undefined,
): string | null {
	if (!targetType || targetType === "string" || targetType === "unknown") {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) return null;

	if (targetType === "number") {
		const numericValue = Number(trimmed);
		return Number.isFinite(numericValue)
			? null
			: "Value must be a valid number.";
	}

	if (targetType === "boolean") {
		return /^(true|false)$/i.test(trimmed)
			? null
			: "Value must be true or false.";
	}

	if (targetType === "date") {
		const parsed = Date.parse(trimmed);
		return Number.isNaN(parsed) ? "Value must be a valid date." : null;
	}

	if (targetType === "array" || targetType === "object") {
		return `Select options cannot map to ${targetType} fields.`;
	}

	return null;
}

function getBudgetValueTokenAsNumber(token: string): number | undefined {
	const parsed = parseBudgetInput({ value: token });
	if (!parsed) return undefined;
	return parsed.budgetMin;
}

function getBudgetOptionValidationError(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return "Budget amount is required.";

	const minimumMatch = trimmed.match(/^(.*?)\+$/);
	if (minimumMatch) {
		const minToken = minimumMatch[1]?.trim() ?? "";
		if (!minToken) {
			return "Minimum budget amount is required.";
		}
		const minValue = getBudgetValueTokenAsNumber(minToken);
		if (typeof minValue !== "number") {
			return "Minimum budget amount must be a valid number.";
		}
		return null;
	}

	const rangeMatch = trimmed.match(/^(.*?)\s*(?:-|–|—|to)\s*(.*?)$/i);
	if (rangeMatch) {
		const minToken = rangeMatch[1]?.trim() ?? "";
		const maxToken = rangeMatch[2]?.trim() ?? "";
		if (!minToken && !maxToken) {
			return "Range min and max budget amounts are required.";
		}
		if (!minToken) {
			return "Range min budget amount is required.";
		}
		if (!maxToken) {
			return "Range max budget amount is required.";
		}
		const minValue = getBudgetValueTokenAsNumber(minToken);
		const maxValue = getBudgetValueTokenAsNumber(maxToken);
		if (typeof minValue !== "number") {
			return "Range min budget amount must be a valid number.";
		}
		if (typeof maxValue !== "number") {
			return "Range max budget amount must be a valid number.";
		}
		if (
			typeof minValue === "number" &&
			typeof maxValue === "number" &&
			maxValue < minValue
		) {
			return "Max budget must be greater than or equal to min budget.";
		}
	}

	return parseBudgetInput({ value: trimmed })
		? null
		: "Budget amount must be a valid number.";
}

function validateSelectBlock(
	pageId: string,
	block: WidgetBlock,
	fieldTypeByKey: WidgetFieldTypeMap,
): WidgetValidationIssue[] {
	const props = (block.props ?? {}) as {
		fieldKey?: unknown;
		options?: unknown;
	};
	const fieldKey = typeof props.fieldKey === "string" ? props.fieldKey : "";
	const targetType = fieldKey ? fieldTypeByKey[fieldKey] : undefined;
	const isBudgetField = fieldKey === "budget";
	const options = normalizeSelectOptions(props.options);
	const issues: WidgetValidationIssue[] = [];
	const hasUnsupportedTargetType =
		!isBudgetField && (targetType === "array" || targetType === "object");

	if (options.length === 0) {
		issues.push({
			pageId,
			blockId: block.id,
			message: "Select block must include at least one option.",
		});
		return issues;
	}

	if (hasUnsupportedTargetType) {
		issues.push({
			pageId,
			blockId: block.id,
			message: `Select options cannot map to ${targetType} fields.`,
		});
	}

	options.forEach((option, optionIndex) => {
		if (!option.label.trim()) {
			issues.push({
				pageId,
				blockId: block.id,
				optionIndex,
				message: "Option label is required.",
			});
		}
		if (!option.value.trim()) {
			if (!isBudgetField) {
				issues.push({
					pageId,
					blockId: block.id,
					optionIndex,
					message: "Option value is required.",
				});
			}
		}

		const typeError = hasUnsupportedTargetType
			? null
			: isBudgetField
				? getBudgetOptionValidationError(option.value)
				: getSelectOptionTypeError(option.value, targetType);
		if (typeError) {
			issues.push({
				pageId,
				blockId: block.id,
				optionIndex,
				message: typeError,
			});
		}
	});

	return issues;
}

function validateBlock(
	pageId: string,
	block: WidgetBlock,
	fieldTypeByKey: WidgetFieldTypeMap,
): WidgetValidationIssue[] {
	const issues: WidgetValidationIssue[] = [];

	if (block.type === "select") {
		issues.push(...validateSelectBlock(pageId, block, fieldTypeByKey));
	}

	(block.children ?? []).forEach((child) => {
		issues.push(...validateBlock(pageId, child, fieldTypeByKey));
	});

	return issues;
}

export function validateWidgetPages(
	pages: WidgetPage[],
	fieldTypeByKey: WidgetFieldTypeMap,
): WidgetValidationIssue[] {
	const issues: WidgetValidationIssue[] = [];
	pages.forEach((page) => {
		(page.fields ?? []).forEach((block) => {
			issues.push(...validateBlock(page.id, block, fieldTypeByKey));
		});
	});
	return issues;
}

export function getContactFieldTypeMap(
	contactMetafieldDefinitions: ContactMetafieldDefinitionLike[],
): WidgetFieldTypeMap {
	const fieldTypeByKey: WidgetFieldTypeMap = {};
	const dynamicSources = getEntityDynamicSourceFields({
		contactMetafieldDefinitions,
	});

	dynamicSources.forEach((source) => {
		if (source.entity !== "contact" || source.path === "organizationId") return;
		fieldTypeByKey[source.path] = source.valueType;
	});

	return fieldTypeByKey;
}

export function parseFieldValueByType(
	value: string | boolean,
	valueType: DynamicSourceValueType | undefined,
): string | boolean | number {
	if (typeof value === "boolean") return value;
	if (!valueType || valueType === "string" || valueType === "unknown") return value;

	if (valueType === "number") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : value;
	}
	if (valueType === "boolean") {
		if (/^true$/i.test(value)) return true;
		if (/^false$/i.test(value)) return false;
		return value;
	}
	return value;
}

export function getBlockFieldValueType(
	block: WidgetBlock,
	fieldTypeByKey: WidgetFieldTypeMap,
): DynamicSourceValueType | undefined {
	const props = (block.props ?? {}) as {
		fieldKey?: unknown;
		fieldValueType?: unknown;
	};

	if (isDynamicSourceValueType(props.fieldValueType)) {
		return props.fieldValueType;
	}

	const fieldKey = typeof props.fieldKey === "string" ? props.fieldKey : "";
	if (!fieldKey) return undefined;
	return fieldTypeByKey[fieldKey];
}
