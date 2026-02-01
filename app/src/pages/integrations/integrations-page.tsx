import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { WidgetBuilderProvider, useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { functionsService } from "@/services/functions/functions-service";
import { projectId } from "@/infrastructure/firebase";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import {
	IntegrationsHeader,
	IntegrationsTabs,
	ShareEmbedSection,
	AutomationsSection,
	WidgetSidebar,
	WidgetBuilderPropertiesPanel,
	type TabValue,
} from "@/components/integrations";
import { Input } from "@/components/ui/input";

function DesignAreaContent({
	showBuilder,
	showPropertiesPanel,
	activeTab,
	effectiveWidgetId,
	getEmbedScript,
}: {
	showBuilder: boolean;
	showPropertiesPanel: boolean;
	activeTab: TabValue;
	effectiveWidgetId: string | undefined;
	getEmbedScript: () => string;
}) {
	const { t } = useTranslation();
	const widgetDesigner = useWidgetDesigner();
	const { data: organization } = useCurrentOrganization();
	const ctx = useWidgetBuilderContext();
	const noWidgetSelected = activeTab === "design" && !effectiveWidgetId;
	const definitions = widgetDesigner?.definitions ?? [];
	const onWidgetChange = widgetDesigner?.onWidgetChange ?? (() => {});
	const onCreateNewWidget = widgetDesigner?.onCreateNewWidget ?? (() => {});
	const isCreatingNewWidget = widgetDesigner?.isCreatingNewWidget ?? false;

	return (
		<>
			{!noWidgetSelected && (
				<aside className="w-fit shrink-0 overflow-y-auto">
					<WidgetSidebar />
				</aside>
			)}
			<main
				className={
					noWidgetSelected
						? "flex-1 min-w-0 overflow-y-auto w-full px-6 py-8"
						: "flex-1 min-w-0 overflow-y-auto mx-auto max-w-[1400px] px-6 py-8"
				}
			>
				{showBuilder && ctx ? (
					ctx.loading ? (
						<div className="flex items-center justify-center min-h-[300px]">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex items-end justify-between gap-4">
								<div className="flex flex-col gap-0.5">
									<Label className="text-sm font-medium">
										{t(
											"siteBuilder.widgets.widgetName",
											"Widget name",
										)}
									</Label>
									<Input
										value={ctx.widgetName}
										onChange={(e) =>
											ctx.setWidgetName(e.target.value)
										}
										onBlur={() => void ctx.handleWidgetNameBlur()}
										onKeyDown={(e) =>
											e.key === "Enter" &&
											(
												e.target as HTMLInputElement
											).blur()
										}
										placeholder={t(
											"siteBuilder.widgets.widgetName",
											"Widget name",
										)}
										disabled={ctx.widgetNameSaving}
										className="max-w-[240px] font-semibold text-lg h-9"
									/>
								</div>
								<div className="flex items-center gap-2">
									<div className="flex gap-2">
										{ctx.definitionStatus === "published" ? (
											<Button
												variant="outline"
												onClick={() =>
													void ctx.unpublish()
												}
												disabled={ctx.unpublishing}
											>
												{ctx.unpublishing ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : null}
												Make draft
											</Button>
										) : (
											<Button
												onClick={() =>
													void ctx.publish()
												}
												variant="outline"
												disabled={ctx.publishing}
											>
												{ctx.publishing ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : null}
												Publish
											</Button>
										)}
										<Button
											onClick={() => void ctx.save()}
											disabled={ctx.saving}
										>
											{ctx.saving ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : null}
											Save
										</Button>
									</div>
								</div>
							</div>

							<div className="min-h-[200px] rounded-lg border bg-card p-6">
								{ctx.schema.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										Add blocks from the left to build your
										widget.
									</p>
								) : (
									<div className="max-w-md mx-auto">
										<WidgetSchemaRenderer
											schema={ctx.schema}
											actions={ctx.actions}
											styling={ctx.previewStyling}
											onSubmit={async () => {}}
										/>
									</div>
								)}
							</div>
						</div>
					)
				) : noWidgetSelected ? (
					<div className="max-w-[1400px] mx-auto">
						<div className="flex flex-col items-center text-center py-12">
							<Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
							<h2 className="text-xl font-semibold text-foreground mb-2">
								{t(
									"siteBuilder.widgets.selectOrCreate",
									"Select or create a widget",
								)}
							</h2>
							<p className="text-sm text-muted-foreground max-w-md mb-12">
								{t(
									"siteBuilder.widgets.selectOrCreateDesc",
									"Choose a widget from the list or create one from a template.",
								)}
							</p>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
							<button
								type="button"
								onClick={() => void onCreateNewWidget()}
								disabled={isCreatingNewWidget}
								className="group flex flex-col items-center justify-center min-h-[180px] rounded-xl border-2 border-dashed border-border bg-background hover:bg-muted/30 hover:border-primary/40 transition-all duration-200 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70 disabled:pointer-events-none"
							>
								<div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted/80 group-hover:bg-primary/15 transition-colors mb-4">
									{isCreatingNewWidget ? (
										<Loader2 className="h-7 w-7 animate-spin" />
									) : (
										<Plus className="h-7 w-7" />
									)}
								</div>
								<span className="text-base font-semibold">
									{isCreatingNewWidget
										? t("siteBuilder.widgets.creating", "Creating…")
										: t("siteBuilder.widgets.createNew", "Create New")}
								</span>
							</button>
							{definitions.map((d) => (
								<button
									key={d.id}
									type="button"
									onClick={() => onWidgetChange(d.id)}
									className="group flex flex-col items-stretch min-h-[180px] rounded-xl border border-border bg-card p-5 text-left shadow-sm hover:shadow-md hover:border-primary/25 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<div className="flex items-start gap-3 min-w-0">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 group-hover:bg-primary/10 transition-colors">
											<Layout className="h-5 w-5 text-muted-foreground" />
										</div>
										<div className="min-w-0 flex-1">
											<span className="block text-base font-semibold text-foreground truncate">
												{d.name}
											</span>
										</div>
									</div>
									<div className="mt-auto pt-4 flex items-center justify-between gap-2">
										<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<span
												className={d.status === "published"
													? "h-1.5 w-1.5 rounded-full bg-primary"
													: "h-1.5 w-1.5 rounded-full bg-amber-500"}
											/>
											{d.status === "published"
												? t("siteBuilder.widgetStatus.published", "Published")
												: t("siteBuilder.widgetStatus.draft", "Draft")}
										</span>
									</div>
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="min-w-0">
						{activeTab === "share" && (
							<ShareEmbedSection
								embedScript={getEmbedScript()}
								organizationId={organization?.id || ""}
								widgetDefinitions={
									widgetDesigner?.definitions?.map(
										(d) => ({
											id: d.id,
											name: d.name,
										}),
									) ?? []
								}
								selectedWidgetId={effectiveWidgetId}
							/>
						)}
						{activeTab === "automations" && (
							<AutomationsSection />
						)}
					</div>
				)}
			</main>
			{showPropertiesPanel && <WidgetBuilderPropertiesPanel />}
		</>
	);
}

export default function IntegrationsPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: organization, isLoading } = useCurrentOrganization();

	const [activeTab, setActiveTab] = useState<TabValue>("design");
	const { widgetId: currentWidgetId } = useParams<{ widgetId?: string }>();
	const widgetDesigner = useWidgetDesigner();
	const effectiveWidgetId =
		widgetDesigner?.currentWidgetId ?? currentWidgetId;

	const definitions = widgetDesigner?.definitions ?? [];
	const widgetBelongsToOrg = definitions.some(
		(d) => d.id === effectiveWidgetId,
	);

	const handleDeleteWidget = useCallback(
		async (widgetId: string) => {
			if (!organization?.id) return;
			try {
				await functionsService.deleteWidgetDefinition({
					organizationId: organization.id,
					widgetId,
				});
				queryClient.invalidateQueries({
					queryKey: ["widget-definitions", organization.id],
				});
				if (effectiveWidgetId === widgetId) {
					navigate("/integrations", { replace: true });
				}
				toast.success(
					t("siteBuilder.toasts.widgetDeleted", "Widget deleted"),
				);
			} catch {
				toast.error(
					t(
						"siteBuilder.toasts.errors.deleteWidgetFailed",
						"Failed to delete widget",
					),
				);
			}
		},
		[organization?.id, effectiveWidgetId, queryClient, navigate, t],
	);

	const getEmbedScript = useCallback(() => {
		if (!organization) return "";
		const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
		const widgetLoaderUrl = window.location.origin + "/widget-loader.js";
		return `<script src="${widgetLoaderUrl}" data-org-id="${organization.id}" data-api-url="${apiUrl}"></script>`;
	}, [organization]);

	const showBuilder = Boolean(effectiveWidgetId) && activeTab === "design";
	const showPropertiesPanel = showBuilder;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<IntegrationsHeader />

			<div className="border-b border-border shrink-0">
				<div className="mx-auto max-w-[1400px] px-6">
					<IntegrationsTabs
						activeTab={activeTab}
						onTabChange={setActiveTab}
					/>
				</div>
			</div>

			<WidgetBuilderProvider
				effectiveWidgetId={effectiveWidgetId}
				organizationId={organization?.id}
				widgetBelongsToOrg={widgetBelongsToOrg}
				onDeleteWidget={handleDeleteWidget}
			>
				<div className="flex flex-1 min-h-0 w-full">
					<DesignAreaContent
						showBuilder={showBuilder}
						showPropertiesPanel={showPropertiesPanel}
						activeTab={activeTab}
						effectiveWidgetId={effectiveWidgetId}
						getEmbedScript={getEmbedScript}
					/>
				</div>
			</WidgetBuilderProvider>
		</div>
	);
}
