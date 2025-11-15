import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import type { Organization } from "@/core/entities/organization";

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

interface InvoiceComplianceAlertProps {
	complianceValidation: ComplianceValidation | null;
	currentOrganization: Organization | undefined;
	onAutoFill: (field: { binding: string; label: string }) => void;
}

export function InvoiceComplianceAlert({
	complianceValidation,
	currentOrganization,
	onAutoFill,
}: InvoiceComplianceAlertProps) {
	if (!complianceValidation) return null;

	return (
		<Alert
			className={
				complianceValidation.valid
					? "bg-green-50 border-green-200"
					: "bg-amber-50 border-amber-200"
			}
		>
			{complianceValidation.valid ? (
				<CheckCircle2 className="h-4 w-4 text-green-600" />
			) : (
				<AlertCircle className="h-4 w-4 text-amber-600" />
			)}
			<AlertDescription className="text-xs">
				<div className="font-medium mb-1">
					{complianceValidation.valid
						? "✅ Compliant"
						: "⚠️ Missing Required Fields"}
				</div>
				<div className="text-neutral-600 mb-1">
					Region: {complianceValidation.region}
				</div>
				{!complianceValidation.valid &&
					complianceValidation.missingFields.length > 0 && (
						<div className="mt-2">
							<div className="text-xs font-medium text-amber-700 mb-1">
								Missing fields:
							</div>
							<div className="space-y-1.5">
								{complianceValidation.missingFields.map((field) => (
									<div
										key={field.binding}
										className="flex items-center justify-between gap-2 p-1.5 bg-amber-50 rounded border border-amber-200"
									>
										<div className="flex-1 min-w-0">
											<div className="text-xs font-medium text-amber-800 truncate">
												{field.label}
											</div>
											{field.description && (
												<div className="text-xs text-amber-600 truncate">
													{field.description}
												</div>
											)}
										</div>
										<Button
											size="sm"
											variant="outline"
											className="h-6 px-2 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
											onClick={() => onAutoFill(field)}
										>
											<Plus className="h-3 w-3 mr-1" />
											Fill
										</Button>
									</div>
								))}
							</div>
						</div>
					)}
				{complianceValidation.warnings &&
					complianceValidation.warnings.length > 0 && (
						<div className="mt-2">
							<div className="text-xs font-medium text-amber-700 mb-1">
								Warnings:
							</div>
							<ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
								{complianceValidation.warnings.map((warning, idx) => (
									<li key={idx}>{warning}</li>
								))}
							</ul>
						</div>
					)}
			</AlertDescription>
		</Alert>
	);
}

