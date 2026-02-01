import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWidgetDesigner } from "@/contexts/widget-designer-context";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { functionsService } from "@/services/functions/functions-service";
import type {
	WidgetBlockSchema,
	WidgetBlock,
	WidgetVersionActions,
} from "@/core/entities/widget-block-schema";
import type { BlockType } from "@/core/entities/widget-block-schema";
import type { WidgetStyling } from "@/components/site-builder/widget-types";

const DEFAULT_ACTIONS: WidgetVersionActions = {
	createLead: { enabled: true, tags: [] },
	success: { message: "Thank you!" },
};

const noop = () => {};
const noopAsync = async () => {};
const noopSetStr = (_: string) => {};
const noopSetNull = (_: string | null) => {};

export interface UseWidgetBuilderParams {
	effectiveWidgetId: string | undefined;
	organizationId: string | undefined;
	widgetBelongsToOrg: boolean;
	onDeleteWidget: (widgetId: string) => Promise<void>;
}

export interface UseWidgetBuilderReturn {
	schema: WidgetBlockSchema;
	selectedBlockId: string | null;
	setSelectedBlockId: (id: string | null) => void;
	selectedBlock: WidgetBlock | undefined;
	actions: WidgetVersionActions;
	addBlock: (type: BlockType, defaultProps: Record<string, unknown>) => void;
	addBlockAt: (
		index: number,
		type: BlockType,
		defaultProps: Record<string, unknown>,
	) => void;
	duplicateBlock: (index: number) => void;
	removeBlock: (id: string) => void;
	reorderBlocks: (fromIndex: number, toIndex: number) => void;
	updateBlockProps: (id: string, props: Record<string, unknown>) => void;
	save: () => Promise<void>;
	publish: () => Promise<void>;
	unpublish: () => Promise<void>;
	widgetName: string;
	setWidgetName: (name: string) => void;
	handleWidgetNameBlur: () => Promise<void>;
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

	const [schema, setSchema] = useState<WidgetBlockSchema>([]);
	const [actions, setActions] = useState<WidgetVersionActions>(DEFAULT_ACTIONS);
	const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [unpublishing, setUnpublishing] = useState(false);
	const [definitionStatus, setDefinitionStatus] = useState<string | null>(
		null,
	);
	const [widgetName, setWidgetName] = useState("");
	const [widgetNameSaving, setWidgetNameSaving] = useState(false);
	const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);

	const selectedBlock = useMemo(
		() => schema.find((b) => b.id === selectedBlockId),
		[schema, selectedBlockId],
	);

	useEffect(() => {
		if (!organizationId || !effectiveWidgetId) {
			setSchema([]);
			setSelectedBlockId(null);
			return;
		}
		if (!widgetBelongsToOrg) return;
		setLoading(true);
		functionsService
			.getModularWidgetDraft({
				organizationId,
				widgetId: effectiveWidgetId,
			})
			.then((r) => {
				if (r.version?.schema && Array.isArray(r.version.schema)) {
					setSchema(r.version.schema as WidgetBlockSchema);
				}
				if (
					r.version?.actions &&
					typeof r.version.actions === "object"
				) {
					setActions(r.version.actions as WidgetVersionActions);
				}
				setDefinitionStatus(r.definition?.status ?? null);
			})
			.catch(() => toast.error("Failed to load widget"))
			.finally(() => setLoading(false));
	}, [organizationId, effectiveWidgetId, widgetBelongsToOrg]);

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

	const addBlock = useCallback(
		(type: BlockType, defaultProps: Record<string, unknown>) => {
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
			};
			setSchema((prev) => [...prev, block]);
			setSelectedBlockId(block.id);
		},
		[],
	);

	const addBlockAt = useCallback(
		(
			index: number,
			type: BlockType,
			defaultProps: Record<string, unknown>,
		) => {
			const block: WidgetBlock = {
				id: generateBlockId(),
				type,
				props: defaultProps,
			};
			setSchema((prev) => [
				...prev.slice(0, index),
				block,
				...prev.slice(index),
			]);
			setSelectedBlockId(block.id);
		},
		[],
	);

	const duplicateBlock = useCallback((index: number) => {
		setSchema((prev) => {
			const block = prev[index];
			if (!block) return prev;
			const copy: WidgetBlock = {
				id: generateBlockId(),
				type: block.type,
				props: { ...block.props },
			};
			setSelectedBlockId(copy.id);
			return [
				...prev.slice(0, index + 1),
				copy,
				...prev.slice(index + 1),
			];
		});
	}, []);

	const removeBlock = useCallback((id: string) => {
		setSchema((prev) => prev.filter((b) => b.id !== id));
		setSelectedBlockId((prev) => (prev === id ? null : prev));
	}, []);

	const reorderBlocks = useCallback(
		(fromIndex: number, toIndex: number) => {
			if (fromIndex === toIndex) return;
			setSchema((prev) => {
				const copy = [...prev];
				const [item] = copy.splice(fromIndex, 1);
				copy.splice(toIndex, 0, item);
				return copy;
			});
		},
		[],
	);

	const updateBlockProps = useCallback(
		(id: string, props: Record<string, unknown>) => {
			setSchema((prev) =>
				prev.map((b) =>
					b.id === id ? { ...b, props: { ...b.props, ...props } } : b,
				),
			);
		},
		[],
	);

	const save = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		setSaving(true);
		try {
			await functionsService.saveModularWidgetVersion({
				organizationId,
				widgetId: effectiveWidgetId,
				schema,
				actions,
			});
			toast.success("Draft saved");
		} catch {
			toast.error("Failed to save");
		} finally {
			setSaving(false);
		}
	}, [organizationId, effectiveWidgetId, schema, actions]);

	const publish = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		setPublishing(true);
		try {
			const r = await functionsService.saveModularWidgetVersion({
				organizationId,
				widgetId: effectiveWidgetId,
				schema,
				actions,
			});
			await functionsService.publishModularWidget({
				organizationId,
				widgetId: effectiveWidgetId,
				versionId: r.versionId,
			});
			setDefinitionStatus("published");
			queryClient.invalidateQueries({
				queryKey: ["widget-definitions", organizationId],
			});
			toast.success("Widget published");
		} catch {
			toast.error("Failed to publish");
		} finally {
			setPublishing(false);
		}
	}, [organizationId, effectiveWidgetId, schema, actions, queryClient]);

	const unpublish = useCallback(async () => {
		if (!organizationId || !effectiveWidgetId) return;
		setUnpublishing(true);
		try {
			await functionsService.unpublishModularWidget({
				organizationId,
				widgetId: effectiveWidgetId,
			});
			setDefinitionStatus("draft");
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
			schema: [],
			selectedBlockId: null,
			setSelectedBlockId: noopSetNull,
			selectedBlock: undefined,
			actions: DEFAULT_ACTIONS,
			addBlock: noop,
			addBlockAt: noop,
			duplicateBlock: noop,
			removeBlock: noop,
			reorderBlocks: noop,
			updateBlockProps: noop,
			save: noopAsync,
			publish: noopAsync,
			unpublish: noopAsync,
			widgetName: "",
			setWidgetName: noopSetStr,
			handleWidgetNameBlur: noopAsync,
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
		schema,
		selectedBlockId,
		setSelectedBlockId,
		selectedBlock,
		actions,
		addBlock,
		addBlockAt,
		duplicateBlock,
		removeBlock,
		reorderBlocks,
		updateBlockProps,
		save,
		publish,
		unpublish,
		widgetName,
		setWidgetName,
		handleWidgetNameBlur,
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
