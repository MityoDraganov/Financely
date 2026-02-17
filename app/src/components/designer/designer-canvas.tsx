import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Lock, Copy } from "lucide-react";
import { Template, TemplateElement } from "@/core";
import { LiveCursor } from "./live-cursor";
import { WatermarkRenderer } from "./watermark-renderer";
import {
	TextElement,
	ImageElement,
	BoxElement,
	LineElement,
	IconElement,
	InputElement,
	TableElement,
	PathElement,
} from "@/components/designer/elements";
import CurrencyElement from "@/components/designer/elements/currency";
import type { DesignerState, DragState, SnapGuide } from "./designer-types";
import type { UserPresence } from "@/services/presence/presence-service";
import { resolveTemplateMarginsPx } from "@/utils/print-margins";
import { PAGE_SIZES_PX } from "@/utils/page-size-presets";
import { getElementBorderRadiusCss, getElementPaddingCss } from "@/utils/element-box-model";
import { usePathEditing } from "./path-editor/path-editing-context";
import { PathEditOverlay } from "./path-editor/path-edit-overlay";
import { PathVectorHud } from "./path-editor/vector-hud";

type DesignerCanvasProps = {
	template: Template | undefined;
	draftElements: TemplateElement[] | null;
	state: DesignerState;
	hoveredElementId?: string | null;
	onHoverElement?: (id: string | null) => void;
	drag: DragState | null;
	snapGuides: SnapGuide[];
	activeUsers: UserPresence[];
	currentUserId?: string;
	pageRef: React.RefObject<HTMLDivElement | null>;
	onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
	onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
	onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
	onSelectElement: (id: string, event?: React.MouseEvent | React.PointerEvent) => void;
	onStartDrag: (element: TemplateElement, e: React.PointerEvent) => void;
	onStartResize: (element: TemplateElement, edge: DragState["edge"], e: React.PointerEvent) => void;
	onDuplicateElement: (id: string) => void;
	onDeleteElement: (id: string) => void;
	onSetElementLock?: (id: string, locked: boolean) => void;
	onCreateTemplate: () => void;
	isRequired: (binding: string | undefined) => boolean;
	onTableHeaderChange?: (tableId: string, columnId: string, header: string) => void;
	onStartTextEdit?: (id: string) => void;
	onUpdateTextInline?: (id: string, text: string) => void;
	onLassoSelect?: (
		rect: { x: number; y: number; width: number; height: number },
		append: boolean
	) => void;
	dragStartedRef?: React.MutableRefObject<boolean>; // Track if drag actually started (movement detected)
};

function getPageDimensions(template: Template | undefined): { width: number; height: number } {
	const pageSettings = template?.pageSettings;
	const sizeKey = pageSettings?.size && pageSettings.size !== "Custom"
		? pageSettings.size
		: template?.pageSize ?? "A4";
	const base = pageSettings?.size === "Custom" && pageSettings.customSize
		? {
				width: pageSettings.customSize.width,
				height: pageSettings.customSize.height,
			}
		: {
				width: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.w ?? PAGE_SIZES_PX.A4.w,
				height: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.h ?? PAGE_SIZES_PX.A4.h,
			};

	if (pageSettings?.orientation === "landscape") {
		return { width: base.height, height: base.width };
	}

	return base;
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
	const value = color.trim();
	const short = value.match(/^#([0-9a-fA-F]{3})$/);
	if (short) {
		const [r, g, b] = short[1].split("");
		return {
			r: parseInt(`${r}${r}`, 16),
			g: parseInt(`${g}${g}`, 16),
			b: parseInt(`${b}${b}`, 16),
		};
	}
	const full = value.match(/^#([0-9a-fA-F]{6})$/);
	if (!full) return null;
	return {
		r: parseInt(full[1].slice(0, 2), 16),
		g: parseInt(full[1].slice(2, 4), 16),
		b: parseInt(full[1].slice(4, 6), 16),
	};
}

function parseRgbColor(color: string): { r: number; g: number; b: number } | null {
	const match = color.trim().match(
		/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*[0-9.]+\s*)?\)$/i
	);
	if (!match) return null;
	return {
		r: Math.max(0, Math.min(255, Number(match[1]))),
		g: Math.max(0, Math.min(255, Number(match[2]))),
		b: Math.max(0, Math.min(255, Number(match[3]))),
	};
}

