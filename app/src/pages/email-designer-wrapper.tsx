import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useCreateEmailTemplate } from "@/hooks/repository-hooks/use-create-email-template";
import { EmailDesignerTemplateProvider } from "@/contexts/email-designer-template-context";
import EmailDesignerPage from "./email-designer";
import AppLayout from "@/components/layout";
import type { EmailTemplateData, EmailTemplateDesignTokens } from "@/core";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "@/components/error-boundary";

const defaultTokens: EmailTemplateDesignTokens = {
	background: "#ffffff",
	surface: "#f8fafc",
	text: "#0f172a",
	primary: "#2563eb",
	fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
	borderRadius: 12,
};

export default function EmailDesignerWrapper() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const {
		data: templates = [],
		isLoading,
		isSubscribed,
	} = useEmailTemplates(orgId);
	const createTemplate = useCreateEmailTemplate();
	const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(templateIdFromUrl);
	const hasHandledCreateActionRef = useRef(false);
	
	const locationState = (location.state as { templateId?: string; action?: "create" } | null) || null;

	// Sync with URL param
	useEffect(() => {
		if (templateIdFromUrl && templateIdFromUrl !== currentTemplateId) {
			setCurrentTemplateId(templateIdFromUrl);
		}
	}, [templateIdFromUrl, currentTemplateId]);

	// Sync with location state (from templates page)
	useEffect(() => {
		if (locationState?.templateId) {
			setCurrentTemplateId(locationState.templateId);
		}
	}, [locationState?.templateId]);

	const currentTemplate = useMemo(() => {
		if (!currentTemplateId) return undefined;
		return templates.find((t) => t.id === currentTemplateId);
	}, [templates, currentTemplateId]);

	// Get brand colors from organization
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

	const handleCreateNewTemplate = useCallback(async () => {
		if (!orgId) return;
		
		const uniqueName = `New Email Template ${templates.length + 1}`;
		
		// Create blank template - no default content
		// Users can add blocks as needed, no generic placeholder text
		const templateData: EmailTemplateData = {
			orgId,
			name: uniqueName,
			subject: "", // Empty subject - user can set it
			preheader: "", // Empty preheader - user can set it
			status: "draft",
			version: 1,
			isLocked: false,
			isSystemDefault: false,
			allowedContexts: ["organization", "invoice", "proposal"],
			htmlContent: "", // Empty HTML - blank template
			blocks: [], // Empty blocks - no default content
			designTokens: brandDesignTokens,
			placeholders: [],
		};
		
		try {
			const newTemplateId = await createTemplate.mutateAsync(templateData);
			setCurrentTemplateId(newTemplateId);
			navigate(`/email-designer/${newTemplateId}`, { replace: true });
		} catch (error) {
			console.error("Failed to create email template:", error);
		}
	}, [orgId, templates, createTemplate, navigate, t, brandDesignTokens]);

	const onTemplateChange = useCallback(async (id: string) => {
		if (id === "new") {
			await handleCreateNewTemplate();
		} else {
			setCurrentTemplateId(id);
			navigate(`/email-designer/${id}`, { replace: true });
		}
	}, [handleCreateNewTemplate, navigate]);

	// Auto-create if location state says so (only once)
	useEffect(() => {
		if (
			locationState?.action === "create" && 
			!createTemplate.isPending && 
			!createTemplate.isSuccess &&
			templates.length === 0 &&
			!hasHandledCreateActionRef.current
		) {
			hasHandledCreateActionRef.current = true;
			handleCreateNewTemplate().finally(() => {
				// Clear location state after handling to prevent re-triggering
				window.history.replaceState({}, '', location.pathname);
			});
		}
		// Reset ref when location changes (user navigates away and back) or when template is created
		if (!locationState?.action || createTemplate.isSuccess) {
			hasHandledCreateActionRef.current = false;
		}
	}, [locationState?.action, createTemplate.isPending, createTemplate.isSuccess, templates.length, handleCreateNewTemplate, location.pathname]);

	return (
		<ErrorBoundary>
			<EmailDesignerTemplateProvider
				templates={templates}
				currentTemplateId={currentTemplateId}
				setCurrentTemplateId={setCurrentTemplateId}
				currentTemplate={currentTemplate}
				onTemplateChange={onTemplateChange}
				onCreateNewTemplate={handleCreateNewTemplate}
				isLoadingTemplates={isLoading}
				isSubscribed={isSubscribed}
			>
				<AppLayout>
					<EmailDesignerPage />
				</AppLayout>
			</EmailDesignerTemplateProvider>
		</ErrorBoundary>
	);
}

