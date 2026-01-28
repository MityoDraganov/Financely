/**
 * Custom hook for handling currency conversions in invoice forms
 * Manages linked currency fields and table column currency conversions
 */

import { useCallback, useRef } from "react";
import type { Template, TemplateElement } from "@/core/entities/template";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { CurrencyFieldLink } from "@/core/entities/currency-field";
import { setBindingValue } from "@/core/entities/invoice";

/**
 * Round currency values to 2 decimal places
 */
function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

interface UseInvoiceCurrencyConversionProps {
	selectedTemplate: Template | undefined;
	currencyFieldLinks: Map<
		string,
		{
			sourceBinding: string;
			link: CurrencyFieldLink;
			element: Extract<TemplateElement, { type: "currency" }>;
		}
	>;
	tableColumnCurrencyLinks: Map<
		string,
		Map<
			string,
			{
				sourceColumnBinding: string;
				link: CurrencyFieldLink;
				column: { id: string; binding: string; currency?: string };
			}
		>
	>;
	defaultCurrency: string;
}

export function useInvoiceCurrencyConversion({
	selectedTemplate,
	currencyFieldLinks,
	tableColumnCurrencyLinks,
	defaultCurrency,
}: UseInvoiceCurrencyConversionProps) {
	// Debounce timers
	const currencyConversionTimer = useRef<NodeJS.Timeout | null>(null);
	const tableConversionTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

	// Compute linked currency field value
	const computeLinkedCurrencyValue = useCallback(async (
		sourceValue: number,
		sourceCurrency: string,
		link: CurrencyFieldLink,
		targetCurrency: string
	): Promise<number> => {
		try {
			if (link.type === "FX_PAIR") {
				const { getExchangeRate } = await import("@/utils/currencies");
				const rate = await getExchangeRate(sourceCurrency, targetCurrency);
				return roundCurrency(sourceValue * rate);
			} else if (
				link.type === "FIXED_MULTIPLIER" &&
				link.multiplier !== undefined
			) {
				return sourceValue * link.multiplier;
			}
			return sourceValue;
		} catch (error) {
			return sourceValue;
		}
	}, []);

	// Update linked currency fields after a source field changes
	const updateLinkedCurrencyFields = useCallback(async (
		data: Record<string, InvoiceDataValue>,
		updatedBinding: string,
		updatedValue: number
	): Promise<Record<string, InvoiceDataValue>> => {
		const updatedData = { ...data };
		const updates: Array<{ binding: string; value: number }> = [];

		// Check regular currency field links
		for (const [targetBinding, linkInfo] of currencyFieldLinks.entries()) {
			if (linkInfo.sourceBinding === updatedBinding) {
				const sourceElement = selectedTemplate?.elements?.find(
					(e) => e.type === "currency" && e.binding === updatedBinding
				) as Extract<TemplateElement, { type: "currency" }> | undefined;

				const sourceCurrency = sourceElement?.currency || defaultCurrency;
				const targetCurrency = linkInfo.element.currency || defaultCurrency;

				if (typeof updatedValue === "number") {
					try {
						const linkedValue = await computeLinkedCurrencyValue(
							updatedValue,
							sourceCurrency,
							linkInfo.link,
							targetCurrency
						);
						const roundedLinkedValue = roundCurrency(linkedValue);
						if (typeof roundedLinkedValue === "number") {
							updates.push({ binding: targetBinding, value: roundedLinkedValue });
						}
					} catch (error) {
						// Silently fail
					}
				}
			}
		}

		// Check table column currency links
		for (const [tablePath, tableLinks] of tableColumnCurrencyLinks.entries()) {
			const tableMatch = updatedBinding.match(/^(.+)\[(\d+)\]\.(.+)$/);
			if (tableMatch) {
				const [, arrayPath, indexStr, fieldPath] = tableMatch;
				if (arrayPath === tablePath) {
					for (const [targetColumnBinding, linkInfo] of tableLinks.entries()) {
						if (linkInfo.sourceColumnBinding === fieldPath) {
							const targetBinding = `${tablePath}[${indexStr}].${targetColumnBinding}`;
							
							const tableEl = selectedTemplate?.elements?.find(
								(e) => e.type === "table" && (e as Extract<TemplateElement, { type: "table" }>).itemsBinding === tablePath
							) as Extract<TemplateElement, { type: "table" }> | undefined;

							const sourceCol = tableEl?.columns?.find(
								(c) => c.binding === linkInfo.sourceColumnBinding
							);
							const targetCol = tableEl?.columns?.find(
								(c) => c.binding === targetColumnBinding
							);

							const sourceCurrency = sourceCol?.currency || defaultCurrency;
							const targetCurrency = targetCol?.currency || defaultCurrency;

							try {
								const linkedValue = await computeLinkedCurrencyValue(
									updatedValue,
									sourceCurrency,
									linkInfo.link,
									targetCurrency
								);
								const roundedLinkedValue = roundCurrency(linkedValue);
								if (typeof roundedLinkedValue === "number") {
									updates.push({ binding: targetBinding, value: roundedLinkedValue });
								}
							} catch (error) {
								// Silently fail
							}
						}
					}
				}
			}
		}

		// Apply all updates
		for (const { binding, value } of updates) {
			setBindingValue(updatedData, binding, value);
		}

		return updatedData;
	}, [selectedTemplate, tableColumnCurrencyLinks, currencyFieldLinks, defaultCurrency, computeLinkedCurrencyValue]);

	return {
		computeLinkedCurrencyValue,
		updateLinkedCurrencyFields,
		currencyConversionTimer,
		tableConversionTimers,
	};
}

