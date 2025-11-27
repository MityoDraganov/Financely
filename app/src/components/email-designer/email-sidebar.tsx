import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { EmailTemplate, EmailTemplateBlock, EmailSection } from "@/core";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PatternSelector } from "./pattern-selector";
import { Pattern } from "@/core/patterns/email-patterns";

type BlockType = EmailTemplateBlock["type"];

type EmailSidebarProps = {
	templates: EmailTemplate[];
	currentTemplate: EmailTemplate | undefined;
	onCreateNewTemplate: () => void;
	isCreating?: boolean;
	onAddBlock: (type: BlockType, section: EmailSection) => void;
	onAddPattern?: (pattern: Pattern) => void;
	onOpenAIBuilder?: () => void;
	blocks?: EmailTemplateBlock[];
	selectedBlockId?: string;
	onSelectBlock?: (blockId: string) => void;
	onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
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
		default:
			return Text;
	}
};

const getBlockLabel = (block: EmailTemplateBlock, t: (key: string) => string): string => {
	if (block.type === "subject") {
		const subjectBlock = block as Extract<EmailTemplateBlock, { type: "subject" }>;
		return subjectBlock.content?.slice(0, 30) || t("emailDesigner.blocks.subject");
	}
	if (block.type === "preheader") {
		const preheaderBlock = block as Extract<EmailTemplateBlock, { type: "preheader" }>;
		return preheaderBlock.content?.slice(0, 30) || t("emailDesigner.blocks.preheader");
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
		return textBlock.content?.slice(0, 30) || t("emailDesigner.blocks.text");
	}
	if (block.type === "button") {
		const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
		return buttonBlock.label || t("emailDesigner.blocks.button");
	}
	if (block.type === "footerText") {
		const footerBlock = block as Extract<EmailTemplateBlock, { type: "footerText" }>;
		return footerBlock.content?.slice(0, 30) || t("emailDesigner.blocks.footerText");
	}
	if (block.type === "socialLinks") {
		const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
		return socialBlock.links && socialBlock.links.length > 0
			? `${socialBlock.links.length} ${t("emailDesigner.blocks.socialLinks")}`
			: t("emailDesigner.blocks.socialLinks");
	}
	if (block.type === "unsubscribe") {
		const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
		return unsubscribeBlock.text || t("emailDesigner.blocks.unsubscribe");
	}
	return t(`emailDesigner.blocks.${block.type}` as const);
};

