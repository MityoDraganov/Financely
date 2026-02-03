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
} as const;

function getPageDimensions(pageSize: string | undefined): { width: number; height: number } {
	return PAGE_SIZES[pageSize as keyof typeof PAGE_SIZES] || PAGE_SIZES.A4;
}

export function DesignerCanvas({
	template,
	draftElements,
	state,
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
	const pageDimensions = getPageDimensions(template?.pageSize);
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
									className={`absolute select-none ${state.selectedElementIds?.includes(el.id) ? "ring-2 ring-primary" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"} ${isRequiredField ? "ring-1 ring-amber-400 dark:ring-amber-500" : ""}`}
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

