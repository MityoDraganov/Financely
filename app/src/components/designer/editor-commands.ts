import { TemplateElement } from "@/core";
import { normalizeTableTextBehavior } from "@/utils/table-text-behavior";

/** Bottom hint strip in designer `TableElement` (`text-[10px]` + `p-2`). Group bounds must include it. */
const TABLE_EDITOR_HINT_STRIP_HEIGHT = 36;

export type Bounds = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

export type AlignMode =
	| "left"
	| "right"
	| "top"
	| "bottom"
	| "center-horizontal"
	| "center-vertical";

export type LayerMode = "forward" | "backward" | "front" | "back";
export type DistributionAxis = "horizontal" | "vertical";
export type EdgeDirection = "left" | "right" | "top" | "bottom";

export type ClipboardPayload = {
	elements: TemplateElement[];
	origin: { x: number; y: number };
};

export const DEFAULT_GROUP_INNER_PADDING = {
	top: 12,
	right: 12,
	bottom: 12,
	left: 12,
} as const;

export function resolveGroupInnerPadding(
	group: Extract<TemplateElement, { type: "group" }>
): { top: number; right: number; bottom: number; left: number } {
	return group.innerPadding ?? { ...DEFAULT_GROUP_INNER_PADDING };
}

/** Height used for layout (tables grow with design rows / footer). */
export function getTemplateElementVisualHeight(el: TemplateElement): number {
	if (el.type === "table") {
		const tbl = el;
		const rowCount = Math.max(1, tbl.designRows?.length ?? 1);
		const footerExtra = tbl.showFooter ? tbl.rowHeight : 0;
		let bodyHeight = tbl.rowHeight * rowCount;
		const rowBehavior = normalizeTableTextBehavior(tbl.rowStyle?.textBehavior, "wrap");
		if (rowBehavior.mode === "wrap" || rowBehavior.mode === "break-words") {
			bodyHeight += tbl.rowHeight;
		}
		return (
			tbl.headerHeight +
			bodyHeight +
			footerExtra +
			TABLE_EDITOR_HINT_STRIP_HEIGHT
		);
	}
	return el.height;
}

/** Position for a new child inside a group: top-left of padded interior, or below existing stack. */
export function computeNestPositionInsideGroup(
	elements: TemplateElement[],
	groupId: string
): { x: number; y: number } {
	const group = elements.find(
		(e) => e.id === groupId && e.type === "group"
	) as Extract<TemplateElement, { type: "group" }> | undefined;
	if (!group) {
		return { x: 60, y: 80 };
	}
	const pad = resolveGroupInnerPadding(group);
	const innerLeft = group.x + pad.left;
	const innerTop = group.y + pad.top;
	const children = elements.filter((e) => e.groupId === groupId);
	if (children.length === 0) {
		return { x: innerLeft, y: innerTop };
	}
	let maxBottom = innerTop;
	for (const c of children) {
		const bottom = c.y + getTemplateElementVisualHeight(c);
		if (bottom > maxBottom) {
			maxBottom = bottom;
		}
	}
	const gap = 8;
	return { x: innerLeft, y: maxBottom + gap };
}

function shallowCloneElements(elements: TemplateElement[]): TemplateElement[] {
	return elements.map((el) => ({ ...el }));
}

function isSelected(selectedIds: string[], id: string): boolean {
	return selectedIds.includes(id);
}

function isUnlockedSelected(selectedIds: string[], element: TemplateElement): boolean {
	return isSelected(selectedIds, element.id) && !element.locked;
}

function clampMove(
	x: number,
	y: number,
	width: number,
	height: number,
	bounds: Bounds
): { x: number; y: number } {
	const minX = bounds.left;
	const minY = bounds.top;
	const maxX = Math.max(minX, bounds.right - width);
	const maxY = Math.max(minY, bounds.bottom - height);
	return {
		x: Math.min(Math.max(minX, x), maxX),
		y: Math.min(Math.max(minY, y), maxY),
	};
}

