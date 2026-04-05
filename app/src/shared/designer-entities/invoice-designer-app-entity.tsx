import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Template, TemplateData } from "../../core";
import { DesignerTemplateProvider } from "../../contexts/designer-template-context";
import { useCurrentOrganization } from "../../hooks/use-current-organization";
import { useCreateTemplate } from "../../hooks/repository-hooks/use-create-template";
import { useTemplates } from "../../hooks/repository-hooks/use-templates";
import TemplateDesignerPage from "../../pages/designer";
import { invoiceComplianceService } from "../../services/invoice-compliance-service";
import { generateUniqueTemplateName } from "../../utils/template-naming";
import {
	DEFAULT_MARGIN_UNIT,
	getDefaultPrintMarginsPx,
} from "../../utils/print-margins";
import { InvoiceDesignerEntity } from "./invoice-designer-entity";
import type {
	LayoutWrapperComponent,
	NavigateFunction,
	ResolveDesignerRoutePath,
} from "./types";

type CurrentOrg = ReturnType<typeof useCurrentOrganization>["data"];

export interface InvoiceDesignerAppEntityProps {
	templateIdFromUrl?: string;
	navigate?: NavigateFunction;
	LayoutWrapper?: LayoutWrapperComponent;
	resolveRoutePath?: ResolveDesignerRoutePath;
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (templateId: string) => void;
}

export function InvoiceDesignerAppEntity({
	templateIdFromUrl,
	navigate,
	LayoutWrapper,
	resolveRoutePath,
	onMissingTemplateRedirect,
	onTemplateCreatedNavigate,
}: InvoiceDesignerAppEntityProps = {}) {
	const routeNavigate = useNavigate();
	const params = useParams<{ id?: string }>();
	const resolvedTemplateId = templateIdFromUrl ?? params.id;
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const { data: templates = [], isSubscribed: isTemplatesSubscribed } =
		useTemplates(orgId);
	const createTemplate = useCreateTemplate();

	const hostNavigate = useCallback<NavigateFunction>(
		(to, options) => {
			if (navigate) {
				navigate(to, options);
				return;
			}
			routeNavigate(to, {
				replace: options?.replace,
				state: options?.state as Record<string, unknown> | undefined,
			});
		},
		[navigate, routeNavigate],
	);

	const buildNewTemplateData = useCallback(
		({
			orgId,
			templates,
			currentOrg,
		}: {
			orgId: string;
			templates: Template[];
			currentOrg: CurrentOrg | undefined;
		}): TemplateData => {
			const region = currentOrg
				? invoiceComplianceService.detectRegion(currentOrg)
				: "US";
			const uniqueName = generateUniqueTemplateName("New Template", templates);

			return {
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
		},
		[],
	);

	return (
		<InvoiceDesignerEntity
			templateIdFromUrl={resolvedTemplateId}
			navigate={hostNavigate}
			currentOrg={currentOrg}
			getOrgId={(org) => org?.id || ""}
			templates={templates}
			isTemplatesSubscribed={isTemplatesSubscribed}
			getTemplateId={(template) => template.id}
			createTemplate={createTemplate}
			buildNewTemplateData={buildNewTemplateData}
			Provider={DesignerTemplateProvider}
			PageComponent={TemplateDesignerPage}
			LayoutWrapper={LayoutWrapper}
			resolveRoutePath={resolveRoutePath}
			onMissingTemplateRedirect={onMissingTemplateRedirect}
			onTemplateCreatedNavigate={onTemplateCreatedNavigate}
		/>
	);
}

