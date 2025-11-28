import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { signInAnonymously } from "@firebase/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	Drawer,
	DrawerContent,
} from "@/components/ui/drawer";
import {
	Tabs,
	TabsList,
	TabsTrigger,
	TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Menu, Settings } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
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
import { isRequiredBinding, extractTemplateBindings } from "@/utils/invoice-compliance";
import { COMPLIANCE_SCHEMAS } from "@/core/entities/invoice-compliance";
import { generateUniqueTemplateName } from "@/utils/template-naming";
import { TemplateSidebar } from "@/components/designer/template-sidebar";
import { CanvasHeader } from "@/components/designer/canvas-header";
import { DesignerCanvas } from "@/components/designer/designer-canvas";
import { PropertiesPanel } from "@/components/designer/properties-panel";
import { AIBuilderDialog } from "@/components/designer/ai-builder-dialog";
import type { DesignerState, DragState, SnapGuide } from "@/components/designer/designer-types";
import { useDesignerTemplate } from "@/contexts/designer-template-context";
import { useTemplateVersions, useSaveTemplateVersion, useRestoreTemplateVersion } from "@/hooks/repository-hooks/use-template-versions";
import { useUser } from "@clerk/clerk-react";
import { useTheme } from "@/components/ui/theme-provider";
import { BrandImagePickerDialog } from "@/components/brand-image-picker-dialog";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";

