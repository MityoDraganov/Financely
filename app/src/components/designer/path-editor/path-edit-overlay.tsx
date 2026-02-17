import type { TemplateElement } from "@/core";
import { usePathEditing } from "./path-editing-context";

type PathElementModel = Extract<TemplateElement, { type: "path" }>;
type PathSubpathModel = NonNullable<PathElementModel["subpaths"]>[number];
type PathNodeModel = PathSubpathModel["nodes"][number];
type PathNodeType = "corner" | "smooth" | "symmetric";

type PathEditOverlayProps = {
	element: PathElementModel;
	zoom: number;
	isLocked: boolean;
};

function resolvePathNodeType(node: PathNodeModel): PathNodeType {
	if ("handleType" in node && node.handleType) return node.handleType;
	if ("type" in node && node.type) return node.type;
	return "corner";
}

function lerpPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
	};
}

function cubicPointAt(
	p0: { x: number; y: number },
	p1: { x: number; y: number },
	p2: { x: number; y: number },
	p3: { x: number; y: number },
	t: number
) {
	const a = lerpPoint(p0, p1, t);
	const b = lerpPoint(p1, p2, t);
	const c = lerpPoint(p2, p3, t);
	const d = lerpPoint(a, b, t);
	const e = lerpPoint(b, c, t);
	return lerpPoint(d, e, t);
}