function stripBindings(element: TemplateElement): TemplateElement {
	if (element.type === "text") return { ...element, binding: undefined };
	if (element.type === "input") return { ...element, binding: undefined };
	if (element.type === "image") return { ...element, binding: undefined };
	if (element.type === "currency") return { ...element, binding: undefined };
	if (element.type === "table") return { ...element, itemsBinding: "" };
	return { ...element };
}

function normalizeZIndex(elements: TemplateElement[]): TemplateElement[] {
	const ordered = elements
		.map((el, index) => ({ el, index }))
		.sort((a, b) => {
			const az = a.el.zIndex ?? 0;
			const bz = b.el.zIndex ?? 0;
			if (az !== bz) return az - bz;
			return a.index - b.index;
		});
	return ordered.map((item, index) => ({
		...item.el,
		zIndex: index + 1,
	}));
}

function getSelectionBounds(elements: TemplateElement[], selectedIds: string[]): {
	left: number;
	top: number;
	right: number;
	bottom: number;
} | null {
	const selected = elements.filter((el) => isSelected(selectedIds, el.id));
	if (selected.length === 0) return null;
	return {
		left: Math.min(...selected.map((el) => el.x)),
		top: Math.min(...selected.map((el) => el.y)),
		right: Math.max(...selected.map((el) => el.x + el.width)),
		bottom: Math.max(...selected.map((el) => el.y + el.height)),
	};
}

export function deleteSelection(
	elements: TemplateElement[],
	selectedIds: string[]
): { elements: TemplateElement[]; removedIds: string[] } {
	const directlyRemoved = elements
		.filter((el) => isSelected(selectedIds, el.id) && !el.locked)
		.map((el) => el.id);

	// Also remove children of any deleted group containers
	const deletedGroupIds = new Set(
		elements
			.filter((el) => directlyRemoved.includes(el.id) && el.type === "group")
			.map((el) => el.id)
	);
	const orphanedChildIds = deletedGroupIds.size > 0
		? elements
			.filter((el) => el.groupId != null && deletedGroupIds.has(el.groupId))
			.map((el) => el.id)
		: [];

	const removedIds = [...new Set([...directlyRemoved, ...orphanedChildIds])];
	return {
		elements: elements.filter((el) => !removedIds.includes(el.id)),
		removedIds,
	};
}

export function moveSelection(
	elements: TemplateElement[],
	selectedIds: string[],
	dx: number,
	dy: number,
	bounds: Bounds
): TemplateElement[] {
	return elements.map((el) => {
		if (!isUnlockedSelected(selectedIds, el)) return el;
		const next = clampMove(el.x + dx, el.y + dy, el.width, el.height, bounds);
		return {
			...el,
			x: next.x,
			y: next.y,
		};
	});
}

export function jumpSelectionToEdge(
	elements: TemplateElement[],
	selectedIds: string[],
	direction: EdgeDirection,
	bounds: Bounds
): TemplateElement[] {
	return elements.map((el) => {
		if (!isUnlockedSelected(selectedIds, el)) return el;
		let targetX = el.x;
		let targetY = el.y;
		if (direction === "left") targetX = bounds.left;
		if (direction === "right") targetX = Math.max(bounds.left, bounds.right - el.width);
		if (direction === "top") targetY = bounds.top;
		if (direction === "bottom") targetY = Math.max(bounds.top, bounds.bottom - el.height);
		return {
			...el,
			x: targetX,
			y: targetY,
		};
	});
}

export function resizeSelectionByKeyboard(
	elements: TemplateElement[],
	selectedIds: string[],
	dw: number,
	dh: number,
	bounds: Bounds
): TemplateElement[] {
	return elements.map((el) => {
		if (!isUnlockedSelected(selectedIds, el)) return el;
		const width = Math.max(8, el.width + dw);
		const height = Math.max(8, el.height + dh);
		const clamped = clampMove(el.x, el.y, width, height, bounds);
		const maxWidth = Math.max(8, bounds.right - clamped.x);
		const maxHeight = Math.max(8, bounds.bottom - clamped.y);
		return {
			...el,
			x: clamped.x,
			y: clamped.y,
			width: Math.min(width, maxWidth),
			height: Math.min(height, maxHeight),
		};
	});
}

