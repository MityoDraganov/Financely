import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, MessageSquare, Receipt, GripVertical, Trash2, Plus, Search, Copy, ChevronUp, ChevronDown } from "lucide-react";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
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
	onDuplicateBlock?: (index: number) => void;
	onOpenAddBlockPicker?: (index: number) => void;
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
	onDuplicateBlock,
	onOpenAddBlockPicker,
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

	const blockRow = (
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
				className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded touch-none shrink-0"
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

	if (!onDuplicateBlock && !onOpenAddBlockPicker) return blockRow;

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				{blockRow}
			</ContextMenuTrigger>
			<ContextMenuContent className="min-w-40">
				{onDuplicateBlock && (
					<ContextMenuItem onSelect={() => onDuplicateBlock(index)}>
						<Copy className="h-4 w-4" />
						Duplicate
					</ContextMenuItem>
				)}
				{(onDuplicateBlock || onOpenAddBlockPicker) && <ContextMenuSeparator />}
				{onOpenAddBlockPicker && (
					<>
						<ContextMenuItem onSelect={() => onOpenAddBlockPicker(index)}>
							<ChevronUp className="h-4 w-4" />
							Add block before
						</ContextMenuItem>
						<ContextMenuItem onSelect={() => onOpenAddBlockPicker(index + 1)}>
							<ChevronDown className="h-4 w-4" />
							Add block after
						</ContextMenuItem>
					</>
				)}
				<ContextMenuSeparator />
				<ContextMenuItem variant="destructive" onSelect={onRemove}>
					<Trash2 className="h-4 w-4" />
					Remove
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

interface BlockOrderListProps {
	schema: WidgetBlockSchema;
	selectedBlockId?: string | null;
	onSelectBlock: (id: string) => void;
	onRemoveBlock: (id: string) => void;
	onReorderBlocks: (fromIndex: number, toIndex: number) => void;
	onAddBlock?: (type: BlockType, defaultProps: Record<string, unknown>) => void;
	onAddBlockAt?: (index: number, type: BlockType, defaultProps: Record<string, unknown>) => void;
	onOpenAddBlockPicker?: (index: number) => void;
	onDuplicateBlock?: (index: number) => void;
}

function BlockOrderList({
	schema,
	selectedBlockId,
	onSelectBlock,
	onRemoveBlock,
	onReorderBlocks,
	onAddBlock,
	onAddBlockAt,
	onOpenAddBlockPicker,
	onDuplicateBlock,
}: BlockOrderListProps) {
	const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
	const canAdd = (onAddBlock ?? onAddBlockAt) && onOpenAddBlockPicker;

	return (
		<div
			className="shrink-0 border-t p-3"
			onDragLeave={() => setDropTargetIndex(null)}
		>
			<p className="text-xs font-medium text-muted-foreground mb-2">Block order</p>
			<ul className="space-y-1">
				{schema.map((block, index) => (
					<Fragment key={block.id}>
						{canAdd && (
							<li className="flex items-center justify-center py-0.5">
								<AddBlockSlot
									insertIndex={index}
									onOpenAddBlockPicker={onOpenAddBlockPicker!}
								/>
							</li>
						)}
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
							onDuplicateBlock={onDuplicateBlock}
							onOpenAddBlockPicker={onOpenAddBlockPicker}
						/>
					</Fragment>
				))}
				{canAdd && (
					<li className="flex items-center justify-center py-0.5">
						<AddBlockSlot
							insertIndex={schema.length}
							onOpenAddBlockPicker={onOpenAddBlockPicker!}
						/>
					</li>
				)}
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

function AddBlockSlot({
	insertIndex,
	onOpenAddBlockPicker,
}: {
	insertIndex: number;
	onOpenAddBlockPicker: (index: number) => void;
}) {
	return (
		<button
			type="button"
			className="flex items-center justify-center w-full py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
			aria-label="Add block here"
			onClick={() => onOpenAddBlockPicker(insertIndex)}
		>
			<Plus className="h-3.5 w-3.5" />
		</button>
	);
}

export function WidgetSidebar() {
	const ctx = useWidgetDesigner();
	const builder = useWidgetBuilderContext();
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const [addBlockPickerOpen, setAddBlockPickerOpen] = useState(false);
	const [addBlockInsertIndex, setAddBlockInsertIndex] = useState<number | null>(null);
	const [addBlockSearchQuery, setAddBlockSearchQuery] = useState("");

	const schema = builder?.schema ?? [];
	const selectedBlockId = builder?.selectedBlockId ?? null;
	const onSelectBlock = builder ? (id: string) => builder.setSelectedBlockId(id) : undefined;
	const onReorderBlocks = builder?.reorderBlocks;
	const onRemoveBlock = builder?.removeBlock;
	const onAddBlock = builder?.addBlock;
	const onAddBlockAt = builder?.addBlockAt;
	const onDuplicateBlock = builder?.duplicateBlock;
	const openAddBlockPicker = (index: number) => {
		setAddBlockInsertIndex(index);
		setAddBlockSearchQuery("");
		setAddBlockPickerOpen(true);
	};

	const handleAddBlockSelect = (type: BlockType, defaultProps: Record<string, unknown>) => {
		if (addBlockInsertIndex !== null && onAddBlockAt) {
			onAddBlockAt(addBlockInsertIndex, type, defaultProps);
		} else if (onAddBlock) {
			onAddBlock(type, defaultProps);
		}
		setAddBlockInsertIndex(null);
		setAddBlockPickerOpen(false);
	};

	const addBlockQ = addBlockSearchQuery.trim().toLowerCase();
	const addBlockFilteredGroups = addBlockQ
		? BLOCK_GROUPS.map((group) => ({
				...group,
				types: group.types.filter(
					(t) =>
						t.label.toLowerCase().includes(addBlockQ) ||
						t.type.toLowerCase().includes(addBlockQ),
				),
			}))
				.filter((g) => g.types.length > 0)
		: BLOCK_GROUPS;

	if (!ctx) {
		return null;
	}

	const {
		currentWidgetId,
		currentDefinition,
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
			<div className="flex h-full w-48 sm:w-52 md:w-56 items-center justify-center border-r bg-muted/30 p-4 shrink-0">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full w-48 sm:w-52 md:w-56 flex-col border-r bg-muted/30 overflow-y-auto shrink-0">
			{currentWidgetId && currentDefinition && (onAddBlock || onAddBlockAt) && onSelectBlock && onReorderBlocks && onRemoveBlock && (
				<BlockOrderList
					schema={schema}
					selectedBlockId={selectedBlockId}
					onSelectBlock={onSelectBlock}
					onRemoveBlock={onRemoveBlock}
					onReorderBlocks={onReorderBlocks}
					onAddBlock={onAddBlock}
					onAddBlockAt={onAddBlockAt}
					onOpenAddBlockPicker={openAddBlockPicker}
					onDuplicateBlock={onDuplicateBlock}
				/>
			)}
			<Dialog
				open={addBlockPickerOpen}
				onOpenChange={(open) => !open && (setAddBlockPickerOpen(false), setAddBlockInsertIndex(null))}
			>
				<DialogContent className="max-h-[85vh] overflow-hidden flex flex-col p-0 w-64">
					<div className="p-2 border-b shrink-0">
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								placeholder="Search blocks..."
								value={addBlockSearchQuery}
								onChange={(e) => setAddBlockSearchQuery(e.target.value)}
								className="h-8 pl-8 text-sm"
							/>
						</div>
					</div>
					<div className="overflow-y-auto p-1 min-h-0">
						{addBlockFilteredGroups.length === 0 ? (
							<p className="text-xs text-muted-foreground py-4 text-center">No blocks match</p>
						) : (
							addBlockFilteredGroups.map((group, groupIndex) => (
								<Fragment key={group.label}>
									{groupIndex > 0 && (
										<div className="bg-border -mx-1 my-1 h-px" />
									)}
									<p className="text-xs font-medium text-muted-foreground px-2 py-1.5">{group.label}</p>
									{group.types.map(({ type, label, defaultProps }) => (
										<button
											key={type}
											type="button"
											className="w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none"
											onClick={() => handleAddBlockSelect(type, defaultProps)}
										>
											{label}
										</button>
									))}
								</Fragment>
							))
						)}
					</div>
				</DialogContent>
			</Dialog>
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
