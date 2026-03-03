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
	Waves,
} from "lucide-react";
import { Template, TemplateElement } from "@/core";
import { toast } from "sonner";
import {
	CompliancePanel,
	type MissingRequiredField,
} from "./missing-required-fields-panel";
import type { DesignerState } from "./designer-types";
import type { TemplateComplianceStatus } from "@/hooks/use-template-compliance";

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
	complianceStatus: TemplateComplianceStatus | null;
	onAddRequiredElement: (field: MissingRequiredField) => void;
	elementIsRequired: (el: {
		fieldId?: string;
		binding?: string;
		itemsBinding?: string;
	}) => boolean;
};

type PaletteItemConfig = {
	type: TemplateElement["type"];
	icon: React.ComponentType<{ className?: string }>;
	iconClassName: string;
	labelKey: string;
	labelDefault?: string;
	addedToastKey?: string;
	addedToastDefault?: string;
};

const PALETTE_ITEMS: PaletteItemConfig[] = [
	{
		type: "text",
		icon: TypeIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.text",
		addedToastKey: "designer.sidebar.textAdded",
	},
	{
		type: "image",
		icon: ImageIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.image",
		addedToastKey: "designer.sidebar.imageAdded",
	},
	{
		type: "table",
		icon: TableIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.table",
		addedToastKey: "designer.sidebar.tableAdded",
	},
	{
		type: "input",
		icon: TypeIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.input",
		addedToastKey: "designer.sidebar.inputAdded",
	},
	{
		type: "box",
		icon: Square,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.box",
		addedToastKey: "designer.sidebar.boxAdded",
	},
	{
		type: "line",
		icon: Minus,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.line",
		addedToastKey: "designer.sidebar.lineAdded",
	},
	{
		type: "icon",
		icon: StickyNote,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.icon",
		labelDefault: "Icon",
		addedToastKey: "designer.sidebar.iconAdded",
		addedToastDefault: "Icon added",
	},
	{
		type: "currency",
		icon: CircleDollarSign,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.currency",
		addedToastKey: "designer.sidebar.currencyAdded",
	},
	{
		type: "path",
		icon: Waves,
		iconClassName: "text-blue-600",
		labelKey: "designer.sidebar.path",
		labelDefault: "Path",
		addedToastKey: "designer.sidebar.pathAdded",
		addedToastDefault: "Path added",
	},
	{
		type: "spacer",
		icon: Minus,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.spacer",
		labelDefault: "Spacer",
	},
	{
		type: "pageBreak",
		icon: Minus,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.pageBreak",
		labelDefault: "Page Break",
	},
	{
		type: "qrCode",
		icon: Square,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.qrCode",
		labelDefault: "QR Code",
	},
	{
		type: "barcode",
		icon: Minus,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.barcode",
		labelDefault: "Barcode",
	},
	{
		type: "signature",
		icon: TypeIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.signature",
		labelDefault: "Signature",
	},
	{
		type: "stamp",
		icon: StickyNote,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.stamp",
		labelDefault: "Stamp",
	},
];

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
	complianceStatus,
	onAddRequiredElement,
	elementIsRequired,
}: TemplateSidebarProps) {
	const { t } = useTranslation();
	const [draggedElementId, setDraggedElementId] = useState<string | null>(
		null,
	);
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

	const handleDragStart = (
		e: React.DragEvent,
		elementId: string,
		index: number,
	) => {
		setDraggedElementId(elementId);
		dragIndexRef.current = index;
		lastReorderRef.current = null;
		suppressClickRef.current = true;
		lastDragActionAtRef.current = Date.now();
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", elementId);
		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({ elementId, index }),
		);
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
		const adjustedTargetIndex =
			dragIndex < targetIndex ? targetIndex - 1 : targetIndex;

		if (
			dragIndex !== adjustedTargetIndex &&
			(lastReorderRef.current === null ||
				lastReorderRef.current.from !== dragIndex ||
				lastReorderRef.current.to !== adjustedTargetIndex)
		) {
			lastReorderRef.current = {
				from: dragIndex,
				to: adjustedTargetIndex,
			};
			onReorderElements(dragIndex, adjustedTargetIndex);
			dragIndexRef.current = adjustedTargetIndex;
		}
		setDragOverIndex(index);
	};

	const handleContainerDragOver = (e: React.DragEvent) => {
		if (dragIndexRef.current === null || !elementsContainerRef.current)
			return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		const containerRect =
			elementsContainerRef.current.getBoundingClientRect();
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

	const paletteButtonClassName =
		"w-full justify-start hover:bg-accent hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]";

	const tWithOptionalDefault = (key: string, defaultValue?: string) =>
		defaultValue ? t(key, defaultValue) : t(key);

	const handlePaletteItemClick = (item: PaletteItemConfig) => {
		onAddElement(item.type);
		if (item.addedToastKey) {
			toast.success(
				tWithOptionalDefault(item.addedToastKey, item.addedToastDefault),
				{
					duration: 1500,
				},
			);
		}
	};

	const handlePaletteItemDragStart = (
		e: React.DragEvent,
		type: TemplateElement["type"],
	) => {
		e.dataTransfer.setData("application/x-template-element", type);
		e.dataTransfer.setData("text/plain", type);
		e.dataTransfer.effectAllowed = "copy";
	};

	return (
		<div className="h-full p-4 border-r bg-background overflow-y-auto">
			<div className="flex items-center justify-between mb-4">
				<div className="font-semibold text-base text-foreground">
					{t("designer.sidebar.templates")}
				</div>
			</div>
			<div className="mb-4 space-y-2.5">
				<Button
					variant="default"
					size="sm"
					className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
					onClick={onOpenAIBuilder}
				>
					<Sparkles className="h-4 w-4 mr-2 animate-pulse" />
					<span className="font-medium">
						{t("designer.sidebar.aiBuilder")}
					</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="w-full transition-all duration-200 shadow-sm hover:shadow"
					onClick={onCreateNewTemplate}
				>
					<Plus className="h-4 w-4 mr-2" />
					{t("designer.sidebar.newTemplate")}
				</Button>
			</div>
			<div className="space-y-2">
				{templates.length === 0 && (
					<div className="text-xs text-muted-foreground">
						{t("designer.sidebar.noTemplates")}
					</div>
				)}
			</div>
			{currentTemplate && (
				<CompliancePanel
					complianceStatus={complianceStatus}
					onAddRequiredElement={onAddRequiredElement}
					storageKey={currentTemplate.id}
				/>
			)}
			<div className="mt-5">
				<div className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
					<span>{t("designer.sidebar.palette")}</span>
					<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
				</div>
				<div className="grid grid-cols-1 gap-2.5">
					{PALETTE_ITEMS.map((item) => {
						const Icon = item.icon;
						return (
							<Button
								key={item.type}
								variant="secondary"
								onClick={() => handlePaletteItemClick(item)}
								draggable
								onDragStart={(e) =>
									handlePaletteItemDragStart(e, item.type)
								}
								className={paletteButtonClassName}
							>
								<Icon
									className={`h-4 w-4 mr-2 ${item.iconClassName}`}
								/>
								<span className="font-medium">
									{tWithOptionalDefault(
										item.labelKey,
										item.labelDefault,
									)}
								</span>
							</Button>
						);
					})}
				</div>
				<div className="mt-5">
					<div className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
						<div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent"></div>
						<span>{t("designer.elements")}</span>
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
							const isRequiredField = elementIsRequired({
								fieldId: (el as { fieldId?: string }).fieldId,
								binding: (el as { binding?: string }).binding,
								itemsBinding: el.type === "table" ? el.itemsBinding : undefined,
							});
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
												onDragStart={(e) =>
													handleDragStart(
														e,
														el.id,
														index,
													)
												}
												onDragOver={(e) =>
													handleDragOver(e, index)
												}
												onDrop={(e) => {
													e.preventDefault();
													resetDragState();
												}}
												onDragEnd={resetDragState}
												className={`px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-sm cursor-move truncate transition-all duration-200 ${
													state.selectedElementIds?.includes(
														el.id,
													)
														? "bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary/30 dark:border-primary/50 shadow-md"
														: hoveredElementId ===
															  el.id
															? "bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/40"
															: "hover:bg-accent hover:shadow-sm border border-transparent hover:border-border"
												} ${isRequiredField ? "ring-1 ring-amber-400/50 dark:ring-amber-500/50" : ""} ${
													isDragging
														? "opacity-50"
														: ""
												} ${isDragOver && !isDragging ? "border-primary/80 bg-primary/5" : ""}`}
												onClick={(e) => {
													const isWithinSuppressionWindow =
														Date.now() -
															lastDragActionAtRef.current <
														DRAG_CLICK_SUPPRESS_MS;
													if (
														suppressClickRef.current ||
														isWithinSuppressionWindow
													) {
														e.preventDefault();
														e.stopPropagation();
														return;
													}
													onSelectElement(el.id, e);
												}}
												onMouseEnter={() =>
													onHoverElement?.(el.id)
												}
												onMouseLeave={() =>
													onHoverElement?.(null)
												}
											>
												<div className="flex items-center gap-2">
													<GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
													{isRequiredField && (
														<Lock className="h-3 w-3 text-amber-500 shrink-0" />
													)}
													{el.type === "text" && (
														<TypeIcon
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "image" && (
														<ImageIcon
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "table" && (
														<TableIcon
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "input" && (
														<TypeIcon
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "currency" && (
														<CircleDollarSign
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "box" && (
														<Square
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "line" && (
														<Minus
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "icon" && (
														<StickyNote
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "path" && (
														<Waves
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "spacer" && (
														<Minus
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type ===
														"pageBreak" && (
														<Minus
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "qrCode" && (
														<Square
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "barcode" && (
														<Minus
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type ===
														"signature" && (
														<TypeIcon
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													{el.type === "stamp" && (
														<StickyNote
															className={`h-4 w-4 shrink-0 ${
																state.selectedElementIds?.includes(
																	el.id,
																)
																	? "text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													)}
													<span className="truncate flex-1 text-sm text-foreground">
														{(() => {
															if (
																el.type ===
																"text"
															) {
																return (
																	(
																		el as Extract<
																			TemplateElement,
																			{
																				type: "text";
																			}
																		>
																	).text ??
																	t(
																		"designer.sidebar.text",
																	)
																);
															} else if (
																el.type ===
																"table"
															) {
																return t(
																	"designer.sidebar.itemsTable",
																);
															} else if (
																el.type ===
																"image"
															) {
																return t(
																	"designer.sidebar.image",
																);
															} else if (
																el.type ===
																"input"
															) {
																return t(
																	"designer.sidebar.inputField",
																);
															} else if (
																el.type ===
																"currency"
															) {
																return t(
																	"designer.sidebar.currencyField",
																);
															} else if (
																el.type ===
																"box"
															) {
																return t(
																	"designer.sidebar.box",
																);
															} else if (
																el.type ===
																"line"
															) {
																return t(
																	"designer.sidebar.line",
																);
															} else if (
																el.type ===
																"icon"
															) {
																return t(
																	"designer.sidebar.icon",
																	"Icon",
																);
															} else if (
																el.type ===
																"path"
															) {
																return t(
																	"designer.sidebar.path",
																	"Path",
																);
															} else if (
																el.type ===
																"spacer"
															) {
																return t(
																	"designer.sidebar.spacer",
																	"Spacer",
																);
															} else if (
																el.type ===
																"pageBreak"
															) {
																return t(
																	"designer.sidebar.pageBreak",
																	"Page Break",
																);
															} else if (
																el.type ===
																"qrCode"
															) {
																return t(
																	"designer.sidebar.qrCode",
																	"QR Code",
																);
															} else if (
																el.type ===
																"barcode"
															) {
																return t(
																	"designer.sidebar.barcode",
																	"Barcode",
																);
															} else if (
																el.type ===
																"signature"
															) {
																return t(
																	"designer.sidebar.signature",
																	"Signature",
																);
															} else if (
																el.type ===
																"stamp"
															) {
																return t(
																	"designer.sidebar.stamp",
																	"Stamp",
																);
															}
															// Fallback for any other element type
															const element =
																el as TemplateElement;
															return t(
																"designer.sidebar.element",
																{
																	id: element.id.slice(
																		0,
																		6,
																	),
																},
															);
														})()}
													</span>
												</div>
											</div>
										</ContextMenuTrigger>
										<ContextMenuContent>
											<ContextMenuItem
												onClick={() =>
													onSelectElement(el.id)
												}
											>
												{t("designer.sidebar.select")}
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem
												onClick={() =>
													onDuplicateElement(el.id)
												}
											>
												<Copy className="mr-2 h-4 w-4" />
												{t(
													"designer.sidebar.duplicate",
												)}
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem
												onClick={() =>
													onDeleteElement(el.id)
												}
												variant="destructive"
											>
												{t("designer.sidebar.delete")}
											</ContextMenuItem>
										</ContextMenuContent>
									</ContextMenu>
								</div>
							);
						})}
						{dragOverIndex === orderedElements.length &&
							draggedElementId && (
								<div className="h-0.5 bg-primary rounded-full animate-pulse" />
							)}
					</div>
				</div>
			</div>
		</div>
	);
}