export function duplicateSelection(
	elements: TemplateElement[],
	selectedIds: string[],
	bounds: Bounds,
	options?: {
		offsetX?: number;
		offsetY?: number;
		clearBindings?: boolean;
	}
): { elements: TemplateElement[]; newIds: string[] } {
	const offsetX = options?.offsetX ?? 20;
	const offsetY = options?.offsetY ?? 20;
	const clearBindings = options?.clearBindings ?? true;

	const selected = elements.filter((el) => isSelected(selectedIds, el.id) && !el.locked);
	if (selected.length === 0) {
		return { elements, newIds: [] };
	}

	// Remap group container ids so duplicated children point to the duplicated container
	const groupIdRemap = new Map<string, string>();
	for (const el of selected) {
		if (el.type === "group") {
			groupIdRemap.set(el.id, crypto.randomUUID());
		}
	}

	// Also include children of any selected group containers that aren't already selected
	const selectedGroupIds = new Set(selected.filter((el) => el.type === "group").map((el) => el.id));
	const implicitChildren = selectedGroupIds.size > 0
		? elements.filter(
			(el) => el.groupId != null && selectedGroupIds.has(el.groupId) && !isSelected(selectedIds, el.id)
		)
		: [];
	const allToDuplicate = [...selected, ...implicitChildren];

	const duplicates: TemplateElement[] = allToDuplicate.map((el) => {
		const base = clearBindings ? stripBindings(el) : { ...el };
		const newId = groupIdRemap.get(el.id) ?? crypto.randomUUID();
		const nextPos = clampMove(el.x + offsetX, el.y + offsetY, el.width, el.height, bounds);
		const newGroupId = el.groupId != null && groupIdRemap.has(el.groupId)
			? groupIdRemap.get(el.groupId)
			: el.groupId;
		return {
			...base,
			id: newId,
			groupId: newGroupId,
			x: nextPos.x,
			y: nextPos.y,
		};
	});

	return {
		elements: [...elements, ...duplicates],
		newIds: duplicates.map((el) => el.id),
	};
}

export function alignSelection(
	elements: TemplateElement[],
	selectedIds: string[],
	mode: AlignMode
): TemplateElement[] {
	const selected = elements.filter((el) => isUnlockedSelected(selectedIds, el));
	if (selected.length < 2) return elements;
	const bounds = getSelectionBounds(elements, selectedIds);
	if (!bounds) return elements;

	return elements.map((el) => {
		if (!isUnlockedSelected(selectedIds, el)) return el;
		switch (mode) {
			case "left":
				return { ...el, x: bounds.left };
			case "right":
				return { ...el, x: bounds.right - el.width };
			case "top":
				return { ...el, y: bounds.top };
			case "bottom":
				return { ...el, y: bounds.bottom - el.height };
			case "center-horizontal":
				return { ...el, x: bounds.left + (bounds.right - bounds.left - el.width) / 2 };
			case "center-vertical":
				return { ...el, y: bounds.top + (bounds.bottom - bounds.top - el.height) / 2 };
			default:
				return el;
		}
	});
}

export function distributeSelection(
	elements: TemplateElement[],
	selectedIds: string[],
	axis: DistributionAxis
): TemplateElement[] {
	const selected = elements
		.filter((el) => isUnlockedSelected(selectedIds, el))
		.sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
	if (selected.length < 3) return elements;

	const first = selected[0];
	const last = selected[selected.length - 1];
	const totalSize = selected.reduce(
		(sum, el) => sum + (axis === "horizontal" ? el.width : el.height),
		0
	);
	const span =
		(axis === "horizontal" ? last.x + last.width - first.x : last.y + last.height - first.y) -
		totalSize;
	const gap = span / (selected.length - 1);

	let cursor = axis === "horizontal" ? first.x : first.y;
	const targetMap = new Map<string, number>();
	selected.forEach((el, index) => {
		if (index === 0 || index === selected.length - 1) return;
		cursor += axis === "horizontal" ? selected[index - 1].width + gap : selected[index - 1].height + gap;
		targetMap.set(el.id, cursor);
	});

	return elements.map((el) => {
		const target = targetMap.get(el.id);
		if (target == null) return el;
		return axis === "horizontal" ? { ...el, x: target } : { ...el, y: target };
	});
}

