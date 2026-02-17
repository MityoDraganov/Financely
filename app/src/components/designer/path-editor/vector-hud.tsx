import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TemplateElement } from "@/core";
import type { ReactElement, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Circle,
	ChevronLeft,
	ChevronRight,
	Diamond,
	GripVertical,
	Minus,
	MousePointer2,
	PenTool,
	Plus,
	Scale,
	Square,
	SquarePen,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePathEditing, type PathEditorTool } from "./path-editing-context";

type PathElementModel = Extract<TemplateElement, { type: "path" }>;
type HudAnchor = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "free";

const HUD_SNAP_DISTANCE = 56;
const STORAGE_KEY = "designer.path.vectorHud.position.v2";

type HudPoint = { x: number; y: number };
type BoundsSize = { width: number; height: number };
type DragState = {
	startClientX: number;
	startClientY: number;
	originX: number;
	originY: number;
};

type PathVectorHudProps = {
	pathElementId?: string;
	pathElement?: PathElementModel;
	boundsRef?: RefObject<HTMLDivElement | null>;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function ToolButton({
	icon,
	label,
	description,
	active = false,
	onClick,
	disabled = false,
}: {
	icon: ReactNode;
	label: string;
	description?: string;
	active?: boolean;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={label}
					disabled={disabled}
					onClick={onClick}
					className={`h-8 w-8 rounded-lg transition-colors ${
						active
							? "bg-primary/15 text-primary hover:bg-primary/20"
							: "text-foreground/70 hover:text-foreground hover:bg-accent"
					}`}
				>
					{icon}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				<div className="space-y-0.5">
					<div className="font-medium">{label}</div>
					{description && <div className="text-[11px] text-muted-foreground">{description}</div>}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

function ActionTooltip({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: ReactElement;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				<div className="space-y-0.5">
					<div className="font-medium">{label}</div>
					{description && <div className="text-[11px] text-muted-foreground">{description}</div>}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

function MobileToolButton({
	icon,
	label,
	active = false,
	onClick,
	disabled = false,
}: {
	icon: ReactNode;
	label: string;
	active?: boolean;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={`h-9 w-9 rounded-lg transition-colors ${
				active
					? "bg-primary/15 text-primary"
					: "text-foreground/80"
			}`}
		>
			{icon}
		</Button>
	);
}

export function PathVectorHud({ pathElementId, pathElement, boundsRef }: PathVectorHudProps) {
	const path = usePathEditing();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const hudRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<DragState | null>(null);
	const dragPointRef = useRef<HudPoint | null>(null);
	const dragRafRef = useRef<number | null>(null);
	const [hudSize, setHudSize] = useState({ width: 920, height: 44 });
	const [boundsSize, setBoundsSize] = useState<BoundsSize>({ width: 0, height: 0 });
	const [anchor, setAnchor] = useState<HudAnchor>("top-right");
	const [freePosition, setFreePosition] = useState<HudPoint | null>(null);

	useEffect(() => {
		if (isMobile) return;
		if (typeof window === "undefined") return;
		try {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as {
				anchor?: HudAnchor;
				freePosition?: HudPoint | null;
			};
			if (parsed.anchor) setAnchor(parsed.anchor);
			if (parsed.freePosition) setFreePosition(parsed.freePosition);
		} catch {
			// Ignore malformed local storage.
		}
	}, [isMobile]);

	useEffect(() => {
		if (isMobile) return;
		if (typeof window === "undefined") return;
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ anchor, freePosition })
		);
	}, [anchor, freePosition, isMobile]);

	useEffect(() => {
		if (isMobile) return;
		const node = boundsRef?.current;
		if (!node) {
			setBoundsSize({ width: 0, height: 0 });
			return;
		}
		const updateSize = () => {
			setBoundsSize({
				width: node.clientWidth,
				height: node.clientHeight,
			});
		};
		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(node);
		return () => observer.disconnect();
	}, [boundsRef, isMobile]);

	useEffect(() => {
		if (isMobile) return;
		const node = hudRef.current;
		if (!node) return;
		const updateSize = () => {
			setHudSize({
				width: node.offsetWidth,
				height: node.offsetHeight,
			});
		};
		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(node);
		return () => observer.disconnect();
	}, [pathElementId, boundsSize.width, boundsSize.height, isMobile]);

	useEffect(() => {
		return () => {
			if (dragRafRef.current != null) {
				window.cancelAnimationFrame(dragRafRef.current);
				dragRafRef.current = null;
			}
		};
	}, []);

	const isEditing = path.editingPathElementId === pathElementId;
	const canEditNode = Boolean(path.selectedNodeId) && isEditing;
	const activeSubpath = isEditing ? path.activeSubpath : undefined;
	const selectedNode = isEditing ? path.selectedNode : undefined;
	const pointsCount = pathElement?.subpaths?.reduce((sum, subpath) => sum + subpath.nodes.length, 0) ?? 0;
	const subpathsCount = pathElement?.subpaths?.length ?? 0;

	const corners = useMemo(() => {
		if (boundsSize.width <= 0 || boundsSize.height <= 0) return null;
		const maxX = Math.max(0, boundsSize.width - hudSize.width);
		const maxY = Math.max(0, boundsSize.height - hudSize.height);
		return {
			"top-left": { x: 0, y: 0 },
			"top-right": { x: maxX, y: 0 },
			"bottom-left": { x: 0, y: maxY },
			"bottom-right": { x: maxX, y: maxY },
		} as const;
	}, [boundsSize.height, boundsSize.width, hudSize.height, hudSize.width]);

	const getVerticalBounds = useCallback((): { minY: number; maxY: number } => {
		if (!corners) return { minY: 0, maxY: 0 };
		const minCanvasY = corners["top-left"].y;
		const maxCanvasY = corners["bottom-left"].y;
		const boundsNode = boundsRef?.current;
		if (!boundsNode || typeof window === "undefined") {
			return { minY: minCanvasY, maxY: maxCanvasY };
		}
		const rect = boundsNode.getBoundingClientRect();
		const viewportMinY = -rect.top;
		const viewportMaxY = window.innerHeight - rect.top - hudSize.height;
		const minY = Math.max(minCanvasY, viewportMinY);
		const maxY = Math.min(maxCanvasY, viewportMaxY);
		if (maxY < minY) {
			return { minY, maxY: minY };
		}
		return { minY, maxY };
	}, [boundsRef, corners, hudSize.height]);

	const clampToBounds = useCallback((point: HudPoint): HudPoint => {
		if (!corners) return point;
		const { minY, maxY } = getVerticalBounds();
		return {
			x: clamp(point.x, corners["top-left"].x, corners["top-right"].x),
			y: clamp(point.y, minY, maxY),
		};
	}, [corners, getVerticalBounds]);

	const currentPosition = useMemo(() => {
		if (!corners) return { x: 0, y: 0 };
		const basePoint =
			anchor === "free"
				? (freePosition ?? corners["top-right"])
				: corners[anchor];
		return clampToBounds(basePoint);
	}, [anchor, corners, freePosition, clampToBounds]);

	const applyHudPosition = (point: HudPoint) => {
		const node = hudRef.current;
		if (!node) return;
		node.style.left = `${point.x}px`;
		node.style.top = `${point.y}px`;
	};

	const ensureEditingTool = (tool: PathEditorTool) => {
		if (!pathElementId) return;
		if (!isEditing) path.enterEditMode(pathElementId);
		path.setTool(tool);
	};

	const statusText = activeSubpath
		? `Subpath ${activeSubpath.index + 1}/${activeSubpath.total} • ${
				activeSubpath.closed ? "Closed" : "Open"
			} • ${activeSubpath.nodesCount} points`
		: `Path selected • ${subpathsCount} subpaths • ${pointsCount} points`;

	if (!pathElementId) return null;

	if (isMobile) {
		return (
			<div
				className="fixed inset-x-2 bottom-2 z-12000 animate-in fade-in duration-150"
				onPointerDown={(event) => {
					event.stopPropagation();
				}}
				onClick={(event) => {
					event.stopPropagation();
				}}
			>
				<div className="rounded-xl border border-border/70 bg-background/95 p-2 shadow-md backdrop-blur">
					<div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
						<MobileToolButton
							icon={<MousePointer2 className="h-4 w-4" />}
							label="Select (V)"
							active={isEditing && path.activeTool === "select"}
							onClick={() => ensureEditingTool("select")}
						/>
						<MobileToolButton
							icon={<Scale className="h-4 w-4" />}
							label="Node Tool (A)"
							active={isEditing && path.activeTool === "node"}
							onClick={() => ensureEditingTool("node")}
						/>
						<MobileToolButton
							icon={<PenTool className="h-4 w-4" />}
							label="Pen Tool (P)"
							active={isEditing && path.activeTool === "pen"}
							onClick={() => ensureEditingTool("pen")}
						/>
						<div className="mx-1 h-5 w-px shrink-0 bg-border/70" />
							<MobileToolButton
								icon={<Plus className="h-4 w-4" />}
								label="Add Point"
								onClick={() => ensureEditingTool("pen")}
							/>
							<MobileToolButton
								icon={<Minus className="h-4 w-4" />}
								label="Delete Point"
								disabled={!canEditNode}
								onClick={() => path.deleteSelectedNode()}
							/>
							<MobileToolButton
								icon={<SquarePen className="h-4 w-4" />}
								label={activeSubpath?.closed ? "Open Path" : "Close Path"}
								disabled={!isEditing || !activeSubpath}
								onClick={() => path.toggleActiveSubpathClosed(!(activeSubpath?.closed ?? false))}
							/>
						<div className="mx-1 h-5 w-px shrink-0 bg-border/70" />
						<MobileToolButton
							icon={<ChevronLeft className="h-4 w-4" />}
							label="Previous subpath"
							onClick={() => path.cycleSubpath(pathElementId, -1)}
							disabled={!isEditing || !activeSubpath || activeSubpath.total < 2}
						/>
						<MobileToolButton
							icon={<ChevronRight className="h-4 w-4" />}
							label="Next subpath"
							onClick={() => path.cycleSubpath(pathElementId, 1)}
							disabled={!isEditing || !activeSubpath || activeSubpath.total < 2}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-9 shrink-0 px-2 text-xs"
							onClick={() => {
								if (!isEditing) path.enterEditMode(pathElementId);
								path.createSubpath(pathElementId);
							}}
							disabled={!isEditing}
						>
							New
						</Button>
					</div>
					<div className="mt-1.5 flex items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-border/60 pt-1.5">
						{selectedNode ? (
							<>
								<Button
									type="button"
									size="sm"
									variant={selectedNode.handleType === "corner" ? "default" : "outline"}
									className="h-8 shrink-0 gap-1 px-2 text-xs"
									onClick={() => path.setSelectedNodeType("corner")}
								>
									<Square className="h-3.5 w-3.5" />
									Corner
								</Button>
								<Button
									type="button"
									size="sm"
									variant={selectedNode.handleType === "smooth" ? "default" : "outline"}
									className="h-8 shrink-0 gap-1 px-2 text-xs"
									onClick={() => path.setSelectedNodeType("smooth")}
								>
									<Circle className="h-3.5 w-3.5" />
									Smooth
								</Button>
								<Button
									type="button"
									size="sm"
									variant={selectedNode.handleType === "symmetric" ? "default" : "outline"}
									className="h-8 shrink-0 gap-1 px-2 text-xs"
									onClick={() => path.setSelectedNodeType("symmetric")}
								>
									<Diamond className="h-3.5 w-3.5" />
									Symmetric
								</Button>
							</>
						) : (
							<div className="px-1 text-xs text-foreground/65">Select node to edit type</div>
						)}
						<div className="mx-1 h-5 w-px shrink-0 bg-border/70" />
						<div className="px-1 text-xs text-foreground/70">{statusText}</div>
					</div>
				</div>
			</div>
		);
	}

	if (!corners) return null;

	return (
		<div
			ref={hudRef}
			className="absolute z-12000 animate-in fade-in zoom-in-95 duration-150"
			style={{
				left: currentPosition.x,
				top: currentPosition.y,
			}}
			onPointerDown={(event) => {
				event.stopPropagation();
			}}
			onClick={(event) => {
				event.stopPropagation();
			}}
		>
			<TooltipProvider delayDuration={500}>
				<div className="relative rounded-xl border border-border/70 bg-background/95 px-2 py-1 shadow-md backdrop-blur">
					<ActionTooltip label="Drag HUD (snaps to corners)">
						<button
							type="button"
							aria-label="Drag HUD"
							className="mr-1 inline-flex h-7 w-5 items-center justify-center rounded-md border border-border/70 bg-background text-foreground/70 cursor-grab active:cursor-grabbing align-middle"
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
								const startState: DragState = {
									startClientX: event.clientX,
									startClientY: event.clientY,
									originX: currentPosition.x,
									originY: currentPosition.y,
								};
								dragStateRef.current = startState;
								dragPointRef.current = { x: currentPosition.x, y: currentPosition.y };

								const handlePointerMove = (moveEvent: PointerEvent) => {
									const state = dragStateRef.current;
									if (!state) return;
									const dx = moveEvent.clientX - state.startClientX;
									const dy = moveEvent.clientY - state.startClientY;
									dragPointRef.current = clampToBounds({
										x: state.originX + dx,
										y: state.originY + dy,
									});
									if (dragRafRef.current != null) return;
									dragRafRef.current = window.requestAnimationFrame(() => {
										dragRafRef.current = null;
										const point = dragPointRef.current;
										if (!point) return;
										applyHudPosition(point);
									});
								};

								const handlePointerUp = () => {
									window.removeEventListener("pointermove", handlePointerMove);
									window.removeEventListener("pointerup", handlePointerUp);
									if (dragRafRef.current != null) {
										window.cancelAnimationFrame(dragRafRef.current);
										dragRafRef.current = null;
									}

									const released = dragPointRef.current ?? {
										x: currentPosition.x,
										y: currentPosition.y,
									};
									const { minY: topY, maxY: bottomY } = getVerticalBounds();
									const leftX = corners["top-left"].x;
									const rightX = corners["top-right"].x;
									const toLeft = Math.abs(released.x - leftX);
									const toRight = Math.abs(released.x - rightX);
									const toTop = Math.abs(released.y - topY);
									const toBottom = Math.abs(released.y - bottomY);
									const snapX = toLeft <= HUD_SNAP_DISTANCE || toRight <= HUD_SNAP_DISTANCE
										? toLeft <= toRight ? leftX : rightX
										: null;
									const snapY = toTop <= HUD_SNAP_DISTANCE || toBottom <= HUD_SNAP_DISTANCE
										? toTop <= toBottom ? topY : bottomY
										: null;

									if (snapX != null && snapY != null) {
										if (snapX === leftX && snapY === topY) setAnchor("top-left");
										else if (snapX === rightX && snapY === topY) setAnchor("top-right");
										else if (snapX === leftX && snapY === bottomY) setAnchor("bottom-left");
										else setAnchor("bottom-right");
										setFreePosition(null);
									} else {
										setAnchor("free");
										setFreePosition({
											x: snapX ?? released.x,
											y: snapY ?? released.y,
										});
									}
									dragStateRef.current = null;
									dragPointRef.current = null;
								};

								window.addEventListener("pointermove", handlePointerMove, { passive: true });
								window.addEventListener("pointerup", handlePointerUp, { once: true });
							}}
						>
							<GripVertical className="h-3 w-3" />
						</button>
					</ActionTooltip>

					<div className="inline-flex items-center gap-1 overflow-x-auto whitespace-nowrap align-middle">
						<ToolButton
							icon={<MousePointer2 className="h-4 w-4" />}
							label="Select (V)"
							description="Select and move the path object."
							active={isEditing && path.activeTool === "select"}
							onClick={() => ensureEditingTool("select")}
						/>
						<ToolButton
							icon={<Scale className="h-4 w-4" />}
							label="Node Tool (A)"
							description="Edit anchor points and handles."
							active={isEditing && path.activeTool === "node"}
							onClick={() => ensureEditingTool("node")}
						/>
						<ToolButton
							icon={<PenTool className="h-4 w-4" />}
							label="Pen Tool (P)"
							description="Add new points to the active subpath."
							active={isEditing && path.activeTool === "pen"}
							onClick={() => ensureEditingTool("pen")}
						/>
						<div className="mx-1 h-5 w-px bg-border/70" />
							<ToolButton
								icon={<Plus className="h-4 w-4" />}
								label="Add Point"
								description="Switch to Pen and place a new anchor."
								onClick={() => ensureEditingTool("pen")}
							/>
							<ToolButton
								icon={<Minus className="h-4 w-4" />}
								label="Delete Point"
								description="Delete the selected anchor point."
								disabled={!canEditNode}
								onClick={() => path.deleteSelectedNode()}
							/>
							<ToolButton
								icon={<SquarePen className="h-4 w-4" />}
								label={activeSubpath?.closed ? "Open Path" : "Close Path"}
								description={
									activeSubpath?.closed
										? "Reopen the active subpath."
										: "Connect end points to close the subpath."
								}
								disabled={!isEditing || !activeSubpath}
								onClick={() => path.toggleActiveSubpathClosed(!(activeSubpath?.closed ?? false))}
							/>
						<div className="mx-1 h-5 w-px bg-border/70" />
						<ActionTooltip
							label="Previous subpath"
							description="Select the previous subpath in this path."
						>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="h-7 w-7 rounded-md"
								onClick={() => path.cycleSubpath(pathElementId, -1)}
								disabled={!isEditing || !activeSubpath || activeSubpath.total < 2}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
						</ActionTooltip>
						<ActionTooltip
							label="Next subpath"
							description="Select the next subpath in this path."
						>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="h-7 w-7 rounded-md"
								onClick={() => path.cycleSubpath(pathElementId, 1)}
								disabled={!isEditing || !activeSubpath || activeSubpath.total < 2}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</ActionTooltip>
						<ActionTooltip
							label="Create new subpath"
							description="Add a new open subpath to this path object."
						>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-7 px-2 text-xs"
								onClick={() => {
									if (!isEditing) path.enterEditMode(pathElementId);
									path.createSubpath(pathElementId);
								}}
								disabled={!isEditing}
							>
								New
							</Button>
						</ActionTooltip>
						<div className="mx-1 h-5 w-px bg-border/70" />
						{selectedNode ? (
							<>
								<ToolButton
									icon={<Square className="h-3.5 w-3.5" />}
									label="Corner Node (1)"
									description="Sharp corner with independent handles."
									active={selectedNode.handleType === "corner"}
									onClick={() => path.setSelectedNodeType("corner")}
								/>
								<ToolButton
									icon={<Circle className="h-3.5 w-3.5" />}
									label="Smooth Node (2)"
									description="Handles stay aligned with independent lengths."
									active={selectedNode.handleType === "smooth"}
									onClick={() => path.setSelectedNodeType("smooth")}
								/>
								<ToolButton
									icon={<Diamond className="h-3.5 w-3.5" />}
									label="Symmetric Node (3)"
									description="Handles stay aligned and mirrored equally."
									active={selectedNode.handleType === "symmetric"}
									onClick={() => path.setSelectedNodeType("symmetric")}
								/>
							</>
						) : (
							<div className="px-1 text-xs text-foreground/65">Select node</div>
						)}
						<div className="mx-1 h-5 w-px bg-border/70" />
						<div className="max-w-[220px] truncate px-1 text-xs text-foreground/70">{statusText}</div>
					</div>
				</div>
			</TooltipProvider>
		</div>
	);
}
