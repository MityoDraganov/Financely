import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { functionsService } from "@/services/functions/functions-service";
import type {
	WidgetBlockSchema,
	WidgetBlock,
	WidgetVersionActions,
} from "@/core/entities/widget-block-schema";
import type { BlockType } from "@/core/entities/widget-block-schema";
import { projectId } from "@/infrastructure/firebase";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type { WidgetStyling } from "@/components/site-builder/widget-types";
import {
	IntegrationsHeader,
	IntegrationsTabs,
	ShareEmbedSection,
	AutomationsSection,
	WidgetSidebar,
	type TabValue,
} from "@/components/integrations";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function IntegrationsPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: organization, isLoading } = useCurrentOrganization();

	// Tab state
	const [activeTab, setActiveTab] = useState<TabValue>("design");
	const { widgetId: currentWidgetId } = useParams<{ widgetId?: string }>();
	const widgetDesigner = useWidgetDesigner();
	const effectiveWidgetId =
		widgetDesigner?.currentWidgetId ?? currentWidgetId;

	// Modular builder state (when a widget is selected)
	const [builderSchema, setBuilderSchema] = useState<WidgetBlockSchema>([]);
	const [builderActions, setBuilderActions] = useState<WidgetVersionActions>({
		createLead: { enabled: true, tags: [] },
		success: { message: "Thank you!" },
	});
	const [builderSelectedId, setBuilderSelectedId] = useState<string | null>(
		null,
	);
	const [builderLoading, setBuilderLoading] = useState(false);
	const [builderSaving, setBuilderSaving] = useState(false);
	const [builderPublishing, setBuilderPublishing] = useState(false);
	const [builderUnpublishing, setBuilderUnpublishing] = useState(false);
	const [builderDefinitionStatus, setBuilderDefinitionStatus] = useState<
		string | null
	>(null);
	const [widgetName, setWidgetName] = useState("");
	const [widgetNameSaving, setWidgetNameSaving] = useState(false);

	// Load modular widget draft when a widget is selected
	useEffect(() => {
		if (!organization?.id || !effectiveWidgetId) {
			setBuilderSchema([]);
			setBuilderSelectedId(null);
			return;
		}
		setBuilderLoading(true);
		functionsService
			.getModularWidgetDraft({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
			})
			.then((r) => {
				if (r.version?.schema && Array.isArray(r.version.schema)) {
					setBuilderSchema(r.version.schema as WidgetBlockSchema);
				}
				if (
					r.version?.actions &&
					typeof r.version.actions === "object"
				) {
					setBuilderActions(
						r.version.actions as WidgetVersionActions,
					);
				}
				setBuilderDefinitionStatus(r.definition?.status ?? null);
			})
			.catch(() => toast.error("Failed to load widget"))
			.finally(() => setBuilderLoading(false));
	}, [organization?.id, effectiveWidgetId]);

	// Sync editable widget name from current definition
	useEffect(() => {
		setWidgetName(widgetDesigner?.currentDefinition?.name ?? "");
	}, [
		widgetDesigner?.currentDefinition?.id,
		widgetDesigner?.currentDefinition?.name,
	]);

	const handleWidgetNameBlur = useCallback(async () => {
		const trimmed = widgetName.trim();
		if (!organization?.id || !effectiveWidgetId || !trimmed) return;
		if (trimmed === widgetDesigner?.currentDefinition?.name) return;
		setWidgetNameSaving(true);
		try {
			await functionsService.updateWidgetDefinition({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
				name: trimmed,
			});
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organization.id],
			});
			toast.success(t("siteBuilder.toasts.widgetSaved", "Widget saved"));
		} catch {
			toast.error(
				t(
					"siteBuilder.toasts.errors.saveWidgetFailed",
					"Failed to save",
				),
			);
			setWidgetName(widgetDesigner?.currentDefinition?.name ?? "");
		} finally {
			setWidgetNameSaving(false);
		}
	}, [
		organization?.id,
		effectiveWidgetId,
		widgetName,
		widgetDesigner?.currentDefinition?.name,
		queryClient,
		t,
	]);

	const generateBlockId = () =>
		`block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

	const builderAddBlock = useCallback(
		(type: BlockType, defaultProps: Record<string, unknown>) => {
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
			};
			setBuilderSchema((prev) => [...prev, block]);
			setBuilderSelectedId(block.id);
		},
		[],
	);

	const builderRemoveBlock = useCallback(
		(id: string) => {
			setBuilderSchema((prev) => prev.filter((b) => b.id !== id));
			if (builderSelectedId === id) setBuilderSelectedId(null);
		},
		[builderSelectedId],
	);

	const builderReorderBlocks = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex) return;
			const copy = [...builderSchema];
			const [item] = copy.splice(fromIndex, 1);
			copy.splice(toIndex, 0, item);
			setBuilderSchema(copy);
		},
		[builderSchema],
	);

	const builderUpdateBlockProps = useCallback(
		(id: string, props: Record<string, unknown>) => {
			setBuilderSchema((prev) =>
				prev.map((b) =>
					b.id === id ? { ...b, props: { ...b.props, ...props } } : b,
				),
			);
		},
		[],
	);

	const builderSelectedBlock = builderSchema.find(
		(b) => b.id === builderSelectedId,
	);

	const builderHandleSave = useCallback(async () => {
		if (!organization?.id || !effectiveWidgetId) return;
		setBuilderSaving(true);
		try {
			await functionsService.saveModularWidgetVersion({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
				schema: builderSchema,
				actions: builderActions,
			});
			toast.success("Draft saved");
		} catch {
			toast.error("Failed to save");
		} finally {
			setBuilderSaving(false);
		}
	}, [organization?.id, effectiveWidgetId, builderSchema, builderActions]);

	const builderHandlePublish = useCallback(async () => {
		if (!organization?.id || !effectiveWidgetId) return;
		setBuilderPublishing(true);
		try {
			const r = await functionsService.saveModularWidgetVersion({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
				schema: builderSchema,
				actions: builderActions,
			});
			await functionsService.publishModularWidget({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
				versionId: r.versionId,
			});
			setBuilderDefinitionStatus("published");
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organization.id],
			});
			toast.success("Widget published");
		} catch {
			toast.error("Failed to publish");
		} finally {
			setBuilderPublishing(false);
		}
	}, [
		organization?.id,
		effectiveWidgetId,
		builderSchema,
		builderActions,
		queryClient,
	]);

	const builderHandleUnpublish = useCallback(async () => {
		if (!organization?.id || !effectiveWidgetId) return;
		setBuilderUnpublishing(true);
		try {
			await functionsService.unpublishModularWidget({
				organizationId: organization.id,
				widgetId: effectiveWidgetId,
			});
			setBuilderDefinitionStatus("draft");
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organization.id],
			});
			toast.success("Widget set to draft");
		} catch {
			toast.error("Failed to set to draft");
		} finally {
			setBuilderUnpublishing(false);
		}
	}, [organization?.id, effectiveWidgetId, queryClient]);

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

	// Generate embed script
	const getEmbedScript = () => {
		if (!organization) return "";
		const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
		const widgetLoaderUrl = window.location.origin + "/widget-loader.js";
		return `<script src="${widgetLoaderUrl}" data-org-id="${organization.id}" data-api-url="${apiUrl}"></script>`;
	};

	const showBuilder = Boolean(effectiveWidgetId) && activeTab === "design";
	const showPropertiesPanel = showBuilder;

	const builderPreviewStyling: Partial<WidgetStyling> = useMemo(() => {
		const brand = organization?.settings?.brandColors;
		return {
			primaryColor: brand?.primary ?? "#166534",
			secondaryColor: brand?.secondary ?? "#6b7280",
			backgroundColor: "#ffffff",
			textColor: "#111827",
			borderColor: "#d1d5db",
			errorColor: "#ef4444",
			successColor: brand?.accent ?? "#166534",
			fontFamily: "system-ui, sans-serif",
			fontSize: "14px",
			borderRadius: "8px",
			buttonPadding: "12px 24px",
			buttonBorderRadius: "8px",
		};
	}, [organization?.settings?.brandColors]);

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

			<ResizablePanelGroup
				direction="horizontal"
				className="flex-1 min-h-0"
			>
				<ResizablePanel
					defaultSize={16}
					minSize={12}
					maxSize={24}
					className="shrink-0"
				>
					<WidgetSidebar
						onAddBlock={
							effectiveWidgetId ? builderAddBlock : undefined
						}
						schema={showBuilder ? builderSchema : []}
						selectedBlockId={builderSelectedId}
						onSelectBlock={(id) => setBuilderSelectedId(id)}
						onReorderBlocks={builderReorderBlocks}
						onRemoveBlock={builderRemoveBlock}
						onDeleteWidget={handleDeleteWidget}
					/>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel
					defaultSize={showPropertiesPanel ? 60 : 84}
					minSize={40}
				>
					<main className="h-full overflow-y-auto mx-auto max-w-[1400px] px-6 py-8">
						{showBuilder ? (
							builderLoading ? (
								<div className="flex items-center justify-center min-h-[300px]">
									<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
								</div>
							) : (
								<div className="space-y-4">
									<div className="flex items-center justify-between gap-4">
										<Input
											value={widgetName}
											onChange={(e) =>
												setWidgetName(e.target.value)
											}
											onBlur={handleWidgetNameBlur}
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
											disabled={widgetNameSaving}
											className="max-w-[240px] font-semibold text-lg h-9"
										/>
										<div className="flex items-center gap-2">
											<div className="flex gap-2">
												{builderDefinitionStatus ===
												"published" ? (
													<Button
														variant="outline"
														onClick={() =>
															void builderHandleUnpublish()
														}
														disabled={
															builderUnpublishing
														}
													>
														{builderUnpublishing ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : null}
														Make draft
													</Button>
												) : (
													<Button
														onClick={() =>
															void builderHandlePublish()
														}
														variant="outline"
														disabled={
															builderPublishing
														}
													>
														{builderPublishing ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : null}
														Publish
													</Button>
												)}
												<Button
													onClick={() =>
														void builderHandleSave()
													}
													disabled={builderSaving}
												>
													{builderSaving ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : null}
													Save
												</Button>
											</div>
										</div>
									</div>

									<div className="min-h-[200px] rounded-lg border bg-card p-6">
										{builderSchema.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												Add blocks from the left to
												build your widget.
											</p>
										) : (
											<div className="max-w-md mx-auto">
												<WidgetSchemaRenderer
													schema={builderSchema}
													actions={builderActions}
													styling={
														builderPreviewStyling
													}
													onSubmit={async () => {}}
												/>
											</div>
										)}
									</div>
								</div>
							)
						) : activeTab === "design" && !effectiveWidgetId ? (
							<div className="flex flex-col items-center justify-center py-16 text-center">
								<Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
								<h2 className="text-xl font-semibold text-foreground mb-2">
									{t(
										"siteBuilder.widgets.selectOrCreate",
										"Select or create a widget",
									)}
								</h2>
								<p className="text-sm text-muted-foreground max-w-md">
									{t(
										"siteBuilder.widgets.selectOrCreateDesc",
										"Choose a widget from the list or create one from a template.",
									)}
								</p>
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
				</ResizablePanel>
				{showPropertiesPanel && (
					<>
						<ResizableHandle withHandle />
						<ResizablePanel
							defaultSize={24}
							minSize={20}
							maxSize={40}
						>
							<div className="h-full overflow-y-auto border-l bg-muted/20 p-4">
								<h3 className="text-sm font-semibold mb-3">
									Properties
								</h3>
								{!builderSelectedBlock ? (
									<p className="text-xs text-muted-foreground">
										Select a block to edit its properties.
									</p>
								) : (
									<div className="space-y-3">
										<div>
											<Label className="text-xs">
												Type
											</Label>
											<p className="text-sm font-medium">
												{builderSelectedBlock.type}
											</p>
										</div>
										{builderSelectedBlock.type ===
											"sectionHeader" && (
											<>
												<div>
													<Label className="text-xs">
														Title
													</Label>
													<Input
														className="mt-1"
														value={
															(
																builderSelectedBlock.props as {
																	title?: string;
																}
															).title ?? ""
														}
														onChange={(e) =>
															builderUpdateBlockProps(
																builderSelectedBlock.id,
																{
																	title: e
																		.target
																		.value,
																},
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">
														Description
													</Label>
													<Input
														className="mt-1"
														value={
															(
																builderSelectedBlock.props as {
																	description?: string;
																}
															).description ?? ""
														}
														onChange={(e) =>
															builderUpdateBlockProps(
																builderSelectedBlock.id,
																{
																	description:
																		e.target
																			.value,
																},
															)
														}
													/>
												</div>
											</>
										)}
										{builderSelectedBlock.type ===
											"paragraph" && (
											<div>
												<Label className="text-xs">
													Content
												</Label>
												<Input
													className="mt-1"
													value={
														(
															builderSelectedBlock.props as {
																content?: string;
															}
														).content ?? ""
													}
													onChange={(e) =>
														builderUpdateBlockProps(
															builderSelectedBlock.id,
															{
																content:
																	e.target
																		.value,
															},
														)
													}
												/>
											</div>
										)}
										{[
											"inputText",
											"email",
											"phone",
											"textarea",
											"select",
											"checkbox",
											"date",
											"submitButton",
										].includes(
											builderSelectedBlock.type,
										) && (
											<>
												<div>
													<Label className="text-xs">
														Label
													</Label>
													<Input
														className="mt-1"
														value={
															(
																builderSelectedBlock.props as {
																	label?: string;
																}
															).label ?? ""
														}
														onChange={(e) =>
															builderUpdateBlockProps(
																builderSelectedBlock.id,
																{
																	label: e
																		.target
																		.value,
																},
															)
														}
													/>
												</div>
												{builderSelectedBlock.type !==
													"submitButton" && (
													<>
														<div>
															<Label className="text-xs">
																Field key
															</Label>
															<Input
																className="mt-1"
																value={
																	(
																		builderSelectedBlock.props as {
																			fieldKey?: string;
																		}
																	)
																		.fieldKey ??
																	""
																}
																onChange={(e) =>
																	builderUpdateBlockProps(
																		builderSelectedBlock.id,
																		{
																			fieldKey:
																				e
																					.target
																					.value,
																		},
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">
																Placeholder
															</Label>
															<Input
																className="mt-1"
																value={
																	(
																		builderSelectedBlock.props as {
																			placeholder?: string;
																		}
																	)
																		.placeholder ??
																	""
																}
																onChange={(e) =>
																	builderUpdateBlockProps(
																		builderSelectedBlock.id,
																		{
																			placeholder:
																				e
																					.target
																					.value,
																		},
																	)
																}
															/>
														</div>
													</>
												)}
											</>
										)}
										{builderSelectedBlock.type ===
											"successBlock" && (
											<>
												<div>
													<Label className="text-xs">
														Message
													</Label>
													<Input
														className="mt-1"
														value={
															(
																builderSelectedBlock.props as {
																	message?: string;
																}
															).message ?? ""
														}
														onChange={(e) =>
															builderUpdateBlockProps(
																builderSelectedBlock.id,
																{
																	message:
																		e.target
																			.value,
																},
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">
														Redirect URL
													</Label>
													<Input
														className="mt-1"
														value={
															(
																builderSelectedBlock.props as {
																	redirectUrl?: string;
																}
															).redirectUrl ?? ""
														}
														onChange={(e) =>
															builderUpdateBlockProps(
																builderSelectedBlock.id,
																{
																	redirectUrl:
																		e.target
																			.value,
																},
															)
														}
														placeholder="https://..."
													/>
												</div>
											</>
										)}
										{[
											"inputText",
											"email",
											"phone",
											"textarea",
											"select",
											"date",
										].includes(
											builderSelectedBlock.type,
										) && (
											<div className="flex items-center gap-2">
												<input
													type="checkbox"
													id="builder-required"
													checked={
														(
															builderSelectedBlock.props as {
																required?: boolean;
															}
														).required ?? false
													}
													onChange={(e) =>
														builderUpdateBlockProps(
															builderSelectedBlock.id,
															{
																required:
																	e.target
																		.checked,
															},
														)
													}
												/>
												<Label
													htmlFor="builder-required"
													className="text-xs"
												>
													Required
												</Label>
											</div>
										)}
										{builderSelectedBlock.type ===
											"select" && (
											<div>
												<Label className="text-xs">
													Options (one per line)
												</Label>
												<Textarea
													className="mt-1 min-h-[80px]"
													value={(
														(
															builderSelectedBlock.props as {
																options?: string[];
															}
														).options ?? []
													).join("\n")}
													onChange={(
														e: React.ChangeEvent<HTMLTextAreaElement>,
													) =>
														builderUpdateBlockProps(
															builderSelectedBlock.id,
															{
																options:
																	e.target.value
																		.split(
																			"\n",
																		)
																		.filter(
																			Boolean,
																		),
															},
														)
													}
												/>
											</div>
										)}
									</div>
								)}
							</div>
						</ResizablePanel>
					</>
				)}
			</ResizablePanelGroup>
		</div>
	);
}
