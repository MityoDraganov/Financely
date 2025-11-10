import { useEffect, useMemo, useRef, useState } from "react";
import { signInAnonymously } from "@firebase/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Plus,
	Type as TypeIcon,
	ImageIcon,
	Table as TableIcon,
	Square,
	Minus,
	Lock,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Template, TemplateData, TemplateElement } from "@/core";
import { templateService } from "@/services/template-service";
import { firebase } from "@/infrastructure";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useCreateTemplate } from "@/hooks/repository-hooks/use-create-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { usePresence } from "@/hooks/use-presence";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { invoiceComplianceService } from "@/services/invoice-compliance-service";
import { isRequiredBinding } from "@/utils/invoice-compliance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EnhancedPresenceIndicator } from "@/components/designer/enhanced-presence-indicator";
import { LiveCursor } from "@/components/designer/live-cursor";
import {
	TextElement,
	TextProperties,
	ImageElement,
	ImageProperties,
	BoxElement,
	BoxProperties,
	LineElement,
	LineProperties,
	InputElement,
	InputProperties,
	TableElement,
	TableProperties,
} from "@/components/designer/elements";

type DesignerState = {
	currentTemplateId?: string;
	selectedElementId?: string;
	zoom: number;
};

type DragMode = "move" | "resize";

