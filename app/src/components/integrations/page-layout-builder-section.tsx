import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, DragEvent, ReactNode } from "react";
import { toast } from "sonner";
import {
	Check,
	ChevronLeft,
	Copy,
	GripVertical,
	Heading2,
	ImageIcon,
	LayoutPanelLeft,
	List,
	ListChecks,
	Loader2,
	PanelLeftOpen,
	Plus,
	RectangleHorizontal,
	Text,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWidgetBuilderContext } from "@/contexts/widget-builder-context";
import { WidgetSchemaLayout } from "@/components/widget-schema-layout";
import { WidgetSchemaRenderer } from "@/components/widget-schema-renderer";
import type {
	WidgetPageBlock,
	WidgetPageConfig,
	WidgetPageFooterLink,
	WidgetPageSchema,
	WidgetPageSchemaBlock,
	WidgetPageSchemaBlockType,
	WidgetPageSchemaSidebarWidth,
	WidgetPageSchemaStackBlock,
	WidgetPageTrustSignal,
} from "@/core/entities/widget-definition";
import { cn } from "@/lib/utils";

const DRAG_MIME_TYPE = "application/x-financely-page-builder";

type BuilderSelection = "layout" | { blockId: string };
type RootSlot = "sidebar" | "main";
type DropContainer =
	| { kind: "root"; slot: RootSlot }
	| { kind: "stack"; stackId: string };
type DragPayload =
	| { source: "library"; blockType: WidgetPageSchemaBlockType }
	| { source: "tree"; blockId: string };

type BlockLocation = {
	container: DropContainer;
	index: number;
};

const DEFAULT_TRUST_SIGNALS: WidgetPageTrustSignal[] = [
	{ icon: "shield", label: "Your data is secure" },
	{ icon: "clock", label: "Replies within 24h" },
	{ icon: "star", label: "No spam, ever" },
];

const TRUST_ICON_OPTIONS: Array<{
	value: WidgetPageTrustSignal["icon"];
	label: string;
}> = [
	{ value: "shield", label: "Shield" },
	{ value: "clock", label: "Clock" },
	{ value: "star", label: "Star" },
	{ value: "check", label: "Check" },
	{ value: "lock", label: "Lock" },
];

const LIBRARY_BLOCKS: Array<{
	type: WidgetPageSchemaBlockType;
	label: string;
	description: string;
	Icon: ComponentType<{ className?: string }>;
}> = [
	{
		type: "stack",
		label: "Stack",
		description: "Container for nested blocks",
		Icon: LayoutPanelLeft,
	},
	{
		type: "heading",
		label: "Heading",
		description: "Title text",
		Icon: Heading2,
	},
	{
		type: "text",
		label: "Text",
		description: "Paragraph copy",
		Icon: Text,
	},
	{
		type: "logo",
		label: "Logo",
		description: "Brand logo block",
		Icon: ImageIcon,
	},
	{
		type: "list",
		label: "List",
		description: "Simple bullet list",
		Icon: List,
	},
	{
		type: "iconList",
		label: "Icon list",
		description: "Trust badges with icons",
		Icon: ListChecks,
	},
	{
		type: "policyLinks",
		label: "Policy links",
		description: "Privacy / terms links",
		Icon: PanelLeftOpen,
	},
	{
		type: "spacer",
		label: "Spacer",
		description: "Vertical spacing",
		Icon: RectangleHorizontal,
	},
	{
		type: "widgetForm",
		label: "Widget form",
		description: "Form renderer (required, one only)",
		Icon: LayoutPanelLeft,
	},
];

function generateBlockId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultBlock(
	type: WidgetPageSchemaBlockType,
): WidgetPageSchemaBlock {
	if (type === "stack") {
		return {
			id: generateBlockId("stack"),
			type: "stack",
			gap: "md",
			children: [],
		};
	}
	if (type === "heading") {
		return {
			id: generateBlockId("heading"),
			type: "heading",
			text: "Heading",
			level: 2,
		};
	}
	if (type === "text") {
		return {
			id: generateBlockId("text"),
			type: "text",
			text: "Add your copy here.",
		};
	}
	if (type === "logo") {
		return {
			id: generateBlockId("logo"),
			type: "logo",
			showCompanyName: false,
		};
	}
	if (type === "list") {
		return {
			id: generateBlockId("list"),
			type: "list",
			items: ["First item", "Second item", "Third item"],
		};
	}
	if (type === "iconList") {
		return {
			id: generateBlockId("icon-list"),
			type: "iconList",
			items: DEFAULT_TRUST_SIGNALS.map((signal) => ({
				icon: signal.icon,
				text: signal.label,
			})),
		};
	}
	if (type === "policyLinks") {
		return {
			id: generateBlockId("policy-links"),
			type: "policyLinks",
			links: [
				{ label: "Privacy Policy", url: "" },
				{ label: "Terms of Service", url: "" },
			],
		};
	}
	if (type === "spacer") {
		return {
			id: generateBlockId("spacer"),
			type: "spacer",
			size: "md",
		};
	}
	return {
		id: generateBlockId("widget-form"),
		type: "widgetForm",
		title: "Get in touch",
		subtitle: "Fill in the details below and we'll get back to you.",
	};
}

function blockLabel(block: WidgetPageSchemaBlock): string {
	if (block.type === "heading") return "Heading";
	if (block.type === "text") return "Text";
	if (block.type === "logo") return "Logo";
	if (block.type === "list") return "List";
	if (block.type === "iconList") return "Icon list";
	if (block.type === "policyLinks") return "Policy links";
	if (block.type === "widgetForm") return "Widget form";
	if (block.type === "spacer") return "Spacer";
	return "Stack";
}

function sanitizeLinks(
	links: WidgetPageFooterLink[] | undefined,
): WidgetPageFooterLink[] {
	return (links ?? [])
		.map((link) => ({
			label: String(link?.label ?? "").trim(),
			url: String(link?.url ?? "").trim(),
		}))
		.filter((link) => link.label.length > 0 || link.url.length > 0);
}