function closestPointOnLineSegment(
	start: { x: number; y: number },
	end: { x: number; y: number },
	point: { x: number; y: number }
) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) {
		const distSq = (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
		return { t: 0, point: start, distSq };
	}
	const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq;
	const t = Math.max(0, Math.min(1, rawT));
	const projected = {
		x: start.x + dx * t,
		y: start.y + dy * t,
	};
	const distSq = (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2;
	return { t, point: projected, distSq };
}

function findClosestPathSegment(
	subpaths: PathSubpathModel[],
	point: { x: number; y: number }
): { subpathId: string; segmentStartNodeId: string; point: { x: number; y: number }; t: number; distSq: number } | null {
	let best: { subpathId: string; segmentStartNodeId: string; point: { x: number; y: number }; t: number; distSq: number } | null = null;

	subpaths.forEach((subpath) => {
		const nodes = subpath.nodes;
		if (nodes.length < 2) return;
		const last = subpath.closed ? nodes.length : nodes.length - 1;
		for (let i = 0; i < last; i += 1) {
			const current = nodes[i];
			const next = nodes[(i + 1) % nodes.length];
			const p0 = { x: current.x, y: current.y };
			const p3 = { x: next.x, y: next.y };
			const out = current.handleOut
				? { x: current.x + current.handleOut.x, y: current.y + current.handleOut.y }
				: p0;
			const input = next.handleIn
				? { x: next.x + next.handleIn.x, y: next.y + next.handleIn.y }
				: p3;
			const isCurve = Boolean(current.handleOut || next.handleIn);

			if (!isCurve) {
				const line = closestPointOnLineSegment(p0, p3, point);
				if (!best || line.distSq < best.distSq) {
					best = {
						subpathId: subpath.id,
						segmentStartNodeId: current.id,
						point: line.point,
						t: line.t,
						distSq: line.distSq,
					};
				}
				continue;
			}

			const steps = 36;
			let localBest: { point: { x: number; y: number }; t: number; distSq: number } | null = null;
			for (let step = 0; step <= steps; step += 1) {
				const t = step / steps;
				const sample = cubicPointAt(p0, out, input, p3, t);
				const distSq = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2;
				if (!localBest || distSq < localBest.distSq) {
					localBest = { point: sample, t, distSq };
				}
			}
			if (localBest && (!best || localBest.distSq < best.distSq)) {
				best = {
					subpathId: subpath.id,
					segmentStartNodeId: current.id,
					point: localBest.point,
					t: localBest.t,
					distSq: localBest.distSq,
				};
			}
		}
	});

	return best;
}

export function PathEditOverlay({ element, zoom, isLocked }: PathEditOverlayProps) {
	const path = usePathEditing();
	if (path.editingPathElementId !== element.id) return null;

	const pathSubpaths = element.subpaths ?? [];
	const activePathNodeId = path.selectedNodeId;
	const pathNodeSize = 10;
	const pathHandleSize = 8;
	const isPenTool = path.activeTool === "pen";
	const isNodeTool = path.activeTool === "node";

	return (
		<>
			<svg
				className="absolute inset-0 pointer-events-none"
				viewBox={`0 0 ${element.width} ${element.height}`}
				preserveAspectRatio="none"
			>
				<path
					d={element.pathData}
					fill="none"
					stroke="rgba(99, 102, 241, 0.92)"
					strokeWidth={Math.max(1.5 / zoom, 1)}
				/>
			</svg>
			{isPenTool && (
				<div
					className="absolute inset-0"
					style={{ cursor: "crosshair" }}
					onPointerDown={(event) => {
						if (isLocked || event.button !== 0) return;
						event.stopPropagation();
						const rect = event.currentTarget.getBoundingClientRect();
						const x = (event.clientX - rect.left) / zoom;
						const y = (event.clientY - rect.top) / zoom;
						path.addPenNode(element.id, { x, y });
					}}
				/>
			)}
			{isNodeTool && (
				<svg
					className="absolute inset-0"
					viewBox={`0 0 ${element.width} ${element.height}`}
					preserveAspectRatio="none"
				>
					<path
						d={element.pathData}
						fill="none"
						stroke="transparent"
						strokeWidth={Math.max(10 / zoom, 6)}
						pointerEvents="stroke"
						style={{ cursor: "copy" }}
						onPointerDown={(event) => {
							if (isLocked || event.button !== 0) return;
							event.stopPropagation();
							const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
							if (!rect) return;
							const x = (event.clientX - rect.left) / zoom;
							const y = (event.clientY - rect.top) / zoom;
							const closest = findClosestPathSegment(pathSubpaths, { x, y });
							if (!closest) return;
							const thresholdSq = (14 / zoom) ** 2;
							if (closest.distSq > thresholdSq) return;
							path.insertNodeOnSegment({
								elementId: element.id,
								subpathId: closest.subpathId,
								segmentStartNodeId: closest.segmentStartNodeId,
								point: closest.point,
								t: closest.t,
							});
						}}
					/>
				</svg>
			)}
			<svg
				className="absolute inset-0 pointer-events-none"
				viewBox={`0 0 ${element.width} ${element.height}`}
				preserveAspectRatio="none"
			>
				{pathSubpaths.map((subpath) =>
					subpath.nodes.flatMap((node) => {
						if (!activePathNodeId || node.id !== activePathNodeId) return [];
						const isActiveNode = activePathNodeId === node.id;
						const segments = [];
						if (node.handleIn) {
							segments.push(
								<line
									key={`${node.id}-in`}
									x1={node.x}
									y1={node.y}
									x2={node.x + node.handleIn.x}
									y2={node.y + node.handleIn.y}
									stroke={isActiveNode ? "rgba(245, 158, 11, 0.9)" : "rgba(99, 102, 241, 0.55)"}
									strokeWidth={1.25 / zoom}
								/>
							);
						}
						if (node.handleOut) {
							segments.push(
								<line
									key={`${node.id}-out`}
									x1={node.x}
									y1={node.y}
									x2={node.x + node.handleOut.x}
									y2={node.y + node.handleOut.y}
									stroke={isActiveNode ? "rgba(245, 158, 11, 0.9)" : "rgba(99, 102, 241, 0.55)"}
									strokeWidth={1.25 / zoom}
								/>
							);
						}
						return segments;
					})
				)}
			</svg>
			{pathSubpaths.map((subpath) =>
				subpath.nodes.map((node) => {
					const nodeType = resolvePathNodeType(node);
					const isActiveNode = activePathNodeId === node.id;
					const nodeSize = isActiveNode ? pathNodeSize + 2 : pathNodeSize;
					const nodeLeft = node.x * zoom - nodeSize / 2;
					const nodeTop = node.y * zoom - nodeSize / 2;
					const nodeShapeClass =
						nodeType === "corner"
							? "rounded-sm"
							: nodeType === "symmetric"
								? "rounded-[2px] rotate-45"
								: "rounded-full";
					const nodeBg =
						nodeType === "corner"
							? "bg-white"
							: nodeType === "symmetric"
								? "bg-indigo-100"
								: "bg-indigo-50";
					return (
						<div
							key={`${subpath.id}-${node.id}`}
							className={`absolute border transition-all duration-100 hover:scale-110 ${nodeShapeClass} ${nodeBg} ${
								isActiveNode ? "border-amber-500 shadow-sm" : "border-primary"
							}`}
							style={{
								left: nodeLeft,
								top: nodeTop,
								width: nodeSize,
								height: nodeSize,
								cursor: "pointer",
							}}
							onPointerDown={(event) => {
								if (isLocked || event.button !== 0) return;
								event.stopPropagation();
								path.selectNode({ elementId: element.id, subpathId: subpath.id, nodeId: node.id });
								path.startNodeDrag({
									elementId: element.id,
									subpathId: subpath.id,
									nodeId: node.id,
									clientX: event.clientX,
									clientY: event.clientY,
									breakHandles: event.altKey,
								});
							}}
							onDoubleClick={(event) => {
								if (isLocked) return;
								event.stopPropagation();
								path.setNodeType({
									elementId: element.id,
									nodeId: node.id,
									type: nodeType === "corner" ? "smooth" : "corner",
								});
							}}
						/>
					);
				})
			)}
			{pathSubpaths.map((subpath) =>
				subpath.nodes.flatMap((node) => {
					if (activePathNodeId && node.id !== activePathNodeId) return [];
					const handles: Array<{ type: "in" | "out"; x: number; y: number; id: string }> = [];
					if (node.handleIn) {
						handles.push({
							type: "in",
							x: node.x + node.handleIn.x,
							y: node.y + node.handleIn.y,
							id: `${node.id}-in`,
						});
					}
					if (node.handleOut) {
						handles.push({
							type: "out",
							x: node.x + node.handleOut.x,
							y: node.y + node.handleOut.y,
							id: `${node.id}-out`,
						});
					}
					return handles.map((handle) => (
						<div
							key={`${subpath.id}-${handle.id}`}
							className={`absolute rounded-full border ${
								activePathNodeId === node.id ? "border-amber-500 bg-amber-100" : "border-indigo-400 bg-white"
							}`}
							style={{
								left: handle.x * zoom - pathHandleSize / 2,
								top: handle.y * zoom - pathHandleSize / 2,
								width: pathHandleSize,
								height: pathHandleSize,
								cursor: "pointer",
							}}
							onPointerDown={(event) => {
								if (isLocked || event.button !== 0) return;
								event.stopPropagation();
								path.selectNode({ elementId: element.id, subpathId: subpath.id, nodeId: node.id });
								path.startNodeDrag({
									elementId: element.id,
									subpathId: subpath.id,
									nodeId: node.id,
									handleType: handle.type,
									clientX: event.clientX,
									clientY: event.clientY,
									breakHandles: event.altKey,
								});
							}}
						/>
					));
				})
			)}
		</>
	);
}
