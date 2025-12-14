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
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useProductsByOrg } from "@/hooks/repository-hooks/use-products";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Plus } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { setBindingValue, getBindingValue } from "@/core/entities/invoice";
import type { TemplateElement } from "@/core/entities/template";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { InvoicePreview } from "@/components/invoice/invoice-preview";
import { InvoiceTemplateSelector } from "@/components/invoice/invoice-template-selector";
import { InvoiceFormFields } from "@/components/invoice/invoice-form-fields";
import { InvoiceTable } from "@/components/invoice/invoice-table";
import { useInvoiceAutoFill } from "@/hooks/use-invoice-auto-fill";
import { useInvoiceTemplate } from "@/contexts/invoice-template-context";
import {
	mapProductToTableRow,
	getDefaultProductTableConfig,
} from "@/utils/product-table-mapping";
import { useInvoiceTemplateConfig } from "@/hooks/use-invoice-template-config";
import { useInvoiceFormulaEvaluation } from "@/hooks/use-invoice-formula-evaluation";
import { useInvoiceCurrencyConversion } from "@/hooks/use-invoice-currency-conversion";
import { useInvoiceComplianceValidation } from "@/hooks/use-invoice-compliance-validation";

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

/**
 * Round currency values to 2 decimal places
 */
function roundCurrency(value: InvoiceDataValue): InvoiceDataValue {
	if (typeof value === "number") {
		return Math.round(value * 100) / 100;
	}
	return value;
}