function sanitizeTrustSignals(
	trustSignals: WidgetPageTrustSignal[] | undefined,
): WidgetPageTrustSignal[] {
	return (trustSignals ?? [])
		.map((signal) => ({
			icon: signal.icon,
			label: String(signal.label ?? "").trim(),
		}))
		.filter((signal) => signal.label.length > 0);
}

function findBlockById(
	blocks: WidgetPageSchemaBlock[],
	blockId: string,
): WidgetPageSchemaBlock | undefined {
	for (const block of blocks) {
		if (block.id === blockId) return block;
		if (block.type === "stack") {
			const found = findBlockById(block.children, blockId);
			if (found) return found;
		}
	}
	return undefined;
}

function hasBlockType(
	blocks: WidgetPageSchemaBlock[],
	type: WidgetPageSchemaBlockType,
): boolean {
	for (const block of blocks) {
		if (block.type === type) return true;
		if (block.type === "stack" && hasBlockType(block.children, type))
			return true;
	}
	return false;
}

function countBlockType(
	blocks: WidgetPageSchemaBlock[],
	type: WidgetPageSchemaBlockType,
): number {
	return blocks.reduce((count, block) => {
		const current = block.type === type ? 1 : 0;
		const nested =
			block.type === "stack" ? countBlockType(block.children, type) : 0;
		return count + current + nested;
	}, 0);
}

function updateBlockByIdInList(
	blocks: WidgetPageSchemaBlock[],
	blockId: string,
	updater: (block: WidgetPageSchemaBlock) => WidgetPageSchemaBlock,
): WidgetPageSchemaBlock[] {
	return blocks.map((block) => {
		if (block.id === blockId) return updater(block);
		if (block.type === "stack") {
			return {
				...block,
				children: updateBlockByIdInList(
					block.children,
					blockId,
					updater,
				),
			};
		}
		return block;
	});
}

function removeBlockFromList(
	blocks: WidgetPageSchemaBlock[],
	blockId: string,
): { blocks: WidgetPageSchemaBlock[]; removed: WidgetPageSchemaBlock | null } {
	let removed: WidgetPageSchemaBlock | null = null;
	const next: WidgetPageSchemaBlock[] = [];
	for (const block of blocks) {
		if (block.id === blockId) {
			removed = block;
			continue;
		}
		if (block.type === "stack") {
			const nested = removeBlockFromList(block.children, blockId);
			if (nested.removed) {
				removed = nested.removed;
				next.push({ ...block, children: nested.blocks });
				continue;
			}
		}
		next.push(block);
	}
	return { blocks: next, removed };
}

function removeBlockFromSchema(
	schema: WidgetPageSchema,
	blockId: string,
): { schema: WidgetPageSchema; removed: WidgetPageSchemaBlock | null } {
	const fromSidebar = removeBlockFromList(schema.sidebar, blockId);
	if (fromSidebar.removed) {
		return {
			schema: { ...schema, sidebar: fromSidebar.blocks },
			removed: fromSidebar.removed,
		};
	}
	const fromMain = removeBlockFromList(schema.main, blockId);
	if (fromMain.removed) {
		return {
			schema: { ...schema, main: fromMain.blocks },
			removed: fromMain.removed,
		};
	}
	return { schema, removed: null };
}

function insertBlockAtIndex(
	blocks: WidgetPageSchemaBlock[],
	index: number,
	block: WidgetPageSchemaBlock,
): WidgetPageSchemaBlock[] {
	const next = [...blocks];
	const safeIndex = Math.max(0, Math.min(index, next.length));
	next.splice(safeIndex, 0, block);
	return next;
}

function insertBlockInSchema(
	schema: WidgetPageSchema,
	container: DropContainer,
	index: number,
	block: WidgetPageSchemaBlock,
): WidgetPageSchema {
	if (container.kind === "root") {
		if (container.slot === "sidebar") {
			return {
				...schema,
				sidebar: insertBlockAtIndex(schema.sidebar, index, block),
			};
		}
		return {
			...schema,
			main: insertBlockAtIndex(schema.main, index, block),
		};
	}

	return {
		...schema,
		sidebar: updateBlockByIdInList(
			schema.sidebar,
			container.stackId,
			(candidate) => {
				if (candidate.type !== "stack") return candidate;
				return {
					...candidate,
					children: insertBlockAtIndex(
						candidate.children,
						index,
						block,
					),
				};
			},
		),
		main: updateBlockByIdInList(
			schema.main,
			container.stackId,
			(candidate) => {
				if (candidate.type !== "stack") return candidate;
				return {
					...candidate,
					children: insertBlockAtIndex(
						candidate.children,
						index,
						block,
					),
				};
			},
		),
	};
}

function containerEquals(a: DropContainer, b: DropContainer): boolean {
	if (a.kind !== b.kind) return false;
	if (a.kind === "root" && b.kind === "root") return a.slot === b.slot;
	if (a.kind === "stack" && b.kind === "stack")
		return a.stackId === b.stackId;
	return false;
}

function findLocationInList(
	blocks: WidgetPageSchemaBlock[],
	blockId: string,
	container: DropContainer,
): BlockLocation | null {
	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		if (block.id === blockId) {
			return { container, index };
		}
		if (block.type === "stack") {
			const nested = findLocationInList(block.children, blockId, {
				kind: "stack",
				stackId: block.id,
			});
			if (nested) return nested;
		}
	}
	return null;
}

function findBlockLocation(
	schema: WidgetPageSchema,
	blockId: string,
): BlockLocation | null {
	const inSidebar = findLocationInList(schema.sidebar, blockId, {
		kind: "root",
		slot: "sidebar",
	});
	if (inSidebar) return inSidebar;
	return findLocationInList(schema.main, blockId, {
		kind: "root",
		slot: "main",
	});
}

function blockContainsStack(
	block: WidgetPageSchemaBlock,
	stackId: string,
): boolean {
	if (block.id === stackId) return true;
	if (block.type !== "stack") return false;
	return block.children.some((child) => blockContainsStack(child, stackId));
}

function hasStackId(blocks: WidgetPageSchemaBlock[], stackId: string): boolean {
	return blocks.some((block) => blockContainsStack(block, stackId));
}