export default function TemplateDesignerPage() {
	const { t } = useTranslation();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [state, setState] = useState<DesignerState>({ zoom: 1, selectedElementIds: [] });
	const [drag, setDrag] = useState<DragState | null>(null);
	const [draftElements, setDraftElements] = useState<
		TemplateElement[] | null
	>(null);
	const [draftBrand, setDraftBrand] = useState<Template["brand"] | null>(null);
	const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const draftRef = useRef<TemplateElement[] | null>(null);
	const currentTemplateRef = useRef<Template | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);
	const isCreatingTemplateRef = useRef<boolean>(false);
	const dragStartedRef = useRef<boolean>(false); // Track if drag actually started (movement detected)
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || ""; // Fallback to demo-org if no org is loaded
	const designerTemplateContext = useDesignerTemplate();
	const templates = useMemo(() => designerTemplateContext?.templates ?? [], [designerTemplateContext?.templates]);
	const contextCurrentTemplateId = designerTemplateContext?.currentTemplateId;
	const setContextCurrentTemplateId = designerTemplateContext?.setCurrentTemplateId ?? (() => {});
	const contextOnTemplateChange = designerTemplateContext?.onTemplateChange ?? (() => {});
	const contextHandleCreateNewTemplate = designerTemplateContext?.onCreateNewTemplate ?? (() => {});
	const { isSubscribed } = useTemplates(orgId);
	const { activeUsers, updateCursor } = usePresence(state.currentTemplateId);
	const authUser = useFirebaseAuthUser();
	const { user: clerkUser } = useUser();
	const createTemplate = useCreateTemplate();
	const generateTemplate = useGenerateInvoiceTemplate();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
	const [mobilePanelTab, setMobilePanelTab] = useState<"elements" | "properties">("elements");
	const { theme } = useTheme();
	const [imagePickerOpen, setImagePickerOpen] = useState(false);
	const [imagePickerTargetElementId, setImagePickerTargetElementId] = useState<string | null>(null);
	const [brandAssets, setBrandAssets] = useState<{ logo?: string; favicon?: string; gallery: string[] }>({ gallery: [] });
	const [uploadState, setUploadState] = useState<{ preview: string; progress: number } | null>(null);
	const fileUpload = useFileUpload();
	const updateOrganization = useUpdateOrganization();
	
	// Get theme-aware default text color
	const getDefaultTextColor = () => {
		const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
		return isDark ? "#f9fafb" : "#111827"; // Light text for dark bg, dark text for light bg
	};
	
	// Version history hooks
	const templateId = contextCurrentTemplateId ?? state.currentTemplateId;
	const { data: versions = [], error: versionsError, isLoading: isLoadingVersions } = useTemplateVersions(templateId);
	console.log("versions", versions, "templateId", templateId, "error", versionsError, "isLoading", isLoadingVersions);
	const saveVersion = useSaveTemplateVersion();
	const restoreVersion = useRestoreTemplateVersion();
	
	// Determine current version (latest version number)
	const currentVersion = versions.length > 0 ? versions[0].version : null;

	// Load brand assets for image picker
	useEffect(() => {
		const branding = currentOrg?.settings?.branding;
		setBrandAssets({
			logo: branding?.customLogo,
			favicon: branding?.customFavicon,
			gallery: branding?.brandImages ?? [],
		});
	}, [currentOrg?.id, currentOrg?.settings?.branding]);

	useEffect(() => {
		setUploadState((prev) =>
			prev ? { ...prev, progress: fileUpload.uploadProgress } : prev,
		);
	}, [fileUpload.uploadProgress]);

	// Prevent body scroll when mobile panel is open
	useEffect(() => {
		if (isMobile && mobilePanelOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isMobile, mobilePanelOpen]);

	// Cleanup version creation timer on unmount or template change
	useEffect(() => {
		return () => {
			if (versionCreationTimerRef.current) {
				clearTimeout(versionCreationTimerRef.current);
			}
		};
	}, [templateId]);

	// Handler for creating a new template - now uses context
	const handleCreateNewTemplate = contextHandleCreateNewTemplate;

	console.log(
		"templates",
		templates,
		"realtime subscribed:",
		isSubscribed,
		"orgId:",
		orgId
	);

	const currentTemplate = useMemo(() => {
		// Use context's currentTemplateId if available, otherwise fall back to state
		const templateId = contextCurrentTemplateId ?? state.currentTemplateId;
		const template = templates.find((t: Template) => t.id === templateId) ?? templates[0];
		if (!template) return undefined;
		
		// Merge draft state for optimistic UI updates
		return {
			...template,
			elements: draftElements ?? template.elements ?? [],
			brand: draftBrand ?? template.brand,
		} as Template;
	}, [templates, contextCurrentTemplateId, state.currentTemplateId, draftElements, draftBrand]);

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
	): "text" | "input" | "table" | "currency" {
		if (binding === "items" || format === "array") {
			return "table";
		}
		if (format === "date" || binding.includes("Date") || binding.includes("date")) {
			return "input";
		}
		// Currency fields should use currency element type
		if (format === "number" && (binding.includes("Amount") || binding.includes("Total") || binding.includes("Price") || binding.includes("vatTotal") || binding.includes("netAmount") || binding.includes("grossTotal"))) {
			return "currency";
		}
		if (format === "number" || binding.includes("Rate")) {
			return "input";
		}
		return "text";
	}

	// Get missing required fields with metadata for the palette
	const missingRequiredFields = useMemo(() => {
		if (!complianceStatus || !currentTemplate) return [];
		
		const region = complianceStatus.region;
		const schema = COMPLIANCE_SCHEMAS[region];
		
		// Use the proper extraction function to get all bindings (including table columns)
		const existingBindings = extractTemplateBindings(currentTemplate.elements ?? []);
		
		// Also check table column bindings for nested fields
		// For example, if required field is "items" and we have a table with itemsBinding="items", it's satisfied
		// For fields within items (like "description", "quantity"), we check column bindings
		const elements = currentTemplate.elements ?? [];
		for (const el of elements) {
			if (el.type === "table" && el.itemsBinding) {
				// If required field is the items array itself, mark it as found
				existingBindings.add(el.itemsBinding);
				
				// Add column bindings to the set
				const tableEl = el as Extract<TemplateElement, { type: "table" }>;
				for (const col of tableEl.columns ?? []) {
					if (col.binding) {
						existingBindings.add(col.binding);
					}
				}
			}
		}
		
		return schema.requiredFields
			.filter(field => {
				// Check direct binding match
				if (existingBindings.has(field.binding)) {
					return false;
				}
				
				// For "items" array, check if any table has itemsBinding="items"
				if (field.binding === "items") {
					return !elements.some(
						(el) => el.type === "table" && 
						(el as Extract<TemplateElement, { type: "table" }>).itemsBinding === "items"
					);
				}
				
				// For nested bindings like "seller.name", check if any element has that exact binding
				// This is already handled by the direct check above
				return true;
			})
			.map(field => ({
				binding: field.binding,
				label: field.label,
				description: field.description,
				elementType: determineElementTypeForBinding(field.binding, field.format),
			}));
	}, [complianceStatus, currentTemplate]);

	// Function to add required element with pre-configured binding
	function addRequiredElement(binding: string, label: string, elementType: "text" | "input" | "table" | "currency") {
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
						header: t('designer.tableColumns.description'),
						width: 200,
						align: "left",
						type: "text",
						binding: "description",
						format: { kind: "none" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.quantity'),
						width: 80,
						align: "right",
						type: "number",
						binding: "quantity",
						format: { kind: "none" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.price'),
						width: 100,
						align: "right",
						type: "number",
						binding: "unitPrice",
						format: { kind: "currency", currency: "USD" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.total'),
						width: 100,
						align: "right",
						type: "number",
						binding: "total",
						format: { kind: "currency", currency: "USD" },
						showTotal: false,
					},
				],
				designRows: [],
				itemsBinding: binding,
			};
			const next = [...existingElements, tableElement];
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [tableElement.id] }));
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
			setState((s) => ({ ...s, selectedElementIds: [inputElement.id] }));
			saveMutation.mutate({ elements: next });
		} else if (elementType === "currency") {
			// Add currency element
			const currencyElement: TemplateElement = {
				id: crypto.randomUUID(),
				type: "currency",
				x: 60,
				y: yPosition,
				width: 200,
				height: 32,
				rotation: 0,
				zIndex: 1,
				visible: true,
				placeholder: "0.00",
				binding: binding,
				currency: currentOrg?.settings?.defaultCurrency || "USD",
				currencyLinks: [],
				mode: "independent",
				align: "right",
			};
			const next = [...existingElements, currencyElement];
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [currencyElement.id] }));
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
					color: getDefaultTextColor(),
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
			setState((s) => ({ ...s, selectedElementIds: [textElement.id] }));
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
			selectedElementIds: [],
		}));
	}, [state.currentTemplateId]);

	// Sync context currentTemplateId with state and URL
	useEffect(() => {
		if (templateIdFromUrl) {
			// Template ID from URL - set it in context if it exists in templates
			const templateExists = templates.some((t: Template) => t.id === templateIdFromUrl);
			if (templateExists && contextCurrentTemplateId !== templateIdFromUrl) {
				setContextCurrentTemplateId(templateIdFromUrl);
				setState((s: DesignerState) => ({
					...s,
					currentTemplateId: templateIdFromUrl,
				}));
			} else if (!templateExists && templates.length > 0) {
				// Template not found, redirect to templates list
				navigate("/templates");
			}
		} else if (
			!contextCurrentTemplateId && 
			!createTemplate.isPending && 
			!createTemplate.isSuccess &&
			!isCreatingTemplateRef.current
		) {
			// No template ID in URL and no template selected - auto-create a new one
			// Use ref to prevent multiple simultaneous creations
			isCreatingTemplateRef.current = true;
			const createPromise = handleCreateNewTemplate();
			if (createPromise && typeof createPromise.then === 'function') {
				createPromise
					.then(() => {
						// Reset flag after a delay to allow state updates to propagate
						setTimeout(() => {
							isCreatingTemplateRef.current = false;
						}, 1000);
					})
					.catch(() => {
						// Reset flag on error so user can retry
						isCreatingTemplateRef.current = false;
					});
			} else {
				// If it doesn't return a promise, reset after a delay
				setTimeout(() => {
					isCreatingTemplateRef.current = false;
				}, 2000);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templates, contextCurrentTemplateId, templateIdFromUrl, navigate, createTemplate.isPending, createTemplate.isSuccess]);
	
	// Sync state.currentTemplateId with context
	useEffect(() => {
		if (contextCurrentTemplateId && state.currentTemplateId !== contextCurrentTemplateId) {
			setState((s: DesignerState) => ({
				...s,
				currentTemplateId: contextCurrentTemplateId,
			}));
			// Reset creation flag when template ID is set
			isCreatingTemplateRef.current = false;
		}
	}, [contextCurrentTemplateId, state.currentTemplateId]);


	// Ref to track version creation debounce timer
	const versionCreationTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedElementsRef = useRef<string>("");

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
		onSuccess: async (_, partial) => {
			queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
			// Clear draft brand after successful save (real-time update will handle it)
			setTimeout(() => setDraftBrand(null), 100);

			// Auto-create version when elements are changed
			if (partial.elements && currentTemplate && templateId && clerkUser?.id) {
				const elementsStr = JSON.stringify(partial.elements);
				
				// Only create version if elements actually changed
				if (elementsStr !== lastSavedElementsRef.current) {
					lastSavedElementsRef.current = elementsStr;

					// Clear existing timer
					if (versionCreationTimerRef.current) {
						clearTimeout(versionCreationTimerRef.current);
					}

					// Debounce version creation to avoid creating too many versions
					// Wait 2 seconds after the last change before creating a version
					versionCreationTimerRef.current = setTimeout(async () => {
						try {
							await saveVersion.mutateAsync({
								templateId,
								userId: clerkUser.id,
								description: t('designer.defaults.autoSavedVersion'),
							});
						} catch (error) {
							console.error("Failed to auto-create version:", error);
							// Don't show error toast for auto-save failures
						}
					}, 2000);
				}
			}
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
			const uniqueName = generateUniqueTemplateName(t('designer.defaults.newTemplateName'), templates);
			
			const empty: TemplateData = {
				orgId: orgId,
				name: uniqueName,
				description: "",
				pageSize: "A4",
				brand: {
					fonts: ["Inter"],
					colors: {
						primary: getDefaultTextColor(),
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

	// Page dimensions in pixels (at 96 DPI to match PDF rendering)
	const PAGE_SIZES = {
		A4: { width: 794, height: 1123 },
		Letter: { width: 816, height: 1056 },
	} as const;
	
	function getPageDimensions(pageSize: string | undefined): { width: number; height: number } {
		return PAGE_SIZES[pageSize as keyof typeof PAGE_SIZES] || PAGE_SIZES.A4;
	}
	
	const pageDimensions = getPageDimensions(currentTemplate?.pageSize);
	const PAGE_WIDTH = pageDimensions.width;
	const PAGE_HEIGHT = pageDimensions.height;
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
						text: t('designer.defaults.text'),
						binding: defaultBinding,
						padding: 0,
						opacity: 1,
						typography: {
							fontFamily: "Inter",
							fontSize: 12,
							fontWeight: "normal",
							lineHeight: 1.2,
							letterSpacing: 0,
							color: getDefaultTextColor(),
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
										header: t('designer.tableColumns.column1'),
										width: 160,
										align: "left",
										type: "text",
										format: { kind: "none" },
										showTotal: false,
									},
									{
										id: crypto.randomUUID(),
										header: t('designer.tableColumns.column2'),
										width: 160,
										align: "left",
										type: "text",
										format: { kind: "none" },
										showTotal: false,
									},
								],
								designRows: [],
								itemsBinding: "items",
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
			selectedElementIds: [nextElement.id],
		}));
		console.log("[ADD] persisting draft via saveMutation.mutate");
		saveMutation.mutate({ elements: next });
	}

	// Helper function to handle multi-select with Shift+click
	const handleSelectElement = (elementId: string, event?: React.MouseEvent | React.PointerEvent) => {
		// Check shiftKey from the event - make sure we're checking the right property
		const isShiftPressed = Boolean(event?.shiftKey);
		const currentSelected = state.selectedElementIds || [];
		
		console.log('[SELECT]', { 
			elementId, 
			isShiftPressed, 
			currentSelected, 
			eventType: event?.type,
			shiftKey: event?.shiftKey,
			hasEvent: !!event
		});
		
		if (isShiftPressed) {
			// Toggle selection: add if not selected, remove if already selected
			if (currentSelected.includes(elementId)) {
				const newSelected = currentSelected.filter((id) => id !== elementId);
				console.log('[SELECT] Removing from selection:', newSelected);
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
				}));
			} else {
				const newSelected = [...currentSelected, elementId];
				console.log('[SELECT] Adding to selection:', newSelected);
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
				}));
			}
		} else {
			// Single select: replace selection
			console.log('[SELECT] Single select:', [elementId]);
			setState((s) => ({
				...s,
				selectedElementIds: [elementId],
			}));
		}
	};

	function updateSelected(partial: Partial<TemplateElement>) {
		if (!currentTemplate || !state.selectedElementIds || state.selectedElementIds.length === 0) return;
		// Use draftElements if available, otherwise use currentTemplate.elements
		const currentElements = draftElements ?? currentTemplate.elements ?? [];
		const next = currentElements.map(
			(el: TemplateElement) =>
				state.selectedElementIds?.includes(el.id)
					? ((): TemplateElement => {
							const merged = {
								...el,
								...partial,
							} as TemplateElement;
							const clamped = clampMove(
								merged.x,
								merged.y,
								merged.width,
								merged.height
							);
							return {
								...merged,
								x: clamped.x,
								y: clamped.y,
							} as TemplateElement;
						})()
					: el
		);
		setDraftElements(next);
		saveMutation.mutate({ elements: next });
	}

	const handleOpenImagePicker = (elementId: string) => {
		setImagePickerTargetElementId(elementId);
		setImagePickerOpen(true);
	};

	const handleImagePickerOpenChange = (open: boolean) => {
		setImagePickerOpen(open);
		if (!open) {
			setImagePickerTargetElementId(null);
		}
	};

	const handleSelectBrandImage = (url: string) => {
		if (!currentTemplate || !imagePickerTargetElementId) return;
		const currentElements = draftElements ?? currentTemplate.elements ?? [];
		const targetElement = currentElements.find((el) => el.id === imagePickerTargetElementId);
		if (!targetElement || targetElement.type !== "image") {
			toast.error(t("emailDesigner.toast.imagePickerMissing"));
			handleImagePickerOpenChange(false);
			return;
		}
		updateSelected({ ...targetElement, src: url });
		handleImagePickerOpenChange(false);
	};

	const handleBrandImageUpload = async (file: File) => {
		if (!currentOrg) {
			toast.error(t("emailDesigner.toast.imageUploadNoOrg"));
			return;
		}
		const preview = URL.createObjectURL(file);
		setUploadState({ preview, progress: 0 });
		const extension = file.name.split(".").pop() || "png";
		const path = `organizations/${currentOrg.id}/branding/designer-${Date.now()}.${extension}`;
		try {
			const url = await fileUpload.uploadFile(file, path);
			if (!url) {
				throw new Error(fileUpload.error || "upload failed");
			}
			const branding = currentOrg.settings?.branding;
			const nextImages = [...(branding?.brandImages ?? []), url];
			const updatedSettings = {
				...(currentOrg.settings || {}),
				branding: {
					...(branding ?? {}),
					brandImages: nextImages,
				},
			};
			await updateOrganization.mutateAsync({
				id: currentOrg.id,
				data: {
					settings: updatedSettings,
				},
			});
			setBrandAssets({
				logo: updatedSettings.branding?.customLogo,
				favicon: updatedSettings.branding?.customFavicon,
				gallery: nextImages,
			});
			queryClient.invalidateQueries({ queryKey: ["organizations", currentOrg.id] });
			toast.success(t("emailDesigner.toast.imageUploaded"));
		} catch (error) {
			console.error("Failed to upload brand image:", error);
			toast.error(t("emailDesigner.toast.imageUploadFailed"));
		} finally {
			setUploadState(null);
			URL.revokeObjectURL(preview);
		}
	};

	function deleteElement(id: string) {
		if (!currentTemplate) return;
		const next = (currentTemplate.elements ?? []).filter(
			(e) => e.id !== id
		);
		saveMutation.mutate({ elements: next });
		setState((s: DesignerState) => ({
			...s,
			selectedElementIds: [],
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
			selectedElementIds: [duplicated.id],
		}));
		toast.success(t('designer.duplicateSuccess'));
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
			selectedElementPositions,
		} = drag;

		// Track if pointer has moved (to distinguish click from drag)
		let hasMoved = false;
		const DRAG_THRESHOLD = 5; // pixels - threshold to distinguish click from drag
		
		// Reset drag started flag when drag state is created
		dragStartedRef.current = false;

		function handlePointerMove(ev: PointerEvent) {
			const moveDx = Math.abs(ev.clientX - startClientX);
			const moveDy = Math.abs(ev.clientY - startClientY);
			
			// Only consider it a drag if pointer moved beyond threshold
			if (!hasMoved && (moveDx > DRAG_THRESHOLD || moveDy > DRAG_THRESHOLD)) {
				hasMoved = true;
				dragStartedRef.current = true; // Mark that drag has actually started
				// Prevent click event from firing when we start dragging
				ev.preventDefault();
			}
			
			// Only process drag if we've moved
			if (!hasMoved) return;
			
			const dx = (ev.clientX - startClientX) / state.zoom;
			const dy = (ev.clientY - startClientY) / state.zoom;

			setDraftElements((prev: TemplateElement[] | null) => {
				const base = prev ?? currentTemplateRef.current?.elements ?? [];
				const draggingElement = base.find(
					(item) => item.id === elementId
				);
				if (!draggingElement) return base;

				if (mode === "move") {
					// Check if we have multiple selected elements to move together
					const selectedPositions = selectedElementPositions;
					const selectedIds = state.selectedElementIds || [];
					
					if (selectedPositions && selectedIds.length > 1) {
						// Move all selected elements together
						// First, calculate the primary element's position with snapping
						const primaryInitialPos = selectedPositions.get(elementId);
						if (!primaryInitialPos) return base;
						
						const primaryRawX = primaryInitialPos.x + dx;
						const primaryRawY = primaryInitialPos.y + dy;
						
						const { snappedX, snappedY, guides } =
							calculateSnapPositions(
								draggingElement,
								base,
								primaryRawX,
								primaryRawY
							);
						
						// Update snap guides
						setSnapGuides(guides);
						
						const primaryClamped = clampMove(
							snappedX,
							snappedY,
							draggingElement.width,
							draggingElement.height
						);
						
						// Calculate the actual delta after snapping/clamping
						const actualDx = primaryClamped.x - primaryInitialPos.x;
						const actualDy = primaryClamped.y - primaryInitialPos.y;
						
						// Apply the same delta to all selected elements
						return base.map((item) => {
							if (!selectedIds.includes(item.id)) return item;
							
							if (item.id === elementId) {
								return { ...item, x: primaryClamped.x, y: primaryClamped.y };
							}
							
							const initialPos = selectedPositions.get(item.id);
							if (!initialPos) return item;
							
							const clamped = clampMove(
								initialPos.x + actualDx,
								initialPos.y + actualDy,
								item.width,
								item.height
							);
							return { ...item, x: clamped.x, y: clamped.y };
						});
					} else {
						// Single element drag (original behavior)
						return base.map((item) => {
							if (item.id !== elementId) return item;
							
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
						});
					}
				}
				
				// resize logic - clear snap guides during resize
				setSnapGuides([]);
				return base.map((item) => {
					if (item.id !== elementId) return item;
					
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
			// If we never moved, it was just a click - don't save drag state
			// The click handler will handle selection
			if (hasMoved) {
				const latestDraft = draftRef.current;
				const tmpl = currentTemplateRef.current;
				if (latestDraft && tmpl) {
					saveMutation.mutate({ elements: latestDraft });
				}
			}
			// Reset drag started flag immediately - click handler will have already checked it
			// We use requestAnimationFrame to ensure the click handler runs first
			requestAnimationFrame(() => {
				dragStartedRef.current = false;
			});
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

	const sidebarContent = (
		<TemplateSidebar
			templates={templates}
			currentTemplate={currentTemplate}
			state={state}
			onStateChange={setState}
			onCreateNewTemplate={handleCreateNewTemplate}
			onOpenAIBuilder={() => {
				setAiBuilderOpen(true);
				if (isMobile) {
					setMobilePanelOpen(false);
				}
			}}
			onAddElement={addElement}
			onSelectElement={(id, event) => {
				handleSelectElement(id, event);
				if (isMobile) {
					setMobilePanelTab("properties");
					setMobilePanelOpen(true);
				}
			}}
			onDuplicateElement={duplicateElement}
			onDeleteElement={deleteElement}
			missingRequiredFields={missingRequiredFields}
			onAddRequiredElement={addRequiredElement}
			isRequired={isRequired}
		/>
	);

	const propertiesContent = (
		<PropertiesPanel
			template={currentTemplate}
			selectedElementIds={state.selectedElementIds || []}
			draftElements={draftElements}
			organization={currentOrg ?? undefined}
			complianceStatus={complianceStatus}
			saveMutation={saveMutation}
			onUpdateElement={updateSelected}
			onAddRequiredElement={addRequiredElement}
			determineElementTypeForBinding={determineElementTypeForBinding}
			onOpenImagePicker={handleOpenImagePicker}
			templateId={templateId}
			versions={versions}
			currentVersion={currentVersion}
			onRestoreVersion={async (version: number) => {
				if (!templateId) return;
				await restoreVersion.mutateAsync({
					templateId,
					version,
				});
			}}
			isRestoringVersion={restoreVersion.isPending}
			currentUserId={clerkUser?.id}
		/>
	);

	const canvasContent = (
		<div className="h-full flex flex-col overflow-hidden">
			<CanvasHeader
				templates={templates}
				currentTemplate={currentTemplate}
				state={state}
				isSubscribed={isSubscribed}
				activeUsers={activeUsers}
				onTemplateChange={async (id: string) => {
					// Reset draft state when switching templates
					setDraftElements(null);
					setDraftBrand(null);
					setState((s) => ({ ...s, selectedElementIds: [] }));
					// Use context handler
					await contextOnTemplateChange(id);
				}}
				onCreateNewTemplate={handleCreateNewTemplate}
				onZoomChange={(zoom) => setState((s) => ({ ...s, zoom }))}
				isMobile={isMobile}
			/>
			<div className="flex-1 overflow-auto pb-16">
				<DesignerCanvas
					template={currentTemplate}
					draftElements={draftElements}
					state={state}
					drag={drag}
					snapGuides={snapGuides}
					activeUsers={activeUsers}
					currentUserId={authUser?.uid}
					pageRef={pageRef}
					onDragOver={handleCanvasDragOver}
					onDrop={handleCanvasDrop}
					onMouseMove={(e) => {
						if (!state.currentTemplateId) return;
						const rect = pageRef.current?.getBoundingClientRect();
						if (!rect) return;
						const x = (e.clientX - rect.left) / state.zoom;
						const y = (e.clientY - rect.top) / state.zoom;
						updateCursor({ x, y });
					}}
					onSelectElement={(id, event) => {
						handleSelectElement(id, event);
						if (isMobile) {
							setMobilePanelTab("properties");
							setMobilePanelOpen(true);
						}
					}}
					onStartDrag={(el, e) => {
						if (e.button !== 0) return;
						// Don't prevent default or stop propagation - we need click to fire for selection
						// Drag will only start if pointer moves (handled in pointer move handler)
						// When starting drag, ensure this element is selected
						const selectedIds = state.selectedElementIds || [];
						if (!selectedIds.includes(el.id)) {
							setState((s) => ({ ...s, selectedElementIds: [el.id] }));
							// Update selectedIds for this drag operation
							const newSelectedIds = [el.id];
							setDraftElements((currentTemplate?.elements ?? []).map((x) => ({ ...x })));
							// Store initial positions of all selected elements for multi-drag
							const selectedPositions = new Map<string, { x: number; y: number }>();
							(currentTemplate?.elements ?? []).forEach((elem) => {
								if (newSelectedIds.includes(elem.id)) {
									selectedPositions.set(elem.id, { x: elem.x, y: elem.y });
								}
							});
							setDrag({
								elementId: el.id,
								mode: "move",
								startClientX: e.clientX,
								startClientY: e.clientY,
								startX: el.x,
								startY: el.y,
								selectedElementPositions: selectedPositions,
							});
						} else {
							// Element is already selected - check if we have multiple selections
							setDraftElements((currentTemplate?.elements ?? []).map((x) => ({ ...x })));
							// Store initial positions of all selected elements for multi-drag
							const selectedPositions = new Map<string, { x: number; y: number }>();
							(currentTemplate?.elements ?? []).forEach((elem) => {
								if (selectedIds.includes(elem.id)) {
									selectedPositions.set(elem.id, { x: elem.x, y: elem.y });
								}
							});
							setDrag({
								elementId: el.id,
								mode: "move",
								startClientX: e.clientX,
								startClientY: e.clientY,
								startX: el.x,
								startY: el.y,
								selectedElementPositions: selectedPositions,
							});
						}
					}}
					onStartResize={(el, edge, e) => {
						e.preventDefault();
						e.stopPropagation();
						setDraftElements((currentTemplate?.elements ?? []).map((x) => ({ ...x })));
						setDrag({
							elementId: el.id,
							mode: "resize",
							edge,
							startClientX: e.clientX,
							startClientY: e.clientY,
							startX: el.x,
							startY: el.y,
							startWidth: el.width,
							startHeight: el.height,
						});
					}}
					onDuplicateElement={duplicateElement}
					onDeleteElement={deleteElement}
					onCreateTemplate={() => createMutation.mutate()}
					isRequired={isRequired}
					onTableHeaderChange={(tableId, columnId, header) => {
						const elements = draftElements ?? currentTemplate?.elements ?? [];
						const tbl = elements.find((e) => e.id === tableId && e.type === "table") as Extract<TemplateElement, { type: "table" }> | undefined;
						if (!tbl) return;
						const baseColumns = tbl.columns.length > 0 ? tbl.columns : [
							{ id: "c1", header: t('designer.tableColumns.column1'), width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
							{ id: "c2", header: t('designer.tableColumns.column2'), width: 120, align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
						];
						const next = baseColumns.map((col) => col.id === columnId ? { ...col, header } : col);
						setDraftElements((prev) => {
							const base = prev ?? currentTemplateRef.current?.elements ?? [];
							return base.map((it) => it.id === tableId ? ({ ...tbl, columns: next } as TemplateElement) : it);
						});
						saveMutation.mutate({
							elements: (currentTemplateRef.current?.elements ?? []).map((it) =>
								it.id === tableId ? ({ ...tbl, columns: next } as TemplateElement) : it
							),
						});
					}}
					currentTemplateRef={currentTemplateRef}
					saveMutation={saveMutation}
					dragStartedRef={dragStartedRef}
				/>
			</div>
		</div>
	);

	return (
		<div className="flex h-screen overflow-hidden">
			{isMobile ? (
				<>
					<div className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16">
						{canvasContent}
					</div>
					{/* Mobile Bottom Navigation */}
					<div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden">
						<div className="flex items-center justify-around h-16 px-2">
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "elements" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "elements") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("elements");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Menu className="h-5 w-5" />
								<span className="text-xs font-medium text-foreground">{t('designer.elements')}</span>
							</Button>
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "properties" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "properties") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("properties");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Settings className="h-5 w-5" />
								<span className="text-xs font-medium text-foreground">{t('designer.properties')}</span>
							</Button>
						</div>
					</div>
					<Drawer
						open={mobilePanelOpen}
						onOpenChange={setMobilePanelOpen}
						direction="bottom"
					>
						<DrawerContent className="max-h-[85vh] flex flex-col">
							<Tabs
								value={mobilePanelTab}
								onValueChange={(v) => setMobilePanelTab(v as "elements" | "properties")}
								className="flex flex-col flex-1 min-h-0"
							>
								<div className="px-4 pt-2 pb-1 border-b shrink-0">
									<TabsList className="w-full">
										<TabsTrigger value="elements" className="flex-1">
											{t('designer.elements')}
										</TabsTrigger>
										<TabsTrigger value="properties" className="flex-1">
											{t('designer.properties')}
										</TabsTrigger>
									</TabsList>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0">
									<TabsContent value="elements" className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col">
										<div className="h-full overflow-y-auto">
											{sidebarContent}
										</div>
									</TabsContent>
									<TabsContent value="properties" className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col">
										<div className="h-full overflow-y-auto">
											{propertiesContent}
										</div>
									</TabsContent>
								</div>
							</Tabs>
						</DrawerContent>
					</Drawer>
				</>
			) : (
				<ResizablePanelGroup direction="horizontal" className="w-full">
					<ResizablePanel defaultSize={18} minSize={16} maxSize={25}>
						{sidebarContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel minSize={40}>
						{canvasContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={22} minSize={18} maxSize={30}>
						{propertiesContent}
					</ResizablePanel>
				</ResizablePanelGroup>
			)}

		<BrandImagePickerDialog
			open={imagePickerOpen}
			onOpenChange={handleImagePickerOpenChange}
			assets={brandAssets}
			onSelect={handleSelectBrandImage}
			onUploadImage={handleBrandImageUpload}
			isUploading={fileUpload.isUploading}
			uploadState={uploadState}
		/>
		<AIBuilderDialog
			open={aiBuilderOpen}
			onOpenChange={setAiBuilderOpen}
			currentOrg={currentOrg ?? undefined}
				currentTemplate={currentTemplate}
				templates={templates}
				generateTemplate={generateTemplate}
				onTemplateCreated={(templateId) => {
					setState((s) => ({ ...s, currentTemplateId: templateId }));
				}}
			/>
		</div>
	);
}
