/**
 * Custom hook for evaluating formulas in invoice forms
 * Handles formula evaluation with debouncing and currency field detection
 */

import { useCallback } from "react";
import type { Template, TemplateElement } from "@/core/entities/template";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { getBindingValue, setBindingValue } from "@/core/entities/invoice";
import { FormulaService } from "@/services/formula-service";

type TableConfig = {
	itemsPath: string;
	columns: Array<{
		id: string;
		binding: string;
		type: string;
	}>;
};

const MAX_FORMULA_PROPAGATION_PASSES = 24;

/**
 * Round currency values to 2 decimal places
 */
function roundCurrency(value: InvoiceDataValue): InvoiceDataValue {
	if (typeof value === "number") {
		return Math.round(value * 100) / 100;
	}
	return value;
}

/**
 * Check if a field is a currency field
 */
function isCurrencyField(
	binding: string,
	selectedTemplate: { elements?: TemplateElement[] } | undefined,
	tableConfigs: TableConfig[]
): boolean {
	if (!selectedTemplate) return false;

	// Check if it's a currency element
	const currencyElement = selectedTemplate.elements?.find(
		(e) => e.type === "currency" && e.binding === binding
	);
	if (currencyElement) return true;

	// Check if it's a currency column in a table
	for (const tableConfig of tableConfigs) {
		const column = tableConfig.columns.find((c) => {
			const rowBindingMatch = binding.match(/^(.+)\[(\d+)\]\.(.+)$/);
			if (rowBindingMatch) {
				const [, basePath, , fieldName] = rowBindingMatch;
				return basePath === tableConfig.itemsPath && c.binding === fieldName;
			}
			return false;
		});
		if (column && column.type === "currency") return true;
	}

	return false;
}

interface UseInvoiceFormulaEvaluationProps {
	selectedTemplate: Template | undefined;
	tableConfigs: TableConfig[];
}

