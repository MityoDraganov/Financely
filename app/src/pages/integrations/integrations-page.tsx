import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Sparkles, Plus, Layout, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useDeleteWidgetDefinition } from "@/hooks/service-hooks/use-widget-definition-functions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { WidgetBuilderProvider, useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { projectId } from "@/infrastructure/firebase";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import {
	IntegrationsHeader,
	IntegrationsWidgetNavBar,
	ShareEmbedSection,
	PageLayoutBuilderSection,
	WidgetSidebar,
	WidgetBuilderPropertiesPanel,
	CreateWidgetDialog,
	type TabValue,
	type WidgetTemplateOption as TemplateOption,
} from "@/components/integrations";
import { Skeleton } from "@/components/ui/skeleton";

function DesignAreaContent({
	showBuilder,
	showPropertiesPanel,
	activeTab,
	effectiveWidgetId,
	organizationId,
	getEmbedScript,
	onDeleteWidget,
}: {
	showBuilder: boolean;
	showPropertiesPanel: boolean;
	activeTab: TabValue;
	effectiveWidgetId: string | undefined;
	organizationId: string;
	getEmbedScript: () => string;
	onDeleteWidget: (widgetId: string) => Promise<void>;
}) {
	const { t } = useTranslation();
	const widgetDesigner = useWidgetDesigner();
	const ctx = useWidgetBuilderContext();
	const isWideLayout = useMediaQuery("(min-width: 1600px)");
	const noWidgetSelected = activeTab === "design" && !effectiveWidgetId;
	const hasSelectedBlock = Boolean(ctx?.selectedBlockId);
	const definitions = widgetDesigner?.definitions ?? [];
	const isLoadingDefinitions = widgetDesigner?.isLoadingDefinitions ?? false;
	const onWidgetChange = widgetDesigner?.onWidgetChange ?? (() => {});
	const onCreateNewWidget = widgetDesigner?.onCreateNewWidget ?? (() => {});
	const onCreateFromTemplate = widgetDesigner?.onCreateFromTemplate;
	const isCreatingNewWidget = widgetDesigner?.isCreatingNewWidget ?? false;
	const showMergedSidebar = showBuilder && !isWideLayout;
	const showMergedPropertiesPanel = showMergedSidebar && hasSelectedBlock;
	const showLeftSidebar = showBuilder && !showMergedPropertiesPanel;
	const showRightPropertiesPanel = showPropertiesPanel && !showMergedSidebar;
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [selectedOption, setSelectedOption] = useState<TemplateOption | null>({ kind: "blank" });
	const [isDialogPending, setIsDialogPending] = useState(false);
	const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);

	const handleOpenCreateDialog = () => {
		setSelectedOption({ kind: "blank" });
		setCreateDialogOpen(true);
	};

	const handleConfirmCreate = async () => {
		if (!selectedOption) return;
		setIsDialogPending(true);
		try {
			if (selectedOption.kind === "blank") {
				await onCreateNewWidget();
			} else if (onCreateFromTemplate) {
				await onCreateFromTemplate(selectedOption.template);
			}
			setCreateDialogOpen(false);
		} finally {
			setIsDialogPending(false);
		}
	};

	const handleDeleteFromCard = async (widgetId: string) => {
		setDeletingWidgetId(widgetId);
		try {
			await onDeleteWidget(widgetId);
		} finally {
			setDeletingWidgetId((prev) => (prev === widgetId ? null : prev));
		}
	};

	return (
		<>
			{showLeftSidebar && (
				<aside className="w-fit shrink-0 h-full min-h-0 overflow-hidden">
					<WidgetSidebar />
				</aside>
			)}
			{showMergedPropertiesPanel && (
				<WidgetBuilderPropertiesPanel
					isMergedSidebar
					onBack={() => ctx?.setSelectedBlockId(null)}
					backLabel={t("designer.back", "Back")}
				/>
			)}
			<main
				className={
					activeTab === "pageBuilder"
						? "flex-1 min-h-0 min-w-0 overflow-y-auto w-full"
						: "flex-1 min-h-0 min-w-0 overflow-y-auto w-full px-6 py-8"
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
								<div className="min-w-0">
									<Label className="text-sm font-medium truncate">
										{ctx.widgetName}
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<div className="flex gap-2">
										{ctx.isDirty && (
											<Button
												onClick={() => void ctx.save()}
												disabled={ctx.saving || ctx.hasValidationErrors}
											>
												{ctx.saving ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : null}
												Save
											</Button>
										)}
									</div>
								</div>
							</div>
							{ctx.hasValidationErrors ? (
								<p className="text-xs text-destructive">
									Fix {ctx.validationIssues.length} validation issue
									{ctx.validationIssues.length === 1 ? "" : "s"} to save.
								</p>
							) : null}

							<div className="min-h-[200px] rounded-lg border bg-card p-6">
								{ctx.pages.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										Add a page from the left to build your widget.
									</p>
								) : (
									<div className="max-w-md mx-auto">
										<WidgetSchemaRenderer
											pages={ctx.pages}
											actions={ctx.actions}
											styling={ctx.previewStyling}
											onSubmit={async () => {}}
											multiStepOptions={ctx.multiStepOptions}
											previewPageIndex={
												ctx.activePageId != null
													? ctx.pages.findIndex((p) => p.id === ctx.activePageId)
													: undefined
											}
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
							{isLoadingDefinitions ? (
								Array.from({ length: 8 }).map((_, index) => (
									<div
										key={`widget-skeleton-${index}`}
										className="flex flex-col min-h-[180px] rounded-xl border border-border bg-card p-5"
									>
										<div className="flex items-start gap-3 min-w-0">
											<Skeleton className="h-10 w-10 rounded-lg shrink-0" />
											<div className="min-w-0 flex-1 space-y-2">
												<Skeleton className="h-4 w-3/4" />
												<Skeleton className="h-4 w-1/2" />
											</div>
										</div>
										<div className="mt-auto pt-4">
											<Skeleton className="h-3 w-20" />
										</div>
									</div>
								))
							) : (
								<>
									<button
										type="button"
										onClick={handleOpenCreateDialog}
										disabled={isCreatingNewWidget || isDialogPending}
										className="group flex flex-col items-center justify-center min-h-[180px] rounded-xl border-2 border-dashed border-border bg-background hover:bg-muted/30 hover:border-primary/40 transition-all duration-200 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70 disabled:pointer-events-none"
									>
										<div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted/80 group-hover:bg-primary/15 transition-colors mb-4">
											{isCreatingNewWidget || isDialogPending ? (
												<Loader2 className="h-7 w-7 animate-spin" />
											) : (
												<Plus className="h-7 w-7" />
											)}
										</div>
										<span className="text-base font-semibold">
											{isCreatingNewWidget || isDialogPending
												? t("siteBuilder.widgets.creating", "Creating…")
												: t("siteBuilder.widgets.createNew", "Create New")}
										</span>
									</button>
									<CreateWidgetDialog
										open={createDialogOpen}
										isPending={isDialogPending}
										selectedOption={selectedOption}
										onSelectedOptionChange={setSelectedOption}
										onOpenChange={setCreateDialogOpen}
										onConfirm={() => void handleConfirmCreate()}
										onCancel={() => setCreateDialogOpen(false)}
									/>
									{definitions.map((d) => (
										<div
											key={d.id}
											onClick={() => onWidgetChange(d.id)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													onWidgetChange(d.id);
												}
											}}
											role="button"
											tabIndex={0}
											className="group relative flex flex-col items-stretch min-h-[180px] rounded-xl border border-border bg-card p-5 text-left shadow-sm hover:shadow-md hover:border-primary/25 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											aria-label={t("siteBuilder.widgets.openWidget", "Open widget")}
										>
											<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-10">
												<Button
													variant="secondary"
													size="icon"
													className="h-8 w-8 text-destructive hover:text-destructive bg-background/95 backdrop-blur-sm"
													onClick={(e) => {
														e.stopPropagation();
														void handleDeleteFromCard(d.id);
													}}
													disabled={deletingWidgetId !== null}
													aria-label={t("siteBuilder.widgets.deleteWidget", "Delete widget")}
												>
													{deletingWidgetId === d.id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<Trash2 className="h-4 w-4" />
													)}
												</Button>
											</div>
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
										</div>
									))}
								</>
							)}
						</div>
					</div>
				) : (
					<div className="min-w-0">
						{activeTab === "share" && (
							<ShareEmbedSection
								embedScript={getEmbedScript()}
								organizationId={organizationId}
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
						{activeTab === "pageBuilder" && (
							<PageLayoutBuilderSection />
						)}
					</div>
				)}
			</main>
			{showRightPropertiesPanel && (
				<WidgetBuilderPropertiesPanel />
			)}
		</>
	);
}