export function EmailSidebar({
	onAddBlock,
	onAddPattern,
	onOpenAIBuilder,
	blocks = [],
	selectedBlockId,
	onSelectBlock,
	onReorderBlocks,
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
	const blocksContainerRef = useRef<HTMLDivElement | null>(null);
	const sectionSelectorRef = useRef<HTMLDivElement | null>(null);
	const [shouldUseColumnLayout, setShouldUseColumnLayout] = useState(false);

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

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDraggedBlockId(null);
		setDragOverIndex(null);
		dragIndexRef.current = null;
		lastReorderRef.current = null;
	};

	const handleDragEnd = () => {
		setDraggedBlockId(null);
		setDragOverIndex(null);
		dragIndexRef.current = null;
		lastReorderRef.current = null;
	};

	return (
		<div className="h-full flex flex-col bg-background border-r overflow-hidden">
			{/* Section Selector - Fixed at top */}
			{onSectionChange && (
				<div className="p-2 border-b shrink-0 bg-muted/30">
					<div 
						ref={sectionSelectorRef}
						className={`flex gap-1 ${shouldUseColumnLayout ? "flex-col" : "flex-row"}`}
					>
						<Button
							variant={currentSection === "header" ? "secondary" : "ghost"}
							size="sm"
							className={`text-xs h-8 py-1.5 ${shouldUseColumnLayout ? "w-full" : "flex-1"}`}
							onClick={() => onSectionChange("header")}
						>
							{t("emailDesigner.sections.header")}
						</Button>
						<Button
							variant={currentSection === "body" ? "secondary" : "ghost"}
							size="sm"
							className={`text-xs h-8 py-1.5 ${shouldUseColumnLayout ? "w-full" : "flex-1"}`}
							onClick={() => onSectionChange("body")}
						>
							{t("emailDesigner.sections.body")}
						</Button>
						<Button
							variant={currentSection === "footer" ? "secondary" : "ghost"}
							size="sm"
							className={`text-xs h-8 py-1.5 ${shouldUseColumnLayout ? "w-full" : "flex-1"}`}
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
				{sectionBlocks.length > 0 && (
					<>
						<div className="p-3 border-b shrink-0">
							<h3 className="text-sm font-semibold text-foreground">
								{t("emailDesigner.blocks.currentBlocks")} ({sectionBlocks.length})
							</h3>
						</div>
						<div
							ref={blocksContainerRef}
							className="p-2 flex flex-col gap-1"
							onDragOver={handleContainerDragOver}
							onDrop={handleDrop}
						>
							{/* Drop indicator above first element */}
							{dragOverIndex === -1 && draggedBlockId && (
								<div className="h-0.5 bg-primary rounded-full mb-1 animate-pulse" />
							)}
							{sectionBlocks.map((block, index) => {
								const actualIndex = blocks.findIndex(b => b.id === block.id);
								const Icon = getBlockIcon(block.type);
								const isSelected = block.id === selectedBlockId;
								const isDragging = draggedBlockId === block.id;
								const isDragOver = dragOverIndex === index;
								const nestedCount = countNestedBlocks(block);
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
														"flex items-center gap-1 rounded-md border transition-all cursor-move relative group",
														isSelected
															? "border-primary bg-primary/10"
															: "border-border hover:border-primary/50 bg-background",
														isDragging && "opacity-50",
														isDragOver && !isDragging && "border-primary/80 bg-primary/5"
													)}
												>
													<button
														type="button"
														onClick={() => onSelectBlock?.(block.id)}
														className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
													>
														<GripVertical className="h-3 w-3 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
														<Icon className="h-3 w-3 text-muted-foreground shrink-0" />
														<span className="text-xs truncate flex-1">
															{getBlockLabel(block, t)}
														</span>
														{hasNested && !isExpanded && (
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="shrink-0 text-xs text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted/50 cursor-default">
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
											<div className="ml-4 mt-1 space-y-1 border-l-2 border-muted pl-2">
												{block.type === "columns" && (block as Extract<EmailTemplateBlock, { type: "columns" }>).columns?.map((column, colIdx) => (
													<div key={column.id} className="space-y-1">
														<div className="text-xs font-medium text-muted-foreground px-2 py-0.5">
															{t("emailDesigner.sidebar.column")} {colIdx + 1} ({column.blocks?.length || 0})
														</div>
														{column.blocks?.map((nestedBlock) => {
															const NestedIcon = getBlockIcon(nestedBlock.type);
															const isNestedSelected = nestedBlock.id === selectedBlockId;
															return (
																<ContextMenu key={nestedBlock.id}>
																	<ContextMenuTrigger asChild>
																		<button
																			type="button"
																			onClick={() => onSelectBlock?.(nestedBlock.id)}
																			className={cn(
																				"w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-all text-xs",
																				isNestedSelected
																					? "border-primary bg-primary/10"
																					: "border-border hover:border-primary/50 bg-muted/30"
																			)}
																		>
																			<NestedIcon className="h-3 w-3 text-muted-foreground shrink-0" />
																			<span className="truncate flex-1">
																				{getBlockLabel(nestedBlock, t)}
																			</span>
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
													return (
														<ContextMenu key={nestedBlock.id}>
															<ContextMenuTrigger asChild>
																<button
																	type="button"
																	onClick={() => onSelectBlock?.(nestedBlock.id)}
																	className={cn(
																		"w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-all text-xs",
																		isNestedSelected
																			? "border-primary bg-primary/10"
																			: "border-border hover:border-primary/50 bg-muted/30"
																	)}
																>
																	<NestedIcon className="h-3 w-3 text-muted-foreground shrink-0" />
																	<span className="truncate flex-1">
																		{getBlockLabel(nestedBlock, t)}
																	</span>
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
					</>
				)}

				{/* AI Builder Section */}
				{onOpenAIBuilder && (
					<div className="shrink-0 p-3 border-b">
						<Button
							variant="default"
							size="sm"
							className="w-full bg-linear-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 px-2.5"
							onClick={onOpenAIBuilder}
						>
							<Sparkles className="h-3.5 w-3.5 animate-pulse shrink-0" />
							<span className="font-medium text-xs leading-tight">{t("emailDesigner.aiBuilder.buttonLabel")}</span>
						</Button>
					</div>
				)}

				{/* Patterns Section */}
				{onAddPattern && (
					<>
						<div className="shrink-0 border-b">
							<PatternSelector
								section={currentSection}
								onSelectPattern={onAddPattern}
							/>
						</div>
						<Separator />
					</>
				)}

				{/* Add Blocks Section */}
				<div className="shrink-0">
					<div className="p-3 border-b shrink-0">
						<h3 className="text-sm font-semibold text-foreground">
							{t("emailDesigner.blocks.addBlocks")} - {t(`emailDesigner.sections.${currentSection}`)}
						</h3>
					</div>
					<div className="p-3 flex flex-col gap-2">
						{availableBlocks.map((option) => {
							const Icon = option.icon;
							return (
								<Button
									key={option.type}
									variant="outline"
									className="justify-start gap-2 h-9"
									onClick={() => onAddBlock(option.type, currentSection)}
								>
									<Icon className="h-4 w-4" />
									<span className="text-xs">
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