export function reorderSelectionLayer(
	elements: TemplateElement[],
	selectedIds: string[],
	mode: LayerMode
): TemplateElement[] {
	const normalized = normalizeZIndex(shallowCloneElements(elements));
	const ordered = [...normalized].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
	const selected = ordered.filter((el) => isUnlockedSelected(selectedIds, el));
	if (selected.length === 0) return elements;

	if (mode === "front") {
		const selectedIdsSet = new Set(selected.map((el) => el.id));
		const unselected = ordered.filter((el) => !selectedIdsSet.has(el.id));
		const reassigned = [...unselected, ...selected].map((el, idx) => ({
			...el,
			zIndex: idx + 1,
		}));
		return reassigned;
	}
	if (mode === "back") {
		const selectedIdsSet = new Set(selected.map((el) => el.id));
		const unselected = ordered.filter((el) => !selectedIdsSet.has(el.id));
		const reassigned = [...selected, ...unselected].map((el, idx) => ({
			...el,
			zIndex: idx + 1,
		}));
		return reassigned;
	}

	const step = mode === "forward" ? 1 : -1;
	const zMap = new Map<string, number>(ordered.map((el) => [el.id, el.zIndex ?? 1]));
	const traverse = mode === "forward" ? [...selected].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)) : [...selected].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
	for (const el of traverse) {
		const current = zMap.get(el.id) ?? 1;
		const target = current + step;
		const swap = ordered.find((item) => (zMap.get(item.id) ?? 0) === target);
		if (!swap) continue;
		if (swap.locked) continue;
		zMap.set(el.id, target);
		zMap.set(swap.id, current);
	}
	return ordered.map((el) => ({ ...el, zIndex: zMap.get(el.id) ?? el.zIndex ?? 1 }));
}

export function setLockSelection(
	elements: TemplateElement[],
	selectedIds: string[],
	locked: boolean
): TemplateElement[] {
	return elements.map((el) =>
		isSelected(selectedIds, el.id)
			? {
					...el,
					locked,
				}
			: el
	);
}

export function groupSelection(
	elements: TemplateElement[],
	selectedIds: string[]
): { elements: TemplateElement[]; groupId: string | null } {
	const selected = elements.filter((el) => isSelected(selectedIds, el.id));
	if (selected.length < 2) return { elements, groupId: null };

	const groupId = crypto.randomUUID();
	const minZ = Math.min(...selected.map((el) => el.zIndex ?? 0));
	const containerZ = Math.max(0, minZ - 1);

	const container: TemplateElement = {
		type: "group",
		id: groupId,
		label: undefined,
		x: Math.min(...selected.map((el) => el.x)),
		y: Math.min(...selected.map((el) => el.y)),
		width: Math.max(...selected.map((el) => el.x + el.width)) - Math.min(...selected.map((el) => el.x)),
		height: Math.max(...selected.map((el) => el.y + el.height)) - Math.min(...selected.map((el) => el.y)),
		zIndex: containerZ,
		visible: true,
		locked: false,
		opacity: 1,
	} as unknown as TemplateElement;

	const updated = elements.map((el) =>
		isSelected(selectedIds, el.id) ? { ...el, groupId } : el
	);

	return {
		elements: [...updated, container],
		groupId,
	};
}

export function ungroupSelection(
	elements: TemplateElement[],
	selectedIds: string[]
): TemplateElement[] {
	// Collect group container ids that are directly selected
	const selectedContainerIds = new Set(
		elements
			.filter((el) => isSelected(selectedIds, el.id) && el.type === "group")
			.map((el) => el.id)
	);
	if (selectedContainerIds.size === 0) return elements;

	return elements
		.filter((el) => !selectedContainerIds.has(el.id))
		.map((el) =>
			el.groupId != null && selectedContainerIds.has(el.groupId)
				? { ...el, groupId: undefined }
				: el
		);
}