function isContainerInMain(
	schema: WidgetPageSchema,
	container: DropContainer,
): boolean {
	if (container.kind === "root") return container.slot === "main";
	return hasStackId(schema.main, container.stackId);
}

function toLegacyFields(schema: WidgetPageSchema): Partial<WidgetPageConfig> {
	const firstHeading = findFirstBlockOfType(schema.sidebar, "heading");
	const firstText = findFirstBlockOfType(schema.sidebar, "text");
	const firstIconList = findFirstBlockOfType(schema.sidebar, "iconList");
	const firstPolicy = findFirstBlockOfType(schema.main, "policyLinks");
	const formBlock = findFirstBlockOfType(schema.main, "widgetForm");
	const trustSignals = firstIconList
		? firstIconList.items
				.filter((item) => item.text.trim().length > 0)
				.map((item) => ({ icon: item.icon, label: item.text.trim() }))
		: undefined;

	const legacyBlocks: WidgetPageBlock[] = [];
	legacyBlocks.push({
		id: "legacy-side-panel",
		type: "sidePanel",
		position: schema.layout.sidebarPosition,
		title: firstHeading?.text,
		body: firstText?.text,
		primaryColor: schema.layout.sidebarPrimaryColor,
		trustSignals,
	});
	if (firstPolicy && firstPolicy.links.length > 0) {
		legacyBlocks.push({
			id: "legacy-policy-links",
			type: "policyLinks",
			position: "bottom",
			links: firstPolicy.links,
		});
	}

	return {
		layout: "split",
		hideBrandPanel: false,
		backgroundStyle: schema.layout.backgroundStyle,
		primaryColor: schema.layout.sidebarPrimaryColor,
		headline: firstHeading?.text,
		body: firstText?.text,
		formTitle: formBlock?.title,
		formSubtitle: formBlock?.subtitle,
		trustSignals,
		footerLinks: firstPolicy?.links,
		blocks: legacyBlocks,
	};
}

function findFirstBlockOfType<T extends WidgetPageSchemaBlock["type"]>(
	blocks: WidgetPageSchemaBlock[],
	type: T,
): Extract<WidgetPageSchemaBlock, { type: T }> | undefined {
	for (const block of blocks) {
		if (block.type === type) {
			return block as Extract<WidgetPageSchemaBlock, { type: T }>;
		}
		if (block.type === "stack") {
			const nested = findFirstBlockOfType(block.children, type);
			if (nested) return nested;
		}
	}
	return undefined;
}

function migrateToSchema(
	config: WidgetPageConfig | null | undefined,
	widgetName: string,
): WidgetPageSchema {
	const existing = config?.schema;
	if (existing && existing.version === 1) {
		const ensureForm = hasBlockType(existing.main, "widgetForm")
			? existing.main
			: [...existing.main, createDefaultBlock("widgetForm")];
		return { ...existing, main: ensureForm };
	}

	const legacySidePanel = (config?.blocks ?? []).find(
		(block): block is Extract<WidgetPageBlock, { type: "sidePanel" }> =>
			block.type === "sidePanel",
	);
	const sidebarHeading =
		legacySidePanel?.title?.trim() ||
		config?.headline?.trim() ||
		widgetName;
	const sidebarBody =
		legacySidePanel?.body?.trim() ||
		config?.body?.trim() ||
		"Complete the form and our team will review your submission.";
	const sidebarTrustSignals = sanitizeTrustSignals(
		legacySidePanel?.trustSignals ?? config?.trustSignals,
	);

	const sidebarBlocks: WidgetPageSchemaBlock[] = [
		{
			id: generateBlockId("logo"),
			type: "logo",
			showCompanyName: false,
		},
		{
			id: generateBlockId("heading"),
			type: "heading",
			text: sidebarHeading,
			level: 1,
		},
		{
			id: generateBlockId("text"),
			type: "text",
			text: sidebarBody,
		},
		{
			id: generateBlockId("icon-list"),
			type: "iconList",
			items: (sidebarTrustSignals.length > 0
				? sidebarTrustSignals
				: DEFAULT_TRUST_SIGNALS
			).map((signal) => ({
				icon: signal.icon,
				text: signal.label,
			})),
		},
	];

	const mainBlocks: WidgetPageSchemaBlock[] = [
		{
			id: generateBlockId("widget-form"),
			type: "widgetForm",
			title: config?.formTitle?.trim() || "Get in touch",
			subtitle:
				config?.formSubtitle?.trim() ||
				"Fill in the details below and we'll get back to you.",
		},
	];

	const legacyPolicyLinks = sanitizeLinks(config?.footerLinks);
	if (legacyPolicyLinks.length > 0) {
		mainBlocks.push({
			id: generateBlockId("policy-links"),
			type: "policyLinks",
			links: legacyPolicyLinks,
		});
	}

	return {
		version: 1,
		layout: {
			mode: "sidebar",
			sidebarPosition: legacySidePanel?.position ?? "left",
			sidebarWidth: "md",
			backgroundStyle: config?.backgroundStyle ?? "clean",
			sidebarPrimaryColor:
				legacySidePanel?.primaryColor ?? config?.primaryColor,
		},
		sidebar: sidebarBlocks,
		main: mainBlocks,
	};
}

function parseDragPayload(raw: string): DragPayload | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as DragPayload;
		if (!parsed || typeof parsed !== "object") return null;
		if (parsed.source !== "library" && parsed.source !== "tree")
			return null;
		return parsed;
	} catch {
		return null;
	}
}

function serializeDragPayload(payload: DragPayload): string {
	return JSON.stringify(payload);
}

function getGapClass(gap: WidgetPageSchemaStackBlock["gap"]): string {
	if (gap === "sm") return "space-y-1.5";
	if (gap === "lg") return "space-y-4";
	return "space-y-3";
}

function getSpacerClass(size: "sm" | "md" | "lg" | undefined): string {
	if (size === "sm") return "h-3";
	if (size === "lg") return "h-10";
	return "h-6";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16),
			}
		: { r: 37, g: 99, b: 235 };
}

