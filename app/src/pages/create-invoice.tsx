import {
	useMemo,
	useState,
	useEffect,
	useCallback,
	useRef,
	startTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateInvoice } from "@/hooks";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useProductsByOrg } from "@/hooks/repository-hooks/use-products";
import { TemplateElement } from "@/core";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Plus } from "lucide-react";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { setBindingValue, getBindingValue } from "@/core/entities/invoice";
import { CurrencyConversionManager } from "@/components/invoice/currency-conversion-manager";
import type { ConversionRate } from "@/services/currency-conversion-service";
import type { CurrencyFieldLink } from "@/core/entities/currency-field";
import { FormulaService } from "@/services/formula-service";
import { functionsService } from "@/services/functions/functions-service";
import { InvoicePreview } from "@/components/invoice/invoice-preview";
import { InvoiceTemplateSelector } from "@/components/invoice/invoice-template-selector";
import { InvoiceFormFields } from "@/components/invoice/invoice-form-fields";
import { InvoiceTable } from "@/components/invoice/invoice-table";
import { useInvoiceAutoFill } from "@/hooks/use-invoice-auto-fill";

type BindingField = {
	path: string;
	label: string;
	type: "text" | "number" | "date";
	isLinkedCurrency?: boolean; // True if this is a currency field with links
	hasFormula?: boolean; // True if this field has a formula
	elementId?: string; // ID of the template element
};

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

type TableRow = Record<string, InvoiceDataValue>;

