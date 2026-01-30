import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, FileText, MessageSquare, Receipt, GripVertical, Trash2 } from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { WIDGET_TEMPLATES } from "@/core/widget-templates";
import type { BlockType, WidgetBlock, WidgetBlockSchema } from "@/core/entities/widget-block-schema";
import { cn } from "@/lib/utils";

const DROP_LINE_CLASS =
	"list-none h-0.5 rounded-full bg-primary mx-1 my-0.5 flex-shrink-0 min-w-0";

interface BlockOrderItemProps {
	block: WidgetBlock;
	index: number;
	selectedBlockId?: string | null;
	dropTargetIndex: number | null;
	onDragOver: (index: number, half: "top" | "bottom") => void;
	onDragLeave: () => void;
	onSelect: () => void;
	onRemove: () => void;
	onReorder: (fromIndex: number, toIndex: number) => void;
}

function BlockOrderItem({
	block,
	index,
	selectedBlockId,
	dropTargetIndex,
	onDragOver,
	onDragLeave,
	onSelect,
	onRemove,
	onReorder,
}: BlockOrderItemProps) {
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(index));
		e.dataTransfer.setData("application/x-block-index", String(index));
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		const rect = e.currentTarget.getBoundingClientRect();
		const half = e.clientY - rect.top < rect.height / 2 ? "top" : "bottom";
		onDragOver(index, half);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const fromIndex = Number(e.dataTransfer.getData("application/x-block-index"));
		if (Number.isNaN(fromIndex)) return;
		if (dropTargetIndex === null) return;
		const toIndex =
			fromIndex < dropTargetIndex ? dropTargetIndex - 1 : dropTargetIndex;
		if (fromIndex !== toIndex) {
			onReorder(fromIndex, toIndex);
		}
		onDragLeave();
	};

	return (
		<li
			className={cn(
				"flex items-center gap-1 rounded border p-1.5 text-left text-sm transition-colors",
				selectedBlockId === block.id
					? "border-primary bg-primary/5"
					: "border-transparent bg-background hover:bg-muted/50"
			)}
			onDragOver={handleDragOver}
			onDragLeave={onDragLeave}
			onDrop={handleDrop}
		>
			<div
				draggable
				onDragStart={handleDragStart}
				className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded touch-none"
				aria-label="Drag to reorder"
			>
				<GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
			</div>
			<button
				type="button"
				className="flex-1 min-w-0 truncate text-left py-0.5"
				onClick={onSelect}
			>
				{block.type}
				{"label" in block.props && typeof block.props.label === "string"
					? ` — ${block.props.label}`
					: ""}
			</button>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6 shrink-0"
				onClick={onRemove}
				aria-label="Remove block"
			>
				<Trash2 className="h-3.5 w-3.5 text-destructive" />
			</Button>
		</li>
	);
}

interface BlockOrderListProps {
	schema: WidgetBlockSchema;
	selectedBlockId?: string | null;
	onSelectBlock: (id: string) => void;
	onRemoveBlock: (id: string) => void;
	onReorderBlocks: (fromIndex: number, toIndex: number) => void;
}

