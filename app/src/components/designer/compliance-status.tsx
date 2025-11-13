import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Plus, Lock } from "lucide-react";
import { getFieldMetadata } from "@/utils/invoice-compliance";
import type { Template } from "@/core";

type ComplianceStatusProps = {
	complianceStatus: {
		region: string;
		valid: boolean;
		missingBindings: string[];
	} | null;
	template: Template | undefined;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table") => void;
	determineElementTypeForBinding: (binding: string, format?: "string" | "number" | "date" | "boolean" | "object" | "array") => "text" | "input" | "table";
};

export function ComplianceStatus({
	complianceStatus,
	template,
	onAddRequiredElement,
	determineElementTypeForBinding,
}: ComplianceStatusProps) {
	if (!complianceStatus || !template) return null;

	return (
		<Alert className={`transition-all duration-300 ${
			complianceStatus.valid
				? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-md"
				: "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-md"
		}`}>
			{complianceStatus.valid ? (
				<CheckCircle2 className="h-5 w-5 text-green-600 animate-pulse" />
			) : (
				<AlertCircle className="h-5 w-5 text-amber-600" />
			)}
			<AlertDescription className="text-xs">
				<div className={`font-semibold mb-1.5 text-sm ${
					complianceStatus.valid ? "text-green-700" : "text-amber-700"
				}`}>
					{complianceStatus.valid ? (
						<span className="flex items-center gap-1.5">
							<span>✅</span>
							<span>Fully Compliant</span>
						</span>
					) : (
						<span className="flex items-center gap-1.5">
							<span>⚠️</span>
							<span>Missing Required Fields</span>
						</span>
					)}
				</div>
				<div className="text-neutral-600 text-xs mb-2">
					Region: <span className="font-medium">{complianceStatus.region}</span>
				</div>
				{!complianceStatus.valid && complianceStatus.missingBindings.length > 0 && (
					<div className="mt-2">
						<div className="text-xs font-medium text-amber-700 mb-1">Missing fields:</div>
						<div className="space-y-1.5">
							{complianceStatus.missingBindings.map((binding) => {
								const fieldMetadata = getFieldMetadata(complianceStatus.region, binding);
								const elementType = fieldMetadata
									? determineElementTypeForBinding(binding, fieldMetadata.format)
									: "text";
								return (
									<div key={binding} className="flex items-center justify-between gap-2 p-2.5 bg-white/80 rounded-lg border border-amber-200/60 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
										<div className="flex-1 min-w-0">
											<div className="text-xs font-semibold text-amber-900 truncate">
												{fieldMetadata?.label || binding}
											</div>
											{fieldMetadata?.description && (
												<div className="text-xs text-amber-700/70 truncate mt-0.5">
													{fieldMetadata.description}
												</div>
											)}
										</div>
										<Button
											size="sm"
											variant="outline"
											className="h-7 px-3 text-xs border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 shrink-0 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
											onClick={() => {
												onAddRequiredElement(
													binding,
													fieldMetadata?.label || binding,
													elementType
												);
											}}
										>
											<Plus className="h-3.5 w-3.5 mr-1.5" />
											Add
										</Button>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</AlertDescription>
		</Alert>
	);
}

