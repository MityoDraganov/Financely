import { useRef, useState } from "react";
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
	Plus,
	Type as TypeIcon,
	ImageIcon,
	Table as TableIcon,
	Square,
	Minus,
	Lock,
	CircleDollarSign,
	Copy,
	Sparkles,
	StickyNote,
	GripVertical,
} from "lucide-react";
import { Template, TemplateElement } from "@/core";
import { toast } from "sonner";
import type { DesignerState } from "./designer-types";

type TemplateSidebarProps = {
	templates: Template[];
	currentTemplate: Template | undefined;
	state: DesignerState;
	hoveredElementId?: string | null;
	onStateChange: (updater: (s: DesignerState) => DesignerState) => void;
	onCreateNewTemplate: () => void;
	onOpenAIBuilder: () => void;
	onAddElement: (kind: TemplateElement["type"]) => void;
	onSelectElement: (id: string, event?: React.MouseEvent) => void;
	onHoverElement?: (id: string | null) => void;
	onDuplicateElement: (id: string) => void;
	onDeleteElement: (id: string) => void;
	onReorderElements: (fromIndex: number, toIndex: number) => void;
	missingRequiredFields: Array<{
		binding: string;
		label: string;
		description?: string;
		elementType: "text" | "input" | "table" | "currency";
	}>;
	onAddRequiredElement: (binding: string, label: string, elementType: "text" | "input" | "table" | "currency") => void;
	isRequired: (binding: string | undefined) => boolean;
};

