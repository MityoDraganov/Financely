import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { EmailTemplate, EmailTemplateBlock, EmailSection } from "@/core";
import { Separator } from "@/components/ui/separator";
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
	blocks?: EmailTemplateBlock[];
	selectedBlockId?: string;
	onSelectBlock?: (blockId: string) => void;
	onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
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
	blocks = [],
	selectedBlockId,
	onSelectBlock,
	onReorderBlocks,
	currentSection = "body",
	onSectionChange,
}: EmailSidebarProps) {
	const { t } = useTranslation();
	const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragIndexRef = useRef<number | null>(null);
	const lastReorderRef = useRef<{ from: number; to: number } | null>(null);
	const blocksContainerRef = useRef<HTMLDivElement | null>(null);
	
	// Filter blocks by current section (default to "body" if section is missing)
	const sectionBlocks = blocks.filter(block => (block.section || "body") === currentSection);
	const availableBlocks = getBlocksForSection(currentSection);

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
			{/* Section Selector */}
			{onSectionChange && (
				<div className="p-2 border-b shrink-0 bg-muted/30">
					<div className="grid grid-cols-3 gap-1">
						<Button
							variant={currentSection === "header" ? "secondary" : "ghost"}
							size="sm"
							className="text-xs h-7"
							onClick={() => onSectionChange("header")}
						>
							{t("emailDesigner.sections.header")}
						</Button>
						<Button
							variant={currentSection === "body" ? "secondary" : "ghost"}
							size="sm"
							className="text-xs h-7"
							onClick={() => onSectionChange("body")}
						>
							{t("emailDesigner.sections.body")}
						</Button>
						<Button
							variant={currentSection === "footer" ? "secondary" : "ghost"}
							size="sm"
							className="text-xs h-7"
							onClick={() => onSectionChange("footer")}
						>
							{t("emailDesigner.sections.footer")}
						</Button>
					</div>
				</div>
			)}

			{/* Current Blocks Section */}
			{sectionBlocks.length > 0 && (
				<>
					<div className="p-3 border-b shrink-0">
						<h3 className="text-sm font-semibold text-foreground">
							{t("emailDesigner.blocks.currentBlocks")} ({sectionBlocks.length})
						</h3>
					</div>
					<ScrollArea className="max-h-[300px] shrink-0">
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

								return (
									<div key={block.id} className="relative">
										{/* Drop indicator above */}
										{isDragOver && !isDragging && (
											<div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-primary rounded-full z-10" />
										)}
										<div
											draggable
											onDragStart={(e) => handleDragStart(e, block.id, actualIndex)}
											onDragOver={(e) => handleDragOver(e, actualIndex)}
											onDragLeave={handleDragLeave}
											onDrop={handleDrop}
											onDragEnd={handleDragEnd}
											className={cn(
												"flex items-center gap-1 rounded-md border transition-all cursor-move relative",
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
												<GripVertical className="h-3 w-3 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
												<Icon className="h-3 w-3 text-muted-foreground shrink-0" />
												<span className="text-xs truncate flex-1">
													{getBlockLabel(block, t)}
												</span>
											</button>
										</div>
									</div>
								);
							})}
							{/* Drop indicator below last element */}
							{dragOverIndex === sectionBlocks.length && draggedBlockId && (
								<div className="h-0.5 bg-primary rounded-full mt-1 animate-pulse" />
							)}
						</div>
					</ScrollArea>
					<Separator />
				</>
			)}

			{/* Patterns Section */}
			{onAddPattern && (
				<>
					<div className="p-3 border-b shrink-0">
						<h3 className="text-sm font-semibold text-foreground">
							{t("emailDesigner.patterns.title")}
						</h3>
					</div>
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
			<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
				<div className="p-3 border-b shrink-0">
					<h3 className="text-sm font-semibold text-foreground">
						{t("emailDesigner.blocks.addBlocks")} - {t(`emailDesigner.sections.${currentSection}`)}
					</h3>
				</div>
				<ScrollArea className="flex-1 min-h-0">
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
				</ScrollArea>
			</div>
		</div>
	);
}