export type SidebarScope = "root" | { groupId: string };

export function sortElementsByZDescending(elements: TemplateElement[]): TemplateElement[] {
	return [...elements]
		.map((el, index) => ({ el, index }))
		.sort((a, b) => {
			const aZ = a.el.zIndex ?? 0;
			const bZ = b.el.zIndex ?? 0;
			if (aZ !== bZ) return bZ - aZ;
			return a.index - b.index;
		})
		.map(({ el }) => el);
}

/** Root layer: no parent or broken group reference. */
export function isRootLayerElement(elements: TemplateElement[], el: TemplateElement): boolean {
	if (el.groupId == null) return true;
	const parent = elements.find((e) => e.id === el.groupId && e.type === "group");
	return parent == null;
}

export function getSidebarSiblings(elements: TemplateElement[], scope: SidebarScope): TemplateElement[] {
	if (scope === "root") {
		return sortElementsByZDescending(elements.filter((el) => isRootLayerElement(elements, el)));
	}
	return sortElementsByZDescending(elements.filter((el) => el.groupId === scope.groupId));
}

export function collectSubtreeDescendantIds(elements: TemplateElement[], rootId: string): Set<string> {
	const out = new Set<string>();
	const queue = [rootId];
	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) continue;
		for (const el of elements) {
			if (el.groupId !== id) continue;
			if (out.has(el.id)) continue;
			out.add(el.id);
			if (el.type === "group") queue.push(el.id);
		}
	}
	return out;
}

export function assignElementParentGroup(
	elements: TemplateElement[],
	elementId: string,
	newGroupId: string | undefined
): TemplateElement[] | null {
	const el = elements.find((e) => e.id === elementId);
	if (!el) return null;

	if (newGroupId != null) {
		const target = elements.find((e) => e.id === newGroupId && e.type === "group");
		if (!target) return null;
		if (newGroupId === elementId) return null;
		if (el.type === "group") {
			const desc = collectSubtreeDescendantIds(elements, elementId);
			if (desc.has(newGroupId)) return null;
		}
	}

	let nextEl: TemplateElement =
		newGroupId == null
			? ({ ...el, groupId: undefined } as TemplateElement)
			: ({ ...el, groupId: newGroupId } as TemplateElement);

	if (newGroupId != null) {
		const nestAt = computeNestPositionInsideGroup(elements, newGroupId);
		nextEl = {
			...nextEl,
			x: nestAt.x,
			y: nestAt.y,
		} as TemplateElement;
	}

	return elements.map((e) => (e.id === elementId ? nextEl : e));
}

export function reorderSidebarSiblings(
	elements: TemplateElement[],
	scope: SidebarScope,
	fromIndex: number,
	toIndex: number
): TemplateElement[] | null {
	const siblings = getSidebarSiblings(elements, scope);
	if (fromIndex < 0 || toIndex < 0 || fromIndex >= siblings.length || toIndex >= siblings.length) {
		return null;
	}
	if (fromIndex === toIndex) return elements;

	const reordered = [...siblings];
	const [moved] = reordered.splice(fromIndex, 1);
	reordered.splice(toIndex, 0, moved);

	const zMultiset = siblings.map((s) => s.zIndex ?? 0).sort((a, b) => b - a);
	const idToZ = new Map(reordered.map((s, i) => [s.id, zMultiset[i] ?? 1]));

	return elements.map((el) => {
		const nz = idToZ.get(el.id);
		if (nz === undefined) return el;
		return { ...el, zIndex: nz };
	});
}

export function moveElementToParentAtIndex(
	elements: TemplateElement[],
	elementId: string,
	newGroupId: string | undefined,
	insertIndex: number
): TemplateElement[] | null {
	const assigned = assignElementParentGroup(elements, elementId, newGroupId);
	if (!assigned) return null;
	const scope: SidebarScope = newGroupId == null ? "root" : { groupId: newGroupId };
	const siblingsAfter = getSidebarSiblings(assigned, scope);
	const newIdx = siblingsAfter.findIndex((s) => s.id === elementId);
	if (newIdx < 0) return null;
	const clampedTo = Math.max(
		0,
		Math.min(insertIndex, siblingsAfter.length - 1),
	);
	return reorderSidebarSiblings(assigned, scope, newIdx, clampedTo);
}

