import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useCreateEmailTemplate } from "@/hooks/repository-hooks/use-create-email-template";
import { EmailDesignerTemplateProvider } from "@/contexts/email-designer-template-context";
import EmailDesignerPage from "./email-designer";
import AppLayout from "@/components/layout";
import type { EmailTemplateData, EmailTemplateDesignTokens, EmailTemplateBlock } from "@/core";
import { ErrorBoundary } from "@/components/error-boundary";
import { CreateEmailTemplateDialog } from "@/components/email-designer/create-email-template-dialog";
import {
	allowedContextsForTemplateType,
	type EmailTemplateTypeId,
} from "@/utils/email-template-compatibility";

const defaultTokens: EmailTemplateDesignTokens = {
	background: "#ffffff",
	surface: "#f8fafc",
	text: "#0f172a",
	primary: "#2563eb",
	fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
	borderRadius: 12,
};

export default function EmailDesignerWrapper() {
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
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [createDialogOrigin, setCreateDialogOrigin] = useState<"route" | "designer">("designer");
	const [selectedTemplateType, setSelectedTemplateType] = useState<EmailTemplateTypeId>("all");
	const createDialogResolverRef = useRef<((created: boolean) => void) | null>(null);

	const locationState = (location.state as { templateId?: string; action?: "create" } | null) || null;
	const isRouteCreationWizard = createDialogOpen && createDialogOrigin === "route" && !templateIdFromUrl;

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

	const resolveCreateDialog = useCallback((created: boolean) => {
		if (!createDialogResolverRef.current) return;
		createDialogResolverRef.current(created);
		createDialogResolverRef.current = null;
	}, []);

	const openCreateTemplateWizard = useCallback(
		(origin: "route" | "designer") => {
			if (createDialogResolverRef.current) {
				return Promise.resolve(false);
			}
			setCreateDialogOrigin(origin);
			setSelectedTemplateType("all");
			setCreateDialogOpen(true);
			return new Promise<boolean>((resolve) => {
				createDialogResolverRef.current = resolve;
			});
		},
		[],
	);

	const handleCreateNewTemplate = useCallback(async () => {
		if (!orgId) return;
		await openCreateTemplateWizard("designer");
	}, [orgId, openCreateTemplateWizard]);

	const handleCancelCreateTemplate = useCallback(() => {
		setCreateDialogOpen(false);
		resolveCreateDialog(false);
		if (createDialogOrigin === "route" && !templateIdFromUrl) {
			navigate("/templates", { replace: true });
		}
	}, [createDialogOrigin, navigate, resolveCreateDialog, templateIdFromUrl]);

	const handleConfirmCreateTemplate = useCallback(async () => {
		if (!orgId) return;

		const uniqueName = `New Email Template ${templates.length + 1}`;
		const allowedContexts = allowedContextsForTemplateType(selectedTemplateType);
		const includeSmartPaymentBlock =
			allowedContexts.includes("invoice_send") || selectedTemplateType === "invoice";
		const defaultBlocks: EmailTemplateBlock[] = includeSmartPaymentBlock
			? [
					{
						id: crypto.randomUUID(),
						type: "paymentInstructions",
						section: "body",
						ctaLabel: "Pay now",
						fallbackMode: "bank_transfer",
						showReference: true,
						backgroundColor: "#f8fafc",
						border: {
							borderWidth: 1,
							borderColor: "#e2e8f0",
							borderStyle: "solid",
							borderRadius: 10,
						},
						spacing: {
							paddingTop: 12,
							paddingRight: 12,
							paddingBottom: 12,
							paddingLeft: 12,
							marginTop: 8,
							marginRight: 0,
							marginBottom: 8,
							marginLeft: 0,
						},
					},
				]
			: [];
		const templateData: EmailTemplateData = {
			orgId,
			name: uniqueName,
			subject: "",
			preheader: "",
			status: "draft",
			version: 1,
			isLocked: false,
			isSystemDefault: false,
			allowedContexts,
			htmlContent: "",
			blocks: defaultBlocks,
			designTokens: brandDesignTokens,
			placeholders: [],
		};

		try {
			const newTemplateId = await createTemplate.mutateAsync(templateData);
			setCurrentTemplateId(newTemplateId);
			setCreateDialogOpen(false);
			resolveCreateDialog(true);
			navigate(`/email-designer/${newTemplateId}`, { replace: true });
		} catch (error) {
			console.error("Failed to create email template:", error);
		}
	}, [
		orgId,
		templates.length,
		createTemplate,
		selectedTemplateType,
		brandDesignTokens,
		resolveCreateDialog,
		navigate,
	]);

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
			!hasHandledCreateActionRef.current
		) {
			hasHandledCreateActionRef.current = true;
			openCreateTemplateWizard("route").finally(() => {
				// Clear location state after handling to prevent re-triggering
				window.history.replaceState({}, '', location.pathname);
			});
		}
		// Reset ref when location changes (user navigates away and back) or when template is created
		if (!locationState?.action || createTemplate.isSuccess) {
			hasHandledCreateActionRef.current = false;
		}
	}, [locationState?.action, createTemplate.isPending, createTemplate.isSuccess, openCreateTemplateWizard, location.pathname]);

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
					<>
						{isRouteCreationWizard ? (
							<div className="py-10 px-6">
								<p className="text-sm text-muted-foreground">
									Select a template type to start creating your email template.
								</p>
							</div>
						) : (
							<EmailDesignerPage />
						)}
						<CreateEmailTemplateDialog
							open={createDialogOpen}
							isPending={createTemplate.isPending}
							selectedTemplateType={selectedTemplateType}
							onSelectedTemplateTypeChange={setSelectedTemplateType}
							onOpenChange={(open) => {
								if (createTemplate.isPending) return;
								if (!open) {
									handleCancelCreateTemplate();
									return;
								}
								setCreateDialogOpen(true);
							}}
							onConfirm={handleConfirmCreateTemplate}
							onCancel={handleCancelCreateTemplate}
						/>
					</>
				</AppLayout>
			</EmailDesignerTemplateProvider>
		</ErrorBoundary>
	);
}
