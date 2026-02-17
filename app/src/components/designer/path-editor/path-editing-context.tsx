import { createContext, useContext, type ReactNode } from "react";

export type PathEditorTool = "select" | "node" | "pen";
export type PathNodeType = "corner" | "smooth" | "symmetric";

export type PathSelectedNode = {
	id: string;
	handleType: PathNodeType;
	cornerRadius: number;
	hasHandleIn: boolean;
	hasHandleOut: boolean;
};

export type PathActiveSubpath = {
	id: string;
	closed: boolean;
	nodesCount: number;
	index: number;
	total: number;
};

type PathPoint = { x: number; y: number };

export type PathEditingContextValue = {
	editingPathElementId?: string;
	activeTool: PathEditorTool;
	selectedNodeId?: string;
	selectedSubpathId?: string;
	selectedNode?: PathSelectedNode;
	activeSubpath?: PathActiveSubpath;
	enterEditMode: (elementId: string) => void;
	exitEditMode: () => void;
	setTool: (tool: PathEditorTool) => void;
	selectNode: (options: { elementId: string; subpathId: string; nodeId: string }) => void;
	selectSubpath: (options: { elementId: string; subpathId: string }) => void;
	cycleSubpath: (elementId: string, direction: 1 | -1) => void;
	addPenNode: (elementId: string, point: PathPoint) => void;
	createSubpath: (elementId: string) => void;
	createSubpathForEditingPath: () => void;
	toggleSubpathClosed: (options: { elementId: string; subpathId: string; closed: boolean }) => void;
	toggleActiveSubpathClosed: (closed: boolean) => void;
	insertNodeOnSegment: (options: {
		elementId: string;
		subpathId: string;
		segmentStartNodeId: string;
		point: PathPoint;
		t?: number;
	}) => void;
	startNodeDrag: (options: {
		elementId: string;
		subpathId?: string;
		nodeId: string;
		handleType?: "in" | "out";
		clientX: number;
		clientY: number;
		breakHandles: boolean;
	}) => void;
	setNodeType: (options: { elementId: string; nodeId: string; type: PathNodeType }) => void;
	setSelectedNodeType: (type: PathNodeType) => void;
	toggleConvertSelectedNode: () => void;
	deleteNode: (options: { elementId: string; nodeId: string }) => void;
	deleteSelectedNode: () => void;
	addNodeHandles: (options: { elementId: string; nodeId: string }) => void;
	addHandlesToSelectedNode: () => void;
	removeNodeHandles: (options: { elementId: string; nodeId: string; handle: "in" | "out" | "both" }) => void;
	removeHandlesFromSelectedNode: (handle: "in" | "out" | "both") => void;
	setNodeCornerRadius: (options: { elementId: string; nodeId: string; radius: number }) => void;
	setSelectedNodeCornerRadius: (radius: number) => void;
};

const PathEditingContext = createContext<PathEditingContextValue | null>(null);

export function PathEditingProvider({
	value,
	children,
}: {
	value: PathEditingContextValue;
	children: ReactNode;
}) {
	return <PathEditingContext.Provider value={value}>{children}</PathEditingContext.Provider>;
}

export function usePathEditing() {
	const context = useContext(PathEditingContext);
	if (!context) {
		throw new Error("usePathEditing must be used within PathEditingProvider");
	}
	return context;
}
