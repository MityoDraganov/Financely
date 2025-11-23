import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceComplianceAlert } from "./invoice-compliance-alert";
import { InvoiceFormField } from "./invoice-form-field";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Organization } from "@/core/entities/organization";

interface BindingField {
	path: string;
	label: string;
	type: "text" | "number" | "date";
	isLinkedCurrency?: boolean;
	hasFormula?: boolean;
	elementId?: string;
}

interface ComplianceValidation {
	valid: boolean;
	region: string;
	missingFields: Array<{
		binding: string;
		label: string;
		description?: string;
	}>;
	warnings?: string[];
	errors?: string[];
}

interface InvoiceFormFieldsProps {
	bindings: BindingField[];
	formData: Record<string, InvoiceDataValue>;
	getValue: (path: string) => InvoiceDataValue;
	setValue: (path: string, value: InvoiceDataValue) => void;
	complianceValidation: ComplianceValidation | null;
	currentOrganization: Organization | undefined;
	onAutoFill: (field: { binding: string; label: string }) => void;
	productLockedFields: Set<string>;
	allItems: Array<Record<string, unknown>>;
	calculatedTotals: { subtotal: number; total: number };
	defaultCurrency: string;
}

export function InvoiceFormFields({
	bindings,
	getValue,
	setValue,
	complianceValidation,
	currentOrganization,
	onAutoFill,
	productLockedFields,
	allItems,
	calculatedTotals,
	defaultCurrency,
}: InvoiceFormFieldsProps) {
	if (bindings.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Invoice Details</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<InvoiceComplianceAlert
					complianceValidation={complianceValidation}
					currentOrganization={currentOrganization}
					onAutoFill={onAutoFill}
				/>

				{bindings.map((field) => {
					const shouldAutoCalculate =
						((field.path === "total" ||
							field.path === "grossTotal") &&
							!getValue(field.path) &&
							allItems.length > 0) ||
						((field.path === "subtotal" ||
							field.path === "netAmount") &&
							!getValue(field.path) &&
							allItems.length > 0);

					const isProductLocked = productLockedFields.has(field.path);
					const isReadOnly =
						field.isLinkedCurrency ||
						field.hasFormula ||
						isProductLocked;

					const handleAutoCalculate = () => {
						if (field.path === "total" || field.path === "grossTotal") {
							setValue(field.path, calculatedTotals.total);
						} else if (
							field.path === "subtotal" ||
							field.path === "netAmount"
						) {
							setValue(field.path, calculatedTotals.subtotal);
						}
					};

					return (
						<InvoiceFormField
							key={field.path}
							field={field}
							value={getValue(field.path)}
							onChange={(value) => setValue(field.path, value)}
							isReadOnly={isReadOnly}
							isProductLocked={isProductLocked}
							shouldAutoCalculate={shouldAutoCalculate}
							onAutoCalculate={handleAutoCalculate}
							suggestedValue={
								shouldAutoCalculate
									? field.path === "total" ||
									  field.path === "grossTotal"
										? calculatedTotals.total
										: calculatedTotals.subtotal
									: undefined
							}
							defaultCurrency={defaultCurrency}
						/>
					);
				})}
			</CardContent>
		</Card>
	);
}

