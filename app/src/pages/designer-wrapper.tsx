import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useCreateTemplate } from "@/hooks/repository-hooks/use-create-template";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { generateUniqueTemplateName } from "@/utils/template-naming";
import { DesignerTemplateProvider } from "@/contexts/designer-template-context";
import TemplateDesignerPage from "./designer";
import AppLayout from "@/components/layout";
import type { TemplateData } from "@/core";
import { DEFAULT_MARGIN_UNIT, getDefaultPrintMarginsPx } from "@/utils/print-margins";

export default function DesignerWrapper() {
	const navigate = useNavigate();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const { data: templates = [], isSubscribed: isTemplatesSubscribed } = useTemplates(orgId);
	const createTemplate = useCreateTemplate();
	const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(templateIdFromUrl);
	
	// Sync with URL param
	useEffect(() => {
		if (templateIdFromUrl && templateIdFromUrl !== currentTemplateId) {
			setCurrentTemplateId(templateIdFromUrl);
		}
	}, [templateIdFromUrl, currentTemplateId]);

	const currentTemplate = useMemo(() => {
		if (!currentTemplateId) return undefined;
		return templates.find((t) => t.id === currentTemplateId);
	}, [templates, currentTemplateId]);

	const handleCreateNewTemplate = useCallback(async () => {
		const region = currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US";
		const uniqueName = generateUniqueTemplateName("New Template", templates);
		
		const templateData: TemplateData = {
			orgId,
			name: uniqueName,
			description: "A new template",
			pageSize: "A4",
				brand: {
					colors: {
						primary: "#000000",
						secondary: "#666666",
						accent: "#2563eb",
					},
					backgroundImage: "",
					margins: getDefaultPrintMarginsPx(),
					fonts: ["Inter"],
				},
				pageSettings: {
					size: "A4",
					orientation: "portrait",
					margins: getDefaultPrintMarginsPx(),
					marginUnit: DEFAULT_MARGIN_UNIT,
					padding: { top: 0, right: 0, bottom: 0, left: 0 },
				},
				elements: [],
			status: "draft",
			compliance: {
				region,
				mode: "region",
				additionalRequired: [],
				waived: [],
				autoFooter: true,
				complianceValidated: false,
			},
		};
		
		try {
			const newTemplateId = await createTemplate.mutateAsync(templateData);
			setCurrentTemplateId(newTemplateId);
			navigate(`/designer/${newTemplateId}`, { replace: true });
		} catch (error) {
			console.error("Failed to create template:", error);
		}
	}, [orgId, templates, currentOrg, createTemplate, navigate]);

	const onTemplateChange = useCallback(async (id: string) => {
		if (id === "new") {
			await handleCreateNewTemplate();
		} else {
			setCurrentTemplateId(id);
			navigate(`/designer/${id}`, { replace: true });
		}
	}, [handleCreateNewTemplate, navigate]);

	return (
		<DesignerTemplateProvider
			templates={templates}
			isTemplatesSubscribed={isTemplatesSubscribed}
			currentTemplateId={currentTemplateId}
			setCurrentTemplateId={setCurrentTemplateId}
			currentTemplate={currentTemplate}
			onTemplateChange={onTemplateChange}
			onCreateNewTemplate={handleCreateNewTemplate}
		>
			<AppLayout>
				<TemplateDesignerPage />
			</AppLayout>
		</DesignerTemplateProvider>
	);
}
