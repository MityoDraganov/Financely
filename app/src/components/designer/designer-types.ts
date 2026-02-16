export type DesignerState = {
	currentTemplateId?: string;
	selectedElementIds?: string[]; // Changed to array for multi-select
	zoom: number;
	showGrid?: boolean;
	snapEnabled?: boolean;
	editingTextElementId?: string;
	editingPathElementId?: string; // Path element in edit mode
	activeTool?: "select" | "pen"; // Active tool for path editing
};

export type DragMode = "move" | "resize";
export type DragAxisLock = "x" | "y" | null;

export type DragState = {
	elementId: string;
	mode: DragMode;
	edge?: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startWidth?: number;
	startHeight?: number;
	// For multi-select drag: store initial positions of all selected elements
	selectedElementPositions?: Map<string, { x: number; y: number }>;
	ratioLock?: boolean;
	centerResize?: boolean;
	axisLock?: DragAxisLock;
	altDuplicate?: boolean;
};

export type SnapGuide = {
	type: "horizontal" | "vertical";
	position: number;
	start: number;
	end: number;
	kind?: "snap" | "distance";
	label?: string;
};

// Path node editing types
export type PathNodeType = "corner" | "smooth";

export type PathNode = {
	id: string;
	x: number; // Local coordinates (0 to element.width)
	y: number; // Local coordinates (0 to element.height)
	type: PathNodeType;
	handleIn?: { x: number; y: number } | null; // Relative to node position
	handleOut?: { x: number; y: number } | null; // Relative to node position
};

export type PathNodeDragState = {
	elementId: string;
	nodeId: string;
	handleType?: "in" | "out"; // Undefined = dragging node itself
	startClientX: number;
	startClientY: number;
	startNodeX: number;
	startNodeY: number;
	startHandleX?: number;
	startHandleY?: number;
	symmetricHandles?: boolean; // Tracks if Alt key was pressed (breaks symmetry)
};