export default function CreateInvoicePage() {
	const navigate = useNavigate();
	const createInvoice = useCreateInvoice();
	const { data: currentOrganization, isLoading: isOrgLoading } =
		useCurrentOrganization();
	const invoiceTemplateContext = useInvoiceTemplate();
	const templates = invoiceTemplateContext?.templates ?? [];
	const selectedTemplateId = invoiceTemplateContext?.selectedTemplateId ?? "";
	const setSelectedTemplateId = invoiceTemplateContext?.setSelectedTemplateId ?? (() => {});
	const selectedTemplate = invoiceTemplateContext?.selectedTemplate;
	const previewDialogOpen = invoiceTemplateContext?.previewDialogOpen ?? false;
	const setPreviewDialogOpen = invoiceTemplateContext?.setPreviewDialogOpen ?? (() => {});
	const { data: products = [] } = useProductsByOrg(currentOrganization?.id);
	const { data: existingInvoices = [] } = useInvoices(currentOrganization?.id);
	const isMobile = useMediaQuery("(max-width: 768px)");
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
	const [hasAutoFilled, setHasAutoFilled] = useState(false);

	// Get default currency from organization settings
	const defaultCurrency = useMemo(() => {
		return currentOrganization?.settings?.defaultCurrency || "USD";
	}, [currentOrganization?.settings?.defaultCurrency]);

	// Extract template configuration using custom hook
	const {
		tableConfigs,
		currencyFieldLinks,
		tableColumnCurrencyLinks,
		bindings,
	} = useInvoiceTemplateConfig({ selectedTemplate });

	// Currency conversion hook
	const {
		computeLinkedCurrencyValue,
		updateLinkedCurrencyFields,
		currencyConversionTimer,
		tableConversionTimers,
	} = useInvoiceCurrencyConversion({
		selectedTemplate,
		currencyFieldLinks,
		tableColumnCurrencyLinks,
		defaultCurrency,
	});

	// Formula evaluation hook
	const { evaluateFormulas } = useInvoiceFormulaEvaluation({
		selectedTemplate,
		tableConfigs,
	});

	// Compliance validation hook
	const { complianceValidation } = useInvoiceComplianceValidation({
		selectedTemplate,
		currentOrganization,
		formData,
	});

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

	// Helper to check if a field is a currency field
	const isCurrencyField = useCallback((
		binding: string,
		template: { elements?: Array<{ type: string; binding?: string }> } | undefined,
		configs: TableConfig[]
	): boolean => {
		if (!template) return false;

		const currencyElement = template.elements?.find(
			(e) => e.type === "currency" && e.binding === binding
		);
		if (currencyElement) return true;

		for (const tableConfig of configs) {
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
	}, []);


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
					// Round currency values to 2 decimal places
					const roundedValue = isCurrencyField(
						`${arrayPath}[${index}].${fieldName}`,
						selectedTemplate,
						tableConfigs
					)
						? roundCurrency(value)
						: value;

					if (
						arrayCopy[index] &&
						typeof arrayCopy[index] === "object" &&
						!Array.isArray(arrayCopy[index])
					) {
						arrayCopy[index] = {
							...(arrayCopy[index] as Record<string, InvoiceDataValue>),
							[fieldName]: roundedValue,
						};
					} else {
						arrayCopy[index] = { [fieldName]: roundedValue };
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
										] = roundCurrency(linkedValue);
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
	}, [formData, selectedTemplate, tableConfigs, currencyFieldLinks, defaultCurrency, computeLinkedCurrencyValue]);

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
				const product = products.find((p) => p.id === productId);
				if (!product) {
					throw new Error("Product not found");
				}

				// Get product table config from template, or use default
				let config = selectedTemplate.productTableConfig;
				
				// If config doesn't exist or doesn't match this table, try to get default
				if (!config || config.itemsBinding !== itemsPath) {
					const defaultConfig = getDefaultProductTableConfig(selectedTemplate);
					if (defaultConfig && defaultConfig.itemsBinding === itemsPath) {
						config = defaultConfig;
					} else {
						// No config available - show warning and skip mapping
						toast.warning(
							"Product table configuration not found. Please configure product mapping in the template designer."
						);
						setMappingProducts((prev) => {
							const next = new Set(prev);
							next.delete(rowKey);
							return next;
						});
						return;
					}
				}

				// Map product to table row using the config
				const { rowData, lockedFields: configLockedFields } = await mapProductToTableRow(
					product,
					config,
					rowIndex
				);

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
						const newArray: Array<Record<string, InvoiceDataValue>> = [];
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
							...(arrayCopy[index] as Record<string, InvoiceDataValue>),
							[fieldName]: value,
						};
					} else {
						arrayCopy[index] = { [fieldName]: value };
					}

					// Update the data with the modified array
					setBindingValue(data, arrayPath, arrayCopy);
				};

				// Update form data with mapped values
				const newData = { ...formData };
				const lockedFields = new Set<string>();

				// Apply row data from template mapping
				for (const [fieldName, value] of Object.entries(rowData)) {
					setArrayItemValue(newData, itemsPath, rowIndex, fieldName, value);
				}

				// Add locked fields from config
				configLockedFields.forEach((field) => lockedFields.add(field));

				// Evaluate formulas after updating form data with product mapping
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
				const message = error instanceof Error ? error.message : "Unknown error";
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
		[
			selectedTemplate,
			currentOrganization,
			products,
			formData,
			evaluateFormulas,
			updateLinkedCurrencyFields,
		]
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
		// Use template's stored region if available, otherwise detect from organization
		const region = selectedTemplate.compliance?.region || 
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
			// Store default currency in invoice data
			const invoiceDataWithRates = {
			...formData,
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
		existingInvoices,
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

		// Find the total column binding for each table
		// Look for columns that are likely to be totals (currency/number with showTotal, or binding names like "total", "amount", "lineTotal")
		const totalColumnBindings = new Map<string, string>(); // itemsPath -> totalColumnBinding
		
		for (const tableConfig of tableConfigs) {
			// Find the table element to check for showTotal flag
			const tableEl = selectedTemplate?.elements?.find(
				(el) => el.type === "table" && 
				(el as Extract<TemplateElement, { type: "table" }>).itemsBinding === tableConfig.itemsPath
			) as Extract<TemplateElement, { type: "table" }> | undefined;
			
			// First, try to find a column with showTotal flag
			let totalCol = tableConfig.columns.find(
				(col) => {
					if (col.type !== "currency" && col.type !== "number") return false;
					const templateCol = tableEl?.columns?.find((c) => c.id === col.id);
					return templateCol?.showTotal === true;
				}
			);
			
			// If not found, look for common total binding names
			if (!totalCol) {
				totalCol = tableConfig.columns.find(
					(col) => 
						(col.type === "currency" || col.type === "number") &&
						(col.binding?.toLowerCase().includes("total") ||
						 col.binding?.toLowerCase().includes("amount") ||
						 col.binding === "total" ||
						 col.binding === "amount" ||
						 col.binding === "lineTotal" ||
						 col.binding === "itemTotal")
				);
			}
			
			// Fallback to any currency/number column as last resort
			if (!totalCol) {
				totalCol = tableConfig.columns.find(
					(col) => col.type === "currency" || col.type === "number"
				);
			}
			
			if (totalCol?.binding) {
				totalColumnBindings.set(tableConfig.itemsPath, totalCol.binding);
			}
		}

		// Calculate totals - currency is handled per-field, so we just sum all totals
		for (const tableConfig of tableConfigs) {
			const tableItems = getTableItems(tableConfig.itemsPath);
			const totalBinding = totalColumnBindings.get(tableConfig.itemsPath) || "total";
			
			for (const item of tableItems) {
				// Try the identified total binding first
				let itemTotal: number = 0;
				
				if (totalBinding && typeof item[totalBinding] === "number") {
					itemTotal = item[totalBinding] as number;
				} else {
					// Fallback to common field names
					itemTotal =
						typeof item.total === "number"
							? item.total
							: typeof item.amount === "number"
								? item.amount
								: typeof item.lineTotal === "number"
									? item.lineTotal
									: typeof item.itemTotal === "number"
										? item.itemTotal
										: 0;
				}

				subtotal += itemTotal;
				total += itemTotal;
			}
		}

		return { subtotal, total };
	}, [tableConfigs, selectedTemplate, getTableItems]);

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
	if (isOrgLoading || !invoiceTemplateContext) {
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
	if (invoiceTemplateContext && (!templates || templates.length === 0)) {
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

	const formContent = (
		<form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
			{/* Template Selection - Hidden on mobile (shown in layout header) */}
			<div className={isMobile ? "hidden" : ""}>
				<InvoiceTemplateSelector
					templates={templates ?? []}
					selectedTemplateId={selectedTemplateId}
					onTemplateChange={setSelectedTemplateId}
					selectedTemplate={selectedTemplate}
				/>
			</div>

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

			{/* Submit - Hidden on mobile (shown in sticky footer) */}
			<Card className={isMobile ? "hidden" : ""}>
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
	);

	const previewContent = (
		<InvoicePreview
			template={selectedTemplate}
			formData={formData}
			fullWidth={isMobile && previewDialogOpen}
		/>
	);

	return (
		<div className="min-h-screen bg-background">
				{isMobile ? (
				<>
					{/* Mobile Form Content */}
					<div className="container mx-auto px-4 py-4 max-w-7xl">
						<div className="space-y-6 pb-24">
							{formContent}
						</div>
					</div>

					{/* Mobile Sticky Submit Button */}
					<div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-4 md:hidden">
						<Button
							type="submit"
							form="invoice-form"
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
					</div>

					{/* Mobile Preview Dialog */}
					<Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
						<DialogContent className="inset-0 max-w-none max-h-screen w-full h-full m-0 p-0 rounded-none flex flex-col translate-x-0 translate-y-0 md:inset-auto md:max-w-[90vw] md:max-h-[90vh] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:top-[50%] md:left-[50%]">
							<DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b">
								<DialogTitle>Invoice Preview</DialogTitle>
							</DialogHeader>
							<div className="flex-1 overflow-y-auto min-h-0 w-full p-0">
								<div className="w-full h-full">
									{previewContent}
								</div>
							</div>
						</DialogContent>
					</Dialog>
				</>
			) : (
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
							{previewContent}
						</div>

						{/* Form Sidebar */}
						<div className="space-y-6">
							{formContent}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