type DragState = {
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

type SnapGuide = {
	type: "horizontal" | "vertical";
	position: number;
	start: number;
	end: number;
};

export default function TemplateDesignerPage() {
	const queryClient = useQueryClient();
	const [state, setState] = useState<DesignerState>({ zoom: 1 });
	const [drag, setDrag] = useState<DragState | null>(null);
	const [draftElements, setDraftElements] = useState<
		TemplateElement[] | null
	>(null);
	const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
	const draftRef = useRef<TemplateElement[] | null>(null);
	const currentTemplateRef = useRef<Template | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);
	const propertiesRef = useRef<HTMLDivElement | null>(null);
	const [isPropsNarrow, setIsPropsNarrow] = useState(false);
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || ""; // Fallback to demo-org if no org is loaded
	const { data: templates = [], isSubscribed } = useTemplates(orgId);
	const { activeUsers, updateCursor } = usePresence(state.currentTemplateId);
	const authUser = useFirebaseAuthUser();
	const createTemplate = useCreateTemplate();

	// Handler for creating a new template
	const handleCreateNewTemplate = async () => {
		// Detect region from organization for compliance
		const region = currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US";
		
		const templateData: TemplateData = {
			orgId,
			name: "New Template",
			description: "A new template",
			pageSize: "A4",
			brand: {
				colors: {
					primary: "#000000",
					secondary: "#666666",
					accent: "#2563eb",
				},
				backgroundImage: "",
				margins: { top: 40, right: 40, bottom: 40, left: 40 },
				fonts: ["Inter"],
			},
			elements: [],
			status: "draft",
			// Set compliance metadata based on organization region
			compliance: {
				region,
				requiredFields: [],
				autoFooter: true,
				complianceValidated: false,
			},
		};
		
		try {
			const newTemplateId = await createTemplate.mutateAsync(templateData);
			setState((s: DesignerState) => ({
				...s,
				currentTemplateId: newTemplateId,
			}));
		} catch (error) {
			console.error("Failed to create template:", error);
		}
	};

	console.log(
		"templates",
		templates,
		"realtime subscribed:",
		isSubscribed,
		"orgId:",
		orgId
	);

	const currentTemplate = useMemo(() => {
		return (
			templates.find((t: Template) => t.id === state.currentTemplateId) ??
			templates[0]
		);
	}, [templates, state.currentTemplateId]);

	// Compliance validation for current template
	const complianceStatus = useMemo(() => {
		if (!currentTemplate || !currentOrg) return null;
		
		// Use template's stored region if available, otherwise detect from organization
		const region = currentTemplate.compliance?.region || invoiceComplianceService.detectRegion(currentOrg);
		const validation = invoiceComplianceService.validateTemplate(currentTemplate, region);
		
		return {
			region,
			valid: validation.valid,
			missingBindings: validation.missingBindings,
		};
	}, [currentTemplate, currentOrg]);

	// Check if a binding is required for compliance
	const isRequired = useMemo(() => {
		if (!currentOrg || !complianceStatus) return () => false;
		return (binding: string | undefined) => {
			if (!binding) return false;
			return isRequiredBinding(complianceStatus.region, binding);
		};
	}, [currentOrg, complianceStatus]);

	// Keep refs in sync for stable event handlers
	useEffect(() => {
		draftRef.current = draftElements;
	}, [draftElements]);

	useEffect(() => {
		currentTemplateRef.current = currentTemplate ?? null;
	}, [currentTemplate]);

	// Reset selection when template changes to avoid stale element ids
	useEffect(() => {
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: undefined,
		}));
	}, [state.currentTemplateId]);

	// Ensure a template is selected once templates load
	useEffect(() => {
		if (templates.length > 0 && !state.currentTemplateId) {
			setState((s: DesignerState) => ({
				...s,
				currentTemplateId: templates[0].id,
			}));
		}
	}, [templates, state.currentTemplateId]);

	// Observe sidebar width to adapt layout when user resizes the panel
	useEffect(() => {
		const el = propertiesRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setIsPropsNarrow(
					entry.contentRect.width < PROPS_NARROW_BREAKPOINT_PX
				);
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const saveMutation = useMutation({
		mutationFn: async (partial: Partial<TemplateData>) => {
			if (!currentTemplate) return;
			await templateService.updateDraft(currentTemplate.id, partial);
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["templates", orgId] }),
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			// Detect region from organization for compliance
			const region = currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US";
			
			const empty: TemplateData = {
				orgId: orgId,
				name: "New Invoice Template",
				description: "",
				pageSize: "A4",
				brand: {
					fonts: ["Inter"],
					colors: {
						primary: "#111827",
						secondary: "#6b7280",
						accent: "#2563eb",
					},
					margins: { top: 40, right: 40, bottom: 40, left: 40 },
				},
				elements: [],
				status: "draft",
				// Set compliance metadata based on organization region
				compliance: {
					region,
					requiredFields: [],
					autoFooter: true,
					complianceValidated: false,
				},
			};
			console.log("[CREATE] creating new template for orgId:", orgId);
			const id = await templateService.createDraft(empty);
			console.log("[CREATE] template created with id:", id);
			return id;
		},
		onSuccess: (id: string) => {
			console.log("[CREATE] onSuccess called with id:", id);
			setState((s: DesignerState) => ({ ...s, currentTemplateId: id }));
			queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
		},
		onError: (error) => {
			console.error("[CREATE] failed to create template:", error);
		},
	});

	const PAGE_WIDTH = 794;
	const PAGE_HEIGHT = 1123;
	const PROPS_NARROW_BREAKPOINT_PX = 520;
	const SNAP_THRESHOLD = 5; // pixels

	function calculateSnapPositions(
		draggingElement: TemplateElement,
		allElements: TemplateElement[],
		dragX: number,
		dragY: number
	): {
		snappedX: number;
		snappedY: number;
		guides: SnapGuide[];
	} {
		const guides: SnapGuide[] = [];
		let snappedX = dragX;
		let snappedY = dragY;

		// Calculate edges of dragging element
		const dragLeft = dragX;
		const dragRight = dragX + draggingElement.width;
		const dragTop = dragY;
		const dragBottom = dragY + draggingElement.height;
		const dragCenterX = dragX + draggingElement.width / 2;
		const dragCenterY = dragY + draggingElement.height / 2;

		let bestXSnap: {
			distance: number;
			position: number;
			otherElement: TemplateElement;
		} | null = null;
		let bestYSnap: {
			distance: number;
			position: number;
			otherElement: TemplateElement;
		} | null = null;

		// Check against all other elements
		for (const el of allElements) {
			if (el.id === draggingElement.id) continue;

			const elLeft = el.x;
			const elRight = el.x + el.width;
			const elTop = el.y;
			const elBottom = el.y + el.height;
			const elCenterX = el.x + el.width / 2;
			const elCenterY = el.y + el.height / 2;

			// Check vertical alignments (X axis)
			const xAlignments = [
				{ dragPos: dragLeft, elPos: elLeft, name: "left-left" },
				{ dragPos: dragLeft, elPos: elRight, name: "left-right" },
				{ dragPos: dragRight, elPos: elLeft, name: "right-left" },
				{ dragPos: dragRight, elPos: elRight, name: "right-right" },
				{
					dragPos: dragCenterX,
					elPos: elCenterX,
					name: "center-center",
				},
			];

			for (const align of xAlignments) {
				const distance = Math.abs(align.dragPos - align.elPos);
				if (
					distance <= SNAP_THRESHOLD &&
					(!bestXSnap || distance < bestXSnap.distance)
				) {
					const offset = align.dragPos - dragX;
					bestXSnap = {
						distance,
						position: align.elPos - offset,
						otherElement: el,
					};
				}
			}

			// Check horizontal alignments (Y axis)
			const yAlignments = [
				{ dragPos: dragTop, elPos: elTop, name: "top-top" },
				{ dragPos: dragTop, elPos: elBottom, name: "top-bottom" },
				{ dragPos: dragBottom, elPos: elTop, name: "bottom-top" },
				{ dragPos: dragBottom, elPos: elBottom, name: "bottom-bottom" },
				{
					dragPos: dragCenterY,
					elPos: elCenterY,
					name: "center-center",
				},
			];

			for (const align of yAlignments) {
				const distance = Math.abs(align.dragPos - align.elPos);
				if (
					distance <= SNAP_THRESHOLD &&
					(!bestYSnap || distance < bestYSnap.distance)
				) {
					const offset = align.dragPos - dragY;
					bestYSnap = {
						distance,
						position: align.elPos - offset,
						otherElement: el,
					};
				}
			}
		}

		// Apply snapping
		if (bestXSnap) {
			snappedX = bestXSnap.position;
			const snappedCenterX = snappedX + draggingElement.width / 2;
			const otherCenterX =
				bestXSnap.otherElement.x + bestXSnap.otherElement.width / 2;

			// Determine guide position based on alignment type
			let guideX = snappedX;
			if (Math.abs(snappedCenterX - otherCenterX) < 1) {
				guideX = snappedCenterX;
			} else if (
				Math.abs(
					snappedX +
						draggingElement.width -
						(bestXSnap.otherElement.x +
							bestXSnap.otherElement.width)
				) < 1
			) {
				guideX = snappedX + draggingElement.width;
			}

			guides.push({
				type: "vertical",
				position: guideX,
				start: Math.min(dragY, bestXSnap.otherElement.y),
				end: Math.max(
					dragY + draggingElement.height,
					bestXSnap.otherElement.y + bestXSnap.otherElement.height
				),
			});
		}

		if (bestYSnap) {
			snappedY = bestYSnap.position;
			const snappedCenterY = snappedY + draggingElement.height / 2;
			const otherCenterY =
				bestYSnap.otherElement.y + bestYSnap.otherElement.height / 2;

			// Determine guide position based on alignment type
			let guideY = snappedY;
			if (Math.abs(snappedCenterY - otherCenterY) < 1) {
				guideY = snappedCenterY;
			} else if (
				Math.abs(
					snappedY +
						draggingElement.height -
						(bestYSnap.otherElement.y +
							bestYSnap.otherElement.height)
				) < 1
			) {
				guideY = snappedY + draggingElement.height;
			}

			guides.push({
				type: "horizontal",
				position: guideY,
				start: Math.min(
					dragX,
					bestXSnap?.otherElement?.x ?? bestYSnap.otherElement.x
				),
				end: Math.max(
					dragX + draggingElement.width,
					bestXSnap?.otherElement
						? bestXSnap.otherElement.x +
								bestXSnap.otherElement.width
						: bestYSnap.otherElement.x +
								bestYSnap.otherElement.width
				),
			});
		}

		return { snappedX, snappedY, guides };
	}

	function clampMove(x: number, y: number, width: number, height: number) {
		const maxX = Math.max(0, PAGE_WIDTH - width);
		const maxY = Math.max(0, PAGE_HEIGHT - height);
		return {
			x: Math.min(Math.max(0, x), maxX),
			y: Math.min(Math.max(0, y), maxY),
		};
	}

	function clampResize(x: number, y: number, width: number, height: number) {
		const minW = 8;
		const minH = 8;
		let nextX = x;
		let nextY = y;
		let nextW = Math.max(minW, width);
		let nextH = Math.max(minH, height);
		if (nextX < 0) {
			nextW = Math.max(minW, nextW + nextX);
			nextX = 0;
		}
		if (nextY < 0) {
			nextH = Math.max(minH, nextH + nextY);
			nextY = 0;
		}
		if (nextX + nextW > PAGE_WIDTH) {
			nextW = Math.max(minW, PAGE_WIDTH - nextX);
		}
		if (nextY + nextH > PAGE_HEIGHT) {
			nextH = Math.max(minH, PAGE_HEIGHT - nextY);
		}
		return { x: nextX, y: nextY, width: nextW, height: nextH };
	}

	function handleCanvasDragOver(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		console.log("[DND] canvas dragover", {
			target: (e.target as HTMLElement)?.className,
			currentTarget: (e.currentTarget as HTMLElement)?.className,
		});
		try {
			e.dataTransfer.dropEffect = "copy";
		} catch {
			/* no-op */
		}
	}

	async function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		const raw =
			e.dataTransfer.getData("application/x-template-element") ||
			e.dataTransfer.getData("text/plain");
		const type = (raw as TemplateElement["type"]) || undefined;
		console.log("[DND] canvas drop", {
			raw,
			type,
			target: (e.target as HTMLElement)?.className,
			currentTarget: (e.currentTarget as HTMLElement)?.className,
		});
		if (!type) return;
		if (!currentTemplate) {
			console.log(
				"[DND] no current template; creating one before drop..."
			);
			try {
				// Try to ensure authentication for better security, but don't block if it fails
				if (!firebase.auth.currentUser) {
					try {
						console.log("[AUTH] attempting anonymous sign-in...");
						await signInAnonymously(firebase.auth);
						console.log("[AUTH] signed in anonymously");
					} catch (authErr) {
						console.warn(
							"[AUTH] anonymous sign-in failed, continuing without auth:",
							authErr
						);
						// Continue without auth for development/demo purposes
					}
				}
				console.log("[DND] calling createMutation.mutateAsync...");
				const newId = await (
					createMutation as unknown as {
						mutateAsync: () => Promise<string | undefined>;
					}
				).mutateAsync();
				console.log("[DND] mutateAsync returned:", newId);
				if (newId && typeof newId === "string") {
					setState((s: DesignerState) => ({
						...s,
						currentTemplateId: newId,
					}));
					console.log("[DND] set currentTemplateId to", newId);
					// Wait a bit for the template to be available
					await new Promise((resolve) => setTimeout(resolve, 500));
				} else {
					console.error("[DND] invalid template id returned:", newId);
					return;
				}
			} catch (err) {
				console.error("[DND] failed to create template for drop", err);
				return;
			}
		}
		const rect = pageRef.current?.getBoundingClientRect();
		console.log("[DND] page rect", rect);
		if (!rect) return;
		const x = (e.clientX - rect.left) / state.zoom;
		const y = (e.clientY - rect.top) / state.zoom;
		console.log("[DND] computed drop coords", { x, y, zoom: state.zoom });
		addElement(type, {
			x: Math.max(0, Math.min(Math.round(x), PAGE_WIDTH - 1)),
			y: Math.max(0, Math.min(Math.round(y), PAGE_HEIGHT - 1)),
		});
	}

	function addElement(
		kind: TemplateElement["type"],
		at?: { x: number; y: number }
	) {
		if (!currentTemplate) return;
		console.log("[ADD] addElement called", {
			kind,
			at,
			templateId: currentTemplate.id,
		});

		// Generate default binding based on element type and existing elements
		const existingElements = currentTemplate.elements ?? [];
		const elementsOfSameType = existingElements.filter(el => el.type === kind);
		const defaultBinding = elementsOfSameType.length === 0 
			? kind 
			: `${kind}${elementsOfSameType.length + 1}`;

		const newElement: TemplateElement =
			kind === "text"
				? {
						id: crypto.randomUUID(),
						type: "text",
						x: at?.x ?? 60,
						y: at?.y ?? 80,
						width: 200,
						height: 40,
						rotation: 0,
						zIndex: 1,
						visible: true,
						text: "Text",
						binding: defaultBinding,
						typography: {
							fontFamily: "Inter",
							fontSize: 12,
							fontWeight: "normal",
							lineHeight: 1.2,
							letterSpacing: 0,
							color: "#111827",
							align: "left",
							uppercase: false,
							lowercase: false,
						},
						format: { kind: "none" },
					}
				: kind === "image"
					? {
							id: crypto.randomUUID(),
							type: "image",
							x: at?.x ?? 60,
							y: at?.y ?? 80,
							width: 120,
							height: 60,
							rotation: 0,
							zIndex: 1,
							visible: true,
							src: "",
							binding: defaultBinding,
							objectFit: "contain",
						}
					: kind === "table"
						? {
								id: crypto.randomUUID(),
								type: "table",
								x: at?.x ?? 60,
								y: at?.y ?? 160,
								width: 420,
								height: 200,
								rotation: 0,
								zIndex: 1,
								visible: true,
								rowHeight: 28,
								headerHeight: 28,
								stripe: true,
								columns: [
									{
										id: crypto.randomUUID(),
										header: "Column 1",
										width: 160,
										align: "left",
										type: "text",
										format: { kind: "none" },
									},
									{
										id: crypto.randomUUID(),
										header: "Column 2",
										width: 160,
										align: "left",
										type: "text",
										format: { kind: "none" },
									},
								],
								designRows: [],
								itemsBinding: "items",
								totals: [],
							}
						: kind === "box"
							? {
									id: crypto.randomUUID(),
									type: "box",
									x: at?.x ?? 40,
									y: at?.y ?? 40,
									width: 200,
									height: 80,
									rotation: 0,
									zIndex: 0,
									visible: true,
									fill: "#ffffff00",
									stroke: "#e5e7eb",
									strokeWidth: 1,
									radius: 0,
								}
							: kind === "input"
								? {
										id: crypto.randomUUID(),
										type: "input",
										x: at?.x ?? 60,
										y: at?.y ?? 260,
										width: 200,
										height: 32,
										rotation: 0,
										zIndex: 1,
										visible: true,
										placeholder: "",
										binding: defaultBinding,
										variant: "text",
										align: "left",
									}
								: {
										id: crypto.randomUUID(),
										type: "line",
										x: at?.x ?? 40,
										y: at?.y ?? 140,
										width: 200,
										height: 1,
										rotation: 0,
										zIndex: 0,
										visible: true,
										x2: 240,
										y2: 140,
										stroke: "#e5e7eb",
										strokeWidth: 1,
									};
		console.log("[ADD] new element", newElement);
		// Clamp initial position so element appears fully in frame
		const clampedAt = clampMove(
			newElement.x,
			newElement.y,
			newElement.width,
			newElement.height
		);
		const nextElement = {
			...newElement,
			x: clampedAt.x,
			y: clampedAt.y,
		} as TemplateElement;
		const next = [...(currentTemplate?.elements ?? []), nextElement];
		console.log("[ADD] next elements length", next.length);
		// optimistic UI update so drop shows immediately
		setDraftElements(next);
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: nextElement.id,
		}));
		console.log("[ADD] persisting draft via saveMutation.mutate");
		saveMutation.mutate({ elements: next });
	}

	function updateSelected(partial: Partial<TemplateElement>) {
		if (!currentTemplate || !state.selectedElementId) return;
		const next = (currentTemplate.elements ?? []).map(
			(el: TemplateElement) =>
				el.id === state.selectedElementId
					? ((): TemplateElement => {
							const merged = {
								...el,
								...partial,
							} as TemplateElement;
							const clampedMove = clampMove(
								merged.x,
								merged.y,
								merged.width,
								merged.height
							);
							return {
								...merged,
								x: clampedMove.x,
								y: clampedMove.y,
							} as TemplateElement;
						})()
					: el
		);
		setDraftElements(next);
		saveMutation.mutate({ elements: next });
	}

	function deleteElement(id: string) {
		if (!currentTemplate) return;
		const next = (currentTemplate.elements ?? []).filter(
			(e) => e.id !== id
		);
		saveMutation.mutate({ elements: next });
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: undefined,
		}));
	}

	// Global pointer handlers during drag
	useEffect(() => {
		if (!drag) return;

		const {
			startClientX,
			startClientY,
			startX,
			startY,
			elementId,
			mode,
			edge,
			startWidth,
			startHeight,
		} = drag;

		function handlePointerMove(ev: PointerEvent) {
			const dx = (ev.clientX - startClientX) / state.zoom;
			const dy = (ev.clientY - startClientY) / state.zoom;

			setDraftElements((prev: TemplateElement[] | null) => {
				const base = prev ?? currentTemplateRef.current?.elements ?? [];
				const draggingElement = base.find(
					(item) => item.id === elementId
				);
				if (!draggingElement) return base;

				return base.map((item) => {
					if (item.id !== elementId) return item;
					if (mode === "move") {
						const rawX = startX + dx;
						const rawY = startY + dy;

						// Calculate snapping with guides
						const { snappedX, snappedY, guides } =
							calculateSnapPositions(
								draggingElement,
								base,
								rawX,
								rawY
							);

						// Update snap guides
						setSnapGuides(guides);

						const clamped = clampMove(
							snappedX,
							snappedY,
							item.width,
							item.height
						);
						return { ...item, x: clamped.x, y: clamped.y };
					}
					// resize logic - clear snap guides during resize
					setSnapGuides([]);
					let nextX = startX;
					let nextY = startY;
					let nextW = startWidth ?? item.width;
					let nextH = startHeight ?? item.height;
					if (edge?.includes("e"))
						nextW = Math.max(1, (startWidth ?? item.width) + dx);
					if (edge?.includes("s"))
						nextH = Math.max(1, (startHeight ?? item.height) + dy);
					if (edge?.includes("w")) {
						nextX = startX + dx;
						nextW = Math.max(1, (startWidth ?? item.width) - dx);
					}
					if (edge?.includes("n")) {
						nextY = startY + dy;
						nextH = Math.max(1, (startHeight ?? item.height) - dy);
					}
					const clamped = clampResize(nextX, nextY, nextW, nextH);
					return {
						...item,
						x: clamped.x,
						y: clamped.y,
						width: clamped.width,
						height: clamped.height,
					};
				});
			});
		}

		function handlePointerUp() {
			const latestDraft = draftRef.current;
			const tmpl = currentTemplateRef.current;
			if (latestDraft && tmpl) {
				saveMutation.mutate({ elements: latestDraft });
			}
			setDrag(null);
			setDraftElements(null);
			setSnapGuides([]);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [drag, state.zoom, saveMutation]);

	return (
		<div className="flex h-screen">
			<ResizablePanelGroup direction="horizontal">
				<ResizablePanel defaultSize={18} minSize={16}>
					<div className="h-full p-3 border-r bg-neutral-50">
						<div className="flex items-center justify-between mb-3">
							<div className="font-medium">Templates</div>
						</div>
						<div className="space-y-2">
							{templates.length === 0 && (
								<div className="text-xs text-neutral-500">
									No templates yet. Click "New" to create your
									first template.
								</div>
							)}
						</div>
						<div className="mt-4">
							<div className="text-xs uppercase text-neutral-500 mb-2">
								Palette
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
								<Button
									variant="secondary"
									onClick={() => addElement("text")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: text");
										e.dataTransfer.setData(
											"application/x-template-element",
											"text"
										);
										e.dataTransfer.setData(
											"text/plain",
											"text"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<TypeIcon className="h-4 w-4 mr-1" /> Text
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("image")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: image");
										e.dataTransfer.setData(
											"application/x-template-element",
											"image"
										);
										e.dataTransfer.setData(
											"text/plain",
											"image"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<ImageIcon className="h-4 w-4 mr-1" /> Image
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("table")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: table");
										e.dataTransfer.setData(
											"application/x-template-element",
											"table"
										);
										e.dataTransfer.setData(
											"text/plain",
											"table"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<TableIcon className="h-4 w-4 mr-1" /> Table
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("input")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: input");
										e.dataTransfer.setData(
											"application/x-template-element",
											"input"
										);
										e.dataTransfer.setData(
											"text/plain",
											"input"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<TypeIcon className="h-4 w-4 mr-1" /> Input
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("box")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: box");
										e.dataTransfer.setData(
											"application/x-template-element",
											"box"
										);
										e.dataTransfer.setData(
											"text/plain",
											"box"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<Square className="h-4 w-4 mr-1" /> Box
								</Button>
								<Button
									variant="secondary"
									onClick={() => addElement("line")}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: line");
										e.dataTransfer.setData(
											"application/x-template-element",
											"line"
										);
										e.dataTransfer.setData(
											"text/plain",
											"line"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start"
								>
									{" "}
									<Minus className="h-4 w-4 mr-1" /> Line
								</Button>
							</div>
							<div className="mt-4">
								<div className="text-xs uppercase text-neutral-500 mb-2">
									Elements
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
									{(currentTemplate?.elements ?? []).map(
										(el) => (
											<ContextMenu key={el.id}>
												<ContextMenuTrigger asChild>
													<div
														className={`px-2 py-2 min-w-0 w-full text-xs sm:text-sm rounded cursor-pointer truncate ${state.selectedElementId === el.id ? "bg-blue-50 text-blue-700" : "hover:bg-neutral-100"}`}
														onClick={() =>
															setState(
																(
																	s: DesignerState
																) => ({
																	...s,
																	selectedElementId:
																		el.id,
																})
															)
														}
													>
														<span className="uppercase text-[10px] text-neutral-500 mr-2">
															{el.type}
														</span>
														<span className="truncate inline-block align-middle">
															{el.type === "text"
																? ((
																		el as Extract<
																			TemplateElement,
																			{
																				type: "text";
																			}
																		>
																	).text ??
																	"Text")
																: el.id.slice(
																		0,
																		6
																	)}
														</span>
													</div>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuItem
														onClick={() =>
															deleteElement(el.id)
														}
														variant="destructive"
													>
														Delete
													</ContextMenuItem>
													<ContextMenuSeparator />
													<ContextMenuItem
														onClick={() =>
															setState(
																(
																	s: DesignerState
																) => ({
																	...s,
																	selectedElementId:
																		el.id,
																})
															)
														}
													>
														Select
													</ContextMenuItem>
												</ContextMenuContent>
											</ContextMenu>
										)
									)}
								</div>
							</div>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel minSize={40}>
					<div className="h-full flex flex-col">
						<div className="px-3 py-2 border-b  flex items-center gap-2">
							<Select
								value={currentTemplate?.id ?? ""}
								onValueChange={async (id: string) => {
									if (id === "new") {
										await handleCreateNewTemplate();
									} else {
										setState((s: DesignerState) => ({
											...s,
											currentTemplateId: id,
										}));
									}
								}}
							>
								<SelectTrigger className="w-60">
									<SelectValue placeholder="Select a template" />
								</SelectTrigger>
								<SelectContent>
									{templates.map((t: Template) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
									<SelectItem value="new">
										<Plus className="h-4 w-4 mr-1" /> New
										template
									</SelectItem>
								</SelectContent>
							</Select>
							{isSubscribed && (
								<div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
									<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
									<span>Live</span>
								</div>
							)}
						
								<EnhancedPresenceIndicator users={activeUsers} />
							
							<div className="ml-auto flex items-center gap-2">
								<Select
									value={String(state.zoom)}
									onValueChange={(v: string) =>
										setState((s: DesignerState) => ({
											...s,
											zoom: Number(v),
										}))
									}
								>
									<SelectTrigger className="w-24">
										<SelectValue placeholder="Zoom" />
									</SelectTrigger>
									<SelectContent>
										{[0.75, 1, 1.25, 1.5, 2].map((z) => (
											<SelectItem
												key={z}
												value={String(z)}
											>
												{Math.round(z * 100)}%
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div
							className="flex-1 overflow-auto bg-neutral-100 grid place-items-center"
							onDragOver={(e) => {
								e.preventDefault();
								console.log("[DND] container dragover");
							}}
							onDrop={(e) => {
								e.preventDefault();
								console.log("[DND] container drop (ignored)");
							}}
						>
							{!currentTemplate && (
								<div className="text-center text-neutral-500 p-8">
									<div className="text-sm mb-2">
										No template selected.
									</div>
									<div className="text-xs mb-4">
										Select an existing template from the
										dropdown above or create a new one to
										start designing.
									</div>
									<Button
										size="sm"
										onClick={() => createMutation.mutate()}
									>
										<Plus className="mr-1 h-4 w-4" /> Create
										template
									</Button>
								</div>
							)}
							<div
								ref={pageRef}
								className="bg-white shadow-xl relative"
								style={{
									width: 794 * state.zoom,
									height: 1123 * state.zoom,
								}}
								onDragOver={handleCanvasDragOver}
								onDrop={handleCanvasDrop}
								onMouseMove={(e) => {
									if (!state.currentTemplateId) return;
									
									const rect = pageRef.current?.getBoundingClientRect();
									if (!rect) return;
									
									const x = (e.clientX - rect.left) / state.zoom;
									const y = (e.clientY - rect.top) / state.zoom;
									
									// Throttle cursor updates to avoid too many database writes
									updateCursor({ x, y });
								}}
							>
								{/* grid */}
								<div
									className="absolute inset-0 z-0"
									style={{
										backgroundSize: `${8 * state.zoom}px ${8 * state.zoom}px`,
										backgroundImage: `linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)`,
									}}
									onDragEnter={() => {
										console.log("[DND] grid dragenter");
									}}
									onDragOver={handleCanvasDragOver}
									onDrop={handleCanvasDrop}
								/>
								{/* snap guides */}
								{snapGuides.map((guide, idx) => (
									<div
										key={`snap-${idx}`}
										className="absolute pointer-events-none"
										style={{
											...(guide.type === "vertical"
												? {
														left:
															guide.position *
															state.zoom,
														top:
															guide.start *
															state.zoom,
														width: 1,
														height:
															(guide.end -
																guide.start) *
															state.zoom,
													}
												: {
														left:
															guide.start *
															state.zoom,
														top:
															guide.position *
															state.zoom,
														width:
															(guide.end -
																guide.start) *
															state.zoom,
														height: 1,
													}),
											backgroundColor: "#8b5cf6",
											boxShadow:
												"0 0 0 0.5px rgba(139, 92, 246, 0.5)",
											zIndex: 9999,
										}}
									/>
								))}
								{/* Live cursors - exclude current user's cursor */}
								{activeUsers
									.filter(user => user.uid !== authUser?.uid)
									.map((user) => (
										<LiveCursor
											key={user.uid}
											user={user}
											zoom={state.zoom}
										/>
									))}
								
								{/* elements */}
								{(
									draftElements ??
									currentTemplate?.elements ??
									[]
								).map((el: TemplateElement) => {
									const binding = el.type === "text" ? el.binding : 
										el.type === "input" ? el.binding :
										el.type === "image" ? el.binding :
										el.type === "table" ? el.itemsBinding : undefined;
									const isRequiredField = isRequired(binding);
									
									return (
									<div
										key={el.id}
										className={`absolute ${state.selectedElementId === el.id ? "ring-2 ring-blue-500" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"} ${isRequiredField ? "ring-1 ring-amber-400" : ""}`}
										style={{
											left: el.x * state.zoom,
											top: el.y * state.zoom,
											width: el.width * state.zoom,
											height: el.height * state.zoom,
											transform: `rotate(${el.rotation}deg)`,
											touchAction: "none",
											zIndex: el.zIndex ?? 0,
										}}
										onClick={() => {
											setState((s: DesignerState) => ({
												...s,
												selectedElementId: el.id,
											}));
											console.log("clicked", el.id);
										}}
										onPointerDown={(e) => {
											console.log("pointer down", e);
											// Begin drag for this element
											e.preventDefault();
											e.stopPropagation();
											setState((s: DesignerState) => ({
												...s,
												selectedElementId: el.id,
											}));
											setDraftElements(
												(
													currentTemplate?.elements ??
													[]
												).map((x) => ({ ...x }))
											);
											setDrag({
												elementId: el.id,
												mode: "move",
												startClientX: e.clientX,
												startClientY: e.clientY,
												startX: el.x,
												startY: el.y,
											});
										}}
									>
										{/* Lock icon for required fields */}
										{isRequiredField && (
											<div
												className="absolute -top-2 -left-2 bg-amber-500 text-white rounded-full p-0.5 z-50 shadow-sm"
												title="Required field for compliance"
											>
												<Lock className="w-3 h-3" />
											</div>
										)}
										{/* resize handles */}
										{state.selectedElementId === el.id && (
											<>
												{[
													{
														edge: "nw",
														cx: 0,
														cy: 0,
														cursor: "nwse-resize",
													},
													{
														edge: "n",
														cx: 0.5,
														cy: 0,
														cursor: "ns-resize",
													},
													{
														edge: "ne",
														cx: 1,
														cy: 0,
														cursor: "nesw-resize",
													},
													{
														edge: "e",
														cx: 1,
														cy: 0.5,
														cursor: "ew-resize",
													},
													{
														edge: "se",
														cx: 1,
														cy: 1,
														cursor: "nwse-resize",
													},
													{
														edge: "s",
														cx: 0.5,
														cy: 1,
														cursor: "ns-resize",
													},
													{
														edge: "sw",
														cx: 0,
														cy: 1,
														cursor: "nesw-resize",
													},
													{
														edge: "w",
														cx: 0,
														cy: 0.5,
														cursor: "ew-resize",
													},
												].map((h) => (
													<div
														key={h.edge}
														style={{
															position:
																"absolute",
															left: `calc(${h.cx * 100}% - 4px)`,
															top: `calc(${h.cy * 100}% - 4px)`,
															width: 8,
															height: 8,
															background: "white",
															border: "1px solid #2563eb",
															borderRadius: 2,
															cursor: h.cursor as React.CSSProperties["cursor"],
														}}
														onPointerDown={(e) => {
															e.preventDefault();
															e.stopPropagation();
															setDraftElements(
																(
																	currentTemplate?.elements ??
																	[]
																).map((x) => ({
																	...x,
																}))
															);
															setDrag({
																elementId:
																	el.id,
																mode: "resize",
																edge: h.edge as DragState["edge"],
																startClientX:
																	e.clientX,
																startClientY:
																	e.clientY,
																startX: el.x,
																startY: el.y,
																startWidth:
																	el.width,
																startHeight:
																	el.height,
															});
														}}
													/>
												))}
											</>
										)}
										{el.type === "text" && (
											<TextElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "text" }
													>
												}
												zoom={state.zoom}
											/>
										)}
										{el.type === "input" && (
											<InputElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "input" }
													>
												}
											/>
										)}
										{el.type === "image" && (
											<ImageElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "image" }
													>
												}
											/>
										)}
										{el.type === "box" && (
											<BoxElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "box" }
													>
												}
											/>
										)}
										{el.type === "line" && (
											<LineElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "line" }
													>
												}
											/>
										)}
										{el.type === "table" &&
											(() => {
												const tbl = el as Extract<
													TemplateElement,
													{ type: "table" }
												>;
												return (
													<TableElement
														element={tbl}
														zoom={state.zoom}
														onHeaderChange={(
															columnId,
															header
														) => {
															const baseColumns =
																tbl.columns
																	.length > 0
																	? tbl.columns
																	: [
																			{
																				id: "c1",
																				header: "Column 1",
																				width: 120,
																				align: "left" as const,
																				type: "text" as const,
																				format: {
																					kind: "none" as const,
																				},
																			},
																			{
																				id: "c2",
																				header: "Column 2",
																				width: 120,
																				align: "left" as const,
																				type: "text" as const,
																				format: {
																					kind: "none" as const,
																				},
																			},
																		];
															const next =
																baseColumns.map(
																	(col) =>
																		col.id ===
																		columnId
																			? {
																					...col,
																					header,
																				}
																			: col
																);
															// Optimistic update for immediate feedback
															setDraftElements(
																(prev) => {
																	const base =
																		prev ??
																		currentTemplateRef
																			.current
																			?.elements ??
																		[];
																	return base.map(
																		(it) =>
																			it.id ===
																			tbl.id
																				? ({
																						...tbl,
																						columns:
																							next,
																					} as TemplateElement)
																				: it
																	);
																}
															);
															saveMutation.mutate(
																{
																	elements: (
																		currentTemplateRef
																			.current
																			?.elements ??
																		[]
																	).map(
																		(it) =>
																			it.id ===
																			tbl.id
																				? ({
																						...tbl,
																						columns:
																							next,
																					} as TemplateElement)
																				: it
																	),
																}
															);
														}}
													/>
												);
											})()}
									</div>
								);
								})}
							</div>
						</div>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={22} minSize={18}>
					<div
						ref={propertiesRef}
						className="h-full p-3 border-l bg-neutral-50 space-y-3 overflow-auto min-w-0"
					>
						<div className="font-medium">Properties</div>
						{!currentTemplate && (
							<div className="text-sm text-neutral-500">
								Create a template to begin.
							</div>
						)}
						{currentTemplate && (
							<div className="space-y-4">
								{/* Compliance Status Indicator */}
								{complianceStatus && (
									<Alert className={complianceStatus.valid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
										{complianceStatus.valid ? (
											<CheckCircle2 className="h-4 w-4 text-green-600" />
										) : (
											<AlertCircle className="h-4 w-4 text-amber-600" />
										)}
										<AlertDescription className="text-xs">
											<div className="font-medium mb-1">
												{complianceStatus.valid ? "✅ Compliant" : "⚠️ Missing Required Fields"}
											</div>
											<div className="text-neutral-600">
												Region: {complianceStatus.region}
											</div>
											{!complianceStatus.valid && complianceStatus.missingBindings.length > 0 && (
												<div className="mt-2">
													<div className="text-xs font-medium text-amber-700 mb-1">Missing fields:</div>
													<ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
														{complianceStatus.missingBindings.slice(0, 5).map((binding) => (
															<li key={binding}>{binding}</li>
														))}
														{complianceStatus.missingBindings.length > 5 && (
															<li>+{complianceStatus.missingBindings.length - 5} more</li>
														)}
													</ul>
												</div>
											)}
										</AlertDescription>
									</Alert>
								)}
								<div>
									<div className="text-xs text-neutral-500 mb-1">
										Name
									</div>
									<Input
										value={currentTemplate.name}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>
										) =>
											saveMutation.mutate({
												name: e.target.value,
											})
										}
									/>
								</div>
								<div>
									<div className="text-xs text-neutral-500 mb-1">
										Page Size
									</div>
									<Select
										value={currentTemplate.pageSize}
										onValueChange={(v: string) =>
											saveMutation.mutate({
												pageSize:
													v as TemplateData["pageSize"],
											})
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="A4">
												A4
											</SelectItem>
											<SelectItem value="Letter">
												Letter
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{/* Compliance Region */}
								<div>
									<div className="text-xs text-neutral-500 mb-1">
										Compliance Region
									</div>
									<Select
										value={currentTemplate.compliance?.region || (currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US")}
										onValueChange={(v: string) => {
											const currentCompliance = currentTemplate.compliance || {
												region: "US" as const,
												requiredFields: [],
												autoFooter: true,
												complianceValidated: false,
											};
											saveMutation.mutate({
												compliance: {
													...currentCompliance,
													region: v as "US" | "EU" | "CA" | "AU" | "UK",
													complianceValidated: false, // Reset validation when region changes
												},
											});
										}}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="US">🇺🇸 United States</SelectItem>
											<SelectItem value="EU">🇪🇺 European Union</SelectItem>
											<SelectItem value="CA">🇨🇦 Canada</SelectItem>
											<SelectItem value="AU">🇦🇺 Australia</SelectItem>
											<SelectItem value="UK">🇬🇧 United Kingdom</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-xs text-neutral-400 mt-1">
										Determines which compliance requirements apply
									</p>
								</div>
								{(() => {
									if (!state.selectedElementId) return null;
									const selectedEl = (
										draftElements ??
										currentTemplate?.elements ??
										[]
									).find(
										(e: TemplateElement) =>
											e.id === state.selectedElementId
									);
									if (!selectedEl) return null;
									return (
										<ElementProperties
											element={selectedEl}
											onChange={updateSelected}
											isNarrow={isPropsNarrow}
										/>
									);
								})()}
							</div>
						)}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
	isNarrow,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
}) {
	if (element.type === "text") {
		const t = element as Extract<TemplateElement, { type: "text" }>;
		return (
			<TextProperties
				element={t}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}

	if (element.type === "image") {
		const img = element as Extract<TemplateElement, { type: "image" }>;
		return (
			<ImageProperties
				element={img}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}

	if (element.type === "box") {
		const bx = element as Extract<TemplateElement, { type: "box" }>;
		return (
			<BoxProperties
				element={bx}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}

	if (element.type === "line") {
		const ln = element as Extract<TemplateElement, { type: "line" }>;
		return (
			<LineProperties
				element={ln}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}

	if (element.type === "table") {
		const tbl = element as Extract<TemplateElement, { type: "table" }>;
		return (
			<TableProperties
				element={tbl}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}

	if (element.type === "input") {
		const inp = element as Extract<TemplateElement, { type: "input" }>;
		return (
			<InputProperties
				element={inp}
				onChange={onChange}
				isNarrow={isNarrow}
			/>
		);
	}
	return (
		<div className="text-xs text-neutral-500">
			Select an element to edit.
		</div>
	);
}