function BlockOrderList({
	schema,
	selectedBlockId,
	onSelectBlock,
	onRemoveBlock,
	onReorderBlocks,
}: BlockOrderListProps) {
	const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

	return (
		<div
			className="shrink-0 border-t p-3"
			onDragLeave={() => setDropTargetIndex(null)}
		>
			<p className="text-xs font-medium text-muted-foreground mb-2">Block order</p>
			<ul className="space-y-1">
				{schema.map((block, index) => (
					<Fragment key={block.id}>
						{dropTargetIndex === index && (
							<li className={DROP_LINE_CLASS} aria-hidden />
						)}
						<BlockOrderItem
							block={block}
							index={index}
							selectedBlockId={selectedBlockId}
							dropTargetIndex={dropTargetIndex}
							onDragOver={(idx, half) =>
								setDropTargetIndex(half === "top" ? idx : idx + 1)
							}
							onDragLeave={() => setDropTargetIndex(null)}
							onSelect={() => onSelectBlock(block.id)}
							onRemove={() => onRemoveBlock(block.id)}
							onReorder={onReorderBlocks}
						/>
					</Fragment>
				))}
				{dropTargetIndex === schema.length && (
					<li className={DROP_LINE_CLASS} aria-hidden />
				)}
			</ul>
		</div>
	);
}

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
		types: [{ type: "paragraph", label: "Paragraph", defaultProps: { content: "Text here" } }],
	},
	{
		label: "Inputs",
		types: [
			{ type: "inputText", label: "Text", defaultProps: { label: "Label", fieldKey: "field1", required: false } },
			{ type: "email", label: "Email", defaultProps: { label: "Email", fieldKey: "email", required: true } },
			{ type: "phone", label: "Phone", defaultProps: { label: "Phone", fieldKey: "phone", required: false } },
			{ type: "textarea", label: "Textarea", defaultProps: { label: "Message", fieldKey: "message", required: false } },
			{ type: "select", label: "Select", defaultProps: { label: "Select", fieldKey: "select1", options: ["Option 1"] } },
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

export interface WidgetSidebarProps {
	onAddBlock?: (type: BlockType, defaultProps: Record<string, unknown>) => void;
	schema?: WidgetBlockSchema;
	selectedBlockId?: string | null;
	onSelectBlock?: (id: string) => void;
	onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
	onRemoveBlock?: (id: string) => void;
	onDeleteWidget?: (widgetId: string) => void;
}

export function WidgetSidebar({
	onAddBlock,
	schema = [],
	selectedBlockId,
	onSelectBlock,
	onReorderBlocks,
	onRemoveBlock,
	onDeleteWidget,
}: WidgetSidebarProps) {
	const ctx = useWidgetDesigner();
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

	if (!ctx) {
		return null;
	}

	const {
		definitions,
		currentWidgetId,
		currentDefinition,
		onWidgetChange,
		onCreateNewWidget,
		onCreateFromTemplate,
		isLoadingDefinitions,
	} = ctx;

	const handleCreateFromTemplate = async (template: (typeof WIDGET_TEMPLATES)[number]) => {
		await onCreateFromTemplate({
			id: template.id,
			name: template.name,
			schema: template.schema,
			actions: template.actions,
		});
		setTemplateDialogOpen(false);
	};

	if (isLoadingDefinitions) {
		return (
			<div className="flex h-full w-64 items-center justify-center border-r bg-muted/30 p-4">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full w-64 flex-col border-r bg-muted/30 overflow-y-auto">
			<div className="shrink-0 space-y-2 p-3">
				<div className="flex gap-2">
					<Button
						size="sm"
						className="flex-1"
						onClick={() => void onCreateNewWidget()}
					>
						<Plus className="h-4 w-4 mr-1" />
						New
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="flex-1"
						onClick={() => setTemplateDialogOpen(true)}
					>
						Template
					</Button>
				</div>
				<p className="text-xs font-medium text-muted-foreground">Widgets</p>
			</div>
			<ul className="min-h-0 flex-1 space-y-1 px-2 pb-2">
				{definitions.map((d) => (
					<li key={d.id}>
						<div
							className={cn(
								"flex items-center gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
								currentWidgetId === d.id
									? "border-primary bg-primary/10 text-foreground"
									: "border-transparent hover:bg-muted/50"
							)}
						>
							<button
								type="button"
								onClick={() => onWidgetChange(d.id)}
								className="flex-1 min-w-0 text-left"
							>
								<span className="font-medium truncate block">{d.name}</span>
								<span className="text-xs text-muted-foreground">{d.status === "published" ? "Active" : "Draft"}</span>
							</button>
							{onDeleteWidget && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										if (window.confirm("Delete this widget? This cannot be undone.")) {
											onDeleteWidget(d.id);
										}
									}}
									className="shrink-0 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
									aria-label="Delete widget"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					</li>
				))}
			</ul>
			{currentWidgetId && currentDefinition && schema.length > 0 && onSelectBlock && onReorderBlocks && onRemoveBlock && (
				<BlockOrderList
					schema={schema}
					selectedBlockId={selectedBlockId}
					onSelectBlock={onSelectBlock}
					onRemoveBlock={onRemoveBlock}
					onReorderBlocks={onReorderBlocks}
				/>
			)}
			{currentWidgetId && currentDefinition && onAddBlock && (
				<div className="shrink-0 border-t p-3">
					<p className="text-xs font-medium text-muted-foreground mb-2">Blocks</p>
					<div className="space-y-3">
						{BLOCK_GROUPS.map((group) => (
							<div key={group.label}>
								<p className="text-xs font-semibold mb-1">{group.label}</p>
								<div className="space-y-0.5">
									{group.types.map(({ type, label, defaultProps }) => (
										<button
											key={type}
											type="button"
											className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted"
											onClick={() => onAddBlock(type, defaultProps)}
										>
											{label}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
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
								onClick={() => void handleCreateFromTemplate(t)}
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
		</div>
	);
}
