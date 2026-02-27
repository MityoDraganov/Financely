import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useContactMetafieldDefinitions } from "@/hooks/repository-hooks/use-contact-metafields";
import { functionsService } from "@/services/functions/functions-service";
import {
	buildDefaultWidgetPageConfig,
	hasPageConfigValues,
} from "@/utils/widget-page-config-defaults";
import {
	getContactFieldTypeMap,
	validateWidgetPages,
	type WidgetValidationIssue,
} from "@/utils/widget-builder-validation";
import type {
	WidgetBlock,
	WidgetPage,
	WidgetVersionActions,
} from "@/core/entities/widget-block-schema";
import type { BlockType } from "@/core/entities/widget-block-schema";
import type { WidgetMultiStepOptions } from "@/core/entities/widget-version";
import type { WidgetPageConfig } from "@/core/entities/widget-definition";
import type { WidgetStyling } from "@/components/site-builder/widget-types";

const DEFAULT_ACTIONS: WidgetVersionActions = {
	createLead: { enabled: true, tags: [] },
	success: { message: "Thank you!" },
};

const noop = () => {};
const noopAsync = async () => {};
const noopSetStr: (value: string) => void = () => {};
const noopSetNull: (value: string | null) => void = () => {};

export interface WidgetVersionListItem {
	id: string;
	versionNumber: number;
	createdAt?: string;
}

export interface UseWidgetBuilderParams {
	effectiveWidgetId: string | undefined;
	organizationId: string | undefined;
	widgetBelongsToOrg: boolean;
	onDeleteWidget: (widgetId: string) => Promise<void>;
}

export interface UseWidgetBuilderReturn {
	pages: WidgetPage[];
	isDirty: boolean;
	validationIssues: WidgetValidationIssue[];
	hasValidationErrors: boolean;
	activePageId: string | null;
	setActivePageId: (id: string | null) => void;
	selectedBlockId: string | null;
	setSelectedBlockId: (id: string | null) => void;
	selectedBlock: WidgetBlock | undefined;
	actions: WidgetVersionActions;
	multiStepOptions: WidgetMultiStepOptions;
	setMultiStepOptions: (opts: WidgetMultiStepOptions) => void;
	pageConfig: WidgetPageConfig;
	setPageConfig: (config: WidgetPageConfig) => void;
	savePageConfig: (config: WidgetPageConfig) => Promise<void>;
	addPage: () => void;
	removePage: (pageId: string) => void;
	reorderPages: (fromIndex: number, toIndex: number) => void;
	updatePage: (pageId: string, updates: { name?: string; description?: string }) => void;
	addBlock: (type: BlockType, defaultProps: Record<string, unknown>) => void;
	addBlockAt: (
		index: number,
		type: BlockType,
		defaultProps: Record<string, unknown>,
	) => void;
	addBlockToParent: (
		parentId: string | null,
		index: number,
		type: BlockType,
		defaultProps: Record<string, unknown>,
	) => void;
	duplicateBlockAt: (parentId: string | null, index: number) => void;
	removeBlock: (id: string) => void;
	reorderBlocks: (parentId: string | null, fromIndex: number, toIndex: number) => void;
	moveBlock: (blockId: string, targetParentId: string | null, targetIndex: number) => void;
	updateBlockProps: (id: string, props: Record<string, unknown>) => void;
	updateFieldBlockType: (
		id: string,
		nextType: EditableFieldBlockType,
	) => void;
	save: () => Promise<void>;
	publish: () => Promise<void>;
	publishVersion: (versionId: string) => Promise<void>;
	unpublish: () => Promise<void>;
	restoreVersion: (versionId: string) => Promise<void>;
	refreshVersions: () => Promise<void>;
	widgetName: string;
	setWidgetName: (name: string) => void;
	handleWidgetNameBlur: () => Promise<void>;
	versions: WidgetVersionListItem[];
	versionsLoading: boolean;
	selectedVersionId: string | null;
	setSelectedVersionId: (id: string | null) => void;
	publishedVersionId: string | null;
	publishingVersionId: string | null;
	restoringVersion: boolean;
	definitionStatus: string | null;
	loading: boolean;
	saving: boolean;
	publishing: boolean;
	unpublishing: boolean;
	widgetNameSaving: boolean;
	previewStyling: Partial<WidgetStyling>;
	deleteWidgetId: string | null;
	setDeleteWidgetId: (id: string | null) => void;
	onDeleteWidget: (widgetId: string) => Promise<void>;
}

const generateBlockId = () =>
	`block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const generatePageId = () =>
	`page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const LAYOUT_BLOCKS_WITH_CHILDREN: BlockType[] = ["container", "card", "columns"];
