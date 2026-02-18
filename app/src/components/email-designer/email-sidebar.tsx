import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Text,
	MousePointerClick,
	Minus,
	ScanLine,
	ImageIcon,
	GripVertical,
	Mail,
	FileText,
	Image,
	Menu,
	AlignLeft,
	Share2,
	Link2,
	Columns3,
	Container,
	Copy,
	Trash2,
	Code2,
	Sparkles,
	Table,
	Database,
} from "lucide-react";
import { EmailTemplate, EmailTemplateBlock, EmailSection } from "@/core";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type BlockType = EmailTemplateBlock["type"];

type EmailSidebarProps = {
	templates: EmailTemplate[];
	currentTemplate: EmailTemplate | undefined;
	onCreateNewTemplate: () => void;
	isCreating?: boolean;
	onAddBlock: (type: BlockType, section: EmailSection) => void;
	onOpenAIBuilder?: () => void;
	blocks?: EmailTemplateBlock[];
	selectedBlockId?: string;
	onSelectBlock?: (blockId: string) => void;
	onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
	onReorderStart?: () => void;
	onReorderEnd?: () => void;
	onDuplicateBlock?: (blockId: string) => void;
	onDeleteBlock?: (blockId: string) => void;
	currentSection?: EmailSection;
	onSectionChange?: (section: EmailSection) => void;
};

// Define which blocks can be used in which sections
const getBlocksForSection = (section: EmailSection): { type: BlockType; icon: React.ComponentType<{ className?: string }>; label: string }[] => {
	const allBlocks = [
		{ type: "subject" as const, icon: Mail, label: "Subject", sections: ["header"] as EmailSection[] },
		{ type: "preheader" as const, icon: FileText, label: "Preheader", sections: ["header"] as EmailSection[] },
		{ type: "logo" as const, icon: Image, label: "Logo", sections: ["header"] as EmailSection[] },
		{ type: "navigation" as const, icon: Menu, label: "Navigation", sections: ["header"] as EmailSection[] },
		{ type: "container" as const, icon: Container, label: "Container", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "columns" as const, icon: Columns3, label: "Columns", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "text" as const, icon: Text, label: "Text", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "button" as const, icon: MousePointerClick, label: "Button", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "divider" as const, icon: Minus, label: "Divider", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "spacer" as const, icon: ScanLine, label: "Spacer", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "image" as const, icon: ImageIcon, label: "Image", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "table" as const, icon: Table, label: "Table", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "rawHtml" as const, icon: Code2, label: "Custom HTML", sections: ["header", "body", "footer"] as EmailSection[] },
		{ type: "footerText" as const, icon: AlignLeft, label: "Footer Text", sections: ["footer"] as EmailSection[] },
		{ type: "socialLinks" as const, icon: Share2, label: "Social Links", sections: ["footer"] as EmailSection[] },
		{ type: "unsubscribe" as const, icon: Link2, label: "Unsubscribe", sections: ["footer"] as EmailSection[] },
	];
	
	return allBlocks
		.filter(block => block.sections.includes(section))
		.map((block) => ({
			type: block.type,
			icon: block.icon,
			label: block.label,
		}));
};

const getBlockIcon = (type: EmailTemplateBlock["type"]) => {
	switch (type) {
		case "subject":
			return Mail;
		case "preheader":
			return FileText;
		case "logo":
			return Image;
		case "navigation":
			return Menu;
		case "text":
			return Text;
		case "button":
			return MousePointerClick;
		case "divider":
			return Minus;
		case "spacer":
			return ScanLine;
		case "image":
			return ImageIcon;
		case "footerText":
			return AlignLeft;
		case "socialLinks":
			return Share2;
		case "unsubscribe":
			return Link2;
		case "columns":
			return Columns3;
		case "container":
			return Container;
		case "table":
			return Table;
		default:
			return Text;
	}
};

const createDynamicTokenRegex = () => /\{\{([A-Za-z0-9_-]+)\}\}/g;

