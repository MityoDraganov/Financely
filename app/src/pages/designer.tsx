import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
	Sparkles,
	Loader2,
	Copy,
	CircleDollarSign,
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
import { useGenerateInvoiceTemplate } from "@/hooks/service-hooks/use-invoice-template-generation";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isRequiredBinding, getFieldMetadata } from "@/utils/invoice-compliance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { COMPLIANCE_SCHEMAS } from "@/core/entities/invoice-compliance";
import { generateUniqueTemplateName } from "@/utils/template-naming";
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
import CurrencyElement, { CurrencyProperties } from "@/components/designer/elements/currency";

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
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [state, setState] = useState<DesignerState>({ zoom: 1 });
	const [drag, setDrag] = useState<DragState | null>(null);
	const [draftElements, setDraftElements] = useState<
		TemplateElement[] | null
	>(null);
	const [draftBrand, setDraftBrand] = useState<Template["brand"] | null>(null);
	const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional">("modern");
	const [aiIncludeLogo, setAiIncludeLogo] = useState(true);
	const [aiPrompt, setAiPrompt] = useState("");
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
	const generateTemplate = useGenerateInvoiceTemplate();

	// Handler for creating a new template
	const handleCreateNewTemplate = async () => {
		// Detect region from organization for compliance
		const region = currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US";
		
		// Generate unique template name
		const uniqueName = generateUniqueTemplateName("New Template", templates);
		
		const templateData: TemplateData = {
			orgId,
			name: uniqueName,
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
			// Navigate to the new template's URL
			navigate(`/designer/${newTemplateId}`, { replace: true });
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
		const template = templates.find((t: Template) => t.id === state.currentTemplateId) ?? templates[0];
		if (!template) return undefined;
		
		// Merge draft state for optimistic UI updates
		return {
			...template,
			elements: draftElements ?? template.elements ?? [],
			brand: draftBrand ?? template.brand,
		} as Template;
	}, [templates, state.currentTemplateId, draftElements, draftBrand]);

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

	// Helper to determine element type based on binding
	function determineElementTypeForBinding(
		binding: string,
		format?: "string" | "number" | "date" | "boolean" | "object" | "array"
	): "text" | "input" | "table" {
		if (binding === "items" || format === "array") {
			return "table";
		}
		if (format === "date" || binding.includes("Date") || binding.includes("date")) {
			return "input";
		}
		if (format === "number" || binding.includes("Amount") || binding.includes("Total") || binding.includes("Rate")) {
			return "input";
		}
		return "text";
	}

	// Get missing required fields with metadata for the palette
	const missingRequiredFields = useMemo(() => {
		if (!complianceStatus || !currentTemplate) return [];
		
		const region = complianceStatus.region;
		const schema = COMPLIANCE_SCHEMAS[region];
			const existingBindings = new Set(
			(currentTemplate.elements ?? []).flatMap(el => {
				const bindings: string[] = [];
				if (el.type === "text" || el.type === "input" || el.type === "image" || el.type === "currency") {
					if (el.binding) bindings.push(el.binding);
				}
				if (el.type === "table" && el.itemsBinding) {
					bindings.push(el.itemsBinding);
				}
				return bindings;
			})
		);
		
		return schema.requiredFields
			.filter(field => !existingBindings.has(field.binding))
			.map(field => ({
				...field,
				elementType: determineElementTypeForBinding(field.binding, field.format),
			}));
	}, [complianceStatus, currentTemplate]);

	// Function to add required element with pre-configured binding
	function addRequiredElement(binding: string, label: string, elementType: "text" | "input" | "table") {
		if (!currentTemplate) return;
		
		// Determine position - stack them vertically
		const existingElements = currentTemplate.elements ?? [];
		const maxY = existingElements.length > 0 
			? Math.max(...existingElements.map(el => el.y + el.height))
			: 80;
		const yPosition = maxY + 20;
		
		if (elementType === "table") {
			// Add table for items
			const tableElement: TemplateElement = {
				id: crypto.randomUUID(),
				type: "table",
				x: 60,
				y: yPosition,
				width: 500,
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
						header: "Description",
						width: 200,
						align: "left",
						type: "text",
						binding: "description",
						format: { kind: "none" },
					},
					{
						id: crypto.randomUUID(),
						header: "Quantity",
						width: 80,
						align: "right",
						type: "number",
						binding: "quantity",
						format: { kind: "none" },
					},
					{
						id: crypto.randomUUID(),
						header: "Price",
						width: 100,
						align: "right",
						type: "number",
						binding: "unitPrice",
						format: { kind: "currency", currency: "USD" },
					},
					{
						id: crypto.randomUUID(),
						header: "Total",
						width: 100,
						align: "right",
						type: "number",
						binding: "total",
						format: { kind: "currency", currency: "USD" },
					},
				],
				designRows: [],
				itemsBinding: binding,
				totals: [],
			};
			const next = [...existingElements, tableElement];
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementId: tableElement.id }));
			saveMutation.mutate({ elements: next });
		} else if (elementType === "input") {
			// Add input element
			const inputElement: TemplateElement = {
				id: crypto.randomUUID(),
				type: "input",
				x: 60,
				y: yPosition,
				width: 200,
				height: 32,
				rotation: 0,
				zIndex: 1,
				visible: true,
				placeholder: label,
				binding: binding,
				variant: binding.includes("Date") || binding.includes("date") ? "date" : "number",
				align: "left",
			};
			const next = [...existingElements, inputElement];
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementId: inputElement.id }));
			saveMutation.mutate({ elements: next });
		} else {
			// Add text element
			const textElement: TemplateElement = {
				id: crypto.randomUUID(),
				type: "text",
				x: 60,
				y: yPosition,
				width: 200,
				height: 40,
				rotation: 0,
				zIndex: 1,
				visible: true,
				text: label,
				binding: binding,
				padding: 0,
				opacity: 1,
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
				format: binding.includes("Date") || binding.includes("date") 
					? { kind: "date", dateFormat: "YYYY-MM-DD" }
					: binding.includes("Amount") || binding.includes("Total") || binding.includes("Price")
					? { kind: "currency", currency: "USD" }
					: { kind: "none" },
			};
			const next = [...existingElements, textElement];
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementId: textElement.id }));
			saveMutation.mutate({ elements: next });
		}
	}

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

	// Initialize template from URL param or auto-create new template
	useEffect(() => {
		if (templateIdFromUrl) {
			// Template ID from URL - set it if it exists in templates
			const templateExists = templates.some((t: Template) => t.id === templateIdFromUrl);
			if (templateExists && state.currentTemplateId !== templateIdFromUrl) {
				setState((s: DesignerState) => ({
					...s,
					currentTemplateId: templateIdFromUrl,
				}));
			} else if (!templateExists && templates.length > 0) {
				// Template not found, redirect to templates list
				navigate("/templates");
			}
		} else if (!state.currentTemplateId && !createTemplate.isPending && !createTemplate.isSuccess) {
			// No template ID in URL and no template selected - auto-create a new one
			// This handles the case when user clicks "Create New Template" from templates page
			handleCreateNewTemplate().catch((error) => {
				console.error("Failed to auto-create template:", error);
				// If creation fails, redirect back to templates
				navigate("/templates");
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templates, state.currentTemplateId, templateIdFromUrl, navigate, createTemplate.isPending, createTemplate.isSuccess]);

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
			// For brand updates, we need to ensure we merge with existing brand data
			// since Firebase Realtime Database update does shallow merge
			if (partial.brand && currentTemplate.brand) {
				partial = {
					...partial,
					brand: {
						...currentTemplate.brand,
						...partial.brand,
						// Deep merge watermark if it exists in both
						watermark: partial.brand.watermark
							? {
									...(currentTemplate.brand.watermark || {}),
									...partial.brand.watermark,
								}
							: currentTemplate.brand.watermark,
					},
				};
			}
			await templateService.updateDraft(currentTemplate.id, partial);
		},
		onMutate: async (partial: Partial<TemplateData>) => {
			// Optimistic update for brand changes
			if (partial.brand) {
				// Get the base template (not merged with drafts) for the optimistic update
				const baseTemplate = templates.find((t: Template) => t.id === state.currentTemplateId) ?? templates[0];
				if (baseTemplate) {
					const optimisticBrand = {
						...baseTemplate.brand,
						...partial.brand,
						watermark: partial.brand.watermark
							? {
									...(baseTemplate.brand.watermark || {}),
									...partial.brand.watermark,
								}
							: baseTemplate.brand.watermark,
					};
					setDraftBrand(optimisticBrand);
				}
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
			// Clear draft brand after successful save (real-time update will handle it)
			setTimeout(() => setDraftBrand(null), 100);
		},
		onError: () => {
			// Revert draft brand on error
			setDraftBrand(null);
		},
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			// Detect region from organization for compliance
			const region = currentOrg ? invoiceComplianceService.detectRegion(currentOrg) : "US";
			
			// Generate unique template name
			const uniqueName = generateUniqueTemplateName("New Invoice Template", templates);
			
			const empty: TemplateData = {
				orgId: orgId,
				name: uniqueName,
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
						padding: 0,
						opacity: 1,
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
									opacity: 1,
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
								: kind === "currency"
									? {
											id: crypto.randomUUID(),
											type: "currency",
											x: at?.x ?? 60,
											y: at?.y ?? 260,
											width: 200,
											height: 32,
											rotation: 0,
											zIndex: 1,
											visible: true,
											placeholder: "0.00",
											binding: defaultBinding,
											currency: "USD",
											currencyLinks: [],
											mode: "independent",
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

	function duplicateElement(id: string) {
		if (!currentTemplate) return;
		const elementToDuplicate = (currentTemplate.elements ?? []).find(
			(e) => e.id === id
		);
		if (!elementToDuplicate) return;

		// Create a deep copy with a new ID and offset position
		// Clear binding to prevent duplicates
		const duplicated: TemplateElement = {
			...elementToDuplicate,
			id: crypto.randomUUID(),
			x: elementToDuplicate.x + 20,
			y: elementToDuplicate.y + 20,
			// Clear binding for elements that have bindings
			...(elementToDuplicate.type === "text" && { binding: undefined }),
			...(elementToDuplicate.type === "input" && { binding: undefined }),
			...(elementToDuplicate.type === "image" && { binding: undefined }),
			...(elementToDuplicate.type === "table" && { itemsBinding: undefined }),
		};

		const next = [...(currentTemplate.elements ?? []), duplicated];
		saveMutation.mutate({ elements: next });
		setState((s: DesignerState) => ({
			...s,
			selectedElementId: duplicated.id,
		}));
		toast.success("Element duplicated (binding cleared to prevent duplicates)");
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
					<div className="h-full p-4 border-r bg-gradient-to-b from-neutral-50 to-white overflow-y-auto">
						<div className="flex items-center justify-between mb-4">
							<div className="font-semibold text-base text-neutral-800">Templates</div>
						</div>
						<div className="mb-4 space-y-2.5">
							<Button
								variant="default"
								size="sm"
								className="w-full bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
								onClick={() => setAiBuilderOpen(true)}
							>
								<Sparkles className="h-4 w-4 mr-2 animate-pulse" />
								<span className="font-medium">AI Builder</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="w-full border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200 shadow-sm hover:shadow"
								onClick={handleCreateNewTemplate}
							>
								<Plus className="h-4 w-4 mr-2" />
								New Template
							</Button>
						</div>
						<div className="space-y-2">
							{templates.length === 0 && (
								<div className="text-xs text-neutral-500">
									No templates yet. Click "New" to create your
									first template.
								</div>
							)}
						</div>
						{/* Required Fields Section */}
						{missingRequiredFields.length > 0 && currentTemplate && (
							<div className="mt-5 mb-5 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 shadow-sm">
								<div className="text-xs font-semibold uppercase text-amber-700 mb-2.5 flex items-center gap-1.5">
									<Lock className="h-3.5 w-3.5" />
									Required Fields
							</div>
								<div className="space-y-2">
									{missingRequiredFields.map((field) => (
										<Button
											key={field.binding}
											variant="outline"
											size="sm"
											onClick={() => {
												addRequiredElement(field.binding, field.label, field.elementType);
												toast.success(`Added ${field.label}`, { duration: 2000 });
											}}
											className="w-full justify-start text-xs h-auto py-2.5 px-3 border-amber-300/60 bg-white/80 hover:bg-amber-100 hover:border-amber-400 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
										>
											<Plus className="h-3.5 w-3.5 mr-2 text-amber-600" />
											<span className="text-left flex-1">
												<div className="font-semibold text-amber-900">{field.label}</div>
												{field.description && (
													<div className="text-xs text-amber-700/70 font-normal mt-0.5">{field.description}</div>
												)}
											</span>
										</Button>
									))}
								</div>
							</div>
						)}
						<div className="mt-5">
							<div className="text-xs font-semibold uppercase text-neutral-600 mb-3 flex items-center gap-2">
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
								<span>Palette</span>
								<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
								<Button
									variant="secondary"
									onClick={() => {
										addElement("text");
										toast.success("Text element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<TypeIcon className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Text</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("image");
										toast.success("Image element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<ImageIcon className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Image</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("table");
										toast.success("Table element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<TableIcon className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Table</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("input");
										toast.success("Input element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<TypeIcon className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Input</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("box");
										toast.success("Box element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<Square className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Box</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("line");
										toast.success("Line element added", { duration: 1500 });
									}}
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
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<Minus className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Line</span>
								</Button>
								<Button
									variant="secondary"
									onClick={() => {
										addElement("currency");
										toast.success("Currency element added", { duration: 1500 });
									}}
									draggable
									onDragStart={(e) => {
										console.log("[DND] dragstart: currency");
										e.dataTransfer.setData(
											"application/x-template-element",
											"currency"
										);
										e.dataTransfer.setData(
											"text/plain",
											"currency"
										);
										e.dataTransfer.effectAllowed = "copy";
									}}
									className="w-full justify-start hover:bg-neutral-100 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border border-neutral-200/50"
								>
									<CircleDollarSign className="h-4 w-4 mr-2 text-neutral-600" /> 
									<span className="font-medium">Currency</span>
								</Button>
							</div>
							<div className="mt-5">
								<div className="text-xs font-semibold uppercase text-neutral-600 mb-3 flex items-center gap-2">
									<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
									<span>Elements</span>
									<div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"></div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{(currentTemplate?.elements ?? []).map(
										(el) => {
											const binding = el.type === "text" ? el.binding : 
												el.type === "input" ? el.binding :
												el.type === "image" ? el.binding :
												el.type === "table" ? el.itemsBinding : undefined;
											const isRequiredField = isRequired(binding);
											
											return (
											<ContextMenu key={el.id}>
												<ContextMenuTrigger asChild>
													<div
															className={`px-3 py-2.5 min-w-0 w-full text-xs sm:text-sm rounded-lg cursor-pointer truncate transition-all duration-200 ${
																state.selectedElementId === el.id 
																	? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-2 border-blue-300 shadow-md" 
																	: "hover:bg-neutral-100 hover:shadow-sm border border-transparent hover:border-neutral-200"
															} ${isRequiredField ? "ring-1 ring-amber-300/50" : ""}`}
															onClick={() => {
																setState((s: DesignerState) => ({
																	...s,
																	selectedElementId: el.id,
																}));
															}}
													>
														<div className="flex items-center gap-2">
															{isRequiredField && (
																<Lock className="h-3 w-3 text-amber-500 shrink-0" />
															)}
															{el.type === "text" && (
																<TypeIcon className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "image" && (
																<ImageIcon className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "table" && (
																<TableIcon className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "input" && (
																<TypeIcon className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "currency" && (
																<CircleDollarSign className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "box" && (
																<Square className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															{el.type === "line" && (
																<Minus className={`h-4 w-4 shrink-0 ${
																	state.selectedElementId === el.id 
																		? "text-blue-600" 
																		: "text-neutral-500"
																}`} />
															)}
															<span className="truncate flex-1 text-sm">
																{(() => {
																	const elementId = el.id;
																	if (el.type === "text") {
																		return (el as Extract<TemplateElement, { type: "text" }>).text ?? "Text";
																	} else if (el.type === "table") {
																		return "Items Table";
																	} else if (el.type === "image") {
																		return "Image";
																	} else if (el.type === "input") {
																		return "Input Field";
																	} else if (el.type === "currency") {
																		return "Currency Field";
																	} else if (el.type === "box") {
																		return "Box";
																	} else if (el.type === "line") {
																		return "Line";
																	}
																	return `Element ${elementId.slice(0, 6)}`;
																})()}
														</span>
													</div>
														</div>
												</ContextMenuTrigger>
												<ContextMenuContent>
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
													<ContextMenuSeparator />
													<ContextMenuItem
														onClick={() =>
															duplicateElement(el.id)
														}
													>
														<Copy className="mr-2 h-4 w-4" />
														Duplicate
													</ContextMenuItem>
													<ContextMenuSeparator />
													<ContextMenuItem
														onClick={() =>
															deleteElement(el.id)
														}
														variant="destructive"
													>
														Delete
													</ContextMenuItem>
												</ContextMenuContent>
											</ContextMenu>
											);
										})}
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
							className="flex-1 overflow-auto bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50 grid place-items-center"
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
								className="bg-white shadow-2xl relative rounded-sm border-4 border-neutral-200 transition-all duration-300 hover:shadow-3xl"
								style={{
									width: 794 * state.zoom,
									height: 1123 * state.zoom,
									position: "relative",
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
								
								{/* Watermark */}
								{(() => {
									// Debug logging
									const watermarkEnabled = currentTemplate?.brand?.watermark?.enabled;
									const watermark = currentTemplate?.brand?.watermark;
									
									console.log("[WATERMARK DEBUG] Checking watermark", {
										hasCurrentTemplate: !!currentTemplate,
										hasBrand: !!currentTemplate?.brand,
										hasWatermark: !!watermark,
										watermarkEnabled,
										watermark,
										draftBrand: draftBrand,
										currentTemplateBrand: currentTemplate?.brand,
									});
									
									if (!watermarkEnabled || !watermark) {
										console.log("[WATERMARK DEBUG] Not enabled or missing", { watermarkEnabled, watermark });
										return null;
									}
									
									// Only use the explicitly configured watermark image URL or text
									// Don't fallback to organization logo - that would be a separate feature
									const watermarkImageUrl = watermark.imageUrl;
									const watermarkText = watermark.text;
									
									// Don't render if neither image nor text is set
									if (!watermarkImageUrl && !watermarkText) {
										console.log("[WATERMARK] Not rendering: no image or text", { watermarkImageUrl, watermarkText, watermark, orgLogo: currentOrg?.settings?.branding?.customLogo });
										return null;
									}
									
									console.log("[WATERMARK] Rendering watermark", { watermarkEnabled, watermarkImageUrl, watermarkText, watermark, position: watermark.position, opacity: watermark.opacity });
									
									// Calculate position
									let positionStyle: React.CSSProperties = {};
									if (watermark.x !== undefined && watermark.y !== undefined) {
										positionStyle = {
											left: watermark.x * state.zoom,
											top: watermark.y * state.zoom,
											transform: `translate(0, 0) rotate(${watermark.rotation || 0}deg)`,
										};
									} else {
										const positions: Record<string, React.CSSProperties> = {
											"center": {
												left: "50%",
												top: "50%",
												transform: `translate(-50%, -50%) rotate(${watermark.rotation || 0}deg)`,
											},
											"top-left": { left: 0, top: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
											"top-right": { right: 0, top: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
											"bottom-left": { left: 0, bottom: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
											"bottom-right": { right: 0, bottom: 0, transform: `rotate(${watermark.rotation || 0}deg)` },
											"top-center": { left: "50%", top: 0, transform: `translateX(-50%) rotate(${watermark.rotation || 0}deg)` },
											"bottom-center": { left: "50%", bottom: 0, transform: `translateX(-50%) rotate(${watermark.rotation || 0}deg)` },
											"left-center": { left: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation || 0}deg)` },
											"right-center": { right: 0, top: "50%", transform: `translateY(-50%) rotate(${watermark.rotation || 0}deg)` },
										};
										positionStyle = positions[watermark.position || "center"] || positions.center;
									}

									const width = (watermark.width || 200) * state.zoom;
									const height = watermark.height ? watermark.height * state.zoom : undefined;
									const opacity = watermark.opacity ?? 0.1;
									const blendMode = watermark.blendMode || "normal";

									console.log("[WATERMARK] Final render values", { width, height, opacity, positionStyle, blendMode });

									if (watermarkImageUrl) {
										return (
											<div
												key="watermark-image"
												style={{
													position: "absolute",
													...positionStyle,
													width,
													height: height || width,
													opacity,
													mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
													pointerEvents: "none",
													zIndex: 1000, // Above all elements (elements have zIndex: 10)
												}}
											>
												<img
													src={watermarkImageUrl}
													alt="Watermark"
													style={{ width: "100%", height: "100%", objectFit: "contain" }}
													onLoad={() => {
														console.log("[WATERMARK] Image loaded successfully:", watermarkImageUrl);
													}}
													onError={(e) => {
														console.error("[WATERMARK] Image failed to load:", watermarkImageUrl, e);
													}}
												/>
											</div>
										);
									} else if (watermarkText) {
										return (
											<div
												key="watermark-text"
												style={{
													position: "absolute",
													...positionStyle,
													width,
													minWidth: width,
													opacity,
													mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
													pointerEvents: "none",
													zIndex: 1000, // Above all elements (elements have zIndex: 10)
													fontSize: Math.max(24, width / 10) * state.zoom,
													fontWeight: "bold",
													color: "#999999",
													textAlign: "center",
													whiteSpace: "nowrap",
												}}
											>
												{watermarkText}
											</div>
										);
									}
									return null;
								})()}
								
								{/* elements */}
								{(
									draftElements ??
									currentTemplate?.elements ??
									[]
								).map((el: TemplateElement) => {
									const binding = el.type === "text" ? el.binding : 
										el.type === "input" ? el.binding :
										el.type === "image" ? el.binding :
										el.type === "currency" ? el.binding :
										el.type === "table" ? el.itemsBinding : undefined;
									const isRequiredField = isRequired(binding);
									
									return (
									<ContextMenu key={el.id}>
										<ContextMenuTrigger asChild>
											<div
												className={`absolute ${state.selectedElementId === el.id ? "ring-2 ring-blue-500" : ""} ${drag?.elementId === el.id && drag.mode === "move" ? "cursor-grabbing" : "cursor-grab"} ${isRequiredField ? "ring-1 ring-amber-400" : ""}`}
										style={{
											left: el.x * state.zoom,
											top: el.y * state.zoom,
											width: el.width * state.zoom,
											height: el.height * state.zoom,
											transform: `rotate(${el.rotation}deg)`,
											touchAction: "none",
											zIndex: el.zIndex ?? 10,
										}}
										onClick={() => {
											setState((s: DesignerState) => ({
												...s,
												selectedElementId: el.id,
											}));
											console.log("clicked", el.id);
										}}
										onPointerDown={(e) => {
													// Only start drag on left mouse button (button 0)
													// Right click (button 2) should open context menu
													if (e.button !== 0) return;
													
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
													className="absolute -top-2 -left-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-full p-1 z-50 shadow-md border-2 border-white animate-pulse"
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
										{el.type === "currency" && (
											<CurrencyElement
												element={
													el as Extract<
														TemplateElement,
														{ type: "currency" }
													>
												}
												zoom={state.zoom}
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
										</ContextMenuTrigger>
										<ContextMenuContent>
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
											<ContextMenuSeparator />
											<ContextMenuItem
												onClick={() =>
													duplicateElement(el.id)
												}
											>
												<Copy className="mr-2 h-4 w-4" />
												Duplicate
											</ContextMenuItem>
											<ContextMenuSeparator />
											<ContextMenuItem
												onClick={() =>
													deleteElement(el.id)
												}
												variant="destructive"
											>
												Delete
											</ContextMenuItem>
										</ContextMenuContent>
									</ContextMenu>
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
									<Alert className={`transition-all duration-300 ${
										complianceStatus.valid 
											? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-md" 
											: "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-md"
									}`}>
										{complianceStatus.valid ? (
											<CheckCircle2 className="h-5 w-5 text-green-600 animate-pulse" />
										) : (
											<AlertCircle className="h-5 w-5 text-amber-600" />
										)}
										<AlertDescription className="text-xs">
											<div className={`font-semibold mb-1.5 text-sm ${
												complianceStatus.valid ? "text-green-700" : "text-amber-700"
											}`}>
												{complianceStatus.valid ? (
													<span className="flex items-center gap-1.5">
														<span>✅</span>
														<span>Fully Compliant</span>
													</span>
												) : (
													<span className="flex items-center gap-1.5">
														<span>⚠️</span>
														<span>Missing Required Fields</span>
													</span>
												)}
											</div>
											<div className="text-neutral-600 text-xs mb-2">
												Region: <span className="font-medium">{complianceStatus.region}</span>
											</div>
											{!complianceStatus.valid && complianceStatus.missingBindings.length > 0 && (
												<div className="mt-2">
													<div className="text-xs font-medium text-amber-700 mb-1">Missing fields:</div>
													<div className="space-y-1.5">
														{complianceStatus.missingBindings.map((binding) => {
															const fieldMetadata = getFieldMetadata(complianceStatus.region, binding);
															const elementType = fieldMetadata 
																? determineElementTypeForBinding(binding, fieldMetadata.format)
																: "text";
															return (
																<div key={binding} className="flex items-center justify-between gap-2 p-2.5 bg-white/80 rounded-lg border border-amber-200/60 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
																	<div className="flex-1 min-w-0">
																		<div className="text-xs font-semibold text-amber-900 truncate">
																			{fieldMetadata?.label || binding}
																		</div>
																		{fieldMetadata?.description && (
																			<div className="text-xs text-amber-700/70 truncate mt-0.5">
																				{fieldMetadata.description}
																			</div>
																		)}
																	</div>
																	<Button
																		size="sm"
																		variant="outline"
																		className="h-7 px-3 text-xs border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 shrink-0 shadow-sm hover:shadow transition-all duration-200 hover:scale-105 active:scale-95"
																		onClick={() => {
																			addRequiredElement(
																				binding,
																				fieldMetadata?.label || binding,
																				elementType
																			);
																			toast.success(`Added ${fieldMetadata?.label || binding}`, { duration: 2000 });
																		}}
																	>
																		<Plus className="h-3.5 w-3.5 mr-1.5" />
																		Add
																	</Button>
																</div>
															);
														})}
													</div>
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
								{/* Watermark Configuration */}
								<div className="space-y-3 pt-2 border-t">
									<div className="text-xs font-semibold text-neutral-600 mb-2">Watermark</div>
									<div className="flex items-center justify-between">
										<Label htmlFor="watermark-enabled" className="text-xs">Enable Watermark</Label>
										<input
											id="watermark-enabled"
											type="checkbox"
											checked={currentTemplate.brand.watermark?.enabled ?? false}
											onChange={(e) => {
												const currentWatermark = currentTemplate.brand.watermark || {
													enabled: false,
													position: "center" as const,
													width: 200,
													rotation: 0,
													opacity: 0.1,
													blendMode: "normal" as const,
													repeat: "none" as const,
												};
												saveMutation.mutate({
													brand: {
														...currentTemplate.brand,
														watermark: {
															...currentWatermark,
															enabled: e.target.checked,
															// Don't auto-fill from organization logo - user must explicitly configure watermark
															imageUrl: currentWatermark.imageUrl,
														},
													},
												});
											}}
											className="h-4 w-4 rounded border-gray-300"
										/>
									</div>
									{currentTemplate.brand.watermark?.enabled && (
										<div className="space-y-3 pl-2 border-l-2 border-neutral-200">
											<div className="space-y-2">
												<Label htmlFor="watermark-type" className="text-xs">Type</Label>
												<Select
													value={currentTemplate.brand.watermark?.imageUrl ? "image" : "text"}
													onValueChange={(v) => {
														const currentWatermark = currentTemplate.brand.watermark || {
															enabled: true,
															position: "center" as const,
															width: 200,
															rotation: 0,
															opacity: 0.1,
															blendMode: "normal" as const,
															repeat: "none" as const,
														};
														saveMutation.mutate({
															brand: {
																...currentTemplate.brand,
																watermark: {
																	...currentWatermark,
																	imageUrl: v === "image" ? (currentOrg?.settings?.branding?.customLogo || currentWatermark.imageUrl) : undefined,
																	text: v === "text" ? (currentWatermark.text || "CONFIDENTIAL") : undefined,
																},
															},
														});
													}}
												>
													<SelectTrigger className="h-8">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="image">Image</SelectItem>
														<SelectItem value="text">Text</SelectItem>
													</SelectContent>
												</Select>
											</div>
											{currentTemplate.brand.watermark?.imageUrl ? (
												<div className="space-y-2">
													<Label htmlFor="watermark-image-url" className="text-xs">Image URL</Label>
													<Input
														id="watermark-image-url"
														value={currentTemplate.brand.watermark.imageUrl || ""}
														onChange={(e) => {
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		imageUrl: e.target.value || undefined,
																	},
																},
															});
														}}
														placeholder="https://example.com/logo.png"
														className="h-8 text-xs"
													/>
												</div>
											) : (
												<div className="space-y-2">
													<Label htmlFor="watermark-text" className="text-xs">Text</Label>
													<Input
														id="watermark-text"
														value={currentTemplate.brand.watermark?.text || ""}
														onChange={(e) => {
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		text: e.target.value || undefined,
																	},
																},
															});
														}}
														placeholder="CONFIDENTIAL"
														className="h-8 text-xs"
													/>
												</div>
											)}
											<div className="space-y-2">
												<Label htmlFor="watermark-position" className="text-xs">Position</Label>
												<Select
													value={currentTemplate.brand.watermark?.position || "center"}
													onValueChange={(v) => {
														const currentWatermark = currentTemplate.brand.watermark || {
															enabled: true,
															position: "center" as const,
															width: 200,
															rotation: 0,
															opacity: 0.1,
															blendMode: "normal" as const,
															repeat: "none" as const,
														};
														saveMutation.mutate({
															brand: {
																...currentTemplate.brand,
																watermark: {
																	...currentWatermark,
																	position: v as typeof currentWatermark.position,
																},
															},
														});
													}}
												>
													<SelectTrigger className="h-8">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="center">Center</SelectItem>
														<SelectItem value="top-left">Top Left</SelectItem>
														<SelectItem value="top-right">Top Right</SelectItem>
														<SelectItem value="bottom-left">Bottom Left</SelectItem>
														<SelectItem value="bottom-right">Bottom Right</SelectItem>
														<SelectItem value="top-center">Top Center</SelectItem>
														<SelectItem value="bottom-center">Bottom Center</SelectItem>
														<SelectItem value="left-center">Left Center</SelectItem>
														<SelectItem value="right-center">Right Center</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<div className="space-y-2">
													<Label htmlFor="watermark-width" className="text-xs">Width (px)</Label>
													<Input
														id="watermark-width"
														type="number"
													
														
														value={currentTemplate.brand.watermark?.width ?? ""}
														onChange={(e) => {
															const inputValue = e.target.value;
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															
															// Allow empty value while typing
															let widthValue: number | undefined;
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																widthValue = undefined;
															} else {
																const numValue = Number(inputValue);
																widthValue = isNaN(numValue) ? undefined : numValue;
															}
															
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		width: widthValue ?? currentWatermark.width ?? 200,
																	},
																},
															});
														}}
														onBlur={(e) => {
															// On blur, set default if empty
															const inputValue = e.target.value.trim();
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																const currentWatermark = currentTemplate.brand.watermark || {
																	enabled: true,
																	position: "center" as const,
																	width: 200,
																	rotation: 0,
																	opacity: 0.1,
																	blendMode: "normal" as const,
																	repeat: "none" as const,
																};
																saveMutation.mutate({
																	brand: {
																		...currentTemplate.brand,
																		watermark: {
																			...currentWatermark,
																			width: 200, // Default on blur if empty
																		},
																	},
																});
															}
														}}
														className="h-8 text-xs"
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="watermark-height" className="text-xs">Height (px)</Label>
													<Input
														id="watermark-height"
														type="number"
														min={50}
														max={1000}
														value={currentTemplate.brand.watermark?.height || ""}
														onChange={(e) => {
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		height: e.target.value ? Number(e.target.value) : undefined,
																	},
																},
															});
														}}
														placeholder="Auto"
														className="h-8 text-xs"
													/>
												</div>
											</div>
											<div className="space-y-2">
												<Label htmlFor="watermark-rotation" className="text-xs">Rotation</Label>
												<div className="flex items-center gap-2">
													<Input
														id="watermark-rotation-slider"
														type="range"
														min={-180}
														max={180}
														value={currentTemplate.brand.watermark?.rotation || 0}
														onChange={(e) => {
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		rotation: Number(e.target.value),
																	},
																},
															});
														}}
														className="h-2 flex-1"
													/>
													<Input
														id="watermark-rotation-input"
														type="number"
														min={-180}
														max={180}
														step={1}
														value={currentTemplate.brand.watermark?.rotation ?? ""}
														onChange={(e) => {
															const inputValue = e.target.value;
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															
															let rotationValue: number;
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																rotationValue = currentWatermark.rotation ?? 0;
															} else {
																const numValue = Number(inputValue);
																rotationValue = isNaN(numValue) ? currentWatermark.rotation ?? 0 : Math.max(-180, Math.min(180, numValue));
															}
															
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		rotation: rotationValue,
																	},
																},
															});
														}}
														onBlur={(e) => {
															const inputValue = e.target.value.trim();
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																const currentWatermark = currentTemplate.brand.watermark || {
																	enabled: true,
																	position: "center" as const,
																	width: 200,
																	rotation: 0,
																	opacity: 0.1,
																	blendMode: "normal" as const,
																	repeat: "none" as const,
																};
																saveMutation.mutate({
																	brand: {
																		...currentTemplate.brand,
																		watermark: {
																			...currentWatermark,
																			rotation: currentWatermark.rotation ?? 0,
																		},
																	},
																});
															}
														}}
														className="h-8 w-20 text-xs"
														placeholder="0"
													/>
													<span className="text-xs text-muted-foreground w-4">°</span>
												</div>
											</div>
											<div className="space-y-2">
												<Label htmlFor="watermark-opacity" className="text-xs">Opacity</Label>
												<div className="flex items-center gap-2">
													<Input
														id="watermark-opacity-slider"
														type="range"
														min={0}
														max={100}
														step={1}
														value={Math.round((currentTemplate.brand.watermark?.opacity || 0.1) * 100)}
														onChange={(e) => {
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		opacity: Number(e.target.value) / 100,
																	},
																},
															});
														}}
														className="h-2 flex-1"
													/>
													<Input
														id="watermark-opacity-input"
														type="number"
														min={0}
														max={100}
														step={1}
														value={(() => {
															const opacity = currentTemplate.brand.watermark?.opacity ?? 0.1;
															return Math.round(opacity * 100);
														})()}
														onChange={(e) => {
															const inputValue = e.target.value;
															const currentWatermark = currentTemplate.brand.watermark || {
																enabled: true,
																position: "center" as const,
																width: 200,
																rotation: 0,
																opacity: 0.1,
																blendMode: "normal" as const,
																repeat: "none" as const,
															};
															
															let opacityValue: number;
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																opacityValue = currentWatermark.opacity ?? 0.1;
															} else {
																const numValue = Number(inputValue);
																opacityValue = isNaN(numValue) ? currentWatermark.opacity ?? 0.1 : Math.max(0, Math.min(100, numValue)) / 100;
															}
															
															saveMutation.mutate({
																brand: {
																	...currentTemplate.brand,
																	watermark: {
																		...currentWatermark,
																		opacity: opacityValue,
																	},
																},
															});
														}}
														onBlur={(e) => {
															const inputValue = e.target.value.trim();
															if (inputValue === "" || inputValue === null || inputValue === undefined) {
																const currentWatermark = currentTemplate.brand.watermark || {
																	enabled: true,
																	position: "center" as const,
																	width: 200,
																	rotation: 0,
																	opacity: 0.1,
																	blendMode: "normal" as const,
																	repeat: "none" as const,
																};
																saveMutation.mutate({
																	brand: {
																		...currentTemplate.brand,
																		watermark: {
																			...currentWatermark,
																			opacity: currentWatermark.opacity ?? 0.1,
																		},
																	},
																});
															}
														}}
														className="h-8 w-20 text-xs"
														placeholder="10"
													/>
													<span className="text-xs text-muted-foreground w-4">%</span>
												</div>
											</div>
											<div className="space-y-2">
												<Label htmlFor="watermark-blend-mode" className="text-xs">Blend Mode</Label>
												<Select
													value={currentTemplate.brand.watermark?.blendMode || "normal"}
													onValueChange={(v) => {
														const currentWatermark = currentTemplate.brand.watermark || {
															enabled: true,
															position: "center" as const,
															width: 200,
															rotation: 0,
															opacity: 0.1,
															blendMode: "normal" as const,
															repeat: "none" as const,
														};
														saveMutation.mutate({
															brand: {
																...currentTemplate.brand,
																watermark: {
																	...currentWatermark,
																	blendMode: v as typeof currentWatermark.blendMode,
																},
															},
														});
													}}
												>
													<SelectTrigger className="h-8">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="normal">Normal</SelectItem>
														<SelectItem value="multiply">Multiply</SelectItem>
														<SelectItem value="screen">Screen</SelectItem>
														<SelectItem value="overlay">Overlay</SelectItem>
														<SelectItem value="soft-light">Soft Light</SelectItem>
														<SelectItem value="hard-light">Hard Light</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="space-y-2">
												<Label htmlFor="watermark-repeat" className="text-xs">Repeat</Label>
												<Select
													value={currentTemplate.brand.watermark?.repeat || "none"}
													onValueChange={(v) => {
														const currentWatermark = currentTemplate.brand.watermark || {
															enabled: true,
															position: "center" as const,
															width: 200,
															rotation: 0,
															opacity: 0.1,
															blendMode: "normal" as const,
															repeat: "none" as const,
														};
														saveMutation.mutate({
															brand: {
																...currentTemplate.brand,
																watermark: {
																	...currentWatermark,
																	repeat: v as typeof currentWatermark.repeat,
																},
															},
														});
													}}
												>
													<SelectTrigger className="h-8">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="none">None</SelectItem>
														<SelectItem value="repeat">Repeat</SelectItem>
														<SelectItem value="repeat-x">Repeat X</SelectItem>
														<SelectItem value="repeat-y">Repeat Y</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>
									)}
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
											allElements={draftElements ?? currentTemplate?.elements ?? []}
										/>
									);
								})()}
							</div>
						)}
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>

			{/* AI Builder Dialog */}
			<Dialog open={aiBuilderOpen} onOpenChange={(open) => {
				setAiBuilderOpen(open);
				if (!open) {
					// Reset prompt when dialog closes
					setAiPrompt("");
				}
			}}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-purple-500" />
							AI Invoice Template Builder
						</DialogTitle>
						<DialogDescription>
							Generate a beautiful, functional, and fully compliant invoice template
							using AI. The template will be customized based on your organization's
							branding and compliance region.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Style</Label>
							<Select
								value={aiStyle}
								onValueChange={(v) => setAiStyle(v as typeof aiStyle)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="modern">Modern</SelectItem>
									<SelectItem value="classic">Classic</SelectItem>
									<SelectItem value="minimal">Minimal</SelectItem>
									<SelectItem value="professional">Professional</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center justify-between">
							<Label htmlFor="include-logo">Include Logo</Label>
							<input
								id="include-logo"
								type="checkbox"
								checked={aiIncludeLogo}
								onChange={(e) => setAiIncludeLogo(e.target.checked)}
								className="h-4 w-4 rounded border-gray-300"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="ai-prompt">Additional Instructions (Optional)</Label>
							<Textarea
								id="ai-prompt"
								placeholder="E.g., 'Use a two-column layout for the header', 'Make the totals section more prominent', 'Add a payment terms section'..."
								value={aiPrompt}
								onChange={(e) => setAiPrompt(e.target.value)}
								className="min-h-[80px] resize-none"
								rows={3}
							/>
							<p className="text-xs text-neutral-500">
								Provide any specific design preferences or requirements for the template.
							</p>
						</div>
						{currentOrg && (
							<div className="text-xs text-neutral-500">
								Region: {currentTemplate?.compliance?.region || invoiceComplianceService.detectRegion(currentOrg)}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setAiBuilderOpen(false)}
							disabled={generateTemplate.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								if (!currentOrg) {
									toast.error("Organization not found");
									return;
								}

								try {
									const region = currentTemplate?.compliance?.region || invoiceComplianceService.detectRegion(currentOrg);
									const generatedTemplate = await generateTemplate.mutateAsync({
										organizationId: currentOrg.id,
										region,
										options: {
											style: aiStyle,
											includeLogo: aiIncludeLogo,
											customPrompt: aiPrompt.trim() || undefined,
										},
									});

									// Ensure unique template name
									const baseName = generatedTemplate.name || "AI Generated Template";
									const uniqueName = generateUniqueTemplateName(baseName, templates);
									const templateWithUniqueName = {
										...generatedTemplate,
										name: uniqueName,
									};

									// Create template from generated data
									const templateId = await templateService.createDraft(templateWithUniqueName);
									
									setState((s) => ({
										...s,
										currentTemplateId: templateId,
									}));
									
									setAiBuilderOpen(false);
									toast.success("AI template generated successfully!");
								} catch (error) {
									toast.error(
										`Failed to generate template: ${error instanceof Error ? error.message : "Unknown error"}`
									);
								}
							}}
							disabled={generateTemplate.isPending || !currentOrg}
							className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
						>
							{generateTemplate.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<Sparkles className="h-4 w-4 mr-2" />
									Generate Template
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ElementProperties({
	element,
	onChange,
	isNarrow,
	allElements,
}: {
	element: TemplateElement;
	onChange: (partial: Partial<TemplateElement>) => void;
	isNarrow?: boolean;
	allElements?: TemplateElement[];
}) {
	if (element.type === "text") {
		const t = element as Extract<TemplateElement, { type: "text" }>;
		return (
			<TextProperties
				element={t}
				onChange={onChange}
				isNarrow={isNarrow}
				allElements={allElements}
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
				allElements={allElements}
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
				allElements={allElements}
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
				allElements={allElements}
			/>
		);
	}

	if (element.type === "currency") {
		const curr = element as Extract<TemplateElement, { type: "currency" }>;
		return (
			<CurrencyProperties
				element={curr}
				onChange={onChange}
				isNarrow={isNarrow}
				allElements={allElements}
			/>
		);
	}

	return (
		<div className="text-xs text-neutral-500">
			Select an element to edit.
		</div>
	);
}