type EditableFieldBlockType =
	| "inputText"
	| "email"
	| "phone"
	| "textarea"
	| "select"
	| "checkbox"
	| "date"
	| "file"
	| "submitButton";

const EDITABLE_FIELD_BLOCK_TYPES: EditableFieldBlockType[] = [
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"checkbox",
	"date",
	"file",
	"submitButton",
];

const FIELD_BLOCKS_SUPPORTING_REQUIRED = new Set<EditableFieldBlockType>([
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"date",
	"file",
]);

const FIELD_BLOCKS_SUPPORTING_PLACEHOLDER = new Set<EditableFieldBlockType>([
	"inputText",
	"email",
	"phone",
	"textarea",
	"select",
	"date",
]);

const SELECT_DEFAULT_OPTIONS = [{ label: "Option 1", value: "option_1" }];

const isEditableFieldBlockType = (
	type: BlockType,
): type is EditableFieldBlockType =>
	EDITABLE_FIELD_BLOCK_TYPES.includes(type as EditableFieldBlockType);

function getDefaultFieldBlockProps(
	type: EditableFieldBlockType,
): Record<string, unknown> {
	switch (type) {
		case "inputText":
			return { label: "Label", fieldKey: "field1", required: false };
		case "email":
			return { label: "Email", fieldKey: "email", required: true };
		case "phone":
			return { label: "Phone", fieldKey: "phone", required: false };
		case "textarea":
			return { label: "Message", fieldKey: "message", required: false };
		case "select":
			return {
				label: "Select",
				fieldKey: "select1",
				required: false,
				options: SELECT_DEFAULT_OPTIONS.map((option) => ({ ...option })),
			};
		case "checkbox":
			return { label: "Check", fieldKey: "check1" };
		case "date":
			return { label: "Date", fieldKey: "date1", required: false };
		case "file":
			return {
				label: "Upload file",
				fieldKey: "file1",
				required: false,
				multiple: false,
			};
		case "submitButton":
			return { label: "Submit" };
	}
}

function buildFieldBlockProps(
	type: EditableFieldBlockType,
	previousProps: Record<string, unknown>,
): Record<string, unknown> {
	const defaults = getDefaultFieldBlockProps(type);
	if (type === "submitButton") {
		const nextLabel =
			typeof previousProps.label === "string" && previousProps.label.trim().length > 0
				? previousProps.label
				: defaults.label;
		return { label: nextLabel };
	}

	const nextProps: Record<string, unknown> = {
		...defaults,
	};

	if (typeof previousProps.label === "string") {
		nextProps.label = previousProps.label;
	}

	if (typeof previousProps.fieldKey === "string") {
		nextProps.fieldKey = previousProps.fieldKey;
	}

	if (
		FIELD_BLOCKS_SUPPORTING_REQUIRED.has(type) &&
		typeof previousProps.required === "boolean"
	) {
		nextProps.required = previousProps.required;
	}

	if (
		FIELD_BLOCKS_SUPPORTING_PLACEHOLDER.has(type) &&
		typeof previousProps.placeholder === "string"
	) {
		nextProps.placeholder = previousProps.placeholder;
	}

	if (typeof previousProps.helperText === "string") {
		nextProps.helperText = previousProps.helperText;
	}

	if (typeof previousProps.fieldValueType === "string") {
		nextProps.fieldValueType = previousProps.fieldValueType;
	}

	if (type === "select") {
		const options = previousProps.options;
		nextProps.options =
			Array.isArray(options) && options.length > 0
				? options
				: SELECT_DEFAULT_OPTIONS.map((option) => ({ ...option }));
	}

	if (type === "file" && typeof previousProps.multiple === "boolean") {
		nextProps.multiple = previousProps.multiple;
	}

	return nextProps;
}

const getBuilderSnapshot = ({
	pages,
	actions,
	multiStepOptions,
}: {
	pages: WidgetPage[];
	actions: WidgetVersionActions;
	multiStepOptions: WidgetMultiStepOptions;
}) => JSON.stringify({ pages, actions, multiStepOptions });

