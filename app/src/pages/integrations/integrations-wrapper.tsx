import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWidgetDefinitions } from "@/hooks/repository-hooks/use-widget-definitions";
import { WidgetDesignerProvider, type WidgetTemplateForCreate } from "@/contexts/widget-designer-context";
import { functionsService } from "@/services/functions/functions-service";
import IntegrationsPage from "./integrations-page";
import AppLayout from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";

export default function IntegrationsWrapper() {
	const navigate = useNavigate();
	const { widgetId: widgetIdFromUrl } = useParams<{ widgetId?: string }>();
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id ?? "";
	const { data: definitions = [], isLoading: isLoadingDefinitions, invalidate, refetch } = useWidgetDefinitions(orgId);
	const [currentWidgetId, setCurrentWidgetId] = useState<string | undefined>(widgetIdFromUrl);
	const [isCreatingNewWidget, setIsCreatingNewWidget] = useState(false);
	const creatingRef = useRef(false);

	useEffect(() => {
		if (widgetIdFromUrl !== currentWidgetId) {
			setCurrentWidgetId(widgetIdFromUrl);
		}
	}, [widgetIdFromUrl, currentWidgetId]);

	// Clear URL widget if it doesn't belong to current org (e.g. after org switch or stale link)
	useEffect(() => {
		if (isLoadingDefinitions || !orgId) return;
		if (!currentWidgetId) return;
		const belongsToOrg = definitions.some((d) => d.id === currentWidgetId);
		if (!belongsToOrg) {
			setCurrentWidgetId(undefined);
			navigate("/integrations", { replace: true });
		}
	}, [orgId, currentWidgetId, definitions, isLoadingDefinitions, navigate]);

	const currentDefinition = useMemo(() => {
		if (!currentWidgetId) return undefined;
		return definitions.find((d) => d.id === currentWidgetId);
	}, [definitions, currentWidgetId]);

	const handleCreateNewWidget = useCallback(async () => {
		if (!orgId || creatingRef.current) return;
		creatingRef.current = true;
		setIsCreatingNewWidget(true);
		try {
			const r = await functionsService.createWidgetDefinition({
				organizationId: orgId,
				name: `Widget ${definitions.length + 1}`,
			});
			invalidate();
			await refetch();
			setCurrentWidgetId(r.widgetId);
			navigate(`/integrations/${r.widgetId}`, { replace: true });
		} catch {
			creatingRef.current = false;
		} finally {
			creatingRef.current = false;
			setIsCreatingNewWidget(false);
		}
	}, [orgId, definitions.length, invalidate, refetch, navigate]);

	const onWidgetChange = useCallback(
		(id: string) => {
			if (id === "new") {
				void handleCreateNewWidget();
				return;
			}
			setCurrentWidgetId(id);
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
				await functionsService.saveModularWidgetVersion({
					organizationId: orgId,
					widgetId: r.widgetId,
					pages: template.pages,
					actions: template.actions,
				});
				invalidate();
				setCurrentWidgetId(r.widgetId);
				navigate(`/integrations/${r.widgetId}`, { replace: true });
			} finally {
				creatingRef.current = false;
			}
		},
		[orgId, invalidate, navigate]
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
