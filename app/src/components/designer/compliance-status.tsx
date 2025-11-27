import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { getFieldMetadata } from "@/utils/invoice-compliance";
import type { Template } from "@/core";

type ComplianceStatusProps = {
	complianceStatus: {
		region: string;
		valid: boolean;
		missingBindings: string[];
	} | null;
	template: Template | undefined;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table" | "currency") => void;
	determineElementTypeForBinding: (binding: string, format?: "string" | "number" | "date" | "boolean" | "object" | "array") => "text" | "input" | "table" | "currency";
};

export function ComplianceStatus({
	complianceStatus,
	template,
	onAddRequiredElement,
	determineElementTypeForBinding,
}: ComplianceStatusProps) {
	const { t } = useTranslation();
	if (!complianceStatus || !template) return null;

	return (
		<Alert className={`transition-all duration-300 ${
			complianceStatus.valid
				? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 shadow-md"
				: "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-md"
		}`}>
			{complianceStatus.valid ? (
				<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 animate-pulse" />
			) : (
				<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
			)}
			<AlertDescription className="text-xs">
				<div className={`font-semibold mb-1.5 text-sm ${
					complianceStatus.valid ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
				}`}>
					{complianceStatus.valid ? (
						<span className="flex items-center gap-1.5">
							<span>✅</span>
							<span>{t('designer.compliance.fullyCompliant')}</span>
						</span>
					) : (
						<span className="flex items-center gap-1.5">
							<span>⚠️</span>
							<span>{t('designer.compliance.missingFields')}</span>
						</span>
					)}
				</div>
				<div className="text-muted-foreground text-xs mb-2">
					{t('designer.propertiesPanel.region')}: <span className="font-medium text-foreground">{complianceStatus.region}</span>
				</div>
				{!complianceStatus.valid && complianceStatus.missingBindings.length > 0 && (
					<div className="mt-2">
						<div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">{t('designer.compliance.missingFieldsList')}</div>
						<div className="space-y-1.5">
							{complianceStatus.missingBindings.map((binding) => {
								const fieldMetadata = getFieldMetadata(complianceStatus.region as "US" | "EU" | "CA" | "AU" | "UK", binding);
								const elementType = fieldMetadata
									? determineElementTypeForBinding(binding, fieldMetadata.format)
									: "text";
								return (
									<div key={binding} className="flex items-center justify-between gap-2 p-2.5 bg-background/80 dark:bg-background rounded-lg border border-amber-200/60 dark:border-amber-800/60 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
										<div className="flex-1 min-w-0">
											<div className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate">
												{fieldMetadata?.label || binding}
											</div>
											{fieldMetadata?.description && (
												<div className="text-xs text-amber-700/70 dark:text-amber-400/70 truncate mt-0.5">
													{fieldMetadata.description}
												</div>
											)}
										</div>
										<Button
											size="sm"
											variant="outline"
											className="h-7 px-3 text-xs border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
											onClick={() => {
												onAddRequiredElement(
													binding,
													fieldMetadata?.label || binding,
													elementType
												);
											}}
										>
											<Plus className="h-3.5 w-3.5 mr-1.5" />
											{t('designer.compliance.add')}
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

