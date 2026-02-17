import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { getFieldMetadata } from "@/utils/invoice-compliance";
import type { Template } from "@/core";
import {
	MissingRequiredFieldsPanel,
	type MissingRequiredField,
} from "./missing-required-fields-panel";

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
	const missingRequiredFields: MissingRequiredField[] =
		!complianceStatus.valid && complianceStatus.missingBindings.length > 0
			? complianceStatus.missingBindings.map((binding) => {
					const fieldMetadata = getFieldMetadata(
						complianceStatus.region as "US" | "EU" | "CA" | "AU" | "UK",
						binding,
					);
					const elementType = fieldMetadata
						? determineElementTypeForBinding(binding, fieldMetadata.format)
						: "text";
					return {
						binding,
						label: fieldMetadata?.label || binding,
						description: fieldMetadata?.description,
						elementType,
					};
				})
			: [];

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
						<MissingRequiredFieldsPanel
							fields={missingRequiredFields}
							onAddRequiredElement={onAddRequiredElement}
							title={t("designer.compliance.missingFieldsList")}
							showIcon={false}
							showToast={false}
							variant="embedded"
						/>
					</div>
				)}
			</AlertDescription>
		</Alert>
	);
}
