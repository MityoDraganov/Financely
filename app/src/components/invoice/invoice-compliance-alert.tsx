import { useState } from "react";
import { Plus, ChevronDown, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Organization } from "@/core/entities/organization";

interface ComplianceValidation {
	valid: boolean;
	region: string;
	missingFields: Array<{
		fieldId: string;
		binding?: string;
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
	onAutoFill,
}: InvoiceComplianceAlertProps) {
	const [expanded, setExpanded] = useState(false);

	if (!complianceValidation) return null;

	const { valid, region, missingFields, warnings } = complianceValidation;
	const hasMissing = !valid && missingFields.length > 0;
	const hasWarnings = warnings && warnings.length > 0;

	if (valid && !hasWarnings) {
		return (
			<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 inv-slide-up">
				<ShieldCheck className="h-3.5 w-3.5 shrink-0" />
				<span className="text-xs font-medium">Compliant · {region}</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-lg border overflow-hidden inv-slide-up",
				hasMissing
					? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
					: "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30"
			)}
		>
			<button
				type="button"
				onClick={() => setExpanded((e) => !e)}
				className="w-full flex items-center justify-between px-3 py-2 text-left"
			>
				<div className="flex items-center gap-2">
					{hasMissing ? (
						<ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
					) : (
						<AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
					)}
					<span
						className={cn(
							"text-xs font-medium",
							hasMissing
								? "text-amber-700 dark:text-amber-300"
								: "text-yellow-700 dark:text-yellow-300"
						)}
					>
						{hasMissing
							? `${missingFields.length} required field${missingFields.length > 1 ? "s" : ""} missing`
							: `${warnings!.length} warning${warnings!.length > 1 ? "s" : ""}`}
						{" · "}
						<span className="font-normal opacity-70">{region}</span>
					</span>
				</div>
				<ChevronDown
					className={cn(
						"h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
						expanded && "rotate-180"
					)}
				/>
			</button>

			{expanded && (
				<div className="px-3 pb-3 space-y-2 border-t border-inherit/50">
					{hasMissing && (
						<div className="pt-2 space-y-1.5">
							{missingFields.map((field) => (
								<div
									key={field.fieldId}
									className="flex items-start gap-2"
								>
									<div className="flex-1 min-w-0 pt-0.5">
										<p className="text-xs font-medium text-amber-800 dark:text-amber-200">
											{field.label}
										</p>
										{field.description && (
											<p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
												{field.description}
											</p>
										)}
									</div>
									<Button
										size="sm"
										variant="outline"
										className="h-6 px-2 text-xs shrink-0 border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900"
										onClick={() =>
											onAutoFill({
												binding: field.binding ?? field.fieldId,
												label: field.label,
											})
										}
									>
										<Plus className="h-3 w-3 mr-1" />
										Fill
									</Button>
								</div>
							))}
						</div>
					)}

					{hasWarnings && (
						<div className="pt-2 space-y-1">
							{warnings!.map((warning, idx) => (
								<p key={idx} className="text-xs text-yellow-700 dark:text-yellow-400">
									· {warning}
								</p>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
