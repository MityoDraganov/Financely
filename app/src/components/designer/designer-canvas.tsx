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
} from "@/components/designer/elements";
import CurrencyElement from "@/components/designer/elements/currency";
import type { DesignerState, DragState, SnapGuide } from "./designer-types";
import type { UserPresence } from "@/services/presence/presence-service";

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
	onCreateTemplate: () => void;
	isRequired: (binding: string | undefined) => boolean;
	onTableHeaderChange?: (tableId: string, columnId: string, header: string) => void;
	currentTemplateRef: React.MutableRefObject<Template | null>;
	saveMutation: { mutate: (data: { elements: TemplateElement[] }) => void };
	dragStartedRef?: React.MutableRefObject<boolean>; // Track if drag actually started (movement detected)
};

// Page dimensions in pixels (at 96 DPI to match PDF rendering)
const PAGE_SIZES = {
	A4: { width: 794, height: 1123 },
	Letter: { width: 816, height: 1056 },
	Legal: { width: 816, height: 1344 },
} as const;

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
		: PAGE_SIZES[sizeKey as keyof typeof PAGE_SIZES] || PAGE_SIZES.A4;

	if (pageSettings?.orientation === "landscape") {
		return { width: base.height, height: base.width };
	}

	return base;
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
	onCreateTemplate,
	isRequired,
	onTableHeaderChange,
	dragStartedRef,
}: DesignerCanvasProps) {
	const elements = draftElements ?? template?.elements ?? [];
	const pageDimensions = getPageDimensions(template);
	const PAGE_WIDTH = pageDimensions.width;
	const PAGE_HEIGHT = pageDimensions.height;

	return (
		<div className="bg-muted/30 p-8 pr-16"
			onDragOver={(e) => {
				e.preventDefault();
			}}
			onDrop={(e) => {
				e.preventDefault();
			}}
		>
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
					>
				{/* Grid */}
				<div
					className="absolute inset-0 z-0"
					style={{
						backgroundSize: `${8 * state.zoom}px ${8 * state.zoom}px`,
						backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
					}}
					onDragOver={onDragOver}
					onDrop={onDrop}
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
							backgroundColor: "#8b5cf6",
							boxShadow: "0 0 0 0.5px rgba(139, 92, 246, 0.5)",
							zIndex: 9999,
						}}
					/>
				))}
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
					
					return (
						<ContextMenu key={el.id}>
							<ContextMenuTrigger asChild>
									<div
									className={`absolute select-none ${state.selectedElementIds?.includes(el.id) ? "ring-2 ring-primary" : ""} ${hoveredElementId === el.id && !state.selectedElementIds?.includes(el.id) ? "ring-2 ring-primary/50" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"} ${isRequiredField ? "ring-1 ring-amber-400 dark:ring-amber-500" : ""}`}
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
										zIndex: el.zIndex ?? 10,
									}}
									onMouseEnter={() => onHoverElement?.(el.id)}
									onMouseLeave={() => onHoverElement?.(null)}
									onPointerDown={(e) => {
										if (e.button !== 0) return;
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
										console.log('[CLICK]', { 
											elementId: el.id, 
											shiftKey: e.shiftKey,
											dragStarted: dragStartedRef?.current,
											dragElementId: drag?.elementId
										});
										// Only select if we didn't drag (check if drag actually started)
										// If dragStartedRef is true, it means we actually moved the pointer
										const didDrag = dragStartedRef?.current && drag?.elementId === el.id;
										if (!didDrag) {
											onSelectElement(el.id, e);
										} else {
											console.log('[CLICK] Skipping selection because drag occurred');
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
									{state.selectedElementIds?.length === 1 && state.selectedElementIds?.includes(el.id) && (
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
										<TextElement
											element={el as Extract<TemplateElement, { type: "text" }>}
											zoom={state.zoom}
										/>
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
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onClick={() => onSelectElement(el.id)}>
									Select
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => onDuplicateElement(el.id)}>
									<Copy className="mr-2 h-4 w-4" />
									Duplicate
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
