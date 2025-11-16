import { useCallback } from "react";
import { toast } from "sonner";
import { setBindingValue } from "@/core/entities/invoice";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Organization } from "@/core/entities/organization";

interface AutoFillField {
	binding: string;
	label: string;
}

interface UseInvoiceAutoFillProps {
	formData: Record<string, InvoiceDataValue>;
	setFormData: (data: Record<string, InvoiceDataValue>) => void;
	currentOrganization: Organization | undefined;
	getValue: (path: string) => InvoiceDataValue;
	bindings: Array<{ path: string; label: string }>;
	tableConfigs: Array<{ itemsPath: string }>;
	getTableItems: (itemsPath: string) => Array<Record<string, InvoiceDataValue>>;
}

export function useInvoiceAutoFill({
	formData,
	setFormData,
	currentOrganization,
	getValue,
	bindings,
	tableConfigs,
	getTableItems,
}: UseInvoiceAutoFillProps) {
	const handleAutoFill = useCallback(
		(field: AutoFillField) => {
			const newData = { ...formData };
			let value: InvoiceDataValue | undefined;

			// Auto-fill logic based on binding
			if (
				field.binding === "seller.name" ||
				field.binding === "supplier.name"
			) {
				value = currentOrganization?.name;
			} else if (
				field.binding === "seller.address" ||
				field.binding === "supplier.address"
			) {
				const orgAddress = currentOrganization?.settings?.address;
				if (orgAddress) {
					value = {
						street: orgAddress.street || "",
						city: orgAddress.city || "",
						state: orgAddress.state || "",
						zipCode: orgAddress.zipCode || "",
						country: orgAddress.country || "",
					};
				}
			} else if (
				field.binding === "seller.vatId" ||
				field.binding === "supplier.vatId"
			) {
				// VAT ID would need to be added to organization settings in the future
				value = undefined;
			} else if (
				field.binding === "invoiceDate" ||
				field.binding === "issueDate"
			) {
				value = new Date().toISOString().split("T")[0];
			} else if (field.binding === "currency") {
				value =
					currentOrganization?.settings?.defaultCurrency || "USD";
			} else if (field.binding === "invoiceNumber") {
				value = `INV-${Date.now()}`;
			}

			if (value !== undefined) {
				setBindingValue(newData, field.binding, value);
				setFormData(newData);
				toast.success(`Auto-filled ${field.label}`);
				return;
			}

			// Handle table/items fields
			if (
				field.binding === "items" ||
				field.binding.endsWith(".items") ||
				field.binding.includes("items")
			) {
				const itemsTableConfig = tableConfigs.find(
					(tc) =>
						tc.itemsPath === field.binding ||
						tc.itemsPath.endsWith(field.binding) ||
						tc.itemsPath.includes(field.binding) ||
						field.binding.includes(tc.itemsPath) ||
						tc.itemsPath.includes(
							field.binding.split(".").pop() || ""
						)
				);

				if (itemsTableConfig) {
					const currentTableItems = getTableItems(
						itemsTableConfig.itemsPath
					);
					setTimeout(() => {
						const tableCard = document.querySelector(
							`[data-table-path="${itemsTableConfig.itemsPath}"]`
						);
						if (tableCard) {
							tableCard.scrollIntoView({
								behavior: "smooth",
								block: "center",
							});
							setTimeout(() => {
								const addButton = tableCard.querySelector(
									'button[type="button"]'
								);
								const firstInput =
									tableCard.querySelector("input");
								if (
									addButton &&
									currentTableItems.length === 0
								) {
									(addButton as HTMLElement).focus();
									toast.info(
										`Please click "Add Row" to add items to ${field.label}`
									);
								} else if (firstInput) {
									firstInput.focus();
									toast.info(`Please fill in ${field.label}`);
								} else if (addButton) {
									(addButton as HTMLElement).focus();
									toast.info(
										`Please add items to ${field.label}`
									);
								}
							}, 200);
							return;
						}
					}, 100);

					const tablesSection = document.querySelector(
						'[data-section="tables"]'
					);
					if (tablesSection) {
						tablesSection.scrollIntoView({
							behavior: "smooth",
							block: "center",
						});
						toast.info(`Please add items to ${field.label}`);
						return;
					}
				} else {
					setTimeout(() => {
						const tablesSection = document.querySelector(
							'[data-section="tables"]'
						);
						if (tablesSection) {
							tablesSection.scrollIntoView({
								behavior: "smooth",
								block: "center",
							});
							toast.info(`Please add items to ${field.label}`);
						}
					}, 100);
					return;
				}
			}

			// Handle calculated fields
			const calculatedFields = [
				"total",
				"grossTotal",
				"netAmount",
				"subtotal",
				"vatTotal",
				"taxTotal",
			];
			const isCalculatedField = calculatedFields.includes(
				field.binding
			);

			if (isCalculatedField) {
				const items = getValue("items");
				if (Array.isArray(items) && items.length > 0) {
					let calculatedValue = 0;

					if (
						field.binding === "total" ||
						field.binding === "grossTotal"
					) {
						for (const item of items) {
							if (
								typeof item === "object" &&
								item !== null
							) {
								const itemTotal =
									(item as Record<string, InvoiceDataValue>)
										.total ||
									(item as Record<string, InvoiceDataValue>)
										.amount ||
									0;
								calculatedValue +=
									typeof itemTotal === "number"
										? itemTotal
										: 0;
							}
						}
						const vatTotal = getValue("vatTotal");
						if (typeof vatTotal === "number") {
							calculatedValue += vatTotal;
						}
					} else if (
						field.binding === "netAmount" ||
						field.binding === "subtotal"
					) {
						for (const item of items) {
							if (
								typeof item === "object" &&
								item !== null
							) {
								const itemTotal =
									(item as Record<string, InvoiceDataValue>)
										.total ||
									(item as Record<string, InvoiceDataValue>)
										.amount ||
									0;
								calculatedValue +=
									typeof itemTotal === "number"
										? itemTotal
										: 0;
							}
						}
					} else if (
						field.binding === "vatTotal" ||
						field.binding === "taxTotal"
					) {
						calculatedValue = 0;
					}

					setBindingValue(newData, field.binding, calculatedValue);
					setFormData(newData);
					toast.success(
						`Calculated ${field.label}: ${calculatedValue.toFixed(2)}`
					);
					return;
				} else {
					toast.info(
						`Please add items first, then ${field.label} will be calculated automatically`
					);
					setTimeout(() => {
						const tablesSection = document.querySelector(
							'[data-section="tables"]'
						);
						if (tablesSection) {
							tablesSection.scrollIntoView({
								behavior: "smooth",
								block: "center",
							});
						}
					}, 100);
					return;
				}
			}

			// Handle regular input fields
			const bindingField = bindings.find(
				(b) => b.path === field.binding
			);
			if (bindingField) {
				const inputId = `binding-${field.binding}`;
				setTimeout(() => {
					const input = document.getElementById(inputId);
					if (input) {
						input.focus();
						input.scrollIntoView({
							behavior: "smooth",
							block: "center",
						});
						if (
							input instanceof HTMLInputElement &&
							input.type === "number" &&
							(input.value === "" || input.value === "0")
						) {
							input.select();
						}
					} else {
						toast.info(`Please fill in ${field.label} manually`);
					}
				}, 100);
			} else {
				const similarField = bindings.find(
					(b) =>
						b.path.toLowerCase().includes(field.binding.toLowerCase()) ||
						field.binding.toLowerCase().includes(b.path.toLowerCase())
				);

				if (similarField) {
					const inputId = `binding-${similarField.path}`;
					setTimeout(() => {
						const input = document.getElementById(inputId);
						if (input) {
							input.focus();
							input.scrollIntoView({
								behavior: "smooth",
								block: "center",
							});
							toast.info(
								`Focused similar field: ${similarField.label}`
							);
						} else {
							toast.info(
								`Field "${field.label}" not found in template. Please add it in the template designer.`
							);
						}
					}, 100);
				} else {
					toast.warning(
						`Field "${field.label}" (${field.binding}) is not in the template. Please add it in the template designer.`
					);
				}
			}
		},
		[
			formData,
			setFormData,
			currentOrganization,
			getValue,
			bindings,
			tableConfigs,
			getTableItems,
		]
	);

	return { handleAutoFill };
}

