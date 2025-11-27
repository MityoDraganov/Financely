export type DesignerState = {
	currentTemplateId?: string;
	selectedElementIds?: string[]; // Changed to array for multi-select
	zoom: number;
};

export type DragMode = "move" | "resize";

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
};

export type SnapGuide = {
	type: "horizontal" | "vertical";
	position: number;
	start: number;
	end: number;
};