export function useInvoiceFormulaEvaluation({
	selectedTemplate,
	tableConfigs,
}: UseInvoiceFormulaEvaluationProps) {
	// Helper to get value from data (handles array indices)
	const getValueFromData = useCallback((data: Record<string, InvoiceDataValue>, path: string): InvoiceDataValue => {
		const arrayIndexMatch = path.match(/^(.+)\[(\d+)\]\.(.+)$/);
		if (arrayIndexMatch) {
			const [, arrayPath, indexStr, fieldPath] = arrayIndexMatch;
			const index = parseInt(indexStr, 10);
			
			const arrayValue = getBindingValue(data, arrayPath);
			if (!Array.isArray(arrayValue) || !arrayValue[index]) {
				return "";
			}
			
			const arrayItem = arrayValue[index];
			if (typeof arrayItem !== "object" || Array.isArray(arrayItem)) {
				return "";
			}
			
			return (arrayItem as Record<string, InvoiceDataValue>)[fieldPath] ?? "";
		}
		
		return getBindingValue(data, path) ?? "";
	}, []);

	// Evaluate formulas for given form data
	const evaluateFormulas = useCallback(
		(dataToEvaluate: Record<string, InvoiceDataValue>): { 
			data: Record<string, InvoiceDataValue>; 
			updatedFields: Array<{ binding: string; value: number }> 
		} => {
			if (!selectedTemplate || !dataToEvaluate) {
				return { data: dataToEvaluate, updatedFields: [] };
			}

			const elements = selectedTemplate.elements ?? [];
			const formulaElements: Array<{
				element: TemplateElement;
				binding: string;
				formula: string;
				tableContext?: {
					itemsBinding: string;
					rowIndex: number;
					columns: Array<{
						id: string;
						binding?: string;
						type?: string;
					}>;
				};
			}> = [];

			// Collect all elements with formulas
			for (const element of elements) {
				if (element.type === "input") {
					const inputEl = element as Extract<TemplateElement, { type: "input" }>;
					if (
						inputEl.variant === "number" &&
						inputEl.formula &&
						inputEl.binding
					) {
						formulaElements.push({
							element,
							binding: inputEl.binding,
							formula: inputEl.formula,
						});
					}
				} else if (element.type === "currency") {
					const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
					if (
						currencyEl.mode === "formula" &&
						currencyEl.formula &&
						currencyEl.binding
					) {
						formulaElements.push({
							element,
							binding: currencyEl.binding,
							formula: currencyEl.formula,
						});
					}
				}
			}

			// Check table columns with formulas
			for (const element of elements) {
				if (element.type === "table") {
					const tableEl = element as Extract<TemplateElement, { type: "table" }>;
					if (!tableEl.itemsBinding) continue;

					const items = getValueFromData(dataToEvaluate, tableEl.itemsBinding);
					const itemsArray = Array.isArray(items) ? items : [];

					for (const col of tableEl.columns ?? []) {
						if (
							(col.type === "number" || col.type === "currency") &&
							col.calc
						) {
							for (
								let rowIndex = 0;
								rowIndex < itemsArray.length;
								rowIndex++
							) {
								const rowBinding = `${tableEl.itemsBinding}[${rowIndex}].${col.binding || col.id}`;
								formulaElements.push({
									element: tableEl,
									binding: rowBinding,
									formula: col.calc,
									tableContext: {
										itemsBinding: tableEl.itemsBinding,
										rowIndex,
										columns: tableEl.columns ?? [],
									},
								});
							}
						}
					}
				}
			}

			if (formulaElements.length === 0) {
				return { data: dataToEvaluate, updatedFields: [] };
			}

			const rebuildElementValues = (
				data: Record<string, InvoiceDataValue>
			): Map<string, number> => {
				const map = new Map<string, number>();
				for (const el of elements) {
					if (
						(el.type === "input" && el.variant === "number") ||
						el.type === "currency"
					) {
						if (el.binding) {
							const value = getValueFromData(data, el.binding);
							if (typeof value === "number") {
								map.set(el.id, value);
							}
						}
					}
				}
				return map;
			};

			const updatedData = { ...dataToEvaluate };
			const updatedFieldsByBinding = new Map<string, number>();

			for (let pass = 0; pass < MAX_FORMULA_PROPAGATION_PASSES; pass++) {
				const elementValues = rebuildElementValues(updatedData);
				let changedThisPass = false;

				for (const { element, binding, formula, tableContext } of formulaElements) {
					try {
						let processedFormula = formula;
						if (tableContext) {
							for (const col of tableContext.columns) {
								const colBinding = col.binding || col.id;
								const fullPath = `${tableContext.itemsBinding}[${tableContext.rowIndex}].${colBinding}`;
								const regex = new RegExp(
									`\\b${colBinding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?![\\[\\]])`,
									"g"
								);
								processedFormula = processedFormula.replace(regex, fullPath);
							}
						}

						const result = FormulaService.evaluate(
							processedFormula,
							updatedData,
							elements,
							elementValues
						);

						const currentValue = getBindingValue(updatedData, binding);
						const roundedResult = isCurrencyField(binding, selectedTemplate, tableConfigs)
							? roundCurrency(result)
							: result;

						if (currentValue !== roundedResult) {
							setBindingValue(updatedData, binding, roundedResult);
							if (typeof roundedResult === "number") {
								elementValues.set(element.id, roundedResult);
								updatedFieldsByBinding.set(binding, roundedResult);
								changedThisPass = true;
							}
						}
					} catch {
						// Silently fail - formula errors shouldn't break the form
					}
				}

				if (!changedThisPass) {
					break;
				}
			}

			const updatedFields = Array.from(updatedFieldsByBinding.entries()).map(
				([binding, value]) => ({ binding, value })
			);

			return { data: updatedData, updatedFields };
		},
		[selectedTemplate, tableConfigs, getValueFromData]
	);

	return { evaluateFormulas };
}

