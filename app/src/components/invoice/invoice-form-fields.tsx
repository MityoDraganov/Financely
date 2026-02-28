import { useMemo } from "react";
import { Building2, User, FileText, DollarSign, Hash } from "lucide-react";
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

interface FieldGroup {
	name: string;
	icon: React.ReactNode;
	fields: BindingField[];
}

function groupBindings(bindings: BindingField[]): FieldGroup[] {
	const sellerFields: BindingField[] = [];
	const buyerFields: BindingField[] = [];
	const detailFields: BindingField[] = [];
	const totalsFields: BindingField[] = [];
	const otherFields: BindingField[] = [];

	for (const b of bindings) {
		const p = b.path.toLowerCase();
		if (
			p.startsWith("seller.") ||
			p.startsWith("supplier.") ||
			p.startsWith("vendor.") ||
			p.startsWith("issuer.")
		) {
			sellerFields.push(b);
		} else if (
			p.startsWith("buyer.") ||
			p.startsWith("client.") ||
			p.startsWith("customer.") ||
			p.startsWith("recipient.") ||
			p.startsWith("biller.")
		) {
			buyerFields.push(b);
		} else if (
			p.includes("total") ||
			p.includes("subtotal") ||
			p.includes("tax") ||
			p.includes("discount") ||
			p.includes("amount") ||
			p.includes("vat")
		) {
			totalsFields.push(b);
		} else if (
			p.includes("invoice") ||
			p.includes("number") ||
			p.includes("date") ||
			p.includes("currency") ||
			p.includes("note") ||
			p.includes("payment") ||
			p.includes("due") ||
			p.includes("issue")
		) {
			detailFields.push(b);
		} else {
			otherFields.push(b);
		}
	}

	const groups: FieldGroup[] = [];

	if (detailFields.length > 0) {
		groups.push({
			name: "Invoice Details",
			icon: <FileText className="h-3.5 w-3.5" />,
			fields: detailFields,
		});
	}
	if (sellerFields.length > 0) {
		groups.push({
			name: "Seller / Supplier",
			icon: <Building2 className="h-3.5 w-3.5" />,
			fields: sellerFields,
		});
	}
	if (buyerFields.length > 0) {
		groups.push({
			name: "Buyer / Client",
			icon: <User className="h-3.5 w-3.5" />,
			fields: buyerFields,
		});
	}
	if (totalsFields.length > 0) {
		groups.push({
			name: "Totals",
			icon: <DollarSign className="h-3.5 w-3.5" />,
			fields: totalsFields,
		});
	}
	if (otherFields.length > 0) {
		groups.push({
			name: "Other",
			icon: <Hash className="h-3.5 w-3.5" />,
			fields: otherFields,
		});
	}

	// Fall back to flat list if all fields ended up in "other"
	if (
		groups.length === 1 &&
		groups[0].name === "Other" &&
		bindings.length > 0
	) {
		return [
			{
				name: "Invoice Details",
				icon: <FileText className="h-3.5 w-3.5" />,
				fields: bindings,
			},
		];
	}

	return groups;
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

	const groups = useMemo(() => groupBindings(bindings), [bindings]);

	let sectionIndex = 0;

	return (
		<div className="space-y-5">
			<InvoiceComplianceAlert
				complianceValidation={complianceValidation}
				currentOrganization={currentOrganization}
				onAutoFill={onAutoFill}
			/>

			{groups.map((group) => {
				const delay = sectionIndex * 40;
				sectionIndex++;

				return (
					<div
						key={group.name}
						className="space-y-3 inv-slide-up"
						style={{ animationDelay: `${delay}ms` }}
					>
						<div className="flex items-center gap-2.5">
							<span className="text-muted-foreground/60">{group.icon}</span>
							<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
								{group.name}
							</span>
							<div className="flex-1 h-px bg-border" />
						</div>

						<div className="space-y-3">
							{group.fields.map((field) => {
								const shouldAutoCalculate =
									((field.path === "total" ||
										field.path === "grossTotal") &&
										!getValue(field.path) &&
										allItems.length > 0) ||
									((field.path === "subtotal" ||
										field.path === "netAmount") &&
										!getValue(field.path) &&
										allItems.length > 0);

								const isProductLocked = productLockedFields.has(
									field.path
								);
								const isReadOnly =
									field.isLinkedCurrency ||
									field.hasFormula ||
									isProductLocked;

								const handleAutoCalculate = () => {
									if (
										field.path === "total" ||
										field.path === "grossTotal"
									) {
										setValue(
											field.path,
											calculatedTotals.total
										);
									} else if (
										field.path === "subtotal" ||
										field.path === "netAmount"
									) {
										setValue(
											field.path,
											calculatedTotals.subtotal
										);
									}
								};

								return (
									<InvoiceFormField
										key={field.path}
										field={field}
										value={getValue(field.path)}
										onChange={(value) =>
											setValue(field.path, value)
										}
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
						</div>
					</div>
				);
			})}
		</div>
	);
}
