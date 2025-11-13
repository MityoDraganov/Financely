import type { TemplateElement } from "@/core";

export type DesignerState = {
	currentTemplateId?: string;
	selectedElementId?: string;
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
};

export type SnapGuide = {
	type: "horizontal" | "vertical";
	position: number;
	start: number;
	end: number;
};