export function TemplateSidebar({
	templates,
	currentTemplate,
	state,
	onCreateNewTemplate,
	onOpenAIBuilder,
	onAddElement,
	onSelectElement,
	hoveredElementId,
	onHoverElement,
	onDuplicateElement,
	onDeleteElement,
	onReorderElements,
	missingRequiredFields,
	onAddRequiredElement,
	isRequired,
}: TemplateSidebarProps) {
	const { t } = useTranslation();
	const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragIndexRef = useRef<number | null>(null);
	const lastReorderRef = useRef<{ from: number; to: number } | null>(null);
	const elementsContainerRef = useRef<HTMLDivElement | null>(null);
	const suppressClickRef = useRef(false);
	const lastDragActionAtRef = useRef(0);
	const DRAG_CLICK_SUPPRESS_MS = 300;

	const orderedElements = [...(currentTemplate?.elements ?? [])]
		.map((el, index) => ({ el, index }))
		.sort((a, b) => {
			const aZ = a.el.zIndex ?? 0;
			const bZ = b.el.zIndex ?? 0;
			if (aZ !== bZ) return bZ - aZ;
			return b.index - a.index;
		})
		.map(({ el }) => el);

	const handleDragStart = (e: React.DragEvent, elementId: string, index: number) => {
		setDraggedElementId(elementId);
		dragIndexRef.current = index;
		lastReorderRef.current = null;
		suppressClickRef.current = true;
		lastDragActionAtRef.current = Date.now();
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", elementId);
		e.dataTransfer.setData("application/json", JSON.stringify({ elementId, index }));
	};

	const handleDragOver = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (dragIndexRef.current === null) return;
		const dragIndex = dragIndexRef.current;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const mouseY = e.clientY;
		const centerY = rect.top + rect.height / 2;
		const targetIndex = mouseY < centerY ? index : index + 1;
		const adjustedTargetIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;

		if (
			dragIndex !== adjustedTargetIndex &&
			(lastReorderRef.current === null ||
				lastReorderRef.current.from !== dragIndex ||
				lastReorderRef.current.to !== adjustedTargetIndex)
		) {
			lastReorderRef.current = { from: dragIndex, to: adjustedTargetIndex };
			onReorderElements(dragIndex, adjustedTargetIndex);
			dragIndexRef.current = adjustedTargetIndex;
		}
		setDragOverIndex(index);
	};

	const handleContainerDragOver = (e: React.DragEvent) => {
		if (dragIndexRef.current === null || !elementsContainerRef.current) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		const containerRect = elementsContainerRef.current.getBoundingClientRect();
		const mouseY = e.clientY;
		const dragIndex = dragIndexRef.current;

		if (mouseY < containerRect.top + 20) {
			if (dragIndex !== 0) {
				onReorderElements(dragIndex, 0);
				dragIndexRef.current = 0;
				lastReorderRef.current = { from: dragIndex, to: 0 };
			}
			setDragOverIndex(-1);
			return;
		}

		if (mouseY > containerRect.bottom - 20) {
			const lastIndex = orderedElements.length - 1;
			if (lastIndex >= 0 && dragIndex !== lastIndex) {
				onReorderElements(dragIndex, lastIndex);
				dragIndexRef.current = lastIndex;
				lastReorderRef.current = { from: dragIndex, to: lastIndex };
			}
			setDragOverIndex(orderedElements.length);
			return;
		}
	};

	const resetDragState = () => {
		setDraggedElementId(null);
		setDragOverIndex(null);
		dragIndexRef.current = null;
		lastReorderRef.current = null;
		lastDragActionAtRef.current = Date.now();
		window.setTimeout(() => {
			suppressClickRef.current = false;
		}, DRAG_CLICK_SUPPRESS_MS);
	};

	return (
		<div className="h-full p-4 border-r bg-background overflow-y-auto">
			<div className="flex items-center justify-between mb-4">
				<div className="font-semibold text-base text-foreground">{t('designer.sidebar.templates')}</div>
			</div>
			<div className="mb-4 space-y-2.5">
				<Button
					variant="default"
					size="sm"
					className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
					onClick={onOpenAIBuilder}
				>
					<Sparkles className="h-4 w-4 mr-2 animate-pulse" />
					<span className="font-medium">{t('designer.sidebar.aiBuilder')}</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="w-full transition-all duration-200 shadow-sm hover:shadow"
					onClick={onCreateNewTemplate}
				>
					<Plus className="h-4 w-4 mr-2" />
					{t('designer.sidebar.newTemplate')}
				</Button>
			</div>
			<div className="space-y-2">
				{templates.length === 0 && (
					<div className="text-xs text-muted-foreground">
						{t('designer.sidebar.noTemplates')}
					</div>
				)}
			</div>
			{/* Required Fields Section */}
			{missingRequiredFields.length > 0 && currentTemplate && (
				<div className="mt-5 mb-5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 shadow-sm">
					<div className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 mb-2.5 flex items-center gap-1.5">
						<Lock className="h-3.5 w-3.5" />
						{t('designer.sidebar.requiredFields')}
					</div>
					<div className="space-y-2">
						{missingRequiredFields.map((field) => (
							<Button
								key={field.binding}
								variant="outline"
								size="sm"
								onClick={() => {
									onAddRequiredElement(field.binding, field.label, field.elementType);
									toast.success(t('designer.sidebar.addedField', { label: field.label }), { duration: 2000 });
								}}
								className="w-full justify-start text-xs h-auto py-2.5 px-3 border-amber-300 dark:border-amber-700 bg-background hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:border-amber-400 dark:hover:border-amber-600 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
							>
								<Plus className="h-3.5 w-3.5 mr-2 text-amber-600 dark:text-amber-400" />
								<span className="text-left flex-1">
									<div className="font-semibold text-amber-900 dark:text-amber-200">{field.label}</div>
									{field.description && (
										<div className="text-xs text-amber-700/70 dark:text-amber-400/70 font-normal mt-0.5">{field.description}</div>
									)}
								</span>
							</Button>
						))}
					</div>
				</div>
			)}
			<div className="mt-5">
				<div className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
					<span>{t('designer.sidebar.palette')}</span>
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
				</div>
				<div className="grid grid-cols-1 gap-2.5">
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("text");
							toast.success(t('designer.sidebar.textAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "text");
							e.dataTransfer.setData("text/plain", "text");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<TypeIcon className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.text')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("image");
							toast.success(t('designer.sidebar.imageAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "image");
							e.dataTransfer.setData("text/plain", "image");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<ImageIcon className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.image')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("table");
							toast.success(t('designer.sidebar.tableAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "table");
							e.dataTransfer.setData("text/plain", "table");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<TableIcon className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.table')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("input");
							toast.success(t('designer.sidebar.inputAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "input");
							e.dataTransfer.setData("text/plain", "input");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<TypeIcon className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.input')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("box");
							toast.success(t('designer.sidebar.boxAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "box");
							e.dataTransfer.setData("text/plain", "box");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Square className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.box')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("line");
							toast.success(t('designer.sidebar.lineAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "line");
							e.dataTransfer.setData("text/plain", "line");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Minus className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.line')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("icon");
							toast.success(t('designer.sidebar.iconAdded', 'Icon added'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "icon");
							e.dataTransfer.setData("text/plain", "icon");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<StickyNote className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.icon', 'Icon')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							onAddElement("currency");
							toast.success(t('designer.sidebar.currencyAdded'), { duration: 1500 });
						}}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "currency");
							e.dataTransfer.setData("text/plain", "currency");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
						>
							<CircleDollarSign className="h-4 w-4 mr-2 text-neutral-600" />
							<span className="font-medium">{t('designer.sidebar.currency')}</span>
						</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("spacer")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "spacer");
							e.dataTransfer.setData("text/plain", "spacer");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Minus className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.spacer', 'Spacer')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("pageBreak")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "pageBreak");
							e.dataTransfer.setData("text/plain", "pageBreak");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Minus className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.pageBreak', 'Page Break')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("qrCode")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "qrCode");
							e.dataTransfer.setData("text/plain", "qrCode");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Square className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.qrCode', 'QR Code')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("barcode")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "barcode");
							e.dataTransfer.setData("text/plain", "barcode");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<Minus className="h-4 w-4 mr-2 text-neutral-600" />
						<span className="font-medium">{t('designer.sidebar.barcode', 'Barcode')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("signature")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "signature");
							e.dataTransfer.setData("text/plain", "signature");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<TypeIcon className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.signature', 'Signature')}</span>
					</Button>
					<Button
						variant="secondary"
						onClick={() => onAddElement("stamp")}
						draggable
						onDragStart={(e) => {
							e.dataTransfer.setData("application/x-template-element", "stamp");
							e.dataTransfer.setData("text/plain", "stamp");
							e.dataTransfer.effectAllowed = "copy";
						}}
						className="w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
					>
						<StickyNote className="h-4 w-4 mr-2 text-muted-foreground" />
						<span className="font-medium">{t('designer.sidebar.stamp', 'Stamp')}</span>
					</Button>
					</div>
				<div className="mt-5">
				<div className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
					<span>{t('designer.elements')}</span>
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
				</div>
					<div
						ref={elementsContainerRef}
						className="grid grid-cols-1 gap-2"
						onDragOver={handleContainerDragOver}
						onDrop={(e) => {
							e.preventDefault();
							resetDragState();
						}}
					>
						{dragOverIndex === -1 && draggedElementId && (
							<div className="h-0.5 bg-primary rounded-full animate-pulse" />
						)}
						{orderedElements.map((el, index) => {
							const binding = el.type === "text" ? el.binding :
								el.type === "input" ? el.binding :
								el.type === "image" ? el.binding :
								el.type === "table" ? el.itemsBinding : undefined;
							const isRequiredField = isRequired(binding);
							const isDragging = draggedElementId === el.id;
							const isDragOver = dragOverIndex === index;

							return (
								<div key={el.id} className="relative">
									{isDragOver && !isDragging && (
										<div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-primary rounded-full z-10" />
									)}
									<ContextMenu>
										<ContextMenuTrigger asChild>
											<div
												draggable
												onDragStart={(e) => handleDragStart(e, el.id, index)}
												onDragOver={(e) => handleDragOver(e, index)}
												onDrop={(e) => {
													e.preventDefault();
													resetDragState();
												}}
												onDragEnd={resetDragState}
												className={`px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-sm cursor-move truncate transition-all duration-200 ${
													state.selectedElementIds?.includes(el.id)
														? "bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary/30 dark:border-primary/50 shadow-md"
														: hoveredElementId === el.id
															? "bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/40"
															: "hover:bg-accent hover:shadow-sm border border-transparent hover:border-border"
												} ${isRequiredField ? "ring-1 ring-amber-400/50 dark:ring-amber-500/50" : ""} ${
													isDragging ? "opacity-50" : ""
												} ${isDragOver && !isDragging ? "border-primary/80 bg-primary/5" : ""}`}
												onClick={(e) => {
													const isWithinSuppressionWindow =
														Date.now() - lastDragActionAtRef.current < DRAG_CLICK_SUPPRESS_MS;
													if (suppressClickRef.current || isWithinSuppressionWindow) {
														e.preventDefault();
														e.stopPropagation();
														return;
													}
													onSelectElement(el.id, e);
												}}
												onMouseEnter={() => onHoverElement?.(el.id)}
												onMouseLeave={() => onHoverElement?.(null)}
											>
												<div className="flex items-center gap-2">
													<GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
													{isRequiredField && (
														<Lock className="h-3 w-3 text-amber-500 shrink-0" />
													)}
													{el.type === "text" && (
														<TypeIcon className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "image" && (
														<ImageIcon className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "table" && (
														<TableIcon className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "input" && (
														<TypeIcon className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "currency" && (
														<CircleDollarSign className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "box" && (
														<Square className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "line" && (
														<Minus className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "icon" && (
														<StickyNote className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "spacer" && (
														<Minus className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "pageBreak" && (
														<Minus className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "qrCode" && (
														<Square className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "barcode" && (
														<Minus className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "signature" && (
														<TypeIcon className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													{el.type === "stamp" && (
														<StickyNote className={`h-4 w-4 shrink-0 ${
															state.selectedElementIds?.includes(el.id)
																? "text-primary"
																: "text-muted-foreground"
														}`} />
													)}
													<span className="truncate flex-1 text-sm text-foreground">
														{(() => {
															if (el.type === "text") {
																return (el as Extract<TemplateElement, { type: "text" }>).text ?? t('designer.sidebar.text');
															} else if (el.type === "table") {
																return t('designer.sidebar.itemsTable');
															} else if (el.type === "image") {
																return t('designer.sidebar.image');
															} else if (el.type === "input") {
																return t('designer.sidebar.inputField');
															} else if (el.type === "currency") {
																return t('designer.sidebar.currencyField');
															} else if (el.type === "box") {
																return t('designer.sidebar.box');
															} else if (el.type === "line") {
																return t('designer.sidebar.line');
																} else if (el.type === "icon") {
																	return t('designer.sidebar.icon', 'Icon');
																} else if (el.type === "spacer") {
																	return t('designer.sidebar.spacer', 'Spacer');
																} else if (el.type === "pageBreak") {
																	return t('designer.sidebar.pageBreak', 'Page Break');
																} else if (el.type === "qrCode") {
																	return t('designer.sidebar.qrCode', 'QR Code');
																} else if (el.type === "barcode") {
																	return t('designer.sidebar.barcode', 'Barcode');
																} else if (el.type === "signature") {
																	return t('designer.sidebar.signature', 'Signature');
																} else if (el.type === "stamp") {
																	return t('designer.sidebar.stamp', 'Stamp');
																}
															// Fallback for any other element type
															const element = el as TemplateElement;
															return t('designer.sidebar.element', { id: element.id.slice(0, 6) });
														})()}
													</span>
												</div>
											</div>
										</ContextMenuTrigger>
										<ContextMenuContent>
											<ContextMenuItem onClick={() => onSelectElement(el.id)}>
												{t('designer.sidebar.select')}
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem onClick={() => onDuplicateElement(el.id)}>
												<Copy className="mr-2 h-4 w-4" />
												{t('designer.sidebar.duplicate')}
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem onClick={() => onDeleteElement(el.id)} variant="destructive">
												{t('designer.sidebar.delete')}
											</ContextMenuItem>
										</ContextMenuContent>
									</ContextMenu>
								</div>
							);
						})}
						{dragOverIndex === orderedElements.length && draggedElementId && (
							<div className="h-0.5 bg-primary rounded-full animate-pulse" />
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