function normalizeBuilderState({
	pages,
	actions,
	multiStepOptions,
}: {
	pages: unknown;
	actions: unknown;
	multiStepOptions: unknown;
}): {
	pages: WidgetPage[];
	actions: WidgetVersionActions;
	multiStepOptions: WidgetMultiStepOptions;
} {
	const normalizedPages = ensureAtLeastOnePage(
		(Array.isArray(pages) ? (pages as WidgetPage[]) : []).map((p) => ({
			...p,
			fields: (Array.isArray(p.fields) ? p.fields : []).map(ensureLayoutBlockChildren),
		})),
	);

	const normalizedActions = (
		actions && typeof actions === "object" ? actions : DEFAULT_ACTIONS
	) as WidgetVersionActions;

	const normalizedMultiStep = (
		multiStepOptions && typeof multiStepOptions === "object"
			? multiStepOptions
			: {}
	) as WidgetMultiStepOptions;

	return {
		pages: normalizedPages,
		actions: normalizedActions,
		multiStepOptions: normalizedMultiStep,
	};
}

function findBlockInFields(fields: WidgetBlock[], blockId: string): WidgetBlock | undefined {
	for (const b of fields) {
		if (b.id === blockId) return b;
		const inChild = b.children?.length
			? findBlockInFields(b.children, blockId)
			: undefined;
		if (inChild) return inChild;
	}
	return undefined;
}

function findBlockInPages(pages: WidgetPage[], blockId: string): WidgetBlock | undefined {
	for (const page of pages) {
		const b = findBlockInFields(page.fields ?? [], blockId);
		if (b) return b;
	}
	return undefined;
}

function removeBlockFromFields(fields: WidgetBlock[], blockId: string): WidgetBlock[] {
	return fields
		.filter((b) => b.id !== blockId)
		.map((b) =>
			b.children?.length
				? { ...b, children: removeBlockFromFields(b.children, blockId) }
				: b,
		);
}

function updateBlockInFields(
	fields: WidgetBlock[],
	blockId: string,
	updater: (block: WidgetBlock) => WidgetBlock,
): WidgetBlock[] {
	return fields.map((b) => {
		if (b.id === blockId) return updater(b);
		if (b.children?.length) {
			return { ...b, children: updateBlockInFields(b.children, blockId, updater) };
		}
		return b;
	});
}

function insertBlockAt(
	fields: WidgetBlock[],
	parentId: string | null,
	index: number,
	block: WidgetBlock,
): WidgetBlock[] {
	if (parentId === null) {
		const next = [...fields];
		next.splice(index, 0, block);
		return next;
	}
	return updateBlockInFields(fields, parentId, (parent) => {
		const children = [...(parent.children ?? [])];
		children.splice(index, 0, block);
		return { ...parent, children };
	});
}

function duplicateBlockDeep(block: WidgetBlock): WidgetBlock {
	const copy: WidgetBlock = {
		id: generateBlockId(),
		type: block.type,
		props: { ...block.props },
		...(block.children?.length
			? { children: block.children.map(duplicateBlockDeep) }
			: {}),
	};
	return copy;
}

function ensureLayoutBlockChildren(block: WidgetBlock): WidgetBlock {
	const withChildren =
		LAYOUT_BLOCKS_WITH_CHILDREN.includes(block.type) && !Array.isArray(block.children)
			? { ...block, children: [] }
			: block;
	return withChildren.children?.length
		? { ...withChildren, children: withChildren.children.map(ensureLayoutBlockChildren) }
		: withChildren;
}

function ensureAtLeastOnePage(pages: WidgetPage[]): WidgetPage[] {
	if (pages.length > 0) return pages;
	return [{ id: generatePageId(), name: "Page 1", fields: [] }];
}