function resolveGridColor(backgroundColor: string | undefined): {
	minor: string;
} {
	const parsed =
		(backgroundColor && parseHexColor(backgroundColor)) ||
		(backgroundColor && parseRgbColor(backgroundColor)) ||
		null;
	if (!parsed) {
		return {
			minor: "rgba(15, 23, 42, 0.10)",
		};
	}
	const srgb = [parsed.r, parsed.g, parsed.b].map((channel) => channel / 255);
	const linear = srgb.map((channel) =>
		channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
	);
	const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
	const useLightLines = luminance < 0.45;
	return useLightLines
		? {
				minor: "rgba(255, 255, 255, 0.14)",
			}
		: {
				minor: "rgba(15, 23, 42, 0.12)",
			};
}

function getElementWrapperBackgroundColor(element: TemplateElement): string | undefined {
	if (element.type === "text") {
		return element.backgroundColor;
	}
	if (element.type === "icon") {
		// When icon has a shaped background, keep it rendered by the icon component itself.
		if (element.shape && element.shape !== "none") {
			return undefined;
		}
		return element.backgroundColor;
	}
	return undefined;
}

export function DesignerCanvas({
	template,
	draftElements,
	state,
	hoveredElementId,
	onHoverElement,
	drag,
	snapGuides,
	activeUsers,
	currentUserId,
	pageRef,
	onDragOver,
	onDrop,
	onMouseMove,
	onSelectElement,
	onStartDrag,
	onStartResize,
	onDuplicateElement,
	onDeleteElement,
	onSetElementLock,
	onCreateTemplate,
	isRequired,
	onTableHeaderChange,
	onStartTextEdit,
	onUpdateTextInline,
	onLassoSelect,
	dragStartedRef,
}: DesignerCanvasProps) {
	const path = usePathEditing();
	const canvasBoundsRef = useRef<HTMLDivElement | null>(null);
	const elements = draftElements ?? template?.elements ?? [];
	const isPathMode = Boolean(path.editingPathElementId);
	const [lassoRect, setLassoRect] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
		append: boolean;
	} | null>(null);
	const pageDimensions = getPageDimensions(template);
	const PAGE_WIDTH = pageDimensions.width;
	const PAGE_HEIGHT = pageDimensions.height;
	const margins = resolveTemplateMarginsPx(
		template?.pageSettings?.margins,
		template?.brand?.margins
	);
	const printableArea = {
		left: margins.left * state.zoom,
		top: margins.top * state.zoom,
		width: Math.max(0, (PAGE_WIDTH - margins.left - margins.right) * state.zoom),
		height: Math.max(0, (PAGE_HEIGHT - margins.top - margins.bottom) * state.zoom),
	};
	const pageBackgroundColor = template?.pageSettings?.backgroundColor;
	const gridColors = resolveGridColor(pageBackgroundColor);
	const minorGridSize = Math.max(4, 8 * state.zoom);
	const selectedPathElementId = (() => {
		if (path.editingPathElementId) return path.editingPathElementId;
		if ((state.selectedElementIds?.length ?? 0) !== 1) return undefined;
		const selectedId = state.selectedElementIds?.[0];
		const selectedElement = elements.find((el) => el.id === selectedId);
		return selectedElement?.type === "path" ? selectedElement.id : undefined;
	})();
	const selectedPathElement = selectedPathElementId
		? (elements.find((el) => el.id === selectedPathElementId && el.type === "path") as
				| Extract<TemplateElement, { type: "path" }>
				| undefined)
		: undefined;

	const startLasso = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement) !== e.currentTarget) return;
		if (!onLassoSelect) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const startX = (e.clientX - rect.left) / state.zoom;
		const startY = (e.clientY - rect.top) / state.zoom;
		const append = e.shiftKey;
		setLassoRect({
			x: startX,
			y: startY,
			width: 0,
			height: 0,
			append,
		});

		const handleMove = (ev: PointerEvent) => {
			const curX = (ev.clientX - rect.left) / state.zoom;
			const curY = (ev.clientY - rect.top) / state.zoom;
			setLassoRect({
				x: Math.min(startX, curX),
				y: Math.min(startY, curY),
				width: Math.abs(curX - startX),
				height: Math.abs(curY - startY),
				append,
			});
		};
		const handleUp = () => {
			setLassoRect((current) => {
				if (current && current.width > 1 && current.height > 1) {
					onLassoSelect(current, current.append);
				}
				return null;
			});
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};

		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	}, [onLassoSelect, state.zoom]);

	return (
		<div
			ref={canvasBoundsRef}
			data-designer-canvas-bounds="true"
			className="relative bg-muted/30 p-8"
			onDragOver={(e) => {
				e.preventDefault();
			}}
			onDrop={(e) => {
				e.preventDefault();
			}}
		>
			<PathVectorHud
				pathElementId={selectedPathElementId}
				pathElement={selectedPathElement}
				boundsRef={canvasBoundsRef}
			/>
			<div className="grid place-items-center min-h-full">
				{!template && (
					<div className="text-center text-muted-foreground p-8">
						<div className="text-sm mb-2">
							No template selected.
						</div>
						<div className="text-xs mb-4">
							Select an existing template from the
							dropdown above or create a new one to
							start designing.
						</div>
						<Button
							size="sm"
							onClick={onCreateTemplate}
						>
							<Plus className="mr-1 h-4 w-4" /> Create template
						</Button>
					</div>
				)}
				{template && (
					<div
						ref={pageRef}
						className="bg-white dark:bg-neutral-900 shadow-2xl relative rounded-sm border-4 border-neutral-200 dark:border-neutral-700 transition-all duration-300 hover:shadow-3xl"
						onClick={() => {
							// Deselect when clicking canvas; elements call stopPropagation so we only get here for empty space
							onSelectElement("");
						}}
						style={{
							width: PAGE_WIDTH * state.zoom,
							height: PAGE_HEIGHT * state.zoom,
							position: "relative",
							backgroundColor: template.pageSettings?.backgroundColor || undefined,
						}}
						onDragOver={onDragOver}
						onDrop={onDrop}
						onMouseMove={onMouseMove}
						onPointerDown={startLasso}
					>
				{/* Grid */}
				{state.showGrid !== false && (
					<div
						className="absolute inset-0 z-0 transition-opacity duration-150"
						style={{
							opacity: isPathMode ? 0.55 : 1,
							backgroundSize: [
								`${minorGridSize}px ${minorGridSize}px`,
								`${minorGridSize}px ${minorGridSize}px`,
							].join(", "),
							backgroundImage: [
								`linear-gradient(to right, ${gridColors.minor} 1px, transparent 1px)`,
								`linear-gradient(to bottom, ${gridColors.minor} 1px, transparent 1px)`,
							].join(", "),
						}}
						onDragOver={onDragOver}
						onDrop={onDrop}
					/>
				)}
				<div
					className="absolute pointer-events-none z-[2]"
					style={{
						left: printableArea.left,
						top: printableArea.top,
						width: printableArea.width,
						height: printableArea.height,
						border: "1px dashed rgba(99, 102, 241, 0.6)",
						boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.03)",
					}}
				/>
				{template.referenceLayer?.assetUrl && template.referenceLayer.visible !== false && (
					<div
						className="absolute pointer-events-none"
						style={{
							left: (template.referenceLayer.offsetX ?? 0) * state.zoom,
							top: (template.referenceLayer.offsetY ?? 0) * state.zoom,
							width: PAGE_WIDTH * state.zoom,
							height: PAGE_HEIGHT * state.zoom,
							opacity: template.referenceLayer.opacity ?? 0.3,
							transform: `scale(${template.referenceLayer.scale ?? 1}) rotate(${template.referenceLayer.rotation ?? 0}deg)`,
							transformOrigin: "top left",
							zIndex: 1,
						}}
					>
						<img
							src={template.referenceLayer.assetUrl}
							alt="Template source reference"
							className="w-full h-full object-contain"
						/>
					</div>
				)}
				{/* Snap guides */}
				{snapGuides.map((guide, idx) => (
					<div
						key={`snap-${idx}`}
						className="absolute pointer-events-none"
						style={{
							...(guide.type === "vertical"
								? {
										left: guide.position * state.zoom,
										top: guide.start * state.zoom,
										width: 1,
										height: (guide.end - guide.start) * state.zoom,
									}
								: {
										left: guide.start * state.zoom,
										top: guide.position * state.zoom,
										width: (guide.end - guide.start) * state.zoom,
										height: 1,
									}),
							backgroundColor: guide.kind === "distance" ? "#ec4899" : "#8b5cf6",
							boxShadow: "0 0 0 0.5px rgba(139, 92, 246, 0.5)",
							zIndex: 9999,
						}}
					>
						{guide.label && (
							<span
								className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] px-1 py-0.5 rounded bg-background border border-border text-foreground whitespace-nowrap"
							>
								{guide.label}
							</span>
						)}
					</div>
				))}
				{lassoRect && (
					<div
						className="absolute pointer-events-none border border-primary bg-primary/10 z-[10000]"
						style={{
							left: lassoRect.x * state.zoom,
							top: lassoRect.y * state.zoom,
							width: lassoRect.width * state.zoom,
							height: lassoRect.height * state.zoom,
						}}
					/>
				)}
				{/* Live cursors - exclude current user's cursor */}
				{activeUsers
					.filter(user => user.uid !== currentUserId)
					.map((user) => (
						<LiveCursor
							key={user.uid}
							user={user}
							zoom={state.zoom}
						/>
					))}
				
				{/* Watermark */}
				<WatermarkRenderer template={template} zoom={state.zoom} />
				
				{/* Elements */}
				{elements.map((el: TemplateElement) => {
					const binding = el.type === "text" ? el.binding :
						el.type === "input" ? el.binding :
						el.type === "image" ? el.binding :
						el.type === "currency" ? el.binding :
						el.type === "table" ? el.itemsBinding : undefined;
					const isRequiredField = isRequired(binding);
					const isLocked = el.locked === true;
					const elementPaddingCss = getElementPaddingCss(el);
					const elementBorderRadiusCss = getElementBorderRadiusCss(el);
					const elementWrapperBackgroundColor = getElementWrapperBackgroundColor(el);
					const pathElement = el.type === "path" ? (el as Extract<TemplateElement, { type: "path" }>) : null;
					const isPathEditing = pathElement != null && path.editingPathElementId === el.id;
					const pathSubpaths = pathElement?.subpaths ?? [];
					const activePathNodeId = isPathEditing ? path.selectedNodeId : undefined;
					const activePathSubpathId = isPathEditing ? path.selectedSubpathId : undefined;
					const activePathSubpath = activePathSubpathId
						? pathSubpaths.find((subpath) => subpath.id === activePathSubpathId)
						: undefined;
					const activePathNode = activePathNodeId
						? pathSubpaths.flatMap((subpath) => subpath.nodes).find((node) => node.id === activePathNodeId)
						: undefined;
					
					return (
						<ContextMenu key={el.id}>
							<ContextMenuTrigger asChild>
									<div
									className={`absolute select-none ${state.selectedElementIds?.includes(el.id) ? "ring-2 ring-primary" : ""} ${hoveredElementId === el.id && !state.selectedElementIds?.includes(el.id) ? "ring-2 ring-primary/50" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"} ${isRequiredField ? "ring-1 ring-amber-400 dark:ring-amber-500" : ""} ${isLocked ? "opacity-80" : ""}`}
									style={{
										left: el.x * state.zoom,
										top: el.y * state.zoom,
										width: el.width * state.zoom,
										height: el.type === "table" 
											? (el.headerHeight + el.rowHeight) * state.zoom // Preview: header + one row
											: el.height * state.zoom,
										transform: `rotate(${el.rotation}deg)`,
										touchAction: "none",
										userSelect: "none",
										WebkitUserSelect: "none",
										MozUserSelect: "none",
										msUserSelect: "none",
										boxSizing: "border-box",
										padding: elementPaddingCss,
										backgroundColor: elementWrapperBackgroundColor,
										borderRadius: elementBorderRadiusCss,
										overflow: elementBorderRadiusCss ? "hidden" : undefined,
										zIndex: el.zIndex ?? 10,
										opacity: isPathMode && !isPathEditing ? 0.6 : undefined,
									}}
									onMouseEnter={() => onHoverElement?.(el.id)}
									onMouseLeave={() => onHoverElement?.(null)}
									onPointerDown={(e) => {
										if (e.button !== 0) return;
										if (isLocked) return;
										// Don't prevent default here - we need click events to fire
										// We'll prevent text selection via CSS
										// Only start drag if there's actual movement (handled in pointer move)
										onStartDrag(el, e);
									}}
									onMouseDown={(e: React.MouseEvent) => {
										// Prevent text selection
										if (e.detail > 1) {
											e.preventDefault();
										}
									}}
									onClick={(e) => {
										e.stopPropagation(); // Prevent page onClick from firing
										// Only select if we didn't drag (check if drag actually started)
										// If dragStartedRef is true, it means we actually moved the pointer
										const didDrag = dragStartedRef?.current && drag?.elementId === el.id;
										if (!didDrag) {
											onSelectElement(el.id, e);
										}
									}}
									onDoubleClick={() => {
										if (el.type === "text" && !isLocked) {
											onStartTextEdit?.(el.id);
										}
									}}
								>
									{/* Lock icon for required fields */}
									{isRequiredField && (
										<div
											className="absolute -top-2 -left-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-full p-1 z-50 shadow-md border-2 border-white animate-pulse"
											title="Required field for compliance"
										>
											<Lock className="w-3 h-3" />
										</div>
									)}
									{/* Resize handles - only show for single selection */}
									{/* For tables, only show width resize handles (e, w) - height is calculated dynamically */}
									{state.selectedElementIds?.length === 1 && state.selectedElementIds?.includes(el.id) && !isLocked && (
										<>
											{(
												el.type === "table"
													? [
															// Only width resize for tables
															{ edge: "e" as const, cx: 1, cy: 0.5, cursor: "ew-resize" },
															{ edge: "w" as const, cx: 0, cy: 0.5, cursor: "ew-resize" },
														]
													: [
															// All resize handles for other elements
															{ edge: "nw" as const, cx: 0, cy: 0, cursor: "nwse-resize" },
															{ edge: "n" as const, cx: 0.5, cy: 0, cursor: "ns-resize" },
															{ edge: "ne" as const, cx: 1, cy: 0, cursor: "nesw-resize" },
															{ edge: "e" as const, cx: 1, cy: 0.5, cursor: "ew-resize" },
															{ edge: "se" as const, cx: 1, cy: 1, cursor: "nwse-resize" },
															{ edge: "s" as const, cx: 0.5, cy: 1, cursor: "ns-resize" },
															{ edge: "sw" as const, cx: 0, cy: 1, cursor: "nesw-resize" },
															{ edge: "w" as const, cx: 0, cy: 0.5, cursor: "ew-resize" },
														]
											).map((h) => (
												<div
													key={h.edge}
													className="absolute"
													style={{
														left: `calc(${h.cx * 100}% - 4px)`,
														top: `calc(${h.cy * 100}% - 4px)`,
														width: 8,
														height: 8,
														background: "hsl(var(--background))",
														border: "1px solid hsl(var(--primary))",
														borderRadius: 2,
														cursor: h.cursor as React.CSSProperties["cursor"],
													}}
													onPointerDown={(e) => {
														e.preventDefault();
														e.stopPropagation();
														onStartResize(el, h.edge, e);
													}}
												/>
											))}
										</>
									)}
									{el.type === "text" && (
										<>
											<TextElement
												element={el as Extract<TemplateElement, { type: "text" }>}
												zoom={state.zoom}
											/>
											{state.editingTextElementId === el.id && (
												<textarea
													autoFocus
													value={(el as Extract<TemplateElement, { type: "text" }>).text ?? ""}
													onChange={(event) => onUpdateTextInline?.(el.id, event.target.value)}
													onBlur={() => onStartTextEdit?.("")}
													className="absolute inset-0 w-full h-full resize-none bg-background/90 border border-primary outline-none p-1 text-foreground"
													style={{
														fontFamily: (el as Extract<TemplateElement, { type: "text" }>).typography.fontFamily,
														fontSize: (el as Extract<TemplateElement, { type: "text" }>).typography.fontSize * state.zoom,
														fontWeight: (el as Extract<TemplateElement, { type: "text" }>).typography.fontWeight,
													}}
												/>
											)}
										</>
									)}
									{el.type === "input" && (
										<InputElement
											element={el as Extract<TemplateElement, { type: "input" }>}
										/>
									)}
									{el.type === "image" && (
										<ImageElement
											element={el as Extract<TemplateElement, { type: "image" }>}
										/>
									)}
									{el.type === "box" && (
										<BoxElement
											element={el as Extract<TemplateElement, { type: "box" }>}
										/>
									)}
									{el.type === "line" && (
										<LineElement
											element={el as Extract<TemplateElement, { type: "line" }>}
										/>
									)}
									{el.type === "icon" && (
										<IconElement
											element={el as Extract<TemplateElement, { type: "icon" }>}
										/>
									)}
									{el.type === "currency" && (
										<CurrencyElement
											element={el as Extract<TemplateElement, { type: "currency" }>}
											zoom={state.zoom}
										/>
									)}
									{el.type === "table" && (() => {
										const tbl = el as Extract<TemplateElement, { type: "table" }>;
										return (
											<TableElement
												element={tbl}
												zoom={state.zoom}
												onHeaderChange={(columnId, header) => {
													if (onTableHeaderChange) {
														onTableHeaderChange(tbl.id, columnId, header);
													}
												}}
											/>
										);
									})()}
									{el.type === "spacer" && (() => {
										const spacer = el as Extract<TemplateElement, { type: "spacer" }>;
										return (
											<div className="w-full h-full flex items-center">
												{spacer.showDivider ? (
													<div
														className="w-full"
														style={{
															borderTopWidth: spacer.dividerWidth,
															borderTopStyle: spacer.dividerStyle,
															borderTopColor: spacer.dividerColor,
														}}
													/>
												) : (
													<div className="w-full h-full opacity-40 bg-slate-100 border border-dashed border-slate-300" />
												)}
											</div>
										);
									})()}
									{el.type === "pageBreak" && (() => {
										const pageBreak = el as Extract<TemplateElement, { type: "pageBreak" }>;
										if (pageBreak.showInEditor === false) return null;
										return (
											<div className="w-full h-full flex items-center">
												<div
													className="w-full text-center text-[10px] uppercase tracking-wide text-orange-600"
													style={{
														borderTop: pageBreak.style === "none"
															? "none"
															: pageBreak.style === "line"
																? "1px solid #f97316"
																: "1px dashed #f97316",
													}}
												>
													<span className="bg-white px-1 relative -top-2">Page Break</span>
												</div>
											</div>
										);
									})()}
									{el.type === "qrCode" && (() => {
										const qr = el as Extract<TemplateElement, { type: "qrCode" }>;
										return (
											<div
												className="w-full h-full grid place-items-center text-[10px] font-semibold"
												style={{
													background: qr.backgroundColor,
													color: qr.foregroundColor,
													border: "1px solid #d1d5db",
												}}
											>
												QR
											</div>
										);
									})()}
									{el.type === "barcode" && (() => {
										const barcode = el as Extract<TemplateElement, { type: "barcode" }>;
										return (
											<div
												className="w-full h-full flex flex-col items-center justify-center gap-1"
												style={{ background: barcode.backgroundColor, color: barcode.color }}
											>
												<div
													className="w-[92%] h-[60%]"
													style={{
														backgroundImage: "repeating-linear-gradient(to right, currentColor 0, currentColor 2px, transparent 2px, transparent 4px)",
													}}
												/>
												{barcode.showText && (
													<div className="text-[10px] tracking-widest">{barcode.value || "BARCODE"}</div>
												)}
											</div>
										);
									})()}
									{el.type === "signature" && (() => {
										const signature = el as Extract<TemplateElement, { type: "signature" }>;
										return (
											<div className="w-full h-full flex flex-col justify-end">
												{signature.signatureType === "image" && signature.signatureImage ? (
													<img src={signature.signatureImage} alt="Signature" className="max-h-[70%] object-contain object-left" />
												) : (
													<div className="text-[10px] text-slate-500 mb-1">
														{signature.placeholderText || "Signature"}
													</div>
												)}
												<div
													style={{
														borderBottomWidth: signature.borderBottom?.width ?? 1,
														borderBottomStyle: signature.borderBottom?.style ?? "solid",
														borderBottomColor: signature.borderBottom?.color ?? "#111827",
													}}
												/>
											</div>
										);
									})()}
									{el.type === "stamp" && (() => {
										const stamp = el as Extract<TemplateElement, { type: "stamp" }>;
										return (
											<div
												className="w-full h-full flex items-center justify-center uppercase tracking-wide"
												style={{
													color: stamp.textColor,
													background: stamp.backgroundColor,
													opacity: stamp.opacity,
													borderRadius: stamp.shape === "circle" ? "9999px" : 8,
													border: stamp.border ? `${stamp.border.width}px ${stamp.border.style} ${stamp.border.color}` : "1px solid currentColor",
													fontFamily: stamp.fontFamily,
													fontWeight: stamp.fontWeight,
													fontSize: stamp.fontSize,
												}}
											>
												{stamp.text}
											</div>
										);
									})()}
									{pathElement && (
										<div className="absolute inset-0">
											<PathElement element={pathElement} />
											<PathEditOverlay
												element={pathElement}
												zoom={state.zoom}
												isLocked={isLocked}
											/>
										</div>
									)}
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onClick={() => onSelectElement(el.id)}>
									Select
								</ContextMenuItem>
								{isPathEditing && activePathNode && (
									<>
										<ContextMenuSeparator />
										<ContextMenuItem
											onClick={() =>
												path.setNodeType({
													elementId: el.id,
													nodeId: activePathNode.id,
													type: "corner",
												})
											}
										>
											Convert to Corner
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												path.setNodeType({
													elementId: el.id,
													nodeId: activePathNode.id,
													type: "smooth",
												})
											}
										>
											Convert to Smooth
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												path.setNodeType({
													elementId: el.id,
													nodeId: activePathNode.id,
													type: "symmetric",
												})
											}
										>
											Convert to Symmetric
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												path.addNodeHandles({
													elementId: el.id,
													nodeId: activePathNode.id,
												})
											}
											disabled={Boolean(activePathNode.handleIn && activePathNode.handleOut)}
										>
											Add Handles
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												path.removeNodeHandles({
													elementId: el.id,
													nodeId: activePathNode.id,
													handle: "both",
												})
											}
											disabled={!activePathNode.handleIn && !activePathNode.handleOut}
										>
											Remove Handles
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												path.deleteNode({
													elementId: el.id,
													nodeId: activePathNode.id,
												})
											}
											variant="destructive"
										>
											Delete Anchor
										</ContextMenuItem>
									</>
								)}
								{isPathEditing && activePathSubpath && (
									<>
										<ContextMenuSeparator />
										<ContextMenuItem
											onClick={() =>
												path.toggleSubpathClosed({
													elementId: el.id,
													subpathId: activePathSubpath.id,
													closed: !activePathSubpath.closed,
												})
											}
											disabled={!activePathSubpath.closed && activePathSubpath.nodes.length < 3}
										>
											{activePathSubpath.closed ? "Open Subpath" : "Close Subpath"}
										</ContextMenuItem>
									</>
								)}
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => onDuplicateElement(el.id)}>
									<Copy className="mr-2 h-4 w-4" />
									Duplicate
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem
									onClick={() => onSetElementLock?.(el.id, !isLocked)}
								>
									{isLocked ? "Unlock" : "Lock"}
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => onDeleteElement(el.id)} variant="destructive">
									Delete
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					);
				})}
						</div>
				)}
			</div>
		</div>
	);
}
