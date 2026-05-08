import { Fragment, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
	Group,
	ChevronDown,
	ChevronRight,
} from "lucide-react";
import { Template, TemplateElement } from "@/core";
import {
	type SidebarScope,
	isRootLayerElement,
	sortElementsByZDescending,
} from "@/components/designer/editor-commands";
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
	onReorderSidebarSiblings: (
		scope: SidebarScope,
		fromIndex: number,
		toIndex: number,
	) => void;
	onMoveElementInTree: (
		elementId: string,
		parentGroupId: string | undefined,
		insertIndex: number,
	) => void;
	onAddElementToGroup: (kind: TemplateElement["type"], groupId: string) => void;
	complianceStatus: TemplateComplianceStatus | null;
	onAddRequiredElement: (field: MissingRequiredField) => void;
	elementIsRequired: (el: {
		fieldId?: string;
		binding?: string;
		itemsBinding?: string;
	}) => boolean;
	designerMode?: "content" | "background";
	draftBackgroundElements?: TemplateElement[] | null;
};

type PaletteItemConfig = {
	type: TemplateElement["type"];
	icon: React.ComponentType<{ className?: string }>;
	iconClassName: string;
	labelKey: string;
	labelDefault?: string;
	addedToastKey?: string;
	addedToastDefault?: string;
	hidden?: boolean;
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
		type: "group",
		icon: Group,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.group",
		labelDefault: "Group",
		addedToastKey: "designer.sidebar.groupAdded",
		addedToastDefault: "Group added",
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
		hidden: true,
	},
	{
		type: "qrCode",
		icon: Square,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.qrCode",
		labelDefault: "QR Code",
		hidden: true,
	},
	{
		type: "barcode",
		icon: Minus,
		iconClassName: "text-neutral-600",
		labelKey: "designer.sidebar.barcode",
		labelDefault: "Barcode",
		hidden: true,
	},
	{
		type: "signature",
		icon: TypeIcon,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.signature",
		labelDefault: "Signature",
		hidden: true,
	},
	{
		type: "stamp",
		icon: StickyNote,
		iconClassName: "text-muted-foreground",
		labelKey: "designer.sidebar.stamp",
		labelDefault: "Stamp",
		hidden: true,
	},
];

const BACKGROUND_ALLOWED_TYPES = new Set<TemplateElement["type"]>(["box", "line", "image", "path", "text"]);