export function PageLayoutBuilderSection() {
	const ctx = useWidgetBuilderContext();
	const isWideLayout = useMediaQuery("(min-width: 1600px)");
	const { data: organization } = useCurrentOrganization();
	const widgetName = ctx?.widgetName ?? "Widget";
	const organizationLogo =
		organization?.settings?.branding?.customLogo ||
		organization?.logoUrl ||
		null;
	const organizationDisplayName =
		organization?.settings?.branding?.companyName?.trim() ||
		organization?.name?.trim() ||
		widgetName;
	const brandColors = organization?.settings?.brandColors;

	const [saving, setSaving] = useState(false);
	const [selection, setSelection] = useState<BuilderSelection>("layout");
	const [mergedSidebarView, setMergedSidebarView] = useState<
		"structure" | "properties"
	>("structure");
	const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
	const [dragOverLocation, setDragOverLocation] =
		useState<BlockLocation | null>(null);
	const activeDragPayloadRef = useRef<DragPayload | null>(null);
	const [schema, setSchema] = useState<WidgetPageSchema>(() =>
		migrateToSchema(ctx?.pageConfig ?? {}, widgetName),
	);

	useEffect(() => {
		setSchema(migrateToSchema(ctx?.pageConfig ?? {}, widgetName));
		setSelection("layout");
		setMergedSidebarView("structure");
	}, [ctx?.pageConfig, widgetName]);

	useEffect(() => {
		if (!isWideLayout && selection !== "layout") {
			setMergedSidebarView("properties");
		}
	}, [isWideLayout, selection]);

	const selectedBlock = useMemo(() => {
		if (selection === "layout") return null;
		return (
			findBlockById(schema.sidebar, selection.blockId) ??
			findBlockById(schema.main, selection.blockId) ??
			null
		);
	}, [schema.main, schema.sidebar, selection]);

	const widgetFormCount = useMemo(
		() =>
			countBlockType(schema.sidebar, "widgetForm") +
			countBlockType(schema.main, "widgetForm"),
		[schema.main, schema.sidebar],
	);

	const save = useCallback(async () => {
		if (!ctx) return;
		setSaving(true);
		try {
			const legacy = toLegacyFields(schema);
			await ctx.savePageConfig({
				...ctx.pageConfig,
				...legacy,
				schema,
			});
		} finally {
			setSaving(false);
		}
	}, [ctx, schema]);

	const updateSelectedBlock = useCallback(
		(updater: (block: WidgetPageSchemaBlock) => WidgetPageSchemaBlock) => {
			if (selection === "layout") return;
			setSchema((prev) => ({
				...prev,
				sidebar: updateBlockByIdInList(
					prev.sidebar,
					selection.blockId,
					updater,
				),
				main: updateBlockByIdInList(
					prev.main,
					selection.blockId,
					updater,
				),
			}));
		},
		[selection],
	);

	const deleteBlock = useCallback(
		(blockId: string) => {
			const block =
				findBlockById(schema.sidebar, blockId) ??
				findBlockById(schema.main, blockId);
			if (!block) return;
			if (block.type === "widgetForm" && widgetFormCount <= 1) {
				toast.error("At least one Widget form block is required.");
				return;
			}
			setSchema((prev) => removeBlockFromSchema(prev, blockId).schema);
			if (selection !== "layout" && selection.blockId === blockId) {
				setSelection("layout");
			}
		},
		[schema.main, schema.sidebar, selection, widgetFormCount],
	);

	const duplicateBlock = useCallback(
		(blockId: string) => {
			setSchema((prev) => {
				const location = findBlockLocation(prev, blockId);
				if (!location) return prev;
				const block =
					findBlockById(prev.sidebar, blockId) ??
					findBlockById(prev.main, blockId);
				if (!block) return prev;
				if (block.type === "widgetForm" && widgetFormCount >= 1) {
					toast.error("Only one Widget form block is allowed.");
					return prev;
				}
				const cloned = JSON.parse(
					JSON.stringify(block),
				) as WidgetPageSchemaBlock;
				cloned.id = generateBlockId(cloned.type);
				return insertBlockInSchema(
					prev,
					location.container,
					location.index + 1,
					cloned,
				);
			});
		},
		[widgetFormCount],
	);

	const applyDropPayload = useCallback(
		(payload: DragPayload, container: DropContainer, index: number) => {
			setSchema((prev) => {
				const widgetFormExists =
					countBlockType(prev.sidebar, "widgetForm") +
					countBlockType(prev.main, "widgetForm");

				if (payload.source === "library") {
					if (payload.blockType === "widgetForm") {
						if (widgetFormExists >= 1) {
							toast.error(
								"Only one Widget form block is allowed.",
							);
							return prev;
						}
						if (!isContainerInMain(prev, container)) {
							toast.error(
								"Widget form can only be placed in the main column.",
							);
							return prev;
						}
					}
					const block = createDefaultBlock(payload.blockType);
					return insertBlockInSchema(prev, container, index, block);
				}

				const sourceLocation = findBlockLocation(prev, payload.blockId);
				const movingBlock =
					findBlockById(prev.sidebar, payload.blockId) ??
					findBlockById(prev.main, payload.blockId);
				if (!sourceLocation || !movingBlock) return prev;

				if (
					movingBlock.type === "widgetForm" &&
					!isContainerInMain(prev, container)
				) {
					return prev;
				}

				if (
					container.kind === "stack" &&
					blockContainsStack(movingBlock, container.stackId)
				) {
					return prev;
				}

				let targetIndex = index;
				if (
					containerEquals(sourceLocation.container, container) &&
					sourceLocation.index < targetIndex
				) {
					targetIndex -= 1;
				}

				if (
					containerEquals(sourceLocation.container, container) &&
					sourceLocation.index === targetIndex
				) {
					return prev;
				}

				const removed = removeBlockFromSchema(prev, payload.blockId);
				if (!removed.removed) return prev;
				return insertBlockInSchema(
					removed.schema,
					container,
					targetIndex,
					removed.removed,
				);
			});
		},
		[],
	);

	const clearDragState = useCallback(() => {
		setDraggedBlockId(null);
		setDragOverLocation(null);
		activeDragPayloadRef.current = null;
	}, []);

	const handleStructureDragOver = useCallback(
		(
			event: DragEvent<HTMLElement>,
			container: DropContainer,
			index: number,
			usePointerPosition = true,
		) => {
			const payload =
				activeDragPayloadRef.current ??
				parseDragPayload(event.dataTransfer.getData(DRAG_MIME_TYPE));
			if (!payload) return;
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect =
				payload.source === "library" ? "copy" : "move";

			let targetIndex = index;
			if (usePointerPosition) {
				const rect = (
					event.currentTarget as HTMLElement
				).getBoundingClientRect();
				const centerY = rect.top + rect.height / 2;
				targetIndex = event.clientY < centerY ? index : index + 1;
			}

			setDragOverLocation({ container, index: targetIndex });
		},
		[],
	);

	const handleStructureDrop = useCallback(
		(
			event: DragEvent<HTMLElement>,
			container: DropContainer,
			index: number,
			usePointerPosition = true,
		) => {
			const payload =
				activeDragPayloadRef.current ??
				parseDragPayload(event.dataTransfer.getData(DRAG_MIME_TYPE));
			if (!payload) {
				clearDragState();
				return;
			}
			event.preventDefault();
			event.stopPropagation();

			let targetIndex = index;
			if (usePointerPosition) {
				const rect = (
					event.currentTarget as HTMLElement
				).getBoundingClientRect();
				const centerY = rect.top + rect.height / 2;
				targetIndex = event.clientY < centerY ? index : index + 1;
			}

			applyDropPayload(payload, container, targetIndex);
			clearDragState();
		},
		[applyDropPayload, clearDragState],
	);

	const startLibraryDrag = (
		event: DragEvent<HTMLButtonElement>,
		blockType: WidgetPageSchemaBlockType,
	) => {
		const payload: DragPayload = { source: "library", blockType };
		activeDragPayloadRef.current = payload;
		event.dataTransfer.setData(
			DRAG_MIME_TYPE,
			serializeDragPayload(payload),
		);
		event.dataTransfer.setData("text/plain", blockType);
		event.dataTransfer.effectAllowed = "copy";
		setDraggedBlockId(`library-${blockType}`);
	};

	const startTreeDrag = (event: DragEvent<HTMLElement>, blockId: string) => {
		const payload: DragPayload = { source: "tree", blockId };
		activeDragPayloadRef.current = payload;
		event.dataTransfer.setData(
			DRAG_MIME_TYPE,
			serializeDragPayload(payload),
		);
		event.dataTransfer.setData("text/plain", blockId);
		event.dataTransfer.effectAllowed = "move";
		setDraggedBlockId(blockId);
	};

	const renderStructureBlockList = (
		blocks: WidgetPageSchemaBlock[],
		container: DropContainer,
		depth = 0,
	): ReactNode => {
		return blocks.map((block, blockIndex) => {
			const isSelected =
				selection !== "layout" && selection.blockId === block.id;
			const showDropBefore = Boolean(
				draggedBlockId &&
					dragOverLocation &&
					containerEquals(dragOverLocation.container, container) &&
					dragOverLocation.index === blockIndex,
			);
			return (
				<div
					key={block.id}
					className={cn(
						"relative rounded-md border bg-card",
						isSelected
							? "border-primary/60 ring-1 ring-primary/30"
							: "border-border",
					)}
					onDragOver={(event) =>
						handleStructureDragOver(event, container, blockIndex)
					}
					onDrop={(event) =>
						handleStructureDrop(event, container, blockIndex)
					}
				>
					{showDropBefore && (
						<div className="absolute left-0 right-0 -top-0.5 h-0.5 rounded-full bg-primary z-20" />
					)}
					<div
						className="flex items-center gap-1.5 p-1.5 cursor-grab active:cursor-grabbing"
						draggable
						onDragStart={(event) => startTreeDrag(event, block.id)}
						onDragEnd={clearDragState}
					>
						<div className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground">
							<GripVertical className="h-3.5 w-3.5" />
						</div>
						<button
							type="button"
							onClick={() => setSelection({ blockId: block.id })}
							className="min-w-0 flex-1 rounded-md px-1 py-1 text-left hover:bg-muted/50"
						>
							<p className="truncate text-xs font-medium text-foreground">
								{blockLabel(block)}
							</p>
						</button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-muted-foreground"
							onClick={() => duplicateBlock(block.id)}
						>
							<Copy className="h-3.5 w-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-muted-foreground hover:text-destructive"
							onClick={() => deleteBlock(block.id)}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>
					{block.type === "stack" && (
						<div
							className={cn(
								"pb-2 pr-2",
								depth > 0 ? "pl-6" : "pl-4",
							)}
							onDragOver={(event) =>
								handleStructureDragOver(
									event,
									{ kind: "stack", stackId: block.id },
									block.children.length,
									false,
								)
							}
							onDrop={(event) =>
								handleStructureDrop(
									event,
									{ kind: "stack", stackId: block.id },
									block.children.length,
									false,
								)
							}
						>
							<div
								className={cn(
									"space-y-1.5",
									getGapClass(block.gap),
								)}
							>
								{renderStructureBlockList(
									block.children,
									{ kind: "stack", stackId: block.id },
									depth + 1,
								)}
							</div>
							{draggedBlockId &&
								dragOverLocation &&
								dragOverLocation.index ===
									block.children.length &&
								dragOverLocation.container.kind === "stack" &&
								dragOverLocation.container.stackId ===
									block.id && (
									<div className="mt-1 h-0.5 rounded-full bg-primary" />
								)}
						</div>
					)}
				</div>
			);
		});
	};

	const slotOrder: RootSlot[] =
		schema.layout.sidebarPosition === "left"
			? ["sidebar", "main"]
			: ["main", "sidebar"];
	const previewPrimary =
		schema.layout.sidebarPrimaryColor?.trim() || "#2563eb";
	const previewRgb = hexToRgb(previewPrimary);
	const previewFormStyling = useMemo(
		() => ({
			...ctx?.previewStyling,
			primaryColor:
				ctx?.pageConfig?.primaryColor?.trim() ||
				brandColors?.primary ||
				ctx?.previewStyling?.primaryColor ||
				"#2563eb",
			secondaryColor:
				brandColors?.secondary ||
				ctx?.previewStyling?.secondaryColor ||
				"#6b7280",
			successColor:
				brandColors?.accent ||
				ctx?.previewStyling?.successColor ||
				"#10b981",
		}),
		[
			brandColors?.accent,
			brandColors?.primary,
			brandColors?.secondary,
			ctx?.pageConfig?.primaryColor,
			ctx?.previewStyling,
		],
	);
	const showMergedProperties =
		!isWideLayout && mergedSidebarView === "properties";

	return (
		<div className="h-full min-h-0 flex flex-col space-y-4">
			<div className="flex-1 min-h-0 w-full flex overflow-hidden">
				<aside
					className={cn(
						"w-48 sm:w-52 md:w-56 shrink-0 border-r border-border bg-muted/20 p-4 overflow-y-auto",
						showMergedProperties && "hidden",
					)}
				>
					<div className="space-y-5">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Page Structure
							</p>
						</div>

						<div className="space-y-3">
							{slotOrder.map((slot) => {
								const blocks =
									slot === "sidebar"
										? schema.sidebar
										: schema.main;
								const container: DropContainer = {
									kind: "root",
									slot,
								};
								const showDropAtEnd = Boolean(
									draggedBlockId &&
										dragOverLocation &&
										containerEquals(
											dragOverLocation.container,
											container,
										) &&
										dragOverLocation.index ===
											blocks.length,
								);
								return (
									<section
										key={slot}
										className="rounded-lg border border-border/70 bg-background/80 p-2.5"
									>
										<div className="mb-2 flex items-center justify-between">
											<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
												{slot === "sidebar"
													? "Sidebar"
													: "Main"}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{blocks.length}
											</p>
										</div>
										<div
											className="space-y-1.5"
											onDragOver={(event) =>
												handleStructureDragOver(
													event,
													container,
													blocks.length,
													false,
												)
											}
											onDrop={(event) =>
												handleStructureDrop(
													event,
													container,
													blocks.length,
													false,
												)
											}
										>
											{renderStructureBlockList(
												blocks,
												container,
											)}
											{showDropAtEnd && (
												<div className="h-0.5 rounded-full bg-primary" />
											)}
										</div>
									</section>
								);
							})}
						</div>

						<div className="space-y-3 border-t border-border/70 pt-4">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Add Blocks
								</p>
								<p className="text-[11px] text-muted-foreground mt-1">
									Drag from library or click to append.
								</p>
							</div>
							{LIBRARY_BLOCKS.filter(
								(item) => item.type !== "widgetForm",
							).map((item) => {
								const disabled =
									item.type === "widgetForm" &&
									widgetFormCount >= 1;
								return (
									<button
										key={item.type}
										type="button"
										draggable={!disabled}
										onDragStart={(event) =>
											startLibraryDrag(event, item.type)
										}
										onDragEnd={clearDragState}
										onClick={() => {
											if (disabled) {
												toast.error(
													"Only one Widget form block is allowed.",
												);
												return;
											}
											const block = createDefaultBlock(
												item.type,
											);
											const slot: DropContainer = {
												kind: "root",
												slot:
													item.type === "widgetForm"
														? "main"
														: "sidebar",
											};
											setSchema((prev) =>
												insertBlockInSchema(
													prev,
													slot,
													slot.slot === "sidebar"
														? prev.sidebar.length
														: prev.main.length,
													block,
												),
											);
										}}
										className={cn(
											"w-full rounded-lg border p-3 text-left transition-colors",
											disabled
												? "cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground/60"
												: "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
										)}
									>
										<div className="flex items-center gap-2">
											<item.Icon className="h-4 w-4 text-muted-foreground" />
											<p className="text-sm font-medium">
												{item.label}
											</p>
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											{item.description}
										</p>
									</button>
								);
							})}
						</div>
					</div>
				</aside>

				<main
					className={cn(
						"min-w-0 flex-1 overflow-y-auto bg-background px-6 py-8",
						!isWideLayout && showMergedProperties && "order-2",
					)}
				>
					<div className="w-full space-y-4">
						<div className="flex items-end justify-end gap-4">
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-9 px-3"
									onClick={() => {
										setSelection("layout");
										if (!isWideLayout) {
											setMergedSidebarView("properties");
										}
									}}
								>
									Layout settings
								</Button>
								<Button
									size="sm"
									className="h-9 px-3"
									onClick={() => void save()}
									disabled={saving}
								>
									{saving ? (
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
									) : (
										<Check className="h-4 w-4 mr-2" />
									)}
									Save page builder
								</Button>
							</div>
						</div>

						<div className="min-h-[200px] rounded-lg border bg-card overflow-hidden">
							<div className="min-h-[680px] w-full overflow-auto">
								<WidgetSchemaLayout
									branding={{
										logo: organizationLogo,
										companyName: organizationDisplayName,
									}}
									schema={schema}
									primary={previewPrimary}
									rgb={previewRgb}
									rootClassName="min-h-[680px] w-full max-w-none"
									selectedBlockId={
										selection === "layout"
											? null
											: selection.blockId
									}
									onSelectBlock={(blockId) => {
										setSelection({ blockId });
										if (!isWideLayout) {
											setMergedSidebarView("properties");
										}
									}}
									renderFormBlock={({ block }) => {
										return (
											<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
												<div className="mb-4">
													<p className="text-[10px] uppercase tracking-widest text-primary mb-1">
														{
															organizationDisplayName
														}
													</p>
													<h2 className="text-2xl font-semibold tracking-tight text-foreground">
														{block.title ||
															"Get in touch"}
													</h2>
													<p className="text-sm text-muted-foreground mt-1">
														{block.subtitle ||
															"Fill in the details below and we'll get back to you."}
													</p>
												</div>
												<div className="pointer-events-none">
													<WidgetSchemaRenderer
														pages={ctx?.pages ?? []}
														actions={
															ctx?.actions ?? {
																success: {
																	message:
																		"Thank you!",
																},
															}
														}
														styling={
															previewFormStyling
														}
														onSubmit={async () => {}}
														submitting={false}
														submitError={null}
														multiStepOptions={
															ctx?.multiStepOptions
														}
														previewPageIndex={0}
													/>
												</div>
											</div>
										);
									}}
								/>
							</div>
						</div>
					</div>
				</main>

				<aside
					className={cn(
						"w-80 shrink-0 bg-muted/20 p-4 overflow-y-auto",
						isWideLayout
							? "border-l border-border"
							: showMergedProperties
								? "order-1 border-r border-border"
								: "hidden",
					)}
				>
					{!isWideLayout && (
						<div className="mb-4">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="-ml-1"
								onClick={() => {
									setMergedSidebarView("structure");
									setSelection("layout");
								}}
							>
								<ChevronLeft className="mr-1 h-4 w-4" />
								Back
							</Button>
						</div>
					)}
					{selection === "layout" && (
						<div className="space-y-4">
							<div>
								<h3 className="text-sm font-semibold text-foreground">
									Layout Properties
								</h3>
								<p className="text-xs text-muted-foreground mt-1">
									Configure sidebar placement and page
									atmosphere.
								</p>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">
									Sidebar position
								</Label>
								<select
									value={schema.layout.sidebarPosition}
									onChange={(event) =>
										setSchema((prev) => ({
											...prev,
											layout: {
												...prev.layout,
												sidebarPosition: event.target
													.value as "left" | "right",
											},
										}))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
								>
									<option value="left">Left</option>
									<option value="right">Right</option>
								</select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">Sidebar width</Label>
								<select
									value={schema.layout.sidebarWidth ?? "md"}
									onChange={(event) =>
										setSchema((prev) => ({
											...prev,
											layout: {
												...prev.layout,
												sidebarWidth: event.target
													.value as WidgetPageSchemaSidebarWidth,
											},
										}))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
								>
									<option value="sm">Small</option>
									<option value="md">Medium</option>
									<option value="lg">Large</option>
								</select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">
									Background style
								</Label>
								<select
									value={
										schema.layout.backgroundStyle ?? "clean"
									}
									onChange={(event) =>
										setSchema((prev) => ({
											...prev,
											layout: {
												...prev.layout,
												backgroundStyle: event.target
													.value as
													| "clean"
													| "subtle-grid"
													| "gradient",
											},
										}))
									}
									className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
								>
									<option value="clean">Clean</option>
									<option value="subtle-grid">
										Subtle grid
									</option>
									<option value="gradient">
										Soft gradient
									</option>
								</select>
							</div>
							<div className="space-y-1.5">
								<Label className="text-xs">
									Sidebar color override
								</Label>
								<div className="flex items-center gap-2">
									<input
										type="color"
										value={
											schema.layout.sidebarPrimaryColor ??
											"#2563eb"
										}
										onChange={(event) =>
											setSchema((prev) => ({
												...prev,
												layout: {
													...prev.layout,
													sidebarPrimaryColor:
														event.target.value,
												},
											}))
										}
										className="h-8 w-10 rounded border border-border bg-transparent p-0.5"
									/>
									<Input
										value={
											schema.layout.sidebarPrimaryColor ??
											""
										}
										placeholder="#2563eb"
										className="font-mono text-xs"
										onChange={(event) =>
											setSchema((prev) => ({
												...prev,
												layout: {
													...prev.layout,
													sidebarPrimaryColor:
														event.target.value,
												},
											}))
										}
									/>
								</div>
							</div>
						</div>
					)}

					{selection !== "layout" && selectedBlock && (
						<div className="space-y-4">
							<div>
								<h3 className="text-sm font-semibold text-foreground">
									{blockLabel(selectedBlock)} Properties
								</h3>
								<p className="text-xs text-muted-foreground mt-1">
									ID: {selectedBlock.id}
								</p>
							</div>

							{selectedBlock.type === "heading" && (
								<>
									<div className="space-y-1.5">
										<Label className="text-xs">Text</Label>
										<Input
											value={selectedBlock.text}
											onChange={(event) =>
												updateSelectedBlock((block) =>
													block.type === "heading"
														? {
																...block,
																text: event
																	.target
																	.value,
															}
														: block,
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs">Level</Label>
										<select
											value={selectedBlock.level ?? 2}
											onChange={(event) =>
												updateSelectedBlock((block) =>
													block.type === "heading"
														? {
																...block,
																level: Number(
																	event.target
																		.value,
																) as 1 | 2 | 3,
															}
														: block,
												)
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
										>
											<option value={1}>H1</option>
											<option value={2}>H2</option>
											<option value={3}>H3</option>
										</select>
									</div>
								</>
							)}

							{selectedBlock.type === "text" && (
								<div className="space-y-1.5">
									<Label className="text-xs">Text</Label>
									<Textarea
										value={selectedBlock.text}
										rows={4}
										className="resize-none"
										onChange={(event) =>
											updateSelectedBlock((block) =>
												block.type === "text"
													? {
															...block,
															text: event.target
																.value,
														}
													: block,
											)
										}
									/>
								</div>
							)}

							{selectedBlock.type === "logo" && (
								<div className="space-y-1.5">
									<Label className="text-xs">
										Show company name fallback
									</Label>
									<select
										value={
											selectedBlock.showCompanyName
												? "yes"
												: "no"
										}
										onChange={(event) =>
											updateSelectedBlock((block) =>
												block.type === "logo"
													? {
															...block,
															showCompanyName:
																event.target
																	.value ===
																"yes",
														}
													: block,
											)
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
									>
										<option value="no">No</option>
										<option value="yes">Yes</option>
									</select>
								</div>
							)}

							{selectedBlock.type === "list" && (
								<div className="space-y-1.5">
									<Label className="text-xs">
										Items (one per line)
									</Label>
									<Textarea
										value={selectedBlock.items.join("\n")}
										rows={6}
										className="resize-none"
										onChange={(event) =>
											updateSelectedBlock((block) =>
												block.type === "list"
													? {
															...block,
															items: event.target.value
																.split("\n")
																.map((line) =>
																	line.trim(),
																)
																.filter(
																	(line) =>
																		line.length >
																		0,
																),
														}
													: block,
											)
										}
									/>
								</div>
							)}

							{selectedBlock.type === "iconList" && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="text-xs">Items</Label>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() =>
												updateSelectedBlock((block) =>
													block.type === "iconList"
														? {
																...block,
																items: [
																	...block.items,
																	{
																		icon: "check",
																		text: "New item",
																	},
																],
															}
														: block,
												)
											}
										>
											<Plus className="h-3.5 w-3.5 mr-1" />
											Add
										</Button>
									</div>
									{selectedBlock.items.map((item, index) => (
										<div
											key={`${selectedBlock.id}-icon-item-${index}`}
											className="flex items-center gap-2"
										>
											<select
												value={item.icon}
												onChange={(event) =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"iconList"
															)
																return block;
															const next = [
																...block.items,
															];
															next[index] = {
																...next[index],
																icon: event
																	.target
																	.value as WidgetPageTrustSignal["icon"],
															};
															return {
																...block,
																items: next,
															};
														},
													)
												}
												className="h-8 w-24 rounded-md border border-border bg-background px-2 text-xs"
											>
												{TRUST_ICON_OPTIONS.map(
													(option) => (
														<option
															key={option.value}
															value={option.value}
														>
															{option.label}
														</option>
													),
												)}
											</select>
											<Input
												value={item.text}
												onChange={(event) =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"iconList"
															)
																return block;
															const next = [
																...block.items,
															];
															next[index] = {
																...next[index],
																text: event
																	.target
																	.value,
															};
															return {
																...block,
																items: next,
															};
														},
													)
												}
												className="h-8 text-xs"
											/>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-muted-foreground hover:text-destructive"
												onClick={() =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"iconList"
															)
																return block;
															const next = [
																...block.items,
															];
															next.splice(
																index,
																1,
															);
															return {
																...block,
																items: next,
															};
														},
													)
												}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									))}
								</div>
							)}

							{selectedBlock.type === "policyLinks" && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="text-xs">
											Policy links
										</Label>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 text-xs"
											onClick={() =>
												updateSelectedBlock((block) => {
													if (
														block.type !==
														"policyLinks"
													)
														return block;
													return {
														...block,
														links: [
															...block.links,
															{
																label: "New link",
																url: "",
															},
														],
													};
												})
											}
										>
											<Plus className="h-3.5 w-3.5 mr-1" />
											Add
										</Button>
									</div>
									{selectedBlock.links.map((link, index) => (
										<div
											key={`${selectedBlock.id}-policy-${index}`}
											className="space-y-1.5 rounded-md border border-border/70 p-2"
										>
											<Input
												value={link.label}
												placeholder="Label"
												className="h-8 text-xs"
												onChange={(event) =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"policyLinks"
															)
																return block;
															const next = [
																...block.links,
															];
															next[index] = {
																...next[index],
																label: event
																	.target
																	.value,
															};
															return {
																...block,
																links: next,
															};
														},
													)
												}
											/>
											<Input
												value={link.url}
												placeholder="https://..."
												className="h-8 text-xs"
												onChange={(event) =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"policyLinks"
															)
																return block;
															const next = [
																...block.links,
															];
															next[index] = {
																...next[index],
																url: event
																	.target
																	.value,
															};
															return {
																...block,
																links: next,
															};
														},
													)
												}
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 w-full text-xs text-muted-foreground hover:text-destructive"
												onClick={() =>
													updateSelectedBlock(
														(block) => {
															if (
																block.type !==
																"policyLinks"
															)
																return block;
															const next = [
																...block.links,
															];
															next.splice(
																index,
																1,
															);
															return {
																...block,
																links: next,
															};
														},
													)
												}
											>
												Remove link
											</Button>
										</div>
									))}
								</div>
							)}

							{selectedBlock.type === "widgetForm" && (
								<>
									<div className="space-y-1.5">
										<Label className="text-xs">
											Form title
										</Label>
										<Input
											value={selectedBlock.title ?? ""}
											onChange={(event) =>
												updateSelectedBlock((block) =>
													block.type === "widgetForm"
														? {
																...block,
																title: event
																	.target
																	.value,
															}
														: block,
												)
											}
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs">
											Form subtitle
										</Label>
										<Textarea
											rows={3}
											className="resize-none"
											value={selectedBlock.subtitle ?? ""}
											onChange={(event) =>
												updateSelectedBlock((block) =>
													block.type === "widgetForm"
														? {
																...block,
																subtitle:
																	event.target
																		.value,
															}
														: block,
												)
											}
										/>
									</div>
								</>
							)}

							{selectedBlock.type === "spacer" && (
								<div className="space-y-1.5">
									<Label className="text-xs">Size</Label>
									<select
										value={selectedBlock.size ?? "md"}
										onChange={(event) =>
											updateSelectedBlock((block) =>
												block.type === "spacer"
													? {
															...block,
															size: event.target
																.value as
																| "sm"
																| "md"
																| "lg",
														}
													: block,
											)
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
									>
										<option value="sm">Small</option>
										<option value="md">Medium</option>
										<option value="lg">Large</option>
									</select>
									<div
										className={cn(
											"rounded-md bg-muted/70",
											getSpacerClass(selectedBlock.size),
										)}
									/>
								</div>
							)}

							{selectedBlock.type === "stack" && (
								<div className="space-y-1.5">
									<Label className="text-xs">Gap</Label>
									<select
										value={selectedBlock.gap ?? "md"}
										onChange={(event) =>
											updateSelectedBlock((block) =>
												block.type === "stack"
													? {
															...block,
															gap: event.target
																.value as
																| "sm"
																| "md"
																| "lg",
														}
													: block,
											)
										}
										className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
									>
										<option value="sm">Small</option>
										<option value="md">Medium</option>
										<option value="lg">Large</option>
									</select>
								</div>
							)}
						</div>
					)}
				</aside>
			</div>
		</div>
	);
}
