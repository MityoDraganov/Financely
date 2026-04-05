import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWidgetDefinitions } from "@/hooks/repository-hooks/use-widget-definitions";
import { WidgetDesignerProvider, type WidgetTemplateForCreate } from "@/contexts/widget-designer-context";
import { functionsService } from "@/services/functions/functions-service";
import { buildDefaultWidgetPageConfig } from "@/utils/widget-page-config-defaults";
import IntegrationsPage from "./integrations-page";
import AppLayout from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";

export default function IntegrationsWrapper() {
	const navigate = useNavigate();
	const { widgetId: widgetIdFromUrl } = useParams<{ widgetId?: string }>();
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id ?? "";
	const { data: definitions = [], isLoading: isLoadingDefinitions, invalidate, refetch } = useWidgetDefinitions(orgId);
	const currentWidgetId = widgetIdFromUrl;
	const [isCreatingNewWidget, setIsCreatingNewWidget] = useState(false);
	const creatingRef = useRef(false);
	const previousOrgIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!orgId) return;
		const previousOrgId = previousOrgIdRef.current;
		if (previousOrgId && previousOrgId !== orgId && widgetIdFromUrl) {
			navigate("/integrations", { replace: true });
		}
		previousOrgIdRef.current = orgId;
	}, [orgId, widgetIdFromUrl, navigate]);

	// Clear URL widget if it doesn't belong to current org (e.g. after org switch or stale link)
	useEffect(() => {
		if (isLoadingDefinitions || !orgId) return;
		if (!widgetIdFromUrl) return;
		const belongsToOrg = definitions.some((d) => d.id === widgetIdFromUrl);
		if (!belongsToOrg) {
			navigate("/integrations", { replace: true });
		}
	}, [orgId, widgetIdFromUrl, definitions, isLoadingDefinitions, navigate]);

	const currentDefinition = useMemo(() => {
		if (!currentWidgetId) return undefined;
		return definitions.find((d) => d.id === currentWidgetId);
	}, [definitions, currentWidgetId]);

	const setCurrentWidgetId = useCallback(
		(id: string | undefined) => {
			if (!id) {
				navigate("/integrations", { replace: true });
				return;
			}
			navigate(`/integrations/${id}`, { replace: true });
		},
		[navigate]
	);

	const handleCreateNewWidget = useCallback(async () => {
		if (!orgId || creatingRef.current) return;
		creatingRef.current = true;
		setIsCreatingNewWidget(true);
		try {
			const widgetName = `Widget ${definitions.length + 1}`;
			const r = await functionsService.createWidgetDefinition({
				organizationId: orgId,
				name: widgetName,
			});
			try {
				await functionsService.updateWidgetDefinition({
					organizationId: orgId,
					widgetId: r.widgetId,
					pageConfig: buildDefaultWidgetPageConfig(widgetName, {
						primaryColor: currentOrg?.settings?.brandColors?.primary,
					}),
				});
			} catch {
				// Non-blocking: builder hook will hydrate defaults on first load if this call fails.
			}
			invalidate();
			await refetch();
			navigate(`/integrations/${r.widgetId}`, { replace: true });
		} catch {
			creatingRef.current = false;
		} finally {
			creatingRef.current = false;
			setIsCreatingNewWidget(false);
		}
	}, [orgId, definitions.length, invalidate, refetch, navigate, currentOrg?.settings?.brandColors?.primary]);

	const onWidgetChange = useCallback(
		(id: string) => {
			if (id === "new") {
				void handleCreateNewWidget();
				return;
			}
			navigate(`/integrations/${id}`, { replace: true });
		},
		[handleCreateNewWidget, navigate]
	);

	const handleCreateFromTemplate = useCallback(
		async (template: WidgetTemplateForCreate) => {
			if (!orgId || creatingRef.current) return;
			creatingRef.current = true;
			try {
				const r = await functionsService.createWidgetDefinition({
					organizationId: orgId,
					name: template.name,
				});
				try {
					await functionsService.updateWidgetDefinition({
						organizationId: orgId,
						widgetId: r.widgetId,
						pageConfig: buildDefaultWidgetPageConfig(template.name, {
							primaryColor: currentOrg?.settings?.brandColors?.primary,
						}),
					});
				} catch {
					// Non-blocking: builder hook will hydrate defaults on first load if this call fails.
				}
				await functionsService.saveModularWidgetVersion({
					organizationId: orgId,
					widgetId: r.widgetId,
					pages: template.pages,
					actions: template.actions,
				});
				invalidate();
				await refetch();
				navigate(`/integrations/${r.widgetId}`, { replace: true });
			} finally {
				creatingRef.current = false;
			}
		},
		[orgId, invalidate, refetch, navigate, currentOrg?.settings?.brandColors?.primary]
	);

	return (
		<ErrorBoundary>
			<WidgetDesignerProvider
				definitions={definitions}
				currentWidgetId={currentWidgetId}
				setCurrentWidgetId={setCurrentWidgetId}
				currentDefinition={currentDefinition}
				onWidgetChange={onWidgetChange}
				onCreateNewWidget={handleCreateNewWidget}
				onCreateFromTemplate={handleCreateFromTemplate}
				isLoadingDefinitions={isLoadingDefinitions}
				isCreatingNewWidget={isCreatingNewWidget}
			>
				<AppLayout>
					<IntegrationsPage />
				</AppLayout>
			</WidgetDesignerProvider>
		</ErrorBoundary>
	);
}
