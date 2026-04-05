import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminMarketplaceTemplates } from "@/hooks/admin/use-admin-marketplace-templates";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { useAdminAddMarketplaceTemplate } from "@/hooks/admin/use-admin-add-marketplace-template";
import type { MarketplaceTemplate } from "@/core";
import type { Organization as AppOrganization } from "@app/core";
import { useTemplates } from "@app/hooks/repository-hooks/use-templates";
import { useEmailTemplates } from "@app/hooks/repository-hooks/use-email-templates";
import {
	MarketplaceDesignerBundle,
	type NavigateFunction,
} from "@shared/designer-entities";

function resolveImportedTemplateId(
	marketplaceTemplate: MarketplaceTemplate | null,
	invoiceTemplates: Array<{ id: string; marketplaceTemplateId?: string }>,
	emailTemplates: Array<{ id: string; marketplaceTemplateId?: string }>,
): string | undefined {
	if (!marketplaceTemplate) return undefined;
	if (marketplaceTemplate.type === "invoice") {
		return invoiceTemplates.find(
			(template) => template.marketplaceTemplateId === marketplaceTemplate.id,
		)?.id;
	}
	return emailTemplates.find(
		(template) => template.marketplaceTemplateId === marketplaceTemplate.id,
	)?.id;
}

export function AdminMarketplaceDesignerPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { id } = useParams<{ id: string }>();
	const [searchParams] = useSearchParams();
	const templateIdFromQuery = searchParams.get("templateId") || undefined;
	const [resolvedTemplateId, setResolvedTemplateId] = useState<
		string | undefined
	>(templateIdFromQuery);
	const [ensureError, setEnsureError] = useState<string | null>(null);
	const ensureInFlightRef = useRef(false);
	const attemptedAutoImportKeyRef = useRef<string | null>(null);

	const { data: publishedTemplates = [], isLoading: isLoadingPublished } =
		useAdminMarketplaceTemplates("published");
	const { data: adminOrganizations = [], isLoading: isLoadingOrganizations } =
		useAdminOrganizations();

	const marketplaceTemplate = useMemo(
		() =>
			(publishedTemplates.find((template) => template.id === id) as
				| MarketplaceTemplate
				| undefined) ?? null,
		[publishedTemplates, id],
	);

	const currentOrg = useMemo<AppOrganization | null>(() => {
		if (!adminOrganizations.length) return null;

		const preferredOrgId = marketplaceTemplate?.organizationId;
		if (preferredOrgId) {
			const preferredOrg = adminOrganizations.find(
				(org) => org.id === preferredOrgId,
			);
			if (preferredOrg) {
				return preferredOrg as unknown as AppOrganization;
			}
		}

		const activeOrg =
			adminOrganizations.find((org) => org.status !== "deleted") ??
			adminOrganizations[0];
		return (activeOrg as unknown as AppOrganization) ?? null;
	}, [adminOrganizations, marketplaceTemplate?.organizationId]);

	const orgId = currentOrg?.id || "";
	const { data: invoiceTemplates = [] } = useTemplates(orgId);
	const { data: emailTemplates = [] } = useEmailTemplates(orgId);
	const addMarketplaceTemplate = useAdminAddMarketplaceTemplate();

	const importedTemplateId = useMemo(
		() =>
			resolveImportedTemplateId(
				marketplaceTemplate,
				invoiceTemplates,
				emailTemplates,
			),
		[marketplaceTemplate, invoiceTemplates, emailTemplates],
	);

	const hostNavigate = useCallback<NavigateFunction>(
		(to, options) => {
			navigate(to, {
				replace: options?.replace,
				state: options?.state as Record<string, unknown> | undefined,
			});
		},
		[navigate],
	);

	useEffect(() => {
		if (templateIdFromQuery) {
			setResolvedTemplateId(templateIdFromQuery);
			return;
		}
		if (importedTemplateId) {
			setResolvedTemplateId(importedTemplateId);
		}
	}, [templateIdFromQuery, importedTemplateId]);

	useEffect(() => {
		if (!marketplaceTemplate || !orgId) return;
		if (templateIdFromQuery || importedTemplateId || resolvedTemplateId) return;
		if (ensureInFlightRef.current) return;
		if (ensureError) return;

		const attemptKey = `${marketplaceTemplate.id}:${orgId}:${marketplaceTemplate.type}`;
		if (attemptedAutoImportKeyRef.current === attemptKey) return;
		attemptedAutoImportKeyRef.current = attemptKey;

		ensureInFlightRef.current = true;
		setEnsureError(null);
		addMarketplaceTemplate
			.mutateAsync({
				templateId: marketplaceTemplate.id,
				orgId,
				templateType: marketplaceTemplate.type,
			})
			.then((result) => {
				setResolvedTemplateId(result.templateId);
			})
			.catch((error) => {
				setEnsureError(
					error instanceof Error ? error.message : "Failed to load template.",
				);
			})
			.finally(() => {
				ensureInFlightRef.current = false;
			});
	}, [
		addMarketplaceTemplate,
		ensureError,
		importedTemplateId,
		marketplaceTemplate,
		orgId,
		resolvedTemplateId,
		templateIdFromQuery,
	]);

	if (!id) {
		return (
			<div className="p-6 space-y-4">
				<p className="text-sm text-muted-foreground">Missing marketplace template ID.</p>
				<Button variant="outline" onClick={() => navigate("/marketplace")}>
					<ArrowLeft className="h-4 w-4" />
					Back to Marketplace
				</Button>
			</div>
		);
	}

	if (isLoadingPublished || isLoadingOrganizations) {
		return (
			<div className="p-6 space-y-4">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading designer…
				</div>
			</div>
		);
	}

	if (!marketplaceTemplate) {
		return (
			<div className="p-6 space-y-4">
				<p className="text-sm text-muted-foreground">
					Marketplace template not found.
				</p>
				<Button variant="outline" onClick={() => navigate("/marketplace")}>
					<ArrowLeft className="h-4 w-4" />
					Back to Marketplace
				</Button>
			</div>
		);
	}

	if (!currentOrg || !orgId) {
		return (
			<div className="p-6 space-y-4">
				<p className="text-sm text-muted-foreground">
					No active organization found to open this template in the admin designer.
				</p>
				<Button variant="outline" onClick={() => navigate("/marketplace")}>
					<ArrowLeft className="h-4 w-4" />
					Back to Marketplace
				</Button>
			</div>
		);
	}

	if (ensureError) {
		return (
			<div className="p-6 space-y-4">
				<p className="text-sm text-destructive">{ensureError}</p>
				<Button variant="outline" onClick={() => navigate("/marketplace")}>
					<ArrowLeft className="h-4 w-4" />
					Back to Marketplace
				</Button>
			</div>
		);
	}

	if (!resolvedTemplateId) {
		return (
			<div className="p-6 space-y-4">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Preparing template editor…
				</div>
			</div>
		);
	}

	const resolveAdminDesignerPath = (templateId?: string) => {
		const activeTemplateId = templateId || resolvedTemplateId;
		return activeTemplateId
			? `/marketplace/${id}/designer?templateId=${activeTemplateId}`
			: `/marketplace/${id}/designer`;
	};

	const sharedProps = {
		templateIdFromUrl: resolvedTemplateId,
		organization: currentOrg,
		navigate: hostNavigate,
		onMissingTemplateRedirect: () => navigate("/marketplace", { replace: true }),
		onTemplateCreatedNavigate: (templateId: string) => {
			navigate(`/marketplace/${id}/designer?templateId=${templateId}`, {
				replace: true,
			});
		},
	} as const;

	if (marketplaceTemplate.type === "invoice") {
		return (
			<MarketplaceDesignerBundle
				kind="invoice"
				{...sharedProps}
				resolveRoutePath={(key, templateId) => {
					if (key === "templates") return "/marketplace";
					return resolveAdminDesignerPath(templateId);
				}}
			/>
		);
	}

	return (
		<MarketplaceDesignerBundle
			kind="email"
			{...sharedProps}
			locationPathname={location.pathname}
			locationState={
				(location.state as
					| { templateId?: string; action?: "create" }
					| null
					| undefined) ?? null
			}
			resolveRoutePath={(key, templateId) => {
				if (key === "templates") return "/marketplace";
				return resolveAdminDesignerPath(templateId);
			}}
		/>
	);
}
