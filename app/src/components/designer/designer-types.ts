export type DesignerState = {
	currentTemplateId?: string;
	selectedElementIds?: string[]; // Changed to array for multi-select
	zoom: number;
	showGrid?: boolean;
	snapEnabled?: boolean;
	editingTextElementId?: string;
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