export default function CreateInvoicePage() {
	const navigate = useNavigate();
	const createInvoice = useCreateInvoice();
	const { data: currentOrganization, isLoading: isOrgLoading } =
		useCurrentOrganization();
	const {
		data: templates,
		isLoading: isTemplatesLoading,
		isSubscribed,
	} = useTemplates(currentOrganization?.id);
	const { data: products = [] } = useProductsByOrg(currentOrganization?.id);

	const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
	const [formData, setFormData] = useState<Record<string, InvoiceDataValue>>(
		{}
	);
	// Track selected product per row: key is `${itemsPath}-${rowIndex}`, value is productId
	const [selectedProducts, setSelectedProducts] = useState<
		Map<string, string>
	>(new Map());
	// Track locked fields per row: key is `${itemsPath}-${rowIndex}`, value is Set of field bindings
	const [productLockedFields, setProductLockedFields] = useState<
		Map<string, Set<string>>
	>(new Map());
	// Track mapping state per row
	const [mappingProducts, setMappingProducts] = useState<Set<string>>(
		new Set()
	);
	const [complianceValidation, setComplianceValidation] = useState<{
		valid: boolean;
		region: string;
		missingFields: Array<{
			binding: string;
			label: string;
			description?: string;
		}>;
		warnings?: string[];
		errors?: string[];
	} | null>(null);
	const [hasAutoFilled, setHasAutoFilled] = useState(false);
	const [conversionRates, setConversionRates] = useState<ConversionRate[]>(
		[]
	);

	// Debounce timers for currency conversions
	const currencyConversionTimer = useRef<NodeJS.Timeout | null>(null);
	const tableConversionTimers = useRef<Map<string, NodeJS.Timeout>>(
		new Map()
	);

	// Get selected template
	const selectedTemplate = useMemo(() => {
		const list = templates ?? [];
		if (!selectedTemplateId && list.length > 0) {
			setSelectedTemplateId(list[0].id);
			return list[0];
		}
		return list.find((t) => t.id === selectedTemplateId);
	}, [templates, selectedTemplateId]);

	// Extract table configuration first (supports multiple tables)
	const tableConfigs = useMemo((): TableConfig[] => {
		if (!selectedTemplate) return [];

		const tableElements = (selectedTemplate.elements ?? []).filter(
			(e) => e.type === "table"
		) as Extract<TemplateElement, { type: "table" }>[];

		return tableElements
			.filter((tableEl) => tableEl.itemsBinding) // Only include tables with bindings
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

	// Map of currency field links: target binding -> { source binding, link config, element }
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
				const currencyEl = element as Extract<
					TemplateElement,
					{ type: "currency" }
				>;
				if (
					currencyEl.binding &&
					currencyEl.mode === "linked" &&
					currencyEl.currencyLinks &&
					currencyEl.currencyLinks.length > 0
				) {
					// Get the first link (support multiple links later if needed)
					const link = currencyEl.currencyLinks[0];
					if (link.type === "FX_PAIR" && link.sourceFieldId) {
						// Find the source field element
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
					} else if (
						link.type === "FIXED_MULTIPLIER" &&
						link.multiplier !== undefined
					) {
						// For fixed multiplier, we still need a source field
						// This will be handled differently - for now, skip
					}
				}
			}
		}

		return links;
	}, [selectedTemplate]);

	// Map of table column currency links: table path -> column binding -> { source column binding, link config }
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
				const tableEl = element as Extract<
					TemplateElement,
					{ type: "table" }
				>;
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
								// Find the source column in the same table
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
							} else if (
								link.type === "FIXED_MULTIPLIER" &&
								link.multiplier !== undefined
							) {
								// For fixed multiplier, we need a source - skip for now
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

	// Extract bindings from template elements (depends on tableConfigs)
	const bindings = useMemo((): BindingField[] => {
		if (!selectedTemplate) return [];

		const fields = new Map<string, BindingField>();
		const elements = selectedTemplate.elements ?? [];

		for (const element of elements) {
			let binding: string | undefined;
			let type: "text" | "number" | "date" = "text";

			if (element.type === "text") {
				const textEl = element as Extract<
					TemplateElement,
					{ type: "text" }
				>;
				binding = textEl.binding;
			} else if (element.type === "input") {
				const inputEl = element as Extract<
					TemplateElement,
					{ type: "input" }
				>;
				binding = inputEl.binding;
				type =
					inputEl.variant === "number"
						? "number"
						: inputEl.variant === "date"
							? "date"
							: "text";

				// Check if this input has a formula (for number variant)
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
				const currencyEl = element as Extract<
					TemplateElement,
					{ type: "currency" }
				>;
				binding = currencyEl.binding;
				type = "number"; // Currency fields are numeric

				// Check if this currency field is linked (has currencyLinks) or has formula
				const isLinked =
					currencyEl.mode === "linked" &&
					currencyEl.currencyLinks &&
					currencyEl.currencyLinks.length > 0;
				const hasFormula =
					currencyEl.mode === "formula" && !!currencyEl.formula;

				if (binding) {
					const existingField = fields.get(binding);
					if (existingField) {
						// Update existing field to mark it as linked or formula if it is
						existingField.isLinkedCurrency = isLinked;
						existingField.hasFormula = hasFormula;
						existingField.elementId = element.id;
					} else {
						// Add new field with linked/formula status
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
					continue; // Skip the duplicate addition below
				}
			} else if (element.type === "image") {
				const imageEl = element as Extract<
					TemplateElement,
					{ type: "image" }
				>;
				binding = imageEl.binding;
				type = "text"; // Image URLs are text
			}

			if (binding) {
				// Skip bindings that are table paths (these are handled separately)
				const isTableBinding = tableConfigs.some((tc) =>
					binding.startsWith(tc.itemsPath)
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

	// Auto-fill organization data when template is selected
	useEffect(() => {
		if (!selectedTemplate || !currentOrganization || hasAutoFilled) return;

		const newData = { ...formData };
		let hasChanges = false;

		// Auto-fill seller/supplier information
		if (currentOrganization.name) {
			const sellerNameBinding = bindings.find(
				(b) => b.path === "seller.name" || b.path === "supplier.name"
			);
			if (
				sellerNameBinding &&
				!getBindingValue(newData, sellerNameBinding.path)
			) {
				setBindingValue(
					newData,
					sellerNameBinding.path,
					currentOrganization.name
				);
				hasChanges = true;
			}
		}

		// Auto-fill organization address if available
		const orgAddress = currentOrganization.settings?.address;
		if (orgAddress) {
			const sellerAddressBinding = bindings.find(
				(b) =>
					b.path === "seller.address" || b.path === "supplier.address"
			);
			if (
				sellerAddressBinding &&
				!getBindingValue(newData, sellerAddressBinding.path)
			) {
				// Build address object from organization address
				const addressObj: Record<string, string> = {};
				if (orgAddress.street) addressObj.street = orgAddress.street;
				if (orgAddress.city) addressObj.city = orgAddress.city;
				if (orgAddress.state) addressObj.state = orgAddress.state;
				if (orgAddress.zipCode) addressObj.zipCode = orgAddress.zipCode;
				if (orgAddress.country) addressObj.country = orgAddress.country;

				if (Object.keys(addressObj).length > 0) {
					setBindingValue(
						newData,
						sellerAddressBinding.path,
						addressObj
					);
					hasChanges = true;
				}
			}
		}

		// Auto-fill currency
		const currencyBinding = bindings.find((b) => b.path === "currency");
		if (
			currencyBinding &&
			!getBindingValue(newData, currencyBinding.path)
		) {
			const currency =
				currentOrganization.settings?.defaultCurrency || "USD";
			setBindingValue(newData, currencyBinding.path, currency);
			hasChanges = true;
		}

		// Auto-fill invoice date
		const invoiceDateBinding = bindings.find(
			(b) => b.path === "invoiceDate" || b.path === "issueDate"
		);
		if (
			invoiceDateBinding &&
			!getBindingValue(newData, invoiceDateBinding.path)
		) {
			setBindingValue(
				newData,
				invoiceDateBinding.path,
				new Date().toISOString().split("T")[0]
			);
			hasChanges = true;
		}

		if (hasChanges) {
			setFormData(newData);
			setHasAutoFilled(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTemplate, currentOrganization, bindings, hasAutoFilled]); // formData intentionally excluded to prevent infinite loop

	// Function to evaluate formulas for given form data
	const evaluateFormulas = useCallback(
		(dataToEvaluate: Record<string, InvoiceDataValue>): { data: Record<string, InvoiceDataValue>; updatedFields: Array<{ binding: string; value: number }> } => {
			console.log("evaluateFormulas: Called with data:", dataToEvaluate);
			if (!selectedTemplate || !dataToEvaluate) {
				console.log("evaluateFormulas: Early return - no template or data");
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

			// Helper to get value from data (handles array indices like items[0].unitPrice)
			const getValueFromData = (path: string): InvoiceDataValue => {
				// Handle array indices in path (e.g., "items[0].unitPrice")
				const arrayIndexMatch = path.match(/^(.+)\[(\d+)\]\.(.+)$/);
				if (arrayIndexMatch) {
					const [, arrayPath, indexStr, fieldPath] = arrayIndexMatch;
					const index = parseInt(indexStr, 10);
					
					// Get the array
					const arrayValue = getBindingValue(dataToEvaluate, arrayPath);
					if (!Array.isArray(arrayValue) || !arrayValue[index]) {
						return "";
					}
					
					// Get the field from the array item
					const arrayItem = arrayValue[index];
					if (typeof arrayItem !== "object" || Array.isArray(arrayItem)) {
						return "";
					}
					
					return (arrayItem as Record<string, InvoiceDataValue>)[fieldPath] ?? "";
				}
				
				// Handle simple dot notation
				return getBindingValue(dataToEvaluate, path) ?? "";
			};

			// Collect all elements with formulas
			for (const element of elements) {
				if (element.type === "input") {
					const inputEl = element as Extract<
						TemplateElement,
						{ type: "input" }
					>;
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
					const currencyEl = element as Extract<
						TemplateElement,
						{ type: "currency" }
					>;
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

			// Also check table columns with formulas
			for (const element of elements) {
				if (element.type === "table") {
					const tableEl = element as Extract<
						TemplateElement,
						{ type: "table" }
					>;
					if (!tableEl.itemsBinding) continue;

					const items = getValueFromData(tableEl.itemsBinding);
					const itemsArray = Array.isArray(items) ? items : [];

					for (const col of tableEl.columns ?? []) {
						if (
							(col.type === "number" || col.type === "currency") &&
							col.calc
						) {
							// Evaluate formula for each row
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
									// Add table context for resolving column references
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

			console.log("evaluateFormulas: Found", formulaElements.length, "formula elements");
			if (formulaElements.length === 0) {
				console.log("evaluateFormulas: No formulas to evaluate, returning original data");
				return { data: dataToEvaluate, updatedFields: [] };
			}

			// Create a map of element IDs to their current values for formula evaluation
			const elementValues = new Map<string, number>();
			for (const el of elements) {
				if (
					(el.type === "input" && el.variant === "number") ||
					el.type === "currency"
				) {
					if (el.binding) {
						const value = getValueFromData(el.binding);
						if (typeof value === "number") {
							elementValues.set(el.id, value);
						}
					}
				}
			}

			// Evaluate all formulas
			// Create a deep copy to avoid mutating the original
			const updatedData = JSON.parse(JSON.stringify(dataToEvaluate));
			console.log("evaluateFormulas: Starting evaluation with data:", updatedData);

			// Track which fields were updated by formulas (for currency linking)
			const updatedFields: Array<{ binding: string; value: number }> = [];

			for (const { element, binding, formula, tableContext } of formulaElements) {
				try {
					console.log("evaluateFormulas: Evaluating formula", formula, "for binding", binding, "with tableContext", tableContext);
					
					// If this is a table column formula, resolve column references to full binding paths
					let processedFormula = formula;
					if (tableContext) {
						// Replace column references (e.g., "quantity", "unitPriceBGN") with full paths (e.g., "items[0].quantity", "items[0].unitPriceBGN")
						for (const col of tableContext.columns) {
							const colBinding = col.binding || col.id;
							// Create the full binding path for this row
							const fullPath = `${tableContext.itemsBinding}[${tableContext.rowIndex}].${colBinding}`;
							// Replace column references in the formula (using word boundaries to avoid partial matches)
							// Match: word boundary + column binding + word boundary (but not if it's already part of a path like items[0].quantity)
							const regex = new RegExp(`\\b${colBinding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?![\\[\\]])`, 'g');
							processedFormula = processedFormula.replace(regex, fullPath);
						}
						console.log("evaluateFormulas: Processed formula", processedFormula, "from original", formula);
					}
					
					// FormulaService.evaluate uses resolveReference which reads from formData
					// Make sure it can access the updated values
					const result = FormulaService.evaluate(
						processedFormula,
						updatedData,
						elements,
						elementValues
					);

					console.log("evaluateFormulas: Formula result:", result, "for binding", binding);

					// Update the value if it changed
					const currentValue = getBindingValue(updatedData, binding);
					console.log("evaluateFormulas: Current value:", currentValue, "New result:", result);
					if (currentValue !== result) {
						setBindingValue(updatedData, binding, result);
						// Update elementValues for subsequent formula evaluations that might reference this
						elementValues.set(element.id, result);
						// Track this update for currency linking
						if (typeof result === "number") {
							updatedFields.push({ binding, value: result });
						}
						console.log("evaluateFormulas: Updated binding", binding, "to", result);
					} else {
						console.log("evaluateFormulas: Value unchanged for binding", binding);
					}
				} catch (error) {
					console.error("Formula evaluation error:", error, {
						element,
						binding,
						formula,
						data: updatedData,
					});
				}
			}

			console.log("evaluateFormulas: Final data:", updatedData);
			// Return both the updated data and the list of updated fields
			return { data: updatedData, updatedFields };
		},
		[selectedTemplate]
	);

	// Get default currency from organization settings (fallback only)
	const defaultCurrency = useMemo(() => {
		return currentOrganization?.settings?.defaultCurrency || "USD";
	}, [currentOrganization?.settings?.defaultCurrency]);

	// Compute linked currency field value
	const computeLinkedCurrencyValue = useCallback(async (
		sourceValue: number,
		sourceCurrency: string,
		link: CurrencyFieldLink,
		targetCurrency: string
	): Promise<number> => {
		try {
			if (link.type === "FX_PAIR") {
				// Import getExchangeRate directly to ensure we get the correct rate
				const { getExchangeRate } = await import("@/utils/currencies");

				// Fetch rate directly from API with sourceCurrency as base
				// This ensures we get: 1 sourceCurrency = X targetCurrency
				const rate = await getExchangeRate(
					sourceCurrency,
					targetCurrency
				);

				// Calculate: sourceValue * rate = targetValue
				// Example: 10 BGN * 0.511 = 5.11 EUR
				const result = sourceValue * rate;

				console.log(
					`Currency conversion: ${sourceValue} ${sourceCurrency} * ${rate} = ${result} ${targetCurrency}`
				);
				return result;
			} else if (
				link.type === "FIXED_MULTIPLIER" &&
				link.multiplier !== undefined
			) {
				return sourceValue * link.multiplier;
			}
			return sourceValue;
		} catch (error) {
			console.error("Error computing linked currency value:", error, {
				sourceValue,
				sourceCurrency,
				targetCurrency,
				linkType: link.type,
			});
			return sourceValue;
		}
	}, []);

	// Function to update linked currency fields after a source field changes
	const updateLinkedCurrencyFields = useCallback(async (
		data: Record<string, InvoiceDataValue>,
		updatedBinding: string,
		updatedValue: number
	): Promise<Record<string, InvoiceDataValue>> => {
		const updatedData = JSON.parse(JSON.stringify(data)); // Deep copy
		const updates: Array<{ binding: string; value: number }> = [];

		// Check regular currency field links
		for (const [targetBinding, linkInfo] of currencyFieldLinks.entries()) {
			if (linkInfo.sourceBinding === updatedBinding) {
				// This field is a source for targetBinding
				const sourceElement = selectedTemplate?.elements?.find(
					(e) => e.type === "currency" && e.binding === updatedBinding
				) as Extract<TemplateElement, { type: "currency" }> | undefined;

				const sourceCurrency = sourceElement?.currency || defaultCurrency;
				const targetCurrency = linkInfo.element.currency || defaultCurrency;

				try {
					const linkedValue = await computeLinkedCurrencyValue(
						updatedValue,
						sourceCurrency,
						linkInfo.link,
						targetCurrency
					);
					updates.push({ binding: targetBinding, value: linkedValue });
				} catch (error) {
					console.error("Error computing linked currency value:", error);
				}
			}
		}

		// Check table column currency links
		for (const [tablePath, tableLinks] of tableColumnCurrencyLinks.entries()) {
			// Check if the updated binding is in this table
			const tableMatch = updatedBinding.match(/^(.+)\[(\d+)\]\.(.+)$/);
			if (tableMatch) {
				const [, arrayPath, indexStr, fieldPath] = tableMatch;
				if (arrayPath === tablePath) {
					// The updated field is in this table
					for (const [targetColumnBinding, linkInfo] of tableLinks.entries()) {
						if (linkInfo.sourceColumnBinding === fieldPath) {
							// This column is a source for targetColumnBinding
							const targetBinding = `${tablePath}[${indexStr}].${targetColumnBinding}`;
							
							// Find source and target currency elements
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
								updates.push({ binding: targetBinding, value: linkedValue });
							} catch (error) {
								console.error("Error computing linked currency value for table column:", error);
							}
						}
					}
				}
			}
		}

		// Apply all updates
		for (const { binding, value } of updates) {
			setBindingValue(updatedData, binding, value);
			console.log("updateLinkedCurrencyFields: Updated", binding, "to", value);
		}

		return updatedData;
	}, [selectedTemplate, tableColumnCurrencyLinks, currencyFieldLinks, defaultCurrency, computeLinkedCurrencyValue]);

	// Formula evaluation: debounced to avoid blocking typing
	// Use a ref to track the debounce timer
	const formulaEvaluationTimerRef = useRef<NodeJS.Timeout | null>(null);
	
	useEffect(() => {
		if (!selectedTemplate || !formData) return;

		// Clear existing timer
		if (formulaEvaluationTimerRef.current) {
			clearTimeout(formulaEvaluationTimerRef.current);
		}

		// Debounce formula evaluation to avoid blocking typing
		formulaEvaluationTimerRef.current = setTimeout(() => {
			// Use startTransition to make this non-blocking
			startTransition(() => {
				const { data: updatedData, updatedFields } = evaluateFormulas(formData);
				
				// Only update if there are changes (compare by serializing to avoid unnecessary updates)
				const hasChanges = JSON.stringify(updatedData) !== JSON.stringify(formData);
				if (hasChanges) {
					setFormData(updatedData);
					
					// Update linked currency fields for all fields that were updated by formulas
					if (updatedFields.length > 0) {
						// Process currency conversions asynchronously (fire and forget)
						(async () => {
							let finalData = updatedData;
							for (const { binding, value } of updatedFields) {
								finalData = await updateLinkedCurrencyFields(finalData, binding, value);
							}
							// Only update if currency conversions changed anything
							if (JSON.stringify(finalData) !== JSON.stringify(updatedData)) {
								setFormData(finalData);
							}
						})();
					}
				}
			});
		}, 150); // 150ms debounce - short enough to feel responsive, long enough to avoid blocking

		// Cleanup timer on unmount or when dependencies change
		return () => {
			if (formulaEvaluationTimerRef.current) {
				clearTimeout(formulaEvaluationTimerRef.current);
			}
		};
	}, [formData, selectedTemplate, evaluateFormulas, updateLinkedCurrencyFields]);

	// Real-time compliance validation
	useEffect(() => {
		if (
			!selectedTemplate ||
			!currentOrganization ||
			Object.keys(formData).length === 0
		) {
			setComplianceValidation(null);
			return;
		}

		const region =
			invoiceComplianceService.detectRegion(currentOrganization);
		const invoiceData = {
			orgId: currentOrganization.id,
			templateId: selectedTemplate.id,
			data: formData,
			status: "draft" as const,
		};

		const validation = invoiceComplianceService.validateInvoice(
			invoiceData,
			region
		);
		setComplianceValidation({
			valid: validation.valid,
			region: validation.region,
			missingFields: validation.missingFields,
			warnings: validation.warnings,
			errors: validation.errors,
		});
	}, [formData, selectedTemplate, currentOrganization]);

	// Get value from nested path
	const getValue = useCallback(
		(path: string): InvoiceDataValue => {
			const parts = path.split(".");
			let value: InvoiceDataValue = formData;

			for (const part of parts) {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					value = value[part];
				} else {
					return "";
				}
			}

			return value ?? "";
		},
		[formData]
	);

	// Set value at nested path (creates new references at each level for proper React re-rendering)
	const setValue = useCallback((
		path: string,
		value: InvoiceDataValue
	): void => {
		// Handle array indices in path (e.g., "items[0].quantity")
		const arrayIndexMatch = path.match(/^(.+)\[(\d+)\]\.(.+)$/);
		
		if (arrayIndexMatch) {
			// Handle array index path like "items[0].quantity"
			const [, arrayPath, indexStr, fieldName] = arrayIndexMatch;
			const index = parseInt(indexStr, 10);
			
			// Update state immediately for responsive typing (formulas will be evaluated in useEffect)
			// Use functional update to avoid stale closures when typing fast
			setFormData((prev) => {
				// Only update if the path actually changed to avoid unnecessary re-renders
				const currentValue = getBindingValue(prev, path);
				if (currentValue === value) {
					return prev; // No change, return previous state
				}
				
				// Rebuild from prev to avoid stale closures
				const updatedData = { ...prev };
				
				// Get the array
				const arrayValue = getBindingValue(updatedData, arrayPath);
				if (!Array.isArray(arrayValue)) {
					// Array doesn't exist, create it
					const newArray: Array<Record<string, InvoiceDataValue>> = [];
					while (newArray.length <= index) {
						newArray.push({});
					}
					newArray[index] = { [fieldName]: value };
					setBindingValue(updatedData, arrayPath, newArray);
				} else {
					// Create a copy of the array
					const arrayCopy = [...arrayValue];
					
					// Ensure the array has enough items
					while (arrayCopy.length <= index) {
						arrayCopy.push({});
					}
					
					// Update the array item
					if (
						arrayCopy[index] &&
						typeof arrayCopy[index] === "object" &&
						!Array.isArray(arrayCopy[index])
					) {
						arrayCopy[index] = {
							...(arrayCopy[index] as Record<string, InvoiceDataValue>),
							[fieldName]: value,
						};
					} else {
						arrayCopy[index] = { [fieldName]: value };
					}
					
					setBindingValue(updatedData, arrayPath, arrayCopy);
				}
				
				return updatedData;
			});
			return;
		}
		
		// Handle simple dot notation path (e.g., "seller.name")
		const parts = path.split(".");

		// Create a deep clone with new references at each level in the path
		const newData = { ...formData };
		const pathToUpdate: Record<string, InvoiceDataValue>[] = [newData];
		let current: Record<string, InvoiceDataValue> = newData;

		// Navigate to the parent of the target, creating new object references
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			const next = current[part];

			if (next && typeof next === "object" && !Array.isArray(next)) {
				// Clone the nested object to create a new reference
				current[part] = {
					...(next as Record<string, InvoiceDataValue>),
				};
			} else {
				// Create new object if it doesn't exist or isn't an object
				current[part] = {};
			}

			current = current[part] as Record<string, InvoiceDataValue>;
			pathToUpdate.push(current);
		}

		// Update state immediately for responsive typing (formulas will be evaluated in useEffect)
		// Use functional update to avoid stale closures when typing fast
		setFormData((prev) => {
			// Only update if the path actually changed to avoid unnecessary re-renders
			const currentValue = getBindingValue(prev, path);
			if (currentValue === value) {
				return prev; // No change, return previous state
			}
			
			// Rebuild from prev to avoid stale closures
			const updatedData = { ...prev };
			const pathParts = path.split(".");
			let current: Record<string, InvoiceDataValue> = updatedData;

			// Navigate to the parent of the target, creating new object references
			for (let i = 0; i < pathParts.length - 1; i++) {
				const part = pathParts[i];
				const next = current[part];

				if (next && typeof next === "object" && !Array.isArray(next)) {
					current[part] = {
						...(next as Record<string, InvoiceDataValue>),
					};
				} else {
					current[part] = {};
				}

				current = current[part] as Record<string, InvoiceDataValue>;
			}

			// Set the final value
			current[pathParts[pathParts.length - 1]] = value;
			return updatedData;
		});

		// Debounce currency conversion calculations
		// Check if this is a source field for any linked currency fields
		// currencyFieldLinks maps: target binding -> { source binding, link, element }
		// So we need to find all targets that have this path as their source
		// Only process conversions for actual numbers (not empty strings)
		if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
			// Clear existing timer
			if (currencyConversionTimer.current) {
				clearTimeout(currencyConversionTimer.current);
			}

			// Debounce the conversion calculation
			// Capture the current value to avoid stale closures
			const currentValue = value;
			currencyConversionTimer.current = setTimeout(async () => {
				// Use functional update to get the latest formData
				setFormData((prevFormData) => {
					const updatedData = { ...prevFormData };

					// Get the current source value from the latest formData
					const sourceValue = (() => {
						const parts = path.split(".");
						let val: InvoiceDataValue = prevFormData;
						for (const part of parts) {
							if (
								val &&
								typeof val === "object" &&
								!Array.isArray(val)
							) {
								val = val[part];
							} else {
								return currentValue; // Fallback to captured value
							}
						}
						return val ?? currentValue;
					})();

					if (typeof sourceValue !== "number") {
						return prevFormData; // No update needed
					}

					for (const [
						targetBinding,
						linkInfo,
					] of currencyFieldLinks.entries()) {
						if (linkInfo.sourceBinding === path) {
							// This field is a source for targetBinding
							// Find the source currency element to get its currency
							const sourceElement =
								selectedTemplate?.elements?.find(
									(e) =>
										e.type === "currency" &&
										e.binding === path
								) as
									| Extract<
											TemplateElement,
											{ type: "currency" }
									  >
									| undefined;

							const sourceCurrency =
								sourceElement?.currency || defaultCurrency;
							const targetCurrency =
								linkInfo.element.currency || defaultCurrency;

							// Compute linked value (this is async, so we'll handle it separately)
							computeLinkedCurrencyValue(
								sourceValue,
								sourceCurrency,
								linkInfo.link,
								targetCurrency
							).then((linkedValue) => {
								// Use functional update again to ensure we have the latest state
								setFormData((latestFormData) => {
									const finalData = { ...latestFormData };

									// Update the linked field
									if (targetBinding) {
										const linkedParts =
											targetBinding.split(".");
										let linkedCurrent: Record<
											string,
											InvoiceDataValue
										> = finalData;
										for (
											let i = 0;
											i < linkedParts.length - 1;
											i++
										) {
											const part = linkedParts[i];
											if (
												!linkedCurrent[part] ||
												typeof linkedCurrent[part] !==
													"object" ||
												Array.isArray(
													linkedCurrent[part]
												)
											) {
												linkedCurrent[part] = {};
											}
											linkedCurrent = linkedCurrent[
												part
											] as Record<
												string,
												InvoiceDataValue
											>;
										}
										linkedCurrent[
											linkedParts[linkedParts.length - 1]
										] = linkedValue;
									}

									return finalData;
								});
							});
						}
					}

					return updatedData;
				});
			}, 500); // 500ms debounce delay
		}
	}, [formData, selectedTemplate, currencyFieldLinks, defaultCurrency, computeLinkedCurrencyValue]);

	// Handle product selection for a specific table row
	const handleProductSelectForRow = useCallback(
		async (
			itemsPath: string,
			rowIndex: number,
			productId: string | undefined
		) => {
			const rowKey = `${itemsPath}-${rowIndex}`;

			if (!productId || !selectedTemplate || !currentOrganization) {
				// Clear product selection for this row
				setSelectedProducts((prev) => {
					const next = new Map(prev);
					next.delete(rowKey);
					return next;
				});
				setProductLockedFields((prev) => {
					const next = new Map(prev);
					next.delete(rowKey);
					return next;
				});
				return;
			}

			setMappingProducts((prev) => new Set(prev).add(rowKey));
			try {
				// Get current row data
				const items = getValue(itemsPath);
				const itemsArray = Array.isArray(items) ? items : [];
				const currentRow = itemsArray[rowIndex] as TableRow | undefined;

				// Call backend AI function to map product to invoice fields
				const mappingResult =
					await functionsService.mapProductToInvoiceFields({
						productId,
						templateId: selectedTemplate.id,
						organizationId: currentOrganization.id,
						currentFormData: formData,
					});

				console.log("Mapping result:", mappingResult);

				// Update form data with mapped values for this specific row
				const newData = { ...formData };
				const lockedFields = new Set<string>();

				// Helper function to set array item value directly
				const setArrayItemValue = (
					data: Record<string, InvoiceDataValue>,
					arrayPath: string,
					index: number,
					fieldName: string,
					value: InvoiceDataValue
				) => {
					// Get the array from the data object (not formData)
					const arrayValue = getBindingValue(data, arrayPath);
					if (!Array.isArray(arrayValue)) {
						// Array doesn't exist, create it
						const newArray: Array<
							Record<string, InvoiceDataValue>
						> = [];
						while (newArray.length <= index) {
							newArray.push({});
						}
						newArray[index] = { [fieldName]: value };
						setBindingValue(data, arrayPath, newArray);
						return;
					}

					// Create a copy of the array to avoid mutating the original
					const arrayCopy = [...arrayValue];

					// Ensure the array has enough items
					while (arrayCopy.length <= index) {
						arrayCopy.push({});
					}

					// Set the value directly in the array item
					if (
						arrayCopy[index] &&
						typeof arrayCopy[index] === "object" &&
						!Array.isArray(arrayCopy[index])
					) {
						// Create a copy of the object to avoid mutation
						arrayCopy[index] = {
							...(arrayCopy[index] as Record<
								string,
								InvoiceDataValue
							>),
							[fieldName]: value,
						};
					} else {
						arrayCopy[index] = { [fieldName]: value };
					}

					// Update the data with the modified array
					setBindingValue(data, arrayPath, arrayCopy);
				};

				// Apply mapped field values to the specific row
				for (const [binding, value] of Object.entries(
					mappingResult.mappedFields
				)) {
					// Check if this binding is for a table row (e.g., "items[0].description")
					const rowBindingMatch = binding.match(
						/^(.+)\[(\d+)\]\.(.+)$/
					);
					if (rowBindingMatch) {
						const [, basePath, indexStr, fieldName] =
							rowBindingMatch;
						const index = parseInt(indexStr, 10);

						// Skip quantity fields - user should set these manually
						if (fieldName === "quantity" || fieldName === "qty") {
							continue;
						}

						// Only apply if it matches our row
						if (basePath === itemsPath && index === rowIndex) {
							setArrayItemValue(
								newData,
								itemsPath,
								rowIndex,
								fieldName,
								value as InvoiceDataValue
							);
							lockedFields.add(fieldName); // Store just the field name for this row
						}
					} else {
						// For non-table bindings, check if they should apply to this row
						// This handles cases where AI maps to top-level fields
						// We'll skip these for row-specific mapping
					}
				}

				// Also try to map common product fields directly to row fields
				const product = products.find((p) => p.id === productId);
				if (product) {
					// Map product data to common row fields
					const rowData: Record<string, InvoiceDataValue> = {};

					// Map product name to description
					if (!currentRow?.description) {
						rowData.description = product.name;
						lockedFields.add("description");
					}

					// Map product price to unitPrice or price
					if (!currentRow?.unitPrice && !currentRow?.price) {
						rowData.unitPrice = product.price;
						lockedFields.add("unitPrice");
					}

					// Map product currency
					if (!currentRow?.currency) {
						rowData.currency = product.currency;
						lockedFields.add("currency");
					}

					// Map product SKU
					if (product.sku && !currentRow?.sku) {
						rowData.sku = product.sku;
						lockedFields.add("sku");
					}

					// Map product description
					if (product.description && !currentRow?.description) {
						rowData.description = product.description;
						lockedFields.add("description");
					}

					// Don't set quantity automatically - user should set it manually
					// Stock validation will be handled in the UI

					// Apply row data
					for (const [fieldName, value] of Object.entries(rowData)) {
						setArrayItemValue(
							newData,
							itemsPath,
							rowIndex,
							fieldName,
							value
						);
					}
				}

				// Evaluate formulas after updating form data with product mapping
				// Make sure the data structure is correct before evaluating
				// The newData should already have all the product values set correctly
				const { data: dataWithFormulas, updatedFields } = evaluateFormulas(newData);
				setFormData(dataWithFormulas);
				
				// Update linked currency fields for all fields that were updated by formulas
				if (updatedFields.length > 0) {
					(async () => {
						let finalData = dataWithFormulas;
						for (const { binding, value } of updatedFields) {
							finalData = await updateLinkedCurrencyFields(finalData, binding, value);
						}
						// Only update if currency conversions changed anything
						if (JSON.stringify(finalData) !== JSON.stringify(dataWithFormulas)) {
							setFormData(finalData);
						}
					})();
				}
				setProductLockedFields((prev) => {
					const next = new Map(prev);
					next.set(rowKey, lockedFields);
					return next;
				});
				setSelectedProducts((prev) => {
					const next = new Map(prev);
					next.set(rowKey, productId);
					return next;
				});

				toast.success("Product data mapped to invoice item");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				toast.error(`Failed to map product data: ${message}`);
				setSelectedProducts((prev) => {
					const next = new Map(prev);
					next.delete(rowKey);
					return next;
				});
				setProductLockedFields((prev) => {
					const next = new Map(prev);
					next.delete(rowKey);
					return next;
				});
			} finally {
				setMappingProducts((prev) => {
					const next = new Set(prev);
					next.delete(rowKey);
					return next;
				});
			}
		},
		[selectedTemplate, currentOrganization, formData, products, getValue, evaluateFormulas, updateLinkedCurrencyFields]
	);

	// Clear product selection for a specific row
	const handleClearProductForRow = useCallback(
		(itemsPath: string, rowIndex: number) => {
			const rowKey = `${itemsPath}-${rowIndex}`;
			setSelectedProducts((prev) => {
				const next = new Map(prev);
				next.delete(rowKey);
				return next;
			});
			setProductLockedFields((prev) => {
				const next = new Map(prev);
				next.delete(rowKey);
				return next;
			});
		},
		[]
	);

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault();

		if (!selectedTemplate) {
			toast.error("Please select a template");
			return;
		}

		if (!currentOrganization) {
			toast.error("Organization not found. Please try again.");
			return;
		}

		// Pre-validate compliance before saving
		const region =
			invoiceComplianceService.detectRegion(currentOrganization);
		const invoiceData = {
			orgId: currentOrganization.id,
			templateId: selectedTemplate.id,
			data: formData,
			status: "draft" as const,
		};

		const validation = invoiceComplianceService.validateInvoice(
			invoiceData,
			region
		);

		if (!validation.valid) {
			const missingFieldsList = validation.missingFields
				.map((f) => f.label)
				.join(", ");
			toast.error(
				`Invoice is not compliant. Missing required fields: ${missingFieldsList}`,
				{ duration: 5000 }
			);
			return;
		}

		if (validation.warnings && validation.warnings.length > 0) {
			toast.warning(
				`Invoice has compliance warnings: ${validation.warnings.join(", ")}`,
				{ duration: 5000 }
			);
		}

		try {
			// Store conversion rates in invoice data
			const invoiceDataWithRates = {
			...formData,
			_conversionRates: conversionRates,
			_defaultCurrency: defaultCurrency,
		};

			// Collect product IDs from all rows for quantity deduction
			// Match product IDs to items by row index to ensure correct order
			// We need to maintain index alignment, so we collect all productIds (including undefined)
			const allProductIds: (string | undefined)[] = [];
			for (const tableConfig of tableConfigs) {
				const items = getTableItems(tableConfig.itemsPath);
				for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
					const rowKey = `${tableConfig.itemsPath}-${rowIndex}`;
					const productId = selectedProducts.get(rowKey);
					allProductIds.push(productId); // Push productId (may be undefined to maintain index alignment)
				}
			}
			// Only send if we have at least one product ID
			const hasProducts = allProductIds.some((id) => !!id);
			const productIds = hasProducts
				? allProductIds.filter((id): id is string => !!id)
				: undefined;

			const invoicePayload = {
				orgId: currentOrganization.id,
				templateId: selectedTemplate.id,
				data: invoiceDataWithRates,
				status: "draft" as const,
				productIds, // Include product IDs for quantity deduction
			};

			const result = await createInvoice.mutateAsync(invoicePayload);

			toast.success("Invoice created successfully!");
			navigate(`/invoices/${result.id}`);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to create invoice: ${message}`);
		}
	};

	// Get table items for a specific table
	const getTableItems = useCallback(
		(itemsPath: string): TableRow[] => {
			const parts = itemsPath.split(".");
			let value: InvoiceDataValue = formData;

			for (const part of parts) {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value)
				) {
					value = value[part];
				} else {
					return [];
				}
			}

			if (!Array.isArray(value)) return [];

		return value.filter(
			(item): item is TableRow =>
				typeof item === "object" &&
				item !== null &&
				!Array.isArray(item)
		);
	},
	[formData]
);

	// Auto-fill handler
	const { handleAutoFill } = useInvoiceAutoFill({
		formData,
		setFormData,
		currentOrganization: currentOrganization ?? undefined,
		getValue,
		bindings,
		tableConfigs,
		getTableItems,
	});

	// Get all items from all tables for currency conversion
	const allItems = useMemo(() => {
		const items: Array<{ currency?: string; [key: string]: unknown }> = [];
		for (const tableConfig of tableConfigs) {
			const tableItems = getTableItems(tableConfig.itemsPath);
			for (const item of tableItems) {
				items.push(
					item as { currency?: string; [key: string]: unknown }
				);
			}
		}
		return items;
	}, [tableConfigs, getTableItems]);

	// Calculate totals with currency conversion
	const calculatedTotals = useMemo(() => {
		let subtotal = 0;
		let total = 0;

		// Calculate totals - currency is handled per-field, so we just sum all totals
		for (const item of allItems) {
			const itemTotal =
				typeof item.total === "number"
					? item.total
					: typeof item.amount === "number"
						? item.amount
						: 0;

			subtotal += itemTotal;
			total += itemTotal;
		}

		return { subtotal, total };
	}, [allItems]);

	// Add table row
	const addTableRow = async (
		itemsPath: string,
		columns: TableColumn[]
	): Promise<void> => {
		const items = getValue(itemsPath);
		const itemsArray = Array.isArray(items) ? items : [];

		const newRow: TableRow = {};
		columns.forEach((col) => {
			newRow[col.binding] = col.type === "number" ? 0 : "";
		});

		await setValue(itemsPath, [...itemsArray, newRow]);
	};

	// Remove table row
	const removeTableRow = async (
		itemsPath: string,
		index: number
	): Promise<void> => {
		const items = getValue(itemsPath);
		const itemsArray = Array.isArray(items) ? items : [];

		await setValue(
			itemsPath,
			itemsArray.filter((_: InvoiceDataValue, i: number) => i !== index)
		);
	};

	// Update table cell (creates new array and object references)
	const updateTableCell = (
		itemsPath: string,
		rowIndex: number,
		binding: string,
		value: InvoiceDataValue
	): void => {
		const items = getValue(itemsPath);
		const itemsArray = Array.isArray(items) ? items : [];

		// Create a new array with new object references for immutability
		const newItemsArray = itemsArray.map((item, idx) => {
			if (idx === rowIndex) {
				// Create new object for the row being updated
				const currentRow =
					item && typeof item === "object" && !Array.isArray(item)
						? (item as TableRow)
						: {};
				return { ...currentRow, [binding]: value };
			}
			return item;
		});

		// If row doesn't exist yet, add it
		if (rowIndex >= newItemsArray.length) {
			const newRow: TableRow = { [binding]: value };
			newItemsArray[rowIndex] = newRow;
		}

		// Update table data immediately for responsive UI (synchronous update)
		const parts = itemsPath.split(".");
		const newData = { ...formData };
		let current: Record<string, InvoiceDataValue> = newData;

		// Navigate to the parent of the target, creating new object references
		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			const next = current[part];

			if (next && typeof next === "object" && !Array.isArray(next)) {
				current[part] = {
					...(next as Record<string, InvoiceDataValue>),
				};
			} else {
				current[part] = {};
			}

			current = current[part] as Record<string, InvoiceDataValue>;
		}

		// Set the final value
		current[parts[parts.length - 1]] = newItemsArray;

		// Use startTransition to mark state update as non-urgent for better typing performance
		startTransition(() => {
			setFormData(newData);
		});

		// Debounce currency conversion calculations for table columns
		// Only process conversions for actual numbers (not empty strings)
		const tableLinks = tableColumnCurrencyLinks.get(itemsPath);
		if (
			tableLinks &&
			typeof value === "number" &&
			!isNaN(value) &&
			isFinite(value)
		) {
			// Create a unique key for this table row and column
			const timerKey = `${itemsPath}-${rowIndex}-${binding}`;

			// Clear existing timer for this specific cell
			const existingTimer = tableConversionTimers.current.get(timerKey);
			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			// Debounce the conversion calculation
			// Capture current values to avoid stale closures
			const currentValue = value;
			const timer = setTimeout(() => {
				// Use functional update to get the latest formData
				setFormData((prevFormData) => {
					// Get current items from latest formData
					const currentItems = (() => {
						const parts = itemsPath.split(".");
						let val: InvoiceDataValue = prevFormData;
						for (const part of parts) {
							if (
								val &&
								typeof val === "object" &&
								!Array.isArray(val)
							) {
								val = val[part];
							} else {
								return [];
							}
						}
						return Array.isArray(val) ? val : [];
					})();

					const currentItemsArray = [...currentItems];
					const row = currentItemsArray[rowIndex] as
						| TableRow
						| undefined;

					if (!row) {
						tableConversionTimers.current.delete(timerKey);
						return prevFormData;
					}

					// Get current source value from the row
					// Handle empty string values - don't convert to 0
					const sourceValue = (() => {
						const rowValue = row[binding];
						if (
							typeof rowValue === "number" &&
							!isNaN(rowValue) &&
							isFinite(rowValue)
						) {
							return rowValue;
						}
						if (
							typeof currentValue === "number" &&
							!isNaN(currentValue) &&
							isFinite(currentValue)
						) {
							return currentValue;
						}
						return 0; // Fallback only if we have no valid number
					})();

					const linkedColumns = Array.from(
						tableLinks.entries()
					).filter(([targetBinding]) => targetBinding !== binding);

					// Process all linked columns
					const conversionPromises = linkedColumns
						.filter(
							([, linkInfo]) =>
								linkInfo.sourceColumnBinding === binding
						)
						.map(async ([targetBinding, linkInfo]) => {
							// Get source currency from the template element (not tableConfig)
							// Find the table element in the template
							const tableElement =
								selectedTemplate?.elements?.find(
									(e) =>
										e.type === "table" &&
										e.itemsBinding === itemsPath
								) as
									| Extract<
											TemplateElement,
											{ type: "table" }
									  >
									| undefined;

							// Find source and target columns in the table
							const sourceCol = tableElement?.columns?.find(
								(c) => c.binding === binding
							);
							const targetCol = tableElement?.columns?.find(
								(c) => c.binding === targetBinding
							);

							// Get currencies from the actual column definitions
							const sourceCurrencyStr =
								sourceCol &&
								sourceCol.type === "currency" &&
								sourceCol.currency
									? sourceCol.currency
									: defaultCurrency;
							const targetCurrencyStr =
								targetCol &&
								targetCol.type === "currency" &&
								targetCol.currency
									? targetCol.currency
									: defaultCurrency;

							// Compute linked value
							const linkedValue =
								await computeLinkedCurrencyValue(
									sourceValue,
									sourceCurrencyStr,
									linkInfo.link,
									targetCurrencyStr
								);

							return { targetBinding, linkedValue };
						});

					// Wait for all conversions and update
					Promise.all(conversionPromises).then((results) => {
						setFormData((latestFormData) => {
							const finalData = { ...latestFormData };
							const parts = itemsPath.split(".");
							let current: Record<string, InvoiceDataValue> =
								finalData;

							// Navigate to the items array
							for (let i = 0; i < parts.length - 1; i++) {
								const part = parts[i];
								const next = current[part];

								if (
									next &&
									typeof next === "object" &&
									!Array.isArray(next)
								) {
									current[part] = {
										...(next as Record<
											string,
											InvoiceDataValue
										>),
									};
								} else {
									current[part] = {};
								}

								current = current[part] as Record<
									string,
									InvoiceDataValue
								>;
							}

							// Get current items array
							const items = current[parts[parts.length - 1]];
							const itemsArray = Array.isArray(items)
								? [...items]
								: [];
							const updatedRow = {
								...((itemsArray[rowIndex] as TableRow) || {}),
							};

							// Apply all conversions
							for (const {
								targetBinding,
								linkedValue,
							} of results) {
								updatedRow[targetBinding] = linkedValue;
							}

							itemsArray[rowIndex] = updatedRow;
							current[parts[parts.length - 1]] = itemsArray;

							tableConversionTimers.current.delete(timerKey);
							return finalData;
						});
					});

					return prevFormData; // Return unchanged for now, async update will happen
				});
			}, 500); // 500ms debounce delay

			tableConversionTimers.current.set(timerKey, timer);
		}
	};

	// Show loading state while organization or templates are loading
	if (isOrgLoading || isTemplatesLoading) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
					<div className="space-y-4">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-96" />
					</div>
					<div className="grid gap-6 lg:grid-cols-3">
						<div className="lg:col-span-2">
							<Skeleton className="h-96" />
						</div>
						<div className="space-y-6">
							<Skeleton className="h-32" />
							<Skeleton className="h-64" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Show error state if no organization
	if (!currentOrganization) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-6 max-w-7xl">
					<Card>
						<CardContent className="p-12 text-center">
							<FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
							<h3 className="text-lg font-semibold mb-2">
								Organization Required
							</h3>
							<p className="text-muted-foreground mb-6">
								You need to be part of an organization to create
								invoices.
							</p>
							<Button onClick={() => navigate("/dashboard")}>
								Go to Dashboard
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Show error state if no templates
	if (!isTemplatesLoading && (!templates || templates.length === 0)) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-6 max-w-7xl">
					<div className="space-y-6">
						<div className="space-y-2">
							<h1 className="text-3xl font-bold tracking-tight">
								Create Invoice
							</h1>
							<p className="text-muted-foreground">
								Create a new invoice using your templates
							</p>
						</div>

						<Card>
							<CardContent className="p-12 text-center">
								<FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold mb-2">
									No Templates Available
								</h3>
								<p className="text-muted-foreground mb-6">
									You need to create a template before you can
									create invoices.
								</p>
								<div className="flex flex-col sm:flex-row gap-3 justify-center">
									<Button
										onClick={() => navigate("/designer")}
									>
										<Plus className="mr-2 h-4 w-4" />
										Create Template
									</Button>
									<Button
										variant="outline"
										onClick={() => navigate("/dashboard")}
									>
										Go to Dashboard
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
				{/* Header Section */}
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">
						Create Invoice
					</h1>
					<p className="text-muted-foreground">
						Select a template and fill in the details. Your invoice
						will be generated based on the template design.
					</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Live Preview */}
					<div className="lg:col-span-2">
						<InvoicePreview
							template={selectedTemplate}
							formData={formData}
							isSubscribed={isSubscribed}
						/>
					</div>

					{/* Form Sidebar */}
					<div className="space-y-6">
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Template Selection */}
							<InvoiceTemplateSelector
								templates={templates ?? []}
								selectedTemplateId={selectedTemplateId}
								onTemplateChange={setSelectedTemplateId}
								selectedTemplate={selectedTemplate}
							/>

							{/* Dynamic Fields */}
							{bindings.length > 0 && (
								<InvoiceFormFields
									bindings={bindings}
									formData={formData}
									getValue={getValue}
									setValue={setValue}
									complianceValidation={complianceValidation}
									currentOrganization={currentOrganization}
									onAutoFill={handleAutoFill}
									productLockedFields={new Set(
										Array.from(productLockedFields.values()).flatMap((set) =>
											Array.from(set)
										)
									)}
									allItems={allItems}
									calculatedTotals={calculatedTotals}
									defaultCurrency={defaultCurrency}
								/>
							)}

							{/* Dynamic Tables */}
							<div data-section="tables">
								{tableConfigs.map((tableConfig, tableIndex) => {
									const tableItems = getTableItems(tableConfig.itemsPath);
									const itemsPath = tableConfig.itemsPath;

									return (
										<InvoiceTable
											key={`table-${tableIndex}`}
											tableConfig={tableConfig}
											tableIndex={tableIndex}
											tableItems={tableItems}
											products={products ?? []}
											selectedProducts={selectedProducts}
											productLockedFields={productLockedFields}
											mappingProducts={mappingProducts}
											onAddRow={async () =>
												await addTableRow(itemsPath, tableConfig.columns)
											}
											onRemoveRow={async (rowIndex: number) =>
												await removeTableRow(itemsPath, rowIndex)
											}
											onProductSelect={(rowIndex: number, productId: string | undefined) =>
												handleProductSelectForRow(itemsPath, rowIndex, productId)
											}
											onProductClear={(rowIndex: number) =>
												handleClearProductForRow(itemsPath, rowIndex)
											}
											onCellChange={(rowIndex: number, binding: string, value: InvoiceDataValue) =>
												updateTableCell(itemsPath, rowIndex, binding, value)
											}
											onCellBlur={(rowIndex: number, binding: string, value: InvoiceDataValue) =>
												updateTableCell(itemsPath, rowIndex, binding, value)
											}
											selectedTemplate={selectedTemplate}
											tableColumnCurrencyLinks={tableColumnCurrencyLinks}
											defaultCurrency={defaultCurrency}
										/>
									);
								})}
							</div>

							{/* Currency Conversion Manager */}
							{allItems.length > 0 && (
								<CurrencyConversionManager
									baseCurrency={defaultCurrency}
									items={allItems}
									existingRates={conversionRates}
									onRatesChange={setConversionRates}
								/>
							)}

							{/* Submit */}
							<Card>
								<CardContent className="pt-6">
									<Button
										type="submit"
										className="w-full"
										disabled={
											createInvoice.isPending ||
											!selectedTemplate
										}
										size="lg"
									>
										{createInvoice.isPending ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Creating Invoice...
											</>
										) : (
											<>
												<FileText className="mr-2 h-4 w-4" />
												Create Invoice
											</>
										)}
									</Button>
								</CardContent>
							</Card>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
