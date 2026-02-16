import { TemplateElement } from "@/core";

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
	if (element.type === "table") return { ...element, itemsBinding: undefined };
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
	const removedIds = elements
		.filter((el) => isSelected(selectedIds, el.id) && !el.locked)
		.map((el) => el.id);
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

	const duplicates: TemplateElement[] = selected.map((el) => {
		const base = clearBindings ? stripBindings(el) : { ...el };
		const nextPos = clampMove(el.x + offsetX, el.y + offsetY, el.width, el.height, bounds);
		return {
			...base,
			id: crypto.randomUUID(),
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
	return {
		elements: elements.map((el) =>
			isSelected(selectedIds, el.id)
				? {
						...el,
						groupId,
					}
				: el
		),
		groupId,
	};
}

export function ungroupSelection(
	elements: TemplateElement[],
	selectedIds: string[]
): TemplateElement[] {
	const selectedGroups = new Set(
		elements.filter((el) => isSelected(selectedIds, el.id)).map((el) => el.groupId).filter(Boolean)
	);
	if (selectedGroups.size === 0) return elements;
	return elements.map((el) =>
		el.groupId && selectedGroups.has(el.groupId)
			? {
					...el,
					groupId: undefined,
				}
			: el
	);
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