function elementSidebarIcon(el: TemplateElement, selected: boolean): React.ReactNode {
	const cn = selected ? "text-primary" : "text-muted-foreground";
	if (el.type === "text") {
		return <TypeIcon className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "image") {
		return <ImageIcon className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "table") {
		return <TableIcon className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "input") {
		return <TypeIcon className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "currency") {
		return <CircleDollarSign className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "box") {
		return <Square className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "line") {
		return <Minus className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "icon") {
		return <StickyNote className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "path") {
		return <Waves className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "spacer") {
		return <Minus className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "pageBreak") {
		return <Minus className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "qrCode") {
		return <Square className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "barcode") {
		return <Minus className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "signature") {
		return <TypeIcon className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "stamp") {
		return <StickyNote className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	if (el.type === "group") {
		return <Group className={`h-4 w-4 shrink-0 ${cn}`} />;
	}
	return null;
}

function elementSidebarTitle(el: TemplateElement, t: TFunction): React.ReactNode {
	if (el.type === "text") {
		return (
			(el as Extract<TemplateElement, { type: "text" }>).text ??
			t("designer.sidebar.text")
		);
	}
	if (el.type === "table") {
		return t("designer.sidebar.itemsTable");
	}
	if (el.type === "image") {
		return t("designer.sidebar.image");
	}
	if (el.type === "input") {
		return t("designer.sidebar.inputField");
	}
	if (el.type === "currency") {
		return t("designer.sidebar.currencyField");
	}
	if (el.type === "box") {
		return t("designer.sidebar.box");
	}
	if (el.type === "line") {
		return t("designer.sidebar.line");
	}
	if (el.type === "icon") {
		return t("designer.sidebar.icon", "Icon");
	}
	if (el.type === "path") {
		return t("designer.sidebar.path", "Path");
	}
	if (el.type === "spacer") {
		return t("designer.sidebar.spacer", "Spacer");
	}
	if (el.type === "pageBreak") {
		return t("designer.sidebar.pageBreak", "Page Break");
	}
	if (el.type === "qrCode") {
		return t("designer.sidebar.qrCode", "QR Code");
	}
	if (el.type === "barcode") {
		return t("designer.sidebar.barcode", "Barcode");
	}
	if (el.type === "signature") {
		return t("designer.sidebar.signature", "Signature");
	}
	if (el.type === "stamp") {
		return t("designer.sidebar.stamp", "Stamp");
	}
	if (el.type === "group") {
		const g = el as Extract<TemplateElement, { type: "group" }>;
		return g.label?.trim() || t("designer.sidebar.group", "Group");
	}
	const fallback = el as TemplateElement;
	return t("designer.sidebar.element", { id: fallback.id.slice(0, 6) });
}

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
	onReorderSidebarSiblings,
	onMoveElementInTree,
	onAddElementToGroup,
	complianceStatus,
	onAddRequiredElement,
	elementIsRequired,
	designerMode = "content",
	draftBackgroundElements,
}: TemplateSidebarProps) {
	const { t } = useTranslation();
	const [draggedElementId, setDraggedElementId] = useState<string | null>(
		null,
	);
	const [dragOverKey, setDragOverKey] = useState<string | null>(null);
	type ElementDragRef = {
		elementId: string;
		scope: SidebarScope;
		indexInScope: number;
	};
	const elementDragRef = useRef<ElementDragRef | null>(null);
	const lastReorderRef = useRef<{
		from: number;
		to: number;
		scope: SidebarScope;
	} | null>(null);
	const elementsContainerRef = useRef<HTMLDivElement | null>(null);
	const suppressClickRef = useRef(false);
	const lastDragActionAtRef = useRef(0);
	const DRAG_CLICK_SUPPRESS_MS = 300;
	const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
		() => new Set(),
	);

	const activeElements = useMemo(() => {
		if (designerMode === "background") {
			return draftBackgroundElements ?? currentTemplate?.backgroundElements ?? [];
		}
		return currentTemplate?.elements ?? [];
	}, [
		designerMode,
		draftBackgroundElements,
		currentTemplate?.backgroundElements,
		currentTemplate?.elements,
	]);

	const rootElements = useMemo(
		() =>
			sortElementsByZDescending(
				activeElements.filter((el) =>
					isRootLayerElement(activeElements, el),
				),
			),
		[activeElements],
	);

	function scopeEquals(a: SidebarScope, b: SidebarScope): boolean {
		if (a === "root" && b === "root") return true;
		if (
			typeof a === "object" &&
			typeof b === "object" &&
			a.groupId === b.groupId
		) {
			return true;
		}
		return false;
	}

	function scopeKey(scope: SidebarScope): string {
		return scope === "root" ? "root" : `g:${scope.groupId}`;
	}

	function toggleGroupCollapsed(groupId: string) {
		setCollapsedGroupIds((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) next.delete(groupId);
			else next.add(groupId);
			return next;
		});
	}

	function handleDragStart(
		e: React.DragEvent,
		elementId: string,
		scope: SidebarScope,
		indexInScope: number,
	) {
		setDraggedElementId(elementId);
		elementDragRef.current = { elementId, scope, indexInScope };
		lastReorderRef.current = null;
		suppressClickRef.current = true;
		lastDragActionAtRef.current = Date.now();
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", elementId);
		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({ elementId, scope, indexInScope }),
		);
	}

	function handleDragOverRow(
		e: React.DragEvent,
		scope: SidebarScope,
		rowIndexInScope: number,
	) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		const ref = elementDragRef.current;
		if (!ref) return;
		if (!scopeEquals(ref.scope, scope)) return;

		const dragIndex = ref.indexInScope;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const mouseY = e.clientY;
		const centerY = rect.top + rect.height / 2;
		const targetIndex = mouseY < centerY ? rowIndexInScope : rowIndexInScope + 1;
		const adjustedTargetIndex =
			dragIndex < targetIndex ? targetIndex - 1 : targetIndex;

		if (
			dragIndex !== adjustedTargetIndex &&
			(lastReorderRef.current === null ||
				lastReorderRef.current.from !== dragIndex ||
				lastReorderRef.current.to !== adjustedTargetIndex ||
				!scopeEquals(lastReorderRef.current.scope, scope))
		) {
			lastReorderRef.current = {
				from: dragIndex,
				to: adjustedTargetIndex,
				scope,
			};
			onReorderSidebarSiblings(scope, dragIndex, adjustedTargetIndex);
			elementDragRef.current = {
				...ref,
				indexInScope: adjustedTargetIndex,
			};
		}
		setDragOverKey(`${scopeKey(scope)}:${rowIndexInScope}`);
	}

	function handleContainerDragOver(e: React.DragEvent) {
		const ref = elementDragRef.current;
		if (!ref || ref.scope !== "root" || !elementsContainerRef.current) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		const containerRect =
			elementsContainerRef.current.getBoundingClientRect();
		const mouseY = e.clientY;
		const dragIndex = ref.indexInScope;

		if (mouseY < containerRect.top + 20) {
			if (dragIndex !== 0) {
				onReorderSidebarSiblings("root", dragIndex, 0);
				elementDragRef.current = { ...ref, indexInScope: 0 };
				lastReorderRef.current = { from: dragIndex, to: 0, scope: "root" };
			}
			setDragOverKey("root:-1");
			return;
		}

		if (mouseY > containerRect.bottom - 20) {
			const lastIndex = rootElements.length - 1;
			if (lastIndex >= 0 && dragIndex !== lastIndex) {
				onReorderSidebarSiblings("root", dragIndex, lastIndex);
				elementDragRef.current = { ...ref, indexInScope: lastIndex };
				lastReorderRef.current = {
					from: dragIndex,
					to: lastIndex,
					scope: "root",
				};
			}
			setDragOverKey(`root:${rootElements.length}`);
			return;
		}
	}

	function resetDragState() {
		setDraggedElementId(null);
		setDragOverKey(null);
		elementDragRef.current = null;
		lastReorderRef.current = null;
		lastDragActionAtRef.current = Date.now();
		window.setTimeout(() => {
			suppressClickRef.current = false;
		}, DRAG_CLICK_SUPPRESS_MS);
	}

	function dropInsertIndex(
		e: React.DragEvent,
		rowIndex: number,
		listLength: number,
	): number {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const mouseY = e.clientY;
		const centerY = rect.top + rect.height / 2;
		const raw = mouseY < centerY ? rowIndex : rowIndex + 1;
		return Math.min(raw, listLength);
	}

	function handleRowDrop(
		e: React.DragEvent,
		targetScope: SidebarScope,
		rowIndexInScope: number,
		listLengthInScope: number,
	) {
		e.preventDefault();
		e.stopPropagation();

		const paletteType = e.dataTransfer.getData(
			"application/x-template-element",
		);
		if (paletteType) {
			const kind = paletteType as TemplateElement["type"];
			if (targetScope === "root") {
				onAddElement(kind);
			} else {
				onAddElementToGroup(kind, targetScope.groupId);
			}
			resetDragState();
			return;
		}

		const draggedId = e.dataTransfer.getData("text/plain");
		if (!draggedId) {
			resetDragState();
			return;
		}

		const ref = elementDragRef.current;
		if (
			ref &&
			ref.elementId === draggedId &&
			scopeEquals(ref.scope, targetScope)
		) {
			resetDragState();
			return;
		}

		const insertIndex = dropInsertIndex(
			e,
			rowIndexInScope,
			listLengthInScope,
		);
		const parentId =
			targetScope === "root" ? undefined : targetScope.groupId;
		onMoveElementInTree(draggedId, parentId, insertIndex);
		resetDragState();
	}

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
					{PALETTE_ITEMS.filter((item) => !item.hidden && (designerMode !== "background" || BACKGROUND_ALLOWED_TYPES.has(item.type))).map((item) => {
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
						{dragOverKey === "root:-1" && draggedElementId && (
							<div className="h-0.5 bg-primary rounded-full animate-pulse" />
						)}
						{rootElements.map((el, rootIdx) => {
							const isRequiredField = elementIsRequired({
								fieldId: (el as { fieldId?: string }).fieldId,
								binding: (el as { binding?: string }).binding,
								itemsBinding: el.type === "table" ? el.itemsBinding : undefined,
							});
							const isDragging = draggedElementId === el.id;
							const isDragOver =
								dragOverKey === `${scopeKey("root")}:${rootIdx}`;
							const rowSurface = `px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-sm cursor-move truncate transition-all duration-200 ${
								state.selectedElementIds?.includes(el.id)
									? "bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary/30 dark:border-primary/50 shadow-md"
									: hoveredElementId === el.id
										? "bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/40"
										: "hover:bg-accent hover:shadow-sm border border-transparent hover:border-border"
							} ${isRequiredField ? "ring-1 ring-amber-400/50 dark:ring-amber-500/50" : ""} ${
								isDragging ? "opacity-50" : ""
							} ${isDragOver && !isDragging ? "border-primary/80 bg-primary/5" : ""}`;

							const groupChildren =
								el.type === "group"
									? sortElementsByZDescending(
											activeElements.filter(
												(c) => c.groupId === el.id,
											),
										)
									: [];
							const expanded =
								el.type !== "group" ||
								!collapsedGroupIds.has(el.id);

							return (
								<Fragment key={el.id}>
									<div className="relative">
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
															"root",
															rootIdx,
														)
													}
													onDragOver={(e) =>
														handleDragOverRow(
															e,
															"root",
															rootIdx,
														)
													}
													onDrop={(e) =>
														handleRowDrop(
															e,
															"root",
															rootIdx,
															rootElements.length,
														)
													}
													onDragEnd={resetDragState}
													className={rowSurface}
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
														<div className="w-5 shrink-0 flex justify-center">
															{el.type === "group" ? (
																<button
																	type="button"
																	className="p-0.5 rounded hover:bg-accent"
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		toggleGroupCollapsed(el.id);
																	}}
																	aria-label={
																		collapsedGroupIds.has(el.id)
																			? t(
																					"designer.sidebar.expandGroup",
																					"Expand group",
																				)
																			: t(
																					"designer.sidebar.collapseGroup",
																					"Collapse group",
																				)
																	}
																>
																	{collapsedGroupIds.has(el.id) ? (
																		<ChevronRight className="h-4 w-4 text-muted-foreground" />
																	) : (
																		<ChevronDown className="h-4 w-4 text-muted-foreground" />
																	)}
																</button>
															) : (
																<span className="inline-block w-5" />
															)}
														</div>
														<GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
														{isRequiredField && (
															<Lock className="h-3 w-3 text-amber-500 shrink-0" />
														)}
														{elementSidebarIcon(
															el,
															Boolean(
																state.selectedElementIds?.includes(
																	el.id,
																),
															),
														)}
														<span className="truncate flex-1 text-sm text-foreground">
															{elementSidebarTitle(el, t)}
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
									{el.type === "group" && expanded && (
										<div className="ml-4 pl-2 border-l border-border/60 space-y-2 mt-2">
											{groupChildren.length === 0 && (
												<div
													className="px-3 py-2 text-xs rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground"
													onDragOver={(e) => {
														e.preventDefault();
														e.dataTransfer.dropEffect =
															"copy";
													}}
													onDrop={(e) =>
														handleRowDrop(
															e,
															{ groupId: el.id },
															0,
															1,
														)
													}
												>
													{t(
														"designer.sidebar.dropIntoEmptyGroup",
														"Drop here to add inside this group",
													)}
												</div>
											)}
											{groupChildren.map((child, cIdx) => {
												const childScope: SidebarScope = {
													groupId: el.id,
												};
												const isReq = elementIsRequired({
													fieldId: (child as { fieldId?: string })
														.fieldId,
													binding: (child as { binding?: string })
														.binding,
													itemsBinding:
														child.type === "table"
															? child.itemsBinding
															: undefined,
												});
												const isDragC =
													draggedElementId === child.id;
												const isOverC =
													dragOverKey ===
													`${scopeKey(childScope)}:${cIdx}`;
												const rowC = `px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-sm cursor-move truncate transition-all duration-200 ${
													state.selectedElementIds?.includes(
														child.id,
													)
														? "bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary/30 dark:border-primary/50 shadow-md"
														: hoveredElementId === child.id
															? "bg-primary/5 dark:bg-primary/10 border border-primary/30 dark:border-primary/40"
															: "hover:bg-accent hover:shadow-sm border border-transparent hover:border-border"
												} ${isReq ? "ring-1 ring-amber-400/50 dark:ring-amber-500/50" : ""} ${
													isDragC ? "opacity-50" : ""
												} ${isOverC && !isDragC ? "border-primary/80 bg-primary/5" : ""}`;

												return (
													<div
														key={child.id}
														className="relative"
													>
														{isOverC && !isDragC && (
															<div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-primary rounded-full z-10" />
														)}
														<ContextMenu>
															<ContextMenuTrigger asChild>
																<div
																	draggable
																	onDragStart={(e) =>
																		handleDragStart(
																			e,
																			child.id,
																			childScope,
																			cIdx,
																		)
																	}
																	onDragOver={(e) =>
																		handleDragOverRow(
																			e,
																			childScope,
																			cIdx,
																		)
																	}
																	onDrop={(e) =>
																		handleRowDrop(
																			e,
																			childScope,
																			cIdx,
																			groupChildren.length,
																		)
																	}
																	onDragEnd={resetDragState}
																	className={rowC}
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
																		onSelectElement(child.id, e);
																	}}
																	onMouseEnter={() =>
																		onHoverElement?.(child.id)
																	}
																	onMouseLeave={() =>
																		onHoverElement?.(null)
																	}
																>
																	<div className="flex items-center gap-2">
																		<span className="inline-block w-5 shrink-0" />
																		<GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
																		{isReq && (
																			<Lock className="h-3 w-3 text-amber-500 shrink-0" />
																		)}
																		{elementSidebarIcon(
																			child,
																			Boolean(
																				state.selectedElementIds?.includes(
																					child.id,
																				),
																			),
																		)}
																		<span className="truncate flex-1 text-sm text-foreground">
																			{elementSidebarTitle(
																				child,
																				t,
																			)}
																		</span>
																	</div>
																</div>
															</ContextMenuTrigger>
															<ContextMenuContent>
																<ContextMenuItem
																	onClick={() =>
																		onSelectElement(child.id)
																	}
																>
																	{t(
																		"designer.sidebar.select",
																	)}
																</ContextMenuItem>
																<ContextMenuSeparator />
																<ContextMenuItem
																	onClick={() =>
																		onDuplicateElement(
																			child.id,
																		)
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
																		onDeleteElement(child.id)
																	}
																	variant="destructive"
																>
																	{t(
																		"designer.sidebar.delete",
																	)}
																</ContextMenuItem>
															</ContextMenuContent>
														</ContextMenu>
													</div>
												);
											})}
										</div>
									)}
								</Fragment>
							);
						})}
						{dragOverKey === `root:${rootElements.length}` &&
							draggedElementId && (
								<div className="h-0.5 bg-primary rounded-full animate-pulse" />
							)}
					</div>
				</div>
			</div>
		</div>
	);
}