export function useWidgetBuilder({
	effectiveWidgetId,
	organizationId,
	widgetBelongsToOrg,
	onDeleteWidget,
}: UseWidgetBuilderParams): UseWidgetBuilderReturn {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const widgetDesigner = useWidgetDesigner();
	const { data: organization } = useCurrentOrganization();
	const { data: contactMetafieldDefinitions = [] } =
		useContactMetafieldDefinitions(organizationId);

	const [pages, setPages] = useState<WidgetPage[]>([]);
	const [activePageId, setActivePageId] = useState<string | null>(null);
	const [actions, setActions] = useState<WidgetVersionActions>(DEFAULT_ACTIONS);
	const [multiStepOptions, setMultiStepOptions] = useState<WidgetMultiStepOptions>({});
	const [pageConfig, setPageConfig] = useState<WidgetPageConfig>({});
	const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [unpublishing, setUnpublishing] = useState(false);
	const [publishingVersionId, setPublishingVersionId] = useState<string | null>(
		null,
	);
	const [restoringVersion, setRestoringVersion] = useState(false);
	const [definitionStatus, setDefinitionStatus] = useState<string | null>(
		null,
	);
	const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
	const [widgetName, setWidgetName] = useState("");
	const [widgetNameSaving, setWidgetNameSaving] = useState(false);
	const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);
	const [versions, setVersions] = useState<WidgetVersionListItem[]>([]);
	const [versionsLoading, setVersionsLoading] = useState(false);
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
	const [hasInitializedSnapshot, setHasInitializedSnapshot] = useState(false);

	// Snapshot of last-saved state for dirty tracking
	const savedSnapshotRef = useRef<string>("");
	const currentSnapshot = useMemo(
		() => getBuilderSnapshot({ pages, actions, multiStepOptions }),
		[pages, actions, multiStepOptions],
	);

	const isDirty = useMemo(
		() => hasInitializedSnapshot && savedSnapshotRef.current !== currentSnapshot,
		[hasInitializedSnapshot, currentSnapshot],
	);
	const contactFieldTypeByKey = useMemo(
		() => getContactFieldTypeMap(contactMetafieldDefinitions),
		[contactMetafieldDefinitions],
	);
	const validationIssues = useMemo(
		() => validateWidgetPages(pages, contactFieldTypeByKey),
		[pages, contactFieldTypeByKey],
	);
	const hasValidationErrors = validationIssues.length > 0;

	const selectedBlock = useMemo(
		() => (selectedBlockId ? findBlockInPages(pages, selectedBlockId) : undefined),
		[pages, selectedBlockId],
	);

	const applyBuilderState = useCallback(
		(next: {
			pages: WidgetPage[];
			actions: WidgetVersionActions;
			multiStepOptions: WidgetMultiStepOptions;
		}) => {
			setPages(next.pages);
			setActions(next.actions);
			setMultiStepOptions(next.multiStepOptions);
			setActivePageId(next.pages[0]?.id ?? null);
			setSelectedBlockId(null);
			savedSnapshotRef.current = getBuilderSnapshot(next);
			setHasInitializedSnapshot(true);
		},
		[],
	);

	const refreshVersions = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) {
			setVersions([]);
			setSelectedVersionId(null);
			return;
		}
		setVersionsLoading(true);
		try {
			const result = await functionsService.listModularWidgetVersions({
				organizationId,
				widgetId: effectiveWidgetId,
			});
			setVersions(result.versions);
			setSelectedVersionId((prev) =>
				prev && result.versions.some((v) => v.id === prev)
					? prev
					: result.versions[0]?.id ?? null,
			);
		} catch {
			// Keep existing versions on transient failures
		} finally {
			setVersionsLoading(false);
		}
	}, [organizationId, effectiveWidgetId]);

	useEffect(() => {
		if (!organizationId || !effectiveWidgetId) {
			setPages([]);
			setActivePageId(null);
			setSelectedBlockId(null);
			setVersions([]);
			setSelectedVersionId(null);
			setPublishedVersionId(null);
			setDefinitionStatus(null);
			setPageConfig({});
			savedSnapshotRef.current = "";
			setHasInitializedSnapshot(false);
			return;
		}
		if (!widgetBelongsToOrg) return;
		setLoading(true);
		setHasInitializedSnapshot(false);
		functionsService
			.getModularWidgetDraft({
				organizationId,
				widgetId: effectiveWidgetId,
			})
			.then((r) => {
				const normalized = normalizeBuilderState({
					pages: r.version?.pages ?? [],
					actions: r.version?.actions ?? DEFAULT_ACTIONS,
					multiStepOptions: r.version?.multiStepOptions ?? {},
				});
				applyBuilderState(normalized);

				setDefinitionStatus(r.definition?.status ?? null);
				setPublishedVersionId(r.definition?.publishedVersionId ?? null);
				const fetchedPageConfig =
					r.definition?.pageConfig && typeof r.definition.pageConfig === "object"
						? (r.definition.pageConfig as WidgetPageConfig)
						: null;
				if (fetchedPageConfig && hasPageConfigValues(fetchedPageConfig)) {
					setPageConfig(fetchedPageConfig);
				} else {
					const defaultPageConfig = buildDefaultWidgetPageConfig(r.definition?.name ?? "Widget", {
						primaryColor: organization?.settings?.brandColors?.primary,
					});
					setPageConfig(defaultPageConfig);
					void functionsService
						.updateWidgetDefinition({
							organizationId,
							widgetId: effectiveWidgetId,
							pageConfig: defaultPageConfig,
						})
						.catch(() => {});
				}
				setSelectedVersionId(
					r.version?.id ?? r.definition?.publishedVersionId ?? null,
				);
			})
			.catch(() => toast.error("Failed to load widget"))
			.finally(() => setLoading(false));
	}, [
		organizationId,
		effectiveWidgetId,
		widgetBelongsToOrg,
		organization?.settings?.brandColors?.primary,
		applyBuilderState,
	]);

	useEffect(() => {
		if (!organizationId || !effectiveWidgetId || !widgetBelongsToOrg) {
			setVersions([]);
			setSelectedVersionId(null);
			return;
		}
		void refreshVersions();
	}, [organizationId, effectiveWidgetId, widgetBelongsToOrg, refreshVersions]);

	useEffect(() => {
		setWidgetName(widgetDesigner?.currentDefinition?.name ?? "");
	}, [
		widgetDesigner?.currentDefinition?.id,
		widgetDesigner?.currentDefinition?.name,
	]);

	const handleWidgetNameBlur = useCallback(async () => {
		const trimmed = widgetName.trim();
		if (!organizationId || !effectiveWidgetId || !trimmed) return;
		if (trimmed === widgetDesigner?.currentDefinition?.name) return;
		setWidgetNameSaving(true);
		try {
			await functionsService.updateWidgetDefinition({
				organizationId,
				widgetId: effectiveWidgetId,
				name: trimmed,
			});
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organizationId],
			});
			toast.success(t("siteBuilder.toasts.widgetSaved", "Widget saved"));
		} catch {
			toast.error(
				t(
					"siteBuilder.toasts.errors.saveWidgetFailed",
					"Failed to save",
				),
			);
			setWidgetName(widgetDesigner?.currentDefinition?.name ?? "");
		} finally {
			setWidgetNameSaving(false);
		}
	}, [
		organizationId,
		effectiveWidgetId,
		widgetName,
		widgetDesigner?.currentDefinition?.name,
		queryClient,
		t,
	]);

	const addPage = useCallback(() => {
		const newPage: WidgetPage = {
			id: generatePageId(),
			name: `Page ${pages.length + 1}`,
			fields: [],
		};
		setPages((prev) => [...prev, newPage]);
		setActivePageId(newPage.id);
	}, [pages.length]);

	const removePage = useCallback((pageId: string) => {
		const remaining = pages.filter((p) => p.id !== pageId);
		if (remaining.length === 0 || remaining.length === pages.length) return;
		setPages(remaining);
		if (activePageId === pageId) {
			setActivePageId(remaining[0]?.id ?? null);
			setSelectedBlockId(null);
		} else {
			const removed = pages.find((p) => p.id === pageId);
			if ((removed?.fields ?? []).some((f) => f.id === selectedBlockId)) {
				setSelectedBlockId(null);
			}
		}
	}, [activePageId, pages, selectedBlockId]);

	const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
		if (fromIndex === toIndex) return;
		setPages((prev) => {
			const copy = [...prev];
			const [item] = copy.splice(fromIndex, 1);
			copy.splice(toIndex, 0, item);
			return copy;
		});
	}, []);

	const updatePage = useCallback((pageId: string, updates: { name?: string; description?: string }) => {
		setPages((prev) =>
			prev.map((p) =>
				p.id !== pageId ? p : { ...p, ...updates },
			),
		);
	}, []);

	const addBlock = useCallback(
		(type: BlockType, defaultProps: Record<string, unknown>) => {
			if (!activePageId) return;
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
				...(LAYOUT_BLOCKS_WITH_CHILDREN.includes(type) ? { children: [] } : {}),
			};
			setPages((prev) =>
				prev.map((p) =>
					p.id === activePageId
						? { ...p, fields: [...(p.fields ?? []), block] }
						: p,
				),
			);
			setSelectedBlockId(block.id);
		},
		[activePageId],
	);

	const addBlockAt = useCallback(
		(
			index: number,
			type: BlockType,
			defaultProps: Record<string, unknown>,
		) => {
			if (!activePageId) return;
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
				...(LAYOUT_BLOCKS_WITH_CHILDREN.includes(type) ? { children: [] } : {}),
			};
			setPages((prev) =>
				prev.map((p) => {
					if (p.id !== activePageId) return p;
					const fields = [...(p.fields ?? [])];
					fields.splice(index, 0, block);
					return { ...p, fields };
				}),
			);
			setSelectedBlockId(block.id);
		},
		[activePageId],
	);

	const addBlockToParent = useCallback(
		(
			parentId: string | null,
			index: number,
			type: BlockType,
			defaultProps: Record<string, unknown>,
		) => {
			if (!activePageId) return;
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
				...(LAYOUT_BLOCKS_WITH_CHILDREN.includes(type) ? { children: [] } : {}),
			};
			if (parentId === null) {
				setPages((prev) =>
					prev.map((p) => {
						if (p.id !== activePageId) return p;
						const fields = [...(p.fields ?? [])];
						fields.splice(index, 0, block);
						return { ...p, fields };
					}),
				);
			} else {
				setPages((prev) =>
					prev.map((p) => {
						if (p.id !== activePageId) return p;
						const fields = updateBlockInFields(p.fields ?? [], parentId, (parent) => {
							const children = [...(parent.children ?? [])];
							children.splice(index, 0, block);
							return { ...parent, children };
						});
						return { ...p, fields };
					}),
				);
			}
			setSelectedBlockId(block.id);
		},
		[activePageId],
	);

	const duplicateBlockAt = useCallback(
		(parentId: string | null, index: number) => {
			if (!activePageId) return;
			const newIdRef = { current: "" };
			setPages((prev) => {
				const p = prev.find((page) => page.id === activePageId);
				if (!p) return prev;
				let block: WidgetBlock | undefined;
				if (parentId === null) {
					block = (p.fields ?? [])[index];
				} else {
					const parent = findBlockInFields(p.fields ?? [], parentId);
					block = parent?.children?.[index];
				}
				if (!block) return prev;
				const copy = duplicateBlockDeep(block);
				newIdRef.current = copy.id;
				return prev.map((page) => {
					if (page.id !== activePageId) return page;
					if (parentId === null) {
						const fieldList = [...(page.fields ?? [])];
						fieldList.splice(index + 1, 0, copy);
						return { ...page, fields: fieldList };
					}
					const fields = updateBlockInFields(page.fields ?? [], parentId, (parent) => {
						const children = [...(parent.children ?? [])];
						children.splice(index + 1, 0, copy);
						return { ...parent, children };
					});
					return { ...page, fields };
				});
			});
			setSelectedBlockId(newIdRef.current);
		},
		[activePageId],
	);

	const removeBlock = useCallback((id: string) => {
		setPages((prev) =>
			prev.map((p) => ({
				...p,
				fields: removeBlockFromFields(p.fields ?? [], id),
			})),
		);
		setSelectedBlockId((prev) => (prev === id ? null : prev));
	}, []);

	const reorderBlocks = useCallback(
		(parentId: string | null, fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex || !activePageId) return;
			setPages((prev) =>
				prev.map((p) => {
					if (p.id !== activePageId) return p;
					if (parentId === null) {
						const fieldList = [...(p.fields ?? [])];
						const [item] = fieldList.splice(fromIndex, 1);
						fieldList.splice(toIndex, 0, item);
						return { ...p, fields: fieldList };
					}
					const fields = updateBlockInFields(p.fields ?? [], parentId, (parent) => {
						const children = [...(parent.children ?? [])];
						const [item] = children.splice(fromIndex, 1);
						children.splice(toIndex, 0, item);
						return { ...parent, children };
					});
					return { ...p, fields };
				}),
			);
		},
		[activePageId],
	);

	const moveBlock = useCallback(
		(blockId: string, targetParentId: string | null, targetIndex: number) => {
			if (!activePageId) return;
			if (targetParentId === blockId) return;
			setPages((prev) =>
				prev.map((p) => {
					if (p.id !== activePageId) return p;
					const block = findBlockInFields(p.fields ?? [], blockId);
					if (!block) return p;
					if (
						targetParentId &&
						findBlockInFields([block], targetParentId) !== undefined
					) {
						return p;
					}
					const fieldsWithout = removeBlockFromFields(p.fields ?? [], blockId);
					const fieldsWith = insertBlockAt(
						fieldsWithout,
						targetParentId,
						targetIndex,
						block,
					);
					return { ...p, fields: fieldsWith };
				}),
			);
		},
		[activePageId],
	);

	const updateBlockProps = useCallback(
		(id: string, updates: Record<string, unknown>) => {
			setPages((prev) =>
				prev.map((p) => ({
					...p,
					fields: updateBlockInFields(p.fields ?? [], id, (b) => ({
						...b,
						props: { ...b.props, ...updates },
					})),
				})),
			);
		},
		[],
	);

	const updateFieldBlockType = useCallback(
		(id: string, nextType: EditableFieldBlockType) => {
			setPages((prev) =>
				prev.map((page) => ({
					...page,
					fields: updateBlockInFields(page.fields ?? [], id, (block) => {
						if (!isEditableFieldBlockType(block.type)) return block;
						if (block.type === nextType) return block;
						return {
							...block,
							type: nextType,
							props: buildFieldBlockProps(
								nextType,
								(block.props ?? {}) as Record<string, unknown>,
							),
						};
					}),
				})),
			);
		},
		[],
	);

	const save = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		if (hasValidationErrors) {
			toast.error("Fix widget validation errors before saving.");
			return;
		}
		setSaving(true);
		try {
			const result = await functionsService.saveModularWidgetVersion({
				organizationId,
				widgetId: effectiveWidgetId,
				pages,
				actions,
				multiStepOptions: Object.keys(multiStepOptions).length > 0 ? multiStepOptions : undefined,
			});
			savedSnapshotRef.current = currentSnapshot;
			setHasInitializedSnapshot(true);
			setSelectedVersionId(result.versionId);
			setDefinitionStatus("published");
			setPublishedVersionId(result.versionId);
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organizationId],
			});
			await refreshVersions();
			toast.success("Changes saved");
		} catch {
			toast.error("Failed to save");
		} finally {
			setSaving(false);
		}
	}, [
		organizationId,
		effectiveWidgetId,
		pages,
		actions,
		multiStepOptions,
		queryClient,
		currentSnapshot,
		refreshVersions,
		hasValidationErrors,
	]);

	const publish = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		if (hasValidationErrors) {
			toast.error("Fix widget validation errors before publishing.");
			return;
		}
		setPublishing(true);
		try {
			const r = await functionsService.saveModularWidgetVersion({
				organizationId,
				widgetId: effectiveWidgetId,
				pages,
				actions,
				multiStepOptions: Object.keys(multiStepOptions).length > 0 ? multiStepOptions : undefined,
			});
			savedSnapshotRef.current = currentSnapshot;
			setHasInitializedSnapshot(true);
			setSelectedVersionId(r.versionId);
			setPublishingVersionId(r.versionId);
			await functionsService.publishModularWidget({
				organizationId,
				widgetId: effectiveWidgetId,
				versionId: r.versionId,
			});
			setDefinitionStatus("published");
			setPublishedVersionId(r.versionId);
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organizationId],
			});
			await refreshVersions();
			toast.success("Widget published");
		} catch {
			toast.error("Failed to publish");
		} finally {
			setPublishingVersionId(null);
			setPublishing(false);
		}
	}, [
		organizationId,
		effectiveWidgetId,
		pages,
		actions,
		multiStepOptions,
		queryClient,
		currentSnapshot,
		refreshVersions,
		hasValidationErrors,
	]);

	const publishVersion = useCallback(
		async (versionId: string) => {
			if (!organizationId || !effectiveWidgetId || !versionId) return;
			setPublishingVersionId(versionId);
			try {
				await functionsService.publishModularWidget({
					organizationId,
					widgetId: effectiveWidgetId,
					versionId,
				});
				setDefinitionStatus("published");
				setPublishedVersionId(versionId);
				setSelectedVersionId(versionId);
				queryClient.invalidateQueries({
					queryKey: ["widget-definitions", organizationId],
				});
				await refreshVersions();
				toast.success("Widget published");
			} catch {
				toast.error("Failed to publish");
			} finally {
				setPublishingVersionId(null);
			}
		},
		[organizationId, effectiveWidgetId, queryClient, refreshVersions],
	);

	const unpublish = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		setUnpublishing(true);
		try {
			await functionsService.unpublishModularWidget({
				organizationId,
				widgetId: effectiveWidgetId,
			});
			setDefinitionStatus("draft");
			setPublishedVersionId(null);
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organizationId],
			});
			toast.success("Widget set to draft");
		} catch {
			toast.error("Failed to unpublish");
		} finally {
			setUnpublishing(false);
		}
	}, [organizationId, effectiveWidgetId, queryClient]);

	const restoreVersion = useCallback(
		async (versionId: string) => {
			if (!organizationId || !effectiveWidgetId || !versionId) return;
			setRestoringVersion(true);
			try {
				const config = await functionsService.getModularWidgetConfig({
					organizationId,
					widgetId: effectiveWidgetId,
					widgetVersionId: versionId,
				});
				const normalized = normalizeBuilderState({
					pages: config.widget.pages,
					actions: config.widget.actions,
					multiStepOptions: config.widget.multiStepOptions ?? {},
				});
				const result = await functionsService.saveModularWidgetVersion({
					organizationId,
					widgetId: effectiveWidgetId,
					pages: normalized.pages,
					actions: normalized.actions,
					multiStepOptions:
						Object.keys(normalized.multiStepOptions).length > 0
							? normalized.multiStepOptions
							: undefined,
				});
				applyBuilderState(normalized);
				setSelectedVersionId(result.versionId);
				setDefinitionStatus("published");
				setPublishedVersionId(result.versionId);
				queryClient.invalidateQueries({
					queryKey: ["widget-definitions", organizationId],
				});
				await refreshVersions();
				toast.success("Version restored");
			} catch {
				toast.error("Failed to restore version");
			} finally {
				setRestoringVersion(false);
			}
		},
		[
			organizationId,
			effectiveWidgetId,
			applyBuilderState,
			queryClient,
			refreshVersions,
		],
	);

	const savePageConfig = useCallback(async (config: WidgetPageConfig) => {
		if (!organizationId || !effectiveWidgetId) return;
		try {
			await functionsService.updateWidgetDefinition({
				organizationId,
				widgetId: effectiveWidgetId,
				pageConfig: config,
			});
			setPageConfig(config);
			toast.success("Page settings saved");
		} catch {
			toast.error("Failed to save page settings");
		}
	}, [organizationId, effectiveWidgetId]);

	const previewStyling: Partial<WidgetStyling> = useMemo(() => {
		const brand = organization?.settings?.brandColors;
		return {
			primaryColor: brand?.primary ?? "#166534",
			secondaryColor: brand?.secondary ?? "#6b7280",
			backgroundColor: "#ffffff",
			textColor: "#111827",
			borderColor: "#d1d5db",
			errorColor: "#ef4444",
			successColor: brand?.accent ?? "#166534",
			fontFamily: "system-ui, sans-serif",
			fontSize: "14px",
			borderRadius: "8px",
			buttonPadding: "12px 24px",
			buttonBorderRadius: "8px",
		};
	}, [organization?.settings?.brandColors]);

	const active =
		Boolean(effectiveWidgetId) && Boolean(widgetBelongsToOrg) && Boolean(organizationId);

	if (!active) {
		return {
			pages: [],
			isDirty: false,
			validationIssues: [],
			hasValidationErrors: false,
			activePageId: null,
			setActivePageId: noopSetNull,
			selectedBlockId: null,
			setSelectedBlockId: noopSetNull,
			selectedBlock: undefined,
			actions: DEFAULT_ACTIONS,
			multiStepOptions: {},
			setMultiStepOptions: noop,
			pageConfig: {},
			setPageConfig: noop,
			savePageConfig: noopAsync,
			addPage: noop,
			removePage: noop,
			reorderPages: noop,
			updatePage: noop,
			addBlock: noop,
			addBlockAt: noop,
			addBlockToParent: noop,
			duplicateBlockAt: noop,
			removeBlock: noop,
			reorderBlocks: noop,
			moveBlock: noop,
			updateBlockProps: noop,
			updateFieldBlockType: noop,
			save: noopAsync,
			publish: noopAsync,
			publishVersion: noopAsync,
			unpublish: noopAsync,
			restoreVersion: noopAsync,
			refreshVersions: noopAsync,
			widgetName: "",
			setWidgetName: noopSetStr,
			handleWidgetNameBlur: noopAsync,
			versions: [],
			versionsLoading: false,
			selectedVersionId: null,
			setSelectedVersionId: noopSetNull,
			publishedVersionId: null,
			publishingVersionId: null,
			restoringVersion: false,
			definitionStatus: null,
			loading: false,
			saving: false,
			publishing: false,
			unpublishing: false,
			widgetNameSaving: false,
			previewStyling: {},
			deleteWidgetId: null,
			setDeleteWidgetId: noopSetNull,
			onDeleteWidget,
		};
	}

	return {
		pages,
		isDirty,
		validationIssues,
		hasValidationErrors,
		activePageId,
		setActivePageId,
		selectedBlockId,
		setSelectedBlockId,
		selectedBlock,
		actions,
		multiStepOptions,
		setMultiStepOptions,
		pageConfig,
		setPageConfig,
		savePageConfig,
		addPage,
		removePage,
		reorderPages,
		updatePage,
		addBlock,
		addBlockAt,
		addBlockToParent,
		duplicateBlockAt,
		removeBlock,
		reorderBlocks,
		moveBlock,
		updateBlockProps,
		updateFieldBlockType,
		save,
		publish,
		publishVersion,
		unpublish,
		restoreVersion,
		refreshVersions,
		widgetName,
		setWidgetName,
		handleWidgetNameBlur,
		versions,
		versionsLoading,
		selectedVersionId,
		setSelectedVersionId,
		publishedVersionId,
		publishingVersionId,
		restoringVersion,
		definitionStatus,
		loading,
		saving,
		publishing,
		unpublishing,
		widgetNameSaving,
		previewStyling,
		deleteWidgetId,
		setDeleteWidgetId,
		onDeleteWidget,
	};
}
