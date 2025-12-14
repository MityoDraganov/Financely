/**
 * Custom hook for extracting template configuration
 * Extracts table configs, currency links, and bindings from template
 */

import { useMemo } from "react";
import type { Template, TemplateElement } from "@/core/entities/template";
import type { CurrencyFieldLink } from "@/core/entities/currency-field";

type TableColumn = {
	id: string;
	header: string;
	binding: string;
	type: "text" | "number" | "date" | "currency";
};

type TableConfig = {
	itemsPath: string;
	columns: TableColumn[];
};

type BindingField = {
	path: string;
	label: string;
	type: "text" | "number" | "date";
	isLinkedCurrency?: boolean;
	hasFormula?: boolean;
	elementId?: string;
};

interface UseInvoiceTemplateConfigProps {
	selectedTemplate: Template | undefined;
}

export function useInvoiceTemplateConfig({ selectedTemplate }: UseInvoiceTemplateConfigProps) {
	// Extract table configuration
	const tableConfigs = useMemo((): TableConfig[] => {
		if (!selectedTemplate) return [];

		const tableElements = (selectedTemplate.elements ?? []).filter(
			(e) => e.type === "table"
		) as Extract<TemplateElement, { type: "table" }>[];

		return tableElements
			.filter((tableEl) => tableEl.itemsBinding)
			.map((tableEl) => ({
				itemsPath: tableEl.itemsBinding,
				columns: (tableEl.columns ?? []).map(
					(col): TableColumn => ({
						id: col.id,
						header: col.header || "Column",
						binding: col.binding || col.id,
						type: col.type || "text",
					})
				),
			}));
	}, [selectedTemplate]);

	// Map of currency field links
	const currencyFieldLinks = useMemo(() => {
		const links = new Map<
			string,
			{
				sourceBinding: string;
				link: CurrencyFieldLink;
				element: Extract<TemplateElement, { type: "currency" }>;
			}
		>();

		if (!selectedTemplate) return links;

		const elements = selectedTemplate.elements ?? [];

		for (const element of elements) {
			if (element.type === "currency") {
				const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
				if (
					currencyEl.binding &&
					currencyEl.mode === "linked" &&
					currencyEl.currencyLinks &&
					currencyEl.currencyLinks.length > 0
				) {
					const link = currencyEl.currencyLinks[0];
					if (link.type === "FX_PAIR" && link.sourceFieldId) {
						const sourceElement = elements.find(
							(e) => e.id === link.sourceFieldId
						);
						if (
							sourceElement &&
							sourceElement.type === "currency" &&
							sourceElement.binding
						) {
							links.set(currencyEl.binding, {
								sourceBinding: sourceElement.binding,
								link,
								element: currencyEl,
							});
						}
					}
				}
			}
		}

		return links;
	}, [selectedTemplate]);

	// Map of table column currency links
	const tableColumnCurrencyLinks = useMemo(() => {
		const links = new Map<
			string,
			Map<
				string,
				{
					sourceColumnBinding: string;
					link: CurrencyFieldLink;
					column: { id: string; binding: string; currency?: string };
				}
			>
		>();

		if (!selectedTemplate) return links;

		const elements = selectedTemplate.elements ?? [];

		for (const element of elements) {
			if (element.type === "table") {
				const tableEl = element as Extract<TemplateElement, { type: "table" }>;
				if (tableEl.itemsBinding && tableEl.columns) {
					const tableLinks = new Map<
						string,
						{
							sourceColumnBinding: string;
							link: CurrencyFieldLink;
							column: {
								id: string;
								binding: string;
								currency?: string;
							};
						}
					>();

					for (const col of tableEl.columns) {
						if (
							col.type === "currency" &&
							col.binding &&
							col.mode === "linked" &&
							col.currencyLinks &&
							col.currencyLinks.length > 0
						) {
							const link = col.currencyLinks[0];
							if (link.type === "FX_PAIR" && link.sourceFieldId) {
								const sourceCol = tableEl.columns.find(
									(c) => c.id === link.sourceFieldId
								);
								if (sourceCol && sourceCol.binding) {
									tableLinks.set(col.binding, {
										sourceColumnBinding: sourceCol.binding,
										link,
										column: {
											id: col.id,
											binding: col.binding,
											currency: col.currency,
										},
									});
								}
							}
						}
					}

					if (tableLinks.size > 0) {
						links.set(tableEl.itemsBinding, tableLinks);
					}
				}
			}
		}

		return links;
	}, [selectedTemplate]);

	// Extract bindings from template elements
	const bindings = useMemo((): BindingField[] => {
		if (!selectedTemplate) return [];

		const fields = new Map<string, BindingField>();
		const elements = selectedTemplate.elements ?? [];

		for (const element of elements) {
			let binding: string | undefined;
			let type: "text" | "number" | "date" = "text";

			if (element.type === "text") {
				const textEl = element as Extract<TemplateElement, { type: "text" }>;
				binding = textEl.binding;
			} else if (element.type === "input") {
				const inputEl = element as Extract<TemplateElement, { type: "input" }>;
				binding = inputEl.binding;
				type =
					inputEl.variant === "number"
						? "number"
						: inputEl.variant === "date"
							? "date"
							: "text";

				const hasFormula =
					inputEl.variant === "number" && !!inputEl.formula;

				if (binding) {
					const existingField = fields.get(binding);
					if (existingField) {
						existingField.hasFormula = hasFormula;
						existingField.elementId = element.id;
					} else {
						fields.set(binding, {
							path: binding,
							label: binding
								.split(".")
								.pop()!
								.replace(/([A-Z])/g, " $1")
								.replace(/^./, (c) => c.toUpperCase()),
							type,
							hasFormula,
							elementId: element.id,
						});
					}
					continue;
				}
			} else if (element.type === "currency") {
				const currencyEl = element as Extract<TemplateElement, { type: "currency" }>;
				binding = currencyEl.binding;
				type = "number";

				const isLinked =
					currencyEl.mode === "linked" &&
					currencyEl.currencyLinks &&
					currencyEl.currencyLinks.length > 0;
				const hasFormula =
					currencyEl.mode === "formula" && !!currencyEl.formula;

				if (binding) {
					const existingField = fields.get(binding);
					if (existingField) {
						existingField.isLinkedCurrency = isLinked;
						existingField.hasFormula = hasFormula;
						existingField.elementId = element.id;
					} else {
						fields.set(binding, {
							path: binding,
							label: binding
								.split(".")
								.pop()!
								.replace(/([A-Z])/g, " $1")
								.replace(/^./, (c) => c.toUpperCase()),
							type,
							isLinkedCurrency: isLinked,
							hasFormula,
							elementId: element.id,
						});
					}
					continue;
				}
			} else if (element.type === "image") {
				const imageEl = element as Extract<TemplateElement, { type: "image" }>;
				binding = imageEl.binding;
				type = "text";
			}

			if (binding) {
				const isTableBinding = tableConfigs.some((tc) =>
					binding!.startsWith(tc.itemsPath)
				);
				if (isTableBinding) continue;
				
				const label = binding
					.split(".")
					.pop()!
					.replace(/([A-Z])/g, " $1")
					.replace(/^./, (c) => c.toUpperCase());

				if (!fields.has(binding)) {
					fields.set(binding, { path: binding, label, type });
				}
			}
		}

		return Array.from(fields.values());
	}, [selectedTemplate, tableConfigs]);

	return {
		tableConfigs,
		currencyFieldLinks,
		tableColumnCurrencyLinks,
		bindings,
	};
}

