import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, GripVertical, Trash2, ArrowLeft, FileText, MessageSquare, Receipt } from "lucide-react";
import { toast } from "sonner";
import { functionsService } from "@/services/functions/functions-service";
import { WIDGET_TEMPLATES } from "@/core/widget-templates";
import { buildDefaultWidgetPageConfig } from "@/utils/widget-page-config-defaults";
import type {
	WidgetBlockSchema,
	WidgetBlock,
	WidgetPage,
	WidgetVersionActions,
	BlockType,
} from "@/core/entities/widget-block-schema";

const BLOCK_GROUPS: {
	label: string;
	types: { type: BlockType; label: string; defaultProps: Record<string, unknown> }[];
}[] = [
	{
		label: "Layout",
		types: [
			{ type: "sectionHeader", label: "Section header", defaultProps: { title: "Title", description: "" } },
			{ type: "container", label: "Container", defaultProps: {} },
			{ type: "card", label: "Card", defaultProps: {} },
			{ type: "columns", label: "Columns", defaultProps: { columns: 2 } },
			{ type: "divider", label: "Divider", defaultProps: {} },
			{ type: "spacer", label: "Spacer", defaultProps: {} },
		],
	},
	{
		label: "Content",
		types: [
			{ type: "paragraph", label: "Paragraph", defaultProps: { content: "Text here" } },
		],
	},
	{
		label: "Inputs",
		types: [
			{ type: "inputText", label: "Text", defaultProps: { label: "Label", fieldKey: "field1", required: false } },
			{ type: "email", label: "Email", defaultProps: { label: "Email", fieldKey: "email", required: true } },
			{ type: "phone", label: "Phone", defaultProps: { label: "Phone", fieldKey: "phone", required: false } },
			{ type: "textarea", label: "Textarea", defaultProps: { label: "Message", fieldKey: "message", required: false } },
			{ type: "file", label: "File upload", defaultProps: { label: "Upload file", fieldKey: "file1", required: false } },
			{
				type: "select",
				label: "Select",
				defaultProps: {
					label: "Select",
					fieldKey: "select1",
					options: [{ label: "Option 1", value: "option_1" }],
				},
			},
			{ type: "checkbox", label: "Checkbox", defaultProps: { label: "Check", fieldKey: "check1" } },
			{ type: "date", label: "Date", defaultProps: { label: "Date", fieldKey: "date1", required: false } },
		],
	},
	{
		label: "Actions",
		types: [
			{ type: "submitButton", label: "Submit button", defaultProps: { label: "Submit" } },
			{ type: "successBlock", label: "Success block", defaultProps: { message: "Thank you!", redirectUrl: "" } },
		],
	},
];

