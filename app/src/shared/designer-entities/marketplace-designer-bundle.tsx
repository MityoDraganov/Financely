import { useCallback, useMemo, type ReactNode } from "react";
import type { EmailTemplateDesignTokens } from "../../core";
import { ErrorBoundary } from "../../components/error-boundary";
import { CreateEmailTemplateDialog } from "../../components/email-designer/create-email-template-dialog";
import { DesignerTemplateProvider } from "../../contexts/designer-template-context";
import { EmailDesignerTemplateProvider } from "../../contexts/email-designer-template-context";
import { OrganizationContext } from "../../contexts/organization-context-types";
import { useCreateEmailTemplate } from "../../hooks/repository-hooks/use-create-email-template";
import { useCreateTemplate } from "../../hooks/repository-hooks/use-create-template";
import { useEmailTemplates } from "../../hooks/repository-hooks/use-email-templates";
import { useTemplates } from "../../hooks/repository-hooks/use-templates";
import EmailDesignerPage from "../../pages/email-designer";
import TemplateDesignerPage from "../../pages/designer";
import { invoiceComplianceService } from "../../services/invoice-compliance-service";
import {
	allowedContextsForTemplateType,
	type EmailTemplateTypeId,
} from "../../utils/email-template-compatibility";
import { generateUniqueTemplateName } from "../../utils/template-naming";
import {
	DEFAULT_MARGIN_UNIT,
	getDefaultPrintMarginsPx,
} from "../../utils/print-margins";
import { EmailDesignerEntity } from "./email-designer-entity";
import { InvoiceDesignerEntity } from "./invoice-designer-entity";
import type {
	EmailCreateTemplateLocationState,
	LayoutWrapperComponent,
	NavigateFunction,
	ResolveDesignerRoutePath,
	ResolveEmailDesignerRoutePath,
} from "./types";

const defaultTokens: EmailTemplateDesignTokens = {
	background: "#ffffff",
	surface: "#f8fafc",
	text: "#0f172a",
	primary: "#2563eb",
	fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
	borderRadius: 12,
};

interface BaseBundleProps {
	templateIdFromUrl: string;
	organization: any;
	navigate: NavigateFunction;
	LayoutWrapper?: LayoutWrapperComponent;
	ErrorBoundaryWrapper?: LayoutWrapperComponent;
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (templateId: string) => void;
}

interface InvoiceBundleProps extends BaseBundleProps {
	kind: "invoice";
	resolveRoutePath?: ResolveDesignerRoutePath;
}

interface EmailBundleProps extends BaseBundleProps {
	kind: "email";
	locationPathname: string;
	locationState?: EmailCreateTemplateLocationState | null;
	resolveRoutePath?: ResolveEmailDesignerRoutePath;
}

export type MarketplaceDesignerBundleProps = InvoiceBundleProps | EmailBundleProps;

export function MarketplaceDesignerBundle(props: MarketplaceDesignerBundleProps) {
	const { organization } = props;
	const orgId = organization.id;
	const { data: invoiceTemplates = [], isSubscribed: isInvoiceTemplatesSubscribed } =
		useTemplates(orgId);
	const {
		data: emailTemplates = [],
		isLoading: isLoadingEmailTemplates,
		isSubscribed: isEmailTemplatesSubscribed,
	} = useEmailTemplates(orgId);
	const createTemplate = useCreateTemplate();
	const createEmailTemplate = useCreateEmailTemplate();

	const contextValue = useMemo(
		() => ({
			currentOrganization: organization,
			organizations: [organization],
			isLoading: false,
			error: null,
			switchOrganization: () => {},
		}),
		[organization],
	);

	const buildInvoiceTemplateData = useCallback(
		({
			orgId,
			templates,
			currentOrg,
		}: {
			orgId: string;
			templates: any[];
			currentOrg: any;
		}) => {
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

	const brandDesignTokens = useMemo(() => {
		const brandColors = organization.settings?.brandColors;
		if (!brandColors) return defaultTokens;

		return {
			...defaultTokens,
			primary: brandColors.primary || defaultTokens.primary,
			background: "#ffffff",
			surface: "#f8fafc",
			text: "#0f172a",
		};
	}, [organization.settings?.brandColors]);

	const buildEmailTemplateData = useCallback(
		({
			orgId,
			templateCount,
			selectedTemplateType,
		}: {
			orgId: string;
			templateCount: number;
			selectedTemplateType: EmailTemplateTypeId;
			currentOrg: any;
		}) => {
			const uniqueName = `New Email Template ${templateCount + 1}`;
			return {
				orgId,
				name: uniqueName,
				subject: "",
				preheader: "",
				status: "draft",
				version: 1,
				isLocked: false,
				isSystemDefault: false,
				allowedContexts: allowedContextsForTemplateType(selectedTemplateType),
				htmlContent: "",
				blocks: [],
				designTokens: brandDesignTokens,
				placeholders: [],
			};
		},
		[brandDesignTokens],
	);

	const InvoiceEntity = InvoiceDesignerEntity as any;
	const EmailEntity = EmailDesignerEntity as any;
	let designer: ReactNode;

	if (props.kind === "invoice") {
		designer = (
			<InvoiceEntity
				templateIdFromUrl={props.templateIdFromUrl}
				navigate={props.navigate}
				currentOrg={organization}
				getOrgId={(org: any) => org?.id || ""}
				templates={invoiceTemplates}
				isTemplatesSubscribed={isInvoiceTemplatesSubscribed}
				getTemplateId={(template: any) => template.id}
				createTemplate={createTemplate as any}
				buildNewTemplateData={buildInvoiceTemplateData}
				Provider={DesignerTemplateProvider as any}
				PageComponent={TemplateDesignerPage as any}
				LayoutWrapper={props.LayoutWrapper}
				resolveRoutePath={props.resolveRoutePath}
				onMissingTemplateRedirect={props.onMissingTemplateRedirect}
				onTemplateCreatedNavigate={props.onTemplateCreatedNavigate}
			/>
		);
	} else {
		designer = (
			<EmailEntity
				templateIdFromUrl={props.templateIdFromUrl}
				locationPathname={props.locationPathname}
				locationState={props.locationState ?? null}
				navigate={props.navigate}
				currentOrg={organization}
				getOrgId={(org: any) => org?.id || ""}
				templates={emailTemplates}
				isLoadingTemplates={isLoadingEmailTemplates}
				isSubscribed={isEmailTemplatesSubscribed}
				getTemplateId={(template: any) => template.id}
				createTemplate={createEmailTemplate as any}
				buildNewTemplateData={buildEmailTemplateData}
				initialTemplateType="all"
				Provider={EmailDesignerTemplateProvider as any}
				PageComponent={EmailDesignerPage as any}
				CreateTemplateDialogComponent={CreateEmailTemplateDialog as any}
				LayoutWrapper={props.LayoutWrapper}
				ErrorBoundaryWrapper={props.ErrorBoundaryWrapper ?? (ErrorBoundary as any)}
				resolveRoutePath={props.resolveRoutePath}
				onMissingTemplateRedirect={props.onMissingTemplateRedirect}
				onTemplateCreatedNavigate={props.onTemplateCreatedNavigate}
			/>
		);
	}

	return (
		<OrganizationContext.Provider value={contextValue as any}>
			{designer}
		</OrganizationContext.Provider>
	);
}