export function syncGroupBoundingBoxes(elements: TemplateElement[]): TemplateElement[] {
	const groupContainerIds = new Set(
		elements.filter((el) => el.type === "group").map((el) => el.id)
	);
	if (groupContainerIds.size === 0) return elements;

	const childrenByGroup = new Map<string, TemplateElement[]>();
	for (const el of elements) {
		if (el.groupId == null || !groupContainerIds.has(el.groupId)) continue;
		const arr = childrenByGroup.get(el.groupId) ?? [];
		arr.push(el);
		childrenByGroup.set(el.groupId, arr);
	}

	return elements.map((el) => {
		if (el.type !== "group") return el;
		const children = childrenByGroup.get(el.id);
		if (!children || children.length === 0) return el;
		const left = Math.min(...children.map((c) => c.x));
		const top = Math.min(...children.map((c) => c.y));
		const right = Math.max(...children.map((c) => c.x + c.width));
		const bottom = Math.max(
			...children.map((c) => c.y + getTemplateElementVisualHeight(c))
		);
		const pad = resolveGroupInnerPadding(el);
		return {
			...el,
			x: left - pad.left,
			y: top - pad.top,
			width: right - left + pad.left + pad.right,
			height: bottom - top + pad.top + pad.bottom,
		};
	});
}

export function createClipboardPayload(
	elements: TemplateElement[],
	selectedIds: string[]
): ClipboardPayload | null {
	const picked = elements.filter((el) => isSelected(selectedIds, el.id));
	if (picked.length === 0) return null;
	const origin = {
		x: Math.min(...picked.map((el) => el.x)),
		y: Math.min(...picked.map((el) => el.y)),
	};
	return {
		elements: picked.map((el) => ({ ...el })),
		origin,
	};
}

export function pasteClipboard(
	elements: TemplateElement[],
	clipboard: ClipboardPayload,
	bounds: Bounds,
	options?: {
		target?: { x: number; y: number } | null;
		offsetX?: number;
		offsetY?: number;
		clearBindings?: boolean;
	}
): { elements: TemplateElement[]; newIds: string[] } {
	const clearBindings = options?.clearBindings ?? true;
	const fallbackOffsetX = options?.offsetX ?? 20;
	const fallbackOffsetY = options?.offsetY ?? 20;
	const target = options?.target;
	const baseElements = clipboard.elements;
	if (baseElements.length === 0) return { elements, newIds: [] };

	const anchor = target ?? {
		x: clipboard.origin.x + fallbackOffsetX,
		y: clipboard.origin.y + fallbackOffsetY,
	};
	const deltaX = anchor.x - clipboard.origin.x;
	const deltaY = anchor.y - clipboard.origin.y;

	const pasted = baseElements.map((source) => {
		const withoutBinding = clearBindings ? stripBindings(source) : { ...source };
		const nextPos = clampMove(
			source.x + deltaX,
			source.y + deltaY,
			source.width,
			source.height,
			bounds
		);
		return {
			...withoutBinding,
			id: crypto.randomUUID(),
			x: nextPos.x,
			y: nextPos.y,
		};
	});

	return {
		elements: [...elements, ...pasted],
		newIds: pasted.map((el) => el.id),
	};
}

export function cycleSelection(
	elements: TemplateElement[],
	currentSelectedIds: string[],
	backward = false
): string[] {
	const ordered = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
	if (ordered.length === 0) return [];
	const activeId = currentSelectedIds[0];
	const currentIndex = ordered.findIndex((el) => el.id === activeId);
	const step = backward ? -1 : 1;
	const nextIndex = currentIndex === -1
		? 0
		: (currentIndex + step + ordered.length) % ordered.length;
	return [ordered[nextIndex].id];
}