function generateBlockId(): string {
	return `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_ACTIONS: WidgetVersionActions = {
	createLead: { enabled: true, tags: [] },
	success: { message: "Thank you!" },
};

export default function WidgetBuilderPage() {
	const { widgetId } = useParams<{ widgetId?: string }>();
	const navigate = useNavigate();
	const { data: organization, isLoading: orgLoading } = useCurrentOrganization();
	const [schema, setSchema] = useState<WidgetBlockSchema>([]);
	const [actions, setActions] = useState<WidgetVersionActions>(DEFAULT_ACTIONS);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [definitions, setDefinitions] = useState<
		Array<{ id: string; name: string; status: string }>
	>([]);
	const [creating, setCreating] = useState(false);
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const [versions, setVersions] = useState<
		Array<{ id: string; versionNumber: number; createdAt?: string }>
	>([]);
	const [publishing, setPublishing] = useState(false);
	const [definitionStatus, setDefinitionStatus] = useState<string | null>(null);
	const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);

	useEffect(() => {
		if (!organization?.id) return;
		if (!widgetId) {
			functionsService
				.listWidgetDefinitions({ organizationId: organization.id })
				.then((r) => setDefinitions(r.definitions))
				.catch(() => toast.error("Failed to load widgets"))
				.finally(() => setLoading(false));
			return;
		}
		setLoading(true);
		functionsService
			.getModularWidgetDraft({
				organizationId: organization.id,
				widgetId,
			})
			.then((r) => {
				const pages = r.version?.pages as WidgetPage[] | undefined;
				if (Array.isArray(pages) && pages.length > 0 && pages[0].fields) {
					setSchema(pages[0].fields);
				}
				if (r.version?.actions && typeof r.version.actions === "object") {
					setActions(r.version.actions as WidgetVersionActions);
				}
				setDefinitionStatus(r.definition?.status ?? null);
				setPublishedVersionId(r.definition?.publishedVersionId ?? null);
			})
			.catch(() => toast.error("Failed to load widget"))
			.finally(() => setLoading(false));
	}, [organization?.id, widgetId]);

	useEffect(() => {
		if (!organization?.id || !widgetId) return;
		functionsService
			.listModularWidgetVersions({ organizationId: organization.id, widgetId })
			.then((r) => setVersions(r.versions))
			.catch(() => {});
	}, [organization?.id, widgetId]);

	const addBlock = (type: BlockType, defaultProps: Record<string, unknown>) => {
		const block: WidgetBlock = {
			id: generateBlockId(),
			type,
			props: defaultProps,
		};
		setSchema((prev) => [...prev, block]);
		setSelectedId(block.id);
	};

	const removeBlock = (id: string) => {
		setSchema((prev) => prev.filter((b) => b.id !== id));
		if (selectedId === id) setSelectedId(null);
	};

	const moveBlock = (index: number, direction: "up" | "down") => {
		const next = index + (direction === "up" ? -1 : 1);
		if (next < 0 || next >= schema.length) return;
		const copy = [...schema];
		[copy[index], copy[next]] = [copy[next], copy[index]];
		setSchema(copy);
	};

	const updateBlockProps = (id: string, props: Record<string, unknown>) => {
		setSchema((prev) =>
			prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b))
		);
	};

	const selectedBlock = schema.find((b) => b.id === selectedId);

	const handleSave = async () => {
		if (!organization?.id || !widgetId) return;
		setSaving(true);
		try {
			const pages: WidgetPage[] = [
				{ id: "page-1", name: "Page 1", fields: schema },
			];
			const r = await functionsService.saveModularWidgetVersion({
				organizationId: organization.id,
				widgetId,
				pages,
				actions,
			});
			toast.success("Draft saved");
			setVersions((prev) => [
				{ id: r.versionId, versionNumber: r.versionNumber, createdAt: new Date().toISOString() },
				...prev,
			]);
		} catch {
			toast.error("Failed to save");
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async (versionId: string) => {
		if (!organization?.id || !widgetId) return;
		setPublishing(true);
		try {
			await functionsService.publishModularWidget({
				organizationId: organization.id,
				widgetId,
				versionId,
			});
			setDefinitionStatus("published");
			setPublishedVersionId(versionId);
			toast.success("Widget published");
		} catch {
			toast.error("Failed to publish");
		} finally {
			setPublishing(false);
		}
	};

	const handleCreateNew = async () => {
		if (!organization?.id) return;
		setCreating(true);
		try {
			const widgetName = "New widget";
			const r = await functionsService.createWidgetDefinition({
				organizationId: organization.id,
				name: widgetName,
			});
			try {
				await functionsService.updateWidgetDefinition({
					organizationId: organization.id,
					widgetId: r.widgetId,
					pageConfig: buildDefaultWidgetPageConfig(widgetName, {
						primaryColor: organization?.settings?.brandColors?.primary,
					}),
				});
			} catch {
				// Non-blocking: builder hook will hydrate defaults on first load if this call fails.
			}
			navigate(`/integrations/widget-builder/${r.widgetId}`);
		} catch {
			toast.error("Failed to create widget");
		} finally {
			setCreating(false);
		}
	};

	const handleCreateFromTemplate = async (
		template: (typeof WIDGET_TEMPLATES)[number]
	) => {
		if (!organization?.id) return;
		setCreating(true);
		setTemplateDialogOpen(false);
		try {
			const r = await functionsService.createWidgetDefinition({
				organizationId: organization.id,
				name: template.name,
			});
			try {
				await functionsService.updateWidgetDefinition({
					organizationId: organization.id,
					widgetId: r.widgetId,
					pageConfig: buildDefaultWidgetPageConfig(template.name, {
						primaryColor: organization?.settings?.brandColors?.primary,
					}),
				});
			} catch {
				// Non-blocking: builder hook will hydrate defaults on first load if this call fails.
			}
			await functionsService.saveModularWidgetVersion({
				organizationId: organization.id,
				widgetId: r.widgetId,
				pages: template.pages,
				actions: template.actions,
			});
			navigate(`/integrations/widget-builder/${r.widgetId}`);
		} catch {
			toast.error("Failed to create widget from template");
		} finally {
			setCreating(false);
		}
	};

	if (orgLoading || !organization) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!widgetId) {
		return (
			<div className="container max-w-2xl py-8">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-semibold">Modular widgets</h1>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => setTemplateDialogOpen(true)}
							disabled={creating}
						>
							From template
						</Button>
						<Button onClick={handleCreateNew} disabled={creating}>
							{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
							New widget
						</Button>
					</div>
				</div>
				<Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create from template</DialogTitle>
						</DialogHeader>
						<div className="grid gap-2 py-2">
							{WIDGET_TEMPLATES.map((t) => (
								<Button
									key={t.id}
									variant="outline"
									className="justify-start h-auto py-3"
									onClick={() => handleCreateFromTemplate(t)}
									disabled={creating}
								>
									{t.id === "contact" && <MessageSquare className="h-4 w-4 mr-2" />}
									{t.id === "quote" && <FileText className="h-4 w-4 mr-2" />}
									{t.id === "invoice" && <Receipt className="h-4 w-4 mr-2" />}
									{t.name}
								</Button>
							))}
						</div>
					</DialogContent>
				</Dialog>
				{loading ? (
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				) : definitions.length === 0 ? (
					<Card>
						<CardContent className="pt-6">
							<p className="text-muted-foreground mb-4">No widgets yet. Create one to get started.</p>
							<Button onClick={handleCreateNew} disabled={creating}>
								Create widget
							</Button>
						</CardContent>
					</Card>
				) : (
					<ul className="space-y-2">
						{definitions.map((d) => (
							<li key={d.id}>
								<Card
									className="cursor-pointer hover:bg-muted/50"
									onClick={() => navigate(`/integrations/widget-builder/${d.id}`)}
								>
									<CardContent className="py-3 flex items-center justify-between">
										<span className="font-medium">{d.name}</span>
										<span className="text-xs text-muted-foreground">{d.status}</span>
									</CardContent>
								</Card>
							</li>
						))}
					</ul>
				)}
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-4rem)]">
			<div className="w-56 border-r bg-muted/30 p-3 overflow-y-auto">
				<Button
					variant="ghost"
					size="sm"
					className="mb-3"
					onClick={() => navigate("/integrations/widget-builder")}
				>
					<ArrowLeft className="h-4 w-4 mr-1" /> Back
				</Button>
				<p className="text-xs font-medium text-muted-foreground mb-2">Blocks</p>
				{BLOCK_GROUPS.map((group) => (
					<div key={group.label} className="mb-4">
						<p className="text-xs font-semibold mb-1">{group.label}</p>
						<div className="space-y-1">
							{group.types.map(({ type, label, defaultProps }) => (
								<button
									key={type}
									type="button"
									className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted"
									onClick={() => addBlock(type, defaultProps)}
								>
									{label}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="flex-1 p-4 overflow-y-auto border-r">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Canvas</h2>
					<div className="flex items-center gap-2">
						{definitionStatus === "published" && (
							<span className="text-xs text-muted-foreground">Published</span>
						)}
						<Button onClick={handleSave} disabled={saving}>
							{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
							Save draft
						</Button>
					</div>
				</div>
				{versions.length > 0 && (
					<div className="mb-4 rounded-lg border bg-muted/30 p-3">
						<p className="text-xs font-medium text-muted-foreground mb-2">Versions</p>
						<ul className="space-y-1 max-h-32 overflow-y-auto">
							{versions.map((v) => (
								<li key={v.id} className="flex items-center justify-between text-sm">
									<span>v{v.versionNumber}</span>
									{v.id === publishedVersionId && (
										<span className="text-xs text-primary">Published</span>
									)}
									{v.id !== publishedVersionId && (
										<Button
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() => handlePublish(v.id)}
											disabled={publishing}
										>
											Publish
										</Button>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
				<div className="space-y-2 min-h-[200px] rounded-lg border bg-card p-4">
					{schema.length === 0 ? (
						<p className="text-sm text-muted-foreground">Click a block on the left to add it.</p>
					) : (
						schema.map((block, index) => (
							<div
								key={block.id}
								className={`flex items-center gap-2 rounded border p-2 ${
									selectedId === block.id ? "border-primary bg-primary/5" : "bg-background"
								}`}
							>
								<div className="flex flex-col gap-0">
									<button
										type="button"
										className="p-0.5 hover:bg-muted rounded"
										onClick={() => moveBlock(index, "up")}
										disabled={index === 0}
									>
										<GripVertical className="h-4 w-4 rotate-90" />
									</button>
									<button
										type="button"
										className="p-0.5 hover:bg-muted rounded"
										onClick={() => moveBlock(index, "down")}
										disabled={index === schema.length - 1}
									>
										<GripVertical className="h-4 w-4 -rotate-90" />
									</button>
								</div>
								<button
									type="button"
									className="flex-1 text-left text-sm py-1"
									onClick={() => setSelectedId(block.id)}
								>
									{block.type}{" "}
									{"label" in block.props && typeof block.props.label === "string"
										? `— ${block.props.label}`
										: ""}
								</button>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									onClick={() => removeBlock(block.id)}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
						))
					)}
				</div>
			</div>
			<div className="w-80 p-4 overflow-y-auto bg-muted/20">
				<h3 className="text-sm font-semibold mb-3">Properties</h3>
				{!selectedBlock ? (
					<p className="text-xs text-muted-foreground">Select a block to edit its properties.</p>
				) : (
					<div className="space-y-3">
						<div>
							<Label className="text-xs">Type</Label>
							<p className="text-sm font-medium">{selectedBlock.type}</p>
						</div>
						{selectedBlock.type === "sectionHeader" && (
							<>
								<div>
									<Label className="text-xs">Title</Label>
									<Input
										className="mt-1"
										value={(selectedBlock.props as { title?: string }).title ?? ""}
										onChange={(e) =>
											updateBlockProps(selectedBlock.id, { title: e.target.value })
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Description</Label>
									<Input
										className="mt-1"
										value={(selectedBlock.props as { description?: string }).description ?? ""}
										onChange={(e) =>
											updateBlockProps(selectedBlock.id, { description: e.target.value })
										}
									/>
								</div>
							</>
						)}
						{selectedBlock.type === "paragraph" && (
							<div>
								<Label className="text-xs">Content</Label>
								<Input
									className="mt-1"
									value={(selectedBlock.props as { content?: string }).content ?? ""}
									onChange={(e) =>
										updateBlockProps(selectedBlock.id, { content: e.target.value })
									}
								/>
							</div>
						)}
						{["inputText", "email", "phone", "textarea", "select", "checkbox", "date", "submitButton"].includes(selectedBlock.type) && (
							<>
								<div>
									<Label className="text-xs">Label</Label>
									<Input
										className="mt-1"
										value={(selectedBlock.props as { label?: string }).label ?? ""}
										onChange={(e) =>
											updateBlockProps(selectedBlock.id, { label: e.target.value })
										}
									/>
								</div>
								{selectedBlock.type !== "submitButton" && (
									<>
										<div>
											<Label className="text-xs">Field key</Label>
											<Input
												className="mt-1"
												value={(selectedBlock.props as { fieldKey?: string }).fieldKey ?? ""}
												onChange={(e) =>
													updateBlockProps(selectedBlock.id, { fieldKey: e.target.value })
												}
											/>
										</div>
										<div>
											<Label className="text-xs">Placeholder</Label>
											<Input
												className="mt-1"
												value={(selectedBlock.props as { placeholder?: string }).placeholder ?? ""}
												onChange={(e) =>
													updateBlockProps(selectedBlock.id, { placeholder: e.target.value })
												}
											/>
										</div>
									</>
								)}
							</>
						)}
						{selectedBlock.type === "successBlock" && (
							<>
								<div>
									<Label className="text-xs">Message</Label>
									<Input
										className="mt-1"
										value={(selectedBlock.props as { message?: string }).message ?? ""}
										onChange={(e) =>
											updateBlockProps(selectedBlock.id, { message: e.target.value })
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Redirect URL</Label>
									<Input
										className="mt-1"
										value={(selectedBlock.props as { redirectUrl?: string }).redirectUrl ?? ""}
										onChange={(e) =>
											updateBlockProps(selectedBlock.id, { redirectUrl: e.target.value })
										}
										placeholder="https://..."
									/>
								</div>
							</>
						)}
						{selectedBlock.type === "inputText" ||
						selectedBlock.type === "email" ||
						selectedBlock.type === "phone" ||
						selectedBlock.type === "textarea" ||
						selectedBlock.type === "select" ||
						selectedBlock.type === "date" ? (
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="required"
									checked={(selectedBlock.props as { required?: boolean }).required ?? false}
									onChange={(e) =>
										updateBlockProps(selectedBlock.id, { required: e.target.checked })
									}
								/>
								<Label htmlFor="required" className="text-xs">Required</Label>
							</div>
						) : null}
						{selectedBlock.type === "select" && (
							<div>
								<Label className="text-xs">Options (one per line)</Label>
								<textarea
									className="mt-1 w-full min-h-[80px] rounded-md border px-3 py-2 text-sm"
									value={((selectedBlock.props as { options?: string[] }).options ?? []).join("\n")}
									onChange={(e) =>
										updateBlockProps(selectedBlock.id, {
											options: e.target.value.split("\n").filter(Boolean),
										})
									}
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