export default function IntegrationsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: organization, isLoading } = useCurrentOrganization();
	const deleteWidgetDefinition = useDeleteWidgetDefinition();

	const [activeTab, setActiveTab] = useState<TabValue>("design");
	const widgetDesigner = useWidgetDesigner();
	const effectiveWidgetId = widgetDesigner?.currentWidgetId;

	const handleTabChange = useCallback(
		(tab: TabValue) => {
			const requiresWidget = tab === "share" || tab === "pageBuilder";
			if (requiresWidget && !effectiveWidgetId) return;
			setActiveTab(tab);
		},
		[effectiveWidgetId],
	);

	// If widget is deselected while on a widget-required tab, reset to design
	const prevWidgetIdRef = useRef(effectiveWidgetId);
	if (prevWidgetIdRef.current !== effectiveWidgetId) {
		prevWidgetIdRef.current = effectiveWidgetId;
		if (
			!effectiveWidgetId &&
			(activeTab === "share" || activeTab === "pageBuilder")
		) {
			setActiveTab("design");
		}
	}

	const definitions = widgetDesigner?.definitions ?? [];
	const widgetBelongsToOrg = definitions.some(
		(d) => d.id === effectiveWidgetId,
	);

	const handleDeleteWidget = useCallback(
		async (widgetId: string) => {
			if (!organization?.id) return;
			try {
				await deleteWidgetDefinition.mutateAsync({
					organizationId: organization.id,
					widgetId,
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
		[organization?.id, effectiveWidgetId, deleteWidgetDefinition, navigate, t],
	);

	const getEmbedScript = useCallback(() => {
		if (!organization) return "";
		const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
		const widgetLoaderUrl = window.location.origin + "/widget-loader.js";
		const appUrl = window.location.origin;
		let script = `<script src="${widgetLoaderUrl}" data-org-id="${organization.id}" data-api-url="${apiUrl}"`;
		if (effectiveWidgetId) {
			script += ` data-widget-id="${effectiveWidgetId}" data-app-url="${appUrl}" data-embed-mode="inline"`;
		}
		script += `></script>`;
		return script;
	}, [organization, effectiveWidgetId]);

	const showBuilder = Boolean(effectiveWidgetId) && activeTab === "design";
	const showPropertiesPanel = showBuilder;

	if (isLoading) {
		return (
			<div className="h-[calc(100dvh-3.5rem)] md:h-screen bg-background flex items-center justify-center overflow-hidden">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="h-[calc(100dvh-3.5rem)] md:h-screen bg-background flex flex-col overflow-hidden">
			{!effectiveWidgetId && <IntegrationsHeader />}

			{effectiveWidgetId && (
				<IntegrationsWidgetNavBar
					activeTab={activeTab}
					onTabChange={handleTabChange}
					hasWidgetSelected={Boolean(effectiveWidgetId)}
					selectedWidgetId={effectiveWidgetId}
					onWidgetChange={widgetDesigner?.onWidgetChange ?? (() => {})}
					widgetDefinitions={definitions.map((d) => ({
						id: d.id,
						name: d.name,
					}))}
					loadingDefinitions={widgetDesigner?.isLoadingDefinitions ?? false}
				/>
			)}

			<WidgetBuilderProvider
				effectiveWidgetId={effectiveWidgetId}
				organizationId={organization?.id}
				widgetBelongsToOrg={widgetBelongsToOrg}
				onDeleteWidget={handleDeleteWidget}
			>
				<div className="flex flex-1 min-h-0 w-full overflow-hidden">
					<DesignAreaContent
						showBuilder={showBuilder}
						showPropertiesPanel={showPropertiesPanel}
						activeTab={activeTab}
						effectiveWidgetId={effectiveWidgetId}
						organizationId={organization?.id ?? ""}
						getEmbedScript={getEmbedScript}
						onDeleteWidget={handleDeleteWidget}
					/>
				</div>
			</WidgetBuilderProvider>
		</div>
	);
}
