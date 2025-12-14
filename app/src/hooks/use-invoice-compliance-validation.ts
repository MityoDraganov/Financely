/**
 * Custom hook for real-time compliance validation
 */

import { useEffect, useState } from "react";
import type { Template } from "@/core/entities/template";
import type { Organization } from "@/core/entities/organization";
import type { InvoiceDataValue } from "@/core/entities/invoice";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";

interface UseInvoiceComplianceValidationProps {
	selectedTemplate: Template | undefined;
	currentOrganization: Organization | null | undefined;
	formData: Record<string, InvoiceDataValue>;
}

export function useInvoiceComplianceValidation({
	selectedTemplate,
	currentOrganization,
	formData,
}: UseInvoiceComplianceValidationProps) {
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

	useEffect(() => {
		if (
			!selectedTemplate ||
			!currentOrganization ||
			Object.keys(formData).length === 0
		) {
			setComplianceValidation(null);
			return;
		}

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
		setComplianceValidation({
			valid: validation.valid,
			region: validation.region,
			missingFields: validation.missingFields,
			warnings: validation.warnings,
			errors: validation.errors,
		});
	}, [formData, selectedTemplate, currentOrganization]);

	return { complianceValidation };
}