const summarizeTextWithDynamicTokens = (value: string | undefined, maxLength = 34): string => {
	if (!value) return "";
	const normalized = value
		.replace(createDynamicTokenRegex(), "[$1]")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
};

const extractDynamicKeysFromText = (value?: string): string[] => {
	if (!value) return [];
	const keys: string[] = [];
	const seen = new Set<string>();
	for (const match of value.matchAll(createDynamicTokenRegex())) {
		const key = match[1];
		if (!seen.has(key)) {
			seen.add(key);
			keys.push(key);
		}
	}
	return keys;
};

const extractDynamicKeysFromBlock = (block: EmailTemplateBlock): string[] => {
	const keys = new Set<string>();

	const pushKeys = (values: Array<string | undefined>) => {
		values.forEach((value) => {
			extractDynamicKeysFromText(value).forEach((key) => keys.add(key));
		});
	};

	const walk = (target: EmailTemplateBlock) => {
		switch (target.type) {
			case "subject":
			case "preheader":
			case "text":
			case "footerText":
				pushKeys([target.content]);
				break;
			case "button":
				pushKeys([target.label, target.url]);
				break;
			case "navigation":
				target.links?.forEach((link) => pushKeys([link.label, link.url]));
				break;
			case "unsubscribe":
				pushKeys([target.text, target.url]);
				break;
			case "columns":
				target.columns?.forEach((col) => col.blocks?.forEach(walk));
				break;
			case "container":
				target.blocks?.forEach(walk);
				break;
			default:
				break;
		}
	};

	walk(block);
	return Array.from(keys);
};

const getBlockLabel = (block: EmailTemplateBlock, t: (key: string) => string): string => {
	if (block.type === "subject") {
		const subjectBlock = block as Extract<EmailTemplateBlock, { type: "subject" }>;
		return summarizeTextWithDynamicTokens(subjectBlock.content) || t("emailDesigner.blocks.subject");
	}
	if (block.type === "preheader") {
		const preheaderBlock = block as Extract<EmailTemplateBlock, { type: "preheader" }>;
		return summarizeTextWithDynamicTokens(preheaderBlock.content) || t("emailDesigner.blocks.preheader");
	}
	if (block.type === "logo") {
		return t("emailDesigner.blocks.logo");
	}
	if (block.type === "navigation") {
		const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
		return navBlock.links && navBlock.links.length > 0 
			? `${navBlock.links.length} ${t("emailDesigner.blocks.navigation")}`
			: t("emailDesigner.blocks.navigation");
	}
	if (block.type === "text") {
		const textBlock = block as Extract<EmailTemplateBlock, { type: "text" }>;
		return summarizeTextWithDynamicTokens(textBlock.content) || t("emailDesigner.blocks.text");
	}
	if (block.type === "button") {
		const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
		return summarizeTextWithDynamicTokens(buttonBlock.label) || t("emailDesigner.blocks.button");
	}
	if (block.type === "footerText") {
		const footerBlock = block as Extract<EmailTemplateBlock, { type: "footerText" }>;
		return summarizeTextWithDynamicTokens(footerBlock.content) || t("emailDesigner.blocks.footerText");
	}
	if (block.type === "socialLinks") {
		const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
		return socialBlock.links && socialBlock.links.length > 0
			? `${socialBlock.links.length} ${t("emailDesigner.blocks.socialLinks")}`
			: t("emailDesigner.blocks.socialLinks");
	}
	if (block.type === "unsubscribe") {
		const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
		return summarizeTextWithDynamicTokens(unsubscribeBlock.text) || t("emailDesigner.blocks.unsubscribe");
	}
	return t(`emailDesigner.blocks.${block.type}` as const);
};

