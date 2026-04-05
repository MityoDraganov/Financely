import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type {
	EmailTemplate,
	EmailTemplateData,
	EmailTemplateDesignTokens,
} from "../../core";
import { ErrorBoundary } from "../../components/error-boundary";
import { CreateEmailTemplateDialog } from "../../components/email-designer/create-email-template-dialog";
import { EmailDesignerTemplateProvider } from "../../contexts/email-designer-template-context";
import { useCurrentOrganization } from "../../hooks/use-current-organization";
import { useCreateEmailTemplate } from "../../hooks/repository-hooks/use-create-email-template";
import { useEmailTemplates } from "../../hooks/repository-hooks/use-email-templates";
import EmailDesignerPage from "../../pages/email-designer";
import {
	allowedContextsForTemplateType,
	type EmailTemplateTypeId,
} from "../../utils/email-template-compatibility";
import {
	EmailDesignerEntity,
} from "./email-designer-entity";
import type {
	EmailCreateTemplateLocationState,
	LayoutWrapperComponent,
	NavigateFunction,
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

type CurrentOrg = ReturnType<typeof useCurrentOrganization>["data"];

export interface EmailDesignerAppEntityProps {
	templateIdFromUrl?: string;
	locationPathname?: string;
	locationState?: EmailCreateTemplateLocationState | null;
	navigate?: NavigateFunction;
	LayoutWrapper?: LayoutWrapperComponent;
	ErrorBoundaryWrapper?: LayoutWrapperComponent;
	resolveRoutePath?: ResolveEmailDesignerRoutePath;
	onMissingTemplateRedirect?: () => void;
	onTemplateCreatedNavigate?: (templateId: string) => void;
}

export function EmailDesignerAppEntity({
	templateIdFromUrl,
	locationPathname,
	locationState,
	navigate,
	LayoutWrapper,
	ErrorBoundaryWrapper = ErrorBoundary,
	resolveRoutePath,
	onMissingTemplateRedirect,
	onTemplateCreatedNavigate,
}: EmailDesignerAppEntityProps = {}) {
	const routeNavigate = useNavigate();
	const routeLocation = useLocation();
	const params = useParams<{ id?: string }>();
	const resolvedTemplateId = templateIdFromUrl ?? params.id;
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const {
		data: templates = [],
		isLoading,
		isSubscribed,
	} = useEmailTemplates(orgId);
	const createTemplate = useCreateEmailTemplate();

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

	const resolvedPathname = locationPathname ?? routeLocation.pathname;
	const resolvedLocationState =
		locationState ??
		((routeLocation.state as EmailCreateTemplateLocationState | null) || null);

	const brandDesignTokens = useMemo(() => {
		const brandColors = currentOrg?.settings?.brandColors;
		if (!brandColors) return defaultTokens;

		return {
			...defaultTokens,
			primary: brandColors.primary || defaultTokens.primary,
			background: "#ffffff",
			surface: "#f8fafc",
			text: "#0f172a",
		};
	}, [currentOrg?.settings?.brandColors]);

	const buildNewTemplateData = useCallback(
		({
			orgId,
			templateCount,
			selectedTemplateType,
			currentOrg: _currentOrg,
		}: {
			orgId: string;
			templateCount: number;
			selectedTemplateType: EmailTemplateTypeId;
			currentOrg: CurrentOrg | undefined;
		}): EmailTemplateData => {
			void _currentOrg;
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

	return (
		<EmailDesignerEntity<
			EmailTemplate,
			EmailTemplateData,
			CurrentOrg,
			EmailTemplateTypeId
		>
			templateIdFromUrl={resolvedTemplateId}
			locationPathname={resolvedPathname}
			locationState={resolvedLocationState}
			navigate={hostNavigate}
			currentOrg={currentOrg}
			getOrgId={(org) => org?.id || ""}
			templates={templates}
			isLoadingTemplates={isLoading}
			isSubscribed={isSubscribed}
			getTemplateId={(template) => template.id}
			createTemplate={createTemplate}
			buildNewTemplateData={buildNewTemplateData}
			initialTemplateType="all"
			Provider={EmailDesignerTemplateProvider}
			PageComponent={EmailDesignerPage}
			CreateTemplateDialogComponent={CreateEmailTemplateDialog}
			LayoutWrapper={LayoutWrapper}
			ErrorBoundaryWrapper={ErrorBoundaryWrapper}
			resolveRoutePath={resolveRoutePath}
			onMissingTemplateRedirect={onMissingTemplateRedirect}
			onTemplateCreatedNavigate={onTemplateCreatedNavigate}
		/>
	);
}