export function EmailSidebar({
	onAddBlock,
	onOpenAIBuilder,
	blocks = [],
	selectedBlockId,
	onSelectBlock,
	onReorderBlocks,
	onReorderStart,
	onReorderEnd,
	onDuplicateBlock,
	onDeleteBlock,
	currentSection = "body",
	onSectionChange,
}: EmailSidebarProps) {
	const { t } = useTranslation();
	const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragIndexRef = useRef<number | null>(null);
	const lastReorderRef = useRef<{ from: number; to: number } | null>(null);
	const reorderActiveRef = useRef(false);
	const blocksContainerRef = useRef<HTMLDivElement | null>(null);
	const sectionSelectorRef = useRef<HTMLDivElement | null>(null);
	const [shouldUseColumnLayout, setShouldUseColumnLayout] = useState(false);
	const [blockQuery, setBlockQuery] = useState("");

	// Check if buttons can fit in a row
	useEffect(() => {
		const checkLayout = () => {
			if (!sectionSelectorRef.current) return;
			const container = sectionSelectorRef.current;
			const buttons = container.querySelectorAll("button");
			if (buttons.length === 0) return;
			
			// Get container width (accounting for padding: 8px on each side = 16px total)
			const containerWidth = container.offsetWidth - 16;
			
			// Estimate minimum width needed per button (text + padding)
			// Each button needs roughly 60-70px minimum
			const minButtonWidth = 60;
			const gapWidth = 8; // 2 gaps between 3 buttons = 8px
			const totalNeeded = (minButtonWidth * 3) + gapWidth;
			
			// If container is narrower than needed, use column layout
			setShouldUseColumnLayout(containerWidth < totalNeeded);
		};

		// Initial check
		checkLayout();
		
		// Observe container resize
		const resizeObserver = new ResizeObserver(checkLayout);
		if (sectionSelectorRef.current) {
			resizeObserver.observe(sectionSelectorRef.current);
		}

		return () => {
			resizeObserver.disconnect();
		};
	}, []);
	
	// Filter blocks by current section (default to "body" if section is missing)
	const sectionBlocks = blocks.filter(block => (block.section || "body") === currentSection);
	const availableBlocks = getBlocksForSection(currentSection);
	const filteredAvailableBlocks = useMemo(() => {
		const query = blockQuery.trim().toLowerCase();
		if (!query) return availableBlocks;
		return availableBlocks.filter((block) => block.label.toLowerCase().includes(query));
	}, [availableBlocks, blockQuery]);

	// Helper to count nested blocks
	const countNestedBlocks = (block: EmailTemplateBlock): number => {
		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			return colsBlock.columns?.reduce((sum, col) => sum + (col.blocks?.length || 0), 0) || 0;
		}
		if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			return containerBlock.blocks?.length || 0;
		}
		return 0;
	};

	// Helper to check if any nested block (recursively) is selected
	const hasSelectedNestedBlock = (block: EmailTemplateBlock, selectedId: string | undefined): boolean => {
		if (!selectedId) return false;
		
		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			return colsBlock.columns?.some(col => 
				col.blocks?.some(nested => 
					nested.id === selectedId || hasSelectedNestedBlock(nested, selectedId)
				)
			) || false;
		}
		
		if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			return containerBlock.blocks?.some(nested => 
				nested.id === selectedId || hasSelectedNestedBlock(nested, selectedId)
			) || false;
		}
		
		return false;
	};

	const handleDragStart = (e: React.DragEvent, blockId: string, index: number) => {
		setDraggedBlockId(blockId);
		dragIndexRef.current = index;
		lastReorderRef.current = null;
		if (!reorderActiveRef.current) {
			reorderActiveRef.current = true;
			onReorderStart?.();
		}
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", blockId);
		e.dataTransfer.setData("application/json", JSON.stringify({ blockId, index }));
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		
		if (dragIndexRef.current === null || !onReorderBlocks) return;
		
		const dragIndex = dragIndexRef.current;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const mouseY = e.clientY;
		const elementCenterY = rect.top + rect.height / 2;
		
		// Determine if we should insert above or below this element
		let targetIndex = index;
		if (mouseY < elementCenterY) {
			// Dragging above the center - insert before this element
			targetIndex = index;
		} else {
			// Dragging below the center - insert after this element
			targetIndex = index + 1;
		}
		
		// Adjust for the removed item when dragging forward
		const adjustedTargetIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;
		
		// Only reorder if position actually changed and we haven't already done this reorder
		if (
			dragIndex !== adjustedTargetIndex &&
			(lastReorderRef.current === null ||
				lastReorderRef.current.from !== dragIndex ||
				lastReorderRef.current.to !== adjustedTargetIndex)
		) {
			lastReorderRef.current = { from: dragIndex, to: adjustedTargetIndex };
			onReorderBlocks(dragIndex, adjustedTargetIndex);
			// Update the drag index ref since the blocks have been reordered
			dragIndexRef.current = adjustedTargetIndex;
		}
		
		setDragOverIndex(index);
	};

	const handleDragLeave = () => {
		// Don't clear dragOverIndex here - it causes flickering
		// We'll clear it when drag ends or drops
	};

	const handleContainerDragOver = (e: React.DragEvent) => {
		if (dragIndexRef.current === null || !onReorderBlocks || !blocksContainerRef.current) return;
		
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		
		const containerRect = blocksContainerRef.current.getBoundingClientRect();
		const mouseY = e.clientY;
		const dragIndex = dragIndexRef.current;
		
		// Check if dragging above the first element
		if (mouseY < containerRect.top + 20) {
			if (dragIndex !== 0) {
				onReorderBlocks(dragIndex, 0);
				dragIndexRef.current = 0;
				lastReorderRef.current = { from: dragIndex, to: 0 };
			}
			setDragOverIndex(-1); // Special value for "above first"
			return;
		}
		
		// Check if dragging below the last element
		if (mouseY > containerRect.bottom - 20) {
			const sectionBlockIds = sectionBlocks.map(b => b.id);
			const lastSectionIndex = sectionBlocks.length - 1;
			if (lastSectionIndex >= 0) {
				const lastBlockId = sectionBlockIds[lastSectionIndex];
				const lastIndex = blocks.findIndex(b => b.id === lastBlockId);
				if (dragIndex !== lastIndex && lastIndex >= 0) {
					const targetIndex = dragIndex < lastIndex ? lastIndex : lastIndex + 1;
					onReorderBlocks(dragIndex, targetIndex);
					dragIndexRef.current = lastIndex;
					lastReorderRef.current = { from: dragIndex, to: targetIndex };
				}
			}
			setDragOverIndex(sectionBlocks.length); // Special value for "below last"
			return;
		}
	};

	const finishDrag = () => {
		setDraggedBlockId(null);
		setDragOverIndex(null);
		dragIndexRef.current = null;
		lastReorderRef.current = null;
		if (reorderActiveRef.current) {
			reorderActiveRef.current = false;
			onReorderEnd?.();
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		finishDrag();
	};

	const handleDragEnd = () => {
		finishDrag();
	};

	return (
		<div className="h-full flex flex-col bg-muted/20 border-r border-border/70 overflow-hidden">
			{/* Section Selector - Fixed at top */}
			{onSectionChange && (
				<div className="p-3 border-b border-border/70 shrink-0 bg-background/80">
					<div 
						ref={sectionSelectorRef}
						className={cn(
							"grid gap-1 rounded-lg border border-border/70 bg-muted/40 p-1",
							shouldUseColumnLayout ? "grid-cols-1" : "grid-cols-3"
						)}
					>
						<Button
							variant={currentSection === "header" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"text-sm h-8 px-2",
								currentSection === "header" && "shadow-sm"
							)}
							onClick={() => onSectionChange("header")}
						>
							{t("emailDesigner.sections.header")}
						</Button>
						<Button
							variant={currentSection === "body" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"text-sm h-8 px-2",
								currentSection === "body" && "shadow-sm"
							)}
							onClick={() => onSectionChange("body")}
						>
							{t("emailDesigner.sections.body")}
						</Button>
						<Button
							variant={currentSection === "footer" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"text-sm h-8 px-2",
								currentSection === "footer" && "shadow-sm"
							)}
							onClick={() => onSectionChange("footer")}
						>
							{t("emailDesigner.sections.footer")}
						</Button>
					</div>
				</div>
			)}

			{/* Scrollable Content Area */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{/* Current Blocks Section */}
				<div className="p-3 border-b border-border/70 shrink-0 bg-background/70">
					<h3 className="text-sm font-semibold text-foreground">
						{t("emailDesigner.blocks.currentBlocks")} ({sectionBlocks.length})
					</h3>
				</div>
				<div
					ref={blocksContainerRef}
					className="p-2.5 flex flex-col gap-1.5"
					onDragOver={handleContainerDragOver}
					onDrop={handleDrop}
				>
					{/* Drop indicator above first element */}
					{dragOverIndex === -1 && draggedBlockId && (
						<div className="h-0.5 bg-primary rounded-full mb-1 animate-pulse" />
					)}
					{sectionBlocks.length === 0 && (
						<div className="rounded-lg border border-dashed border-border/70 bg-background/70 px-3 py-8 text-center text-xs text-muted-foreground">
							No blocks in this section yet.
						</div>
					)}
							{sectionBlocks.map((block, index) => {
								const actualIndex = blocks.findIndex(b => b.id === block.id);
								const Icon = getBlockIcon(block.type);
								const isSelected = block.id === selectedBlockId;
								const isDragging = draggedBlockId === block.id;
								const isDragOver = dragOverIndex === index;
								const nestedCount = countNestedBlocks(block);
								const dynamicKeys = extractDynamicKeysFromBlock(block);
								const hasNested = nestedCount > 0;
								// Expand if this block is selected OR if any of its nested children are selected
								const isExpanded = hasNested && (isSelected || hasSelectedNestedBlock(block, selectedBlockId));

								return (
									<div key={block.id} className="relative">
										{/* Drop indicator above */}
										{isDragOver && !isDragging && (
											<div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-primary rounded-full z-10" />
										)}
										<ContextMenu>
											<ContextMenuTrigger asChild>
												<div
													draggable
													onDragStart={(e) => handleDragStart(e, block.id, actualIndex)}
													onDragOver={(e) => handleDragOver(e, actualIndex)}
													onDragLeave={handleDragLeave}
													onDrop={handleDrop}
													onDragEnd={handleDragEnd}
													className={cn(
														"flex items-center gap-1 rounded-lg border transition-all cursor-move relative group shadow-sm",
														isSelected
															? "border-primary/60 bg-primary/10"
															: "border-border/70 hover:border-primary/40 bg-background",
														isDragging && "opacity-50",
														isDragOver && !isDragging && "border-primary/80 bg-primary/5"
													)}
												>
													<button
														type="button"
														onClick={() => onSelectBlock?.(block.id)}
														className="flex-1 flex items-center gap-2.5 px-2.5 py-2 text-left min-w-0"
													>
														<GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing opacity-60 group-hover:opacity-100 transition-opacity" />
														<Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
														<span className="text-sm truncate flex-1">
															{getBlockLabel(block, t)}
														</span>
														{dynamicKeys.length > 0 && (
															<span
																className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 shrink-0"
																title={
																	dynamicKeys.length > 1
																		? `${dynamicKeys.length} dynamic sources`
																		: `Dynamic source: ${dynamicKeys[0]}`
																}
															>
																<Database className="h-2.5 w-2.5" />
																{dynamicKeys[0]}
																{dynamicKeys.length > 1 && ` +${dynamicKeys.length - 1}`}
															</span>
														)}
														{hasNested && !isExpanded && (
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="shrink-0 text-xs text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted/70 cursor-default">
																		+{nestedCount}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	<p>
																		{nestedCount === 1 
																			? t("emailDesigner.sidebar.nestedBlockSingular")
																			: t("emailDesigner.sidebar.nestedBlocksPlural", { count: nestedCount })
																		}
																	</p>
																</TooltipContent>
															</Tooltip>
														)}
													</button>
												</div>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem onClick={() => onSelectBlock?.(block.id)}>
													{t("emailDesigner.sidebar.select")}
												</ContextMenuItem>
												<ContextMenuSeparator />
												{onDuplicateBlock && (
													<ContextMenuItem onClick={() => onDuplicateBlock(block.id)}>
														<Copy className="mr-2 h-4 w-4" />
														{t("emailDesigner.sidebar.duplicate")}
													</ContextMenuItem>
												)}
												{onDuplicateBlock && <ContextMenuSeparator />}
												{onDeleteBlock && (
													<ContextMenuItem 
														onClick={() => onDeleteBlock(block.id)} 
														variant="destructive"
													>
														<Trash2 className="mr-2 h-4 w-4" />
														{t("emailDesigner.sidebar.delete")}
													</ContextMenuItem>
												)}
											</ContextMenuContent>
										</ContextMenu>
										
										{/* Nested blocks */}
										{isExpanded && hasNested && (
											<div className="ml-4 mt-1 space-y-1 border-l-2 border-border/70 pl-2.5">
												{block.type === "columns" && (block as Extract<EmailTemplateBlock, { type: "columns" }>).columns?.map((column, colIdx) => (
													<div key={column.id} className="space-y-1">
														<div className="text-xs font-medium text-muted-foreground px-2 py-0.5">
															{t("emailDesigner.sidebar.column")} {colIdx + 1} ({column.blocks?.length || 0})
														</div>
														{column.blocks?.map((nestedBlock) => {
															const NestedIcon = getBlockIcon(nestedBlock.type);
															const isNestedSelected = nestedBlock.id === selectedBlockId;
															const nestedDynamicKeys = extractDynamicKeysFromBlock(nestedBlock);
															return (
																<ContextMenu key={nestedBlock.id}>
																	<ContextMenuTrigger asChild>
																		<button
																			type="button"
																			onClick={() => onSelectBlock?.(nestedBlock.id)}
																			className={cn(
																				"w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-all text-xs shadow-sm",
																				isNestedSelected
																					? "border-primary/60 bg-primary/10"
																					: "border-border/70 hover:border-primary/40 bg-background/85"
																			)}
																		>
																			<NestedIcon className="h-3 w-3 text-muted-foreground shrink-0" />
																			<span className="truncate flex-1">
																				{getBlockLabel(nestedBlock, t)}
																			</span>
																			{nestedDynamicKeys.length > 0 && (
																				<span
																					className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 shrink-0"
																					title={
																						nestedDynamicKeys.length > 1
																							? `${nestedDynamicKeys.length} dynamic sources`
																							: `Dynamic source: ${nestedDynamicKeys[0]}`
																					}
																				>
																					<Database className="h-2.5 w-2.5" />
																					{nestedDynamicKeys[0]}
																				</span>
																			)}
																		</button>
																	</ContextMenuTrigger>
																	<ContextMenuContent>
																		<ContextMenuItem onClick={() => onSelectBlock?.(nestedBlock.id)}>
																			{t("emailDesigner.sidebar.select")}
																		</ContextMenuItem>
																		<ContextMenuSeparator />
																		{onDuplicateBlock && (
																			<ContextMenuItem onClick={() => onDuplicateBlock(nestedBlock.id)}>
																				<Copy className="mr-2 h-4 w-4" />
																				{t("emailDesigner.sidebar.duplicate")}
																			</ContextMenuItem>
																		)}
																		{onDuplicateBlock && <ContextMenuSeparator />}
																		{onDeleteBlock && (
																			<ContextMenuItem 
																				onClick={() => onDeleteBlock(nestedBlock.id)} 
																				variant="destructive"
																			>
																				<Trash2 className="mr-2 h-4 w-4" />
																				{t("emailDesigner.sidebar.delete")}
																			</ContextMenuItem>
																		)}
																	</ContextMenuContent>
																</ContextMenu>
															);
														})}
													</div>
												))}
												{block.type === "container" && (block as Extract<EmailTemplateBlock, { type: "container" }>).blocks?.map((nestedBlock) => {
													const NestedIcon = getBlockIcon(nestedBlock.type);
													const isNestedSelected = nestedBlock.id === selectedBlockId;
													const nestedDynamicKeys = extractDynamicKeysFromBlock(nestedBlock);
													return (
														<ContextMenu key={nestedBlock.id}>
															<ContextMenuTrigger asChild>
																<button
																	type="button"
																	onClick={() => onSelectBlock?.(nestedBlock.id)}
																	className={cn(
																		"w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-all text-xs shadow-sm",
																		isNestedSelected
																			? "border-primary/60 bg-primary/10"
																			: "border-border/70 hover:border-primary/40 bg-background/85"
																	)}
																>
																	<NestedIcon className="h-3 w-3 text-muted-foreground shrink-0" />
																		<span className="truncate flex-1">
																			{getBlockLabel(nestedBlock, t)}
																		</span>
																		{nestedDynamicKeys.length > 0 && (
																			<span
																				className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 shrink-0"
																				title={
																					nestedDynamicKeys.length > 1
																						? `${nestedDynamicKeys.length} dynamic sources`
																						: `Dynamic source: ${nestedDynamicKeys[0]}`
																				}
																			>
																				<Database className="h-2.5 w-2.5" />
																				{nestedDynamicKeys[0]}
																			</span>
																		)}
																	</button>
															</ContextMenuTrigger>
															<ContextMenuContent>
																<ContextMenuItem onClick={() => onSelectBlock?.(nestedBlock.id)}>
																	{t("emailDesigner.sidebar.select")}
																</ContextMenuItem>
																<ContextMenuSeparator />
																{onDuplicateBlock && (
																	<ContextMenuItem onClick={() => onDuplicateBlock(nestedBlock.id)}>
																		<Copy className="mr-2 h-4 w-4" />
																		{t("emailDesigner.sidebar.duplicate")}
																	</ContextMenuItem>
																)}
																{onDuplicateBlock && <ContextMenuSeparator />}
																{onDeleteBlock && (
																	<ContextMenuItem 
																		onClick={() => onDeleteBlock(nestedBlock.id)} 
																		variant="destructive"
																	>
																		<Trash2 className="mr-2 h-4 w-4" />
																		{t("emailDesigner.sidebar.delete")}
																	</ContextMenuItem>
																)}
															</ContextMenuContent>
														</ContextMenu>
													);
												})}
											</div>
										)}
									</div>
								);
							})}
					{/* Drop indicator below last element */}
					{dragOverIndex === sectionBlocks.length && draggedBlockId && (
						<div className="h-0.5 bg-primary rounded-full mt-1 animate-pulse" />
					)}
				</div>
				<Separator />

				{/* AI Builder Section */}
				{onOpenAIBuilder && (
					<div className="shrink-0 p-3 border-b border-border/70 bg-background/80">
						<Button
							variant="default"
							size="sm"
							className="w-full bg-linear-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 px-3"
							onClick={onOpenAIBuilder}
						>
							<Sparkles className="h-3.5 w-3.5 shrink-0" />
							<span className="font-medium text-sm leading-tight">{t("emailDesigner.aiBuilder.buttonLabel")}</span>
						</Button>
					</div>
				)}


				{/* Add Blocks Section */}
				<div className="shrink-0">
					<div className="p-3 border-b border-border/70 shrink-0 bg-background/70">
						<h3 className="text-sm font-semibold text-foreground">
							{t("emailDesigner.blocks.addBlocks")} - {t(`emailDesigner.sections.${currentSection}`)}
						</h3>
					</div>
					<div className="p-3 flex flex-col gap-2.5">
						<Input
							value={blockQuery}
							onChange={(e) => setBlockQuery(e.target.value)}
							placeholder="Search blocks"
							className="h-8 text-xs bg-background"
						/>
						{filteredAvailableBlocks.length === 0 && (
							<div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
								No matching blocks
							</div>
						)}
						{filteredAvailableBlocks.map((option) => {
							const Icon = option.icon;
							return (
								<Button
									key={option.type}
									variant="outline"
									className="justify-start gap-2 h-9 bg-background shadow-sm hover:bg-muted/50"
									onClick={() => onAddBlock(option.type, currentSection)}
								>
									<Icon className="h-4 w-4" />
									<span className="text-sm">
										{option.label || t(`emailDesigner.blocks.${option.type}` as const)}
									</span>
								</Button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
