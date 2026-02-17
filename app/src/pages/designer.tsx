import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { signInAnonymously } from "@firebase/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ChevronLeft, Menu, Settings } from "lucide-react";
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
import type { DesignerState, DragState, SnapGuide, PathNodeDragState } from "@/components/designer/designer-types";
import { useDesignerTemplate } from "@/contexts/designer-template-context";
import { useTemplateVersions, useSaveTemplateVersion, useRestoreTemplateVersion } from "@/hooks/repository-hooks/use-template-versions";
import { useUser } from "@clerk/clerk-react";
import { useTheme } from "@/components/ui/theme-provider";
import { BrandImagePickerDialog } from "@/components/brand-image-picker-dialog";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { compileInvoiceBlocksToElements } from "@/services/template-compiler/invoice-block-compiler";
import { DEFAULT_MARGIN_UNIT, getDefaultPrintMarginsPx, resolveTemplateMarginsPx } from "@/utils/print-margins";
import { PAGE_SIZES_PX } from "@/utils/page-size-presets";
import { loadGoogleFonts } from "@/utils/google-fonts";
import {
	alignSelection,
	cycleSelection,
	createClipboardPayload,
	deleteSelection,
	duplicateSelection,
	groupSelection,
	jumpSelectionToEdge,
	moveSelection,
	pasteClipboard,
	reorderSelectionLayer,
	resizeSelectionByKeyboard,
	setLockSelection,
	ungroupSelection,
	type AlignMode,
	type Bounds,
	type ClipboardPayload,
} from "@/components/designer/editor-commands";

const DEBUG_DESIGNER = false;
const debugLog = (...args: unknown[]) => {
	if (!DEBUG_DESIGNER) return;
	console.log(...args);
};
const debugWarn = (...args: unknown[]) => {
	if (!DEBUG_DESIGNER) return;
	console.warn(...args);
};

export default function TemplateDesignerPage() {
	const { t } = useTranslation();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [state, setState] = useState<DesignerState>({
		zoom: 1,
		selectedElementIds: [],
		showGrid: true,
		snapEnabled: true,
		activeTool: "select",
	});
	const [drag, setDrag] = useState<DragState | null>(null);
	const [pathNodeDrag, setPathNodeDrag] = useState<PathNodeDragState | null>(null);
	const [draftElements, setDraftElements] = useState<
		TemplateElement[] | null
	>(null);
	const [draftBrand, setDraftBrand] = useState<Template["brand"] | null>(null);
	const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
	const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const draftRef = useRef<TemplateElement[] | null>(null);
	const currentTemplateRef = useRef<Template | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);
	const isCreatingTemplateRef = useRef<boolean>(false);
	const dragStartedRef = useRef<boolean>(false); // Track if drag actually started (movement detected)
	const lastCursorCanvasPointRef = useRef<{ x: number; y: number } | null>(null);
	const isSpacePressedRef = useRef(false);
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
	const { data: dbUser } = useUserByClerkId(clerkUser?.id);
	const createTemplate = useCreateTemplate();
	const generateTemplate = useGenerateInvoiceTemplate();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const isWideLayout = useMediaQuery("(min-width: 1600px)");
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
	const { data: versions = []} = useTemplateVersions(templateId);
	//debugLog("versions", versions, "templateId", templateId, "error", versionsError, "isLoading", isLoadingVersions);
	const saveVersion = useSaveTemplateVersion();
	const restoreVersion = useRestoreTemplateVersion();
	
	// Determine current version (latest version number)
	const currentVersion = versions.length > 0 ? versions[0].version : null;
	const canAutoCreateVersion = useMemo(() => {
		if (!dbUser || !currentOrg?.id) return false;
		const role = dbUser.organizationRoles?.[currentOrg.id];
		return role === "owner" || role === "admin" || role === "member";
	}, [dbUser, currentOrg?.id]);

	// Refs to avoid stale closures and track pending saves
	const versionCreationTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedElementsRef = useRef<string>("");
	const loadedFontSignatureRef = useRef<string>("");
	const currentTemplateIdRef = useRef<string | undefined>(undefined);
	const templatesRef = useRef<Template[]>([]);
		const selectedElementIdsRef = useRef<string[]>([]);
		const pendingSaveRef = useRef<{ elements: TemplateElement[]; timestamp: number } | null>(null);
		// Debounce timers per element ID for property panel changes
		const elementSaveTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
		const keyboardNudgeSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
		const keyboardNudgeRafRef = useRef<number | null>(null);
		const keyboardNudgeDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
		const keyboardNudgeHistoryOpenRef = useRef(false);
		const commandSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
		const undoStackRef = useRef<Array<{
			elements: TemplateElement[];
			selectedElementIds: string[];
			showGrid: boolean;
			snapEnabled: boolean;
			editingTextElementId?: string;
		}>>([]);
		const redoStackRef = useRef<Array<{
			elements: TemplateElement[];
			selectedElementIds: string[];
			showGrid: boolean;
			snapEnabled: boolean;
			editingTextElementId?: string;
		}>>([]);
		const clipboardRef = useRef<ClipboardPayload | null>(null);
	
	// Keep refs in sync
	useEffect(() => {
		currentTemplateIdRef.current = templateId;
	}, [templateId]);
	
	useEffect(() => {
		templatesRef.current = templates;
	}, [templates]);
	
	useEffect(() => {
		selectedElementIdsRef.current = state.selectedElementIds || [];
	}, [state.selectedElementIds]);

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

	// Cleanup timers on unmount or template change
	useEffect(() => {
		const timersMap = elementSaveTimersRef.current;
		return () => {
			if (versionCreationTimerRef.current) {
				clearTimeout(versionCreationTimerRef.current);
			}
			if (keyboardNudgeSaveTimerRef.current) {
				clearTimeout(keyboardNudgeSaveTimerRef.current);
				keyboardNudgeSaveTimerRef.current = null;
			}
			if (keyboardNudgeRafRef.current != null) {
				cancelAnimationFrame(keyboardNudgeRafRef.current);
				keyboardNudgeRafRef.current = null;
				keyboardNudgeDeltaRef.current = { dx: 0, dy: 0 };
			}
			if (commandSaveTimerRef.current) {
				clearTimeout(commandSaveTimerRef.current);
				commandSaveTimerRef.current = null;
			}
			// Clear all element save timers and save any pending changes before clearing
			timersMap.forEach((timer, elementId) => {
				clearTimeout(timer);
				// If there's a pending save, execute it immediately before clearing
				const latestElements = draftRef.current;
				if (latestElements && latestElements.length > 0) {
					const element = latestElements.find((el) => el.id === elementId);
					if (element) {
						debugLog(`[SAVE] Template changing, saving element ${elementId} immediately`);
						saveMutation.mutate({ elements: latestElements });
					}
				}
			});
			timersMap.clear();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templateId]);

	// Handler for creating a new template - now uses context
	const handleCreateNewTemplate = contextHandleCreateNewTemplate;

	// debugLog(
	// 	"templates",
	// 	templates,
	// 	"realtime subscribed:",
	// 	isSubscribed,
	// 	"orgId:",
	// 	orgId
	// );

	const currentTemplate = useMemo(() => {
		// Use context's currentTemplateId if available, otherwise fall back to state
		const templateId = contextCurrentTemplateId ?? state.currentTemplateId;
		const template = templates.find((t: Template) => t.id === templateId) ?? templates[0];
		if (!template) {
			debugLog("[TEMPLATE] currentTemplate useMemo: No template found");
			return undefined;
		}
		
		// Check if we have a pending save that should take precedence
		const pendingSave = pendingSaveRef.current;
		let elementsToUse = draftElements ?? template.elements ?? [];
		
		debugLog("[TEMPLATE] currentTemplate useMemo", {
			templateId,
			hasPendingSave: !!pendingSave,
			hasDraftElements: !!draftElements,
			templateElementsCount: template.elements?.length ?? 0,
			draftElementsCount: draftElements?.length ?? 0,
			initialElementsToUseCount: elementsToUse.length,
		});
		
		// If we have a pending save, check if the realtime update matches our save
		if (pendingSave) {
			// Use normalized comparison to handle floating point precision
			const normalizeElements = (elements: TemplateElement[]) => {
				return elements.map(el => ({
					...el,
					x: Math.round(el.x * 100) / 100,
					y: Math.round(el.y * 100) / 100,
					width: Math.round(el.width * 100) / 100,
					height: Math.round(el.height * 100) / 100,
				})).sort((a, b) => a.id.localeCompare(b.id));
			};
			
			const normalizedTemplate = normalizeElements(template.elements ?? []);
			const normalizedPending = normalizeElements(pendingSave.elements);
			
			const templateElementsStr = JSON.stringify(normalizedTemplate);
			const pendingElementsStr = JSON.stringify(normalizedPending);
			const matches = templateElementsStr === pendingElementsStr;
			
			debugLog("[TEMPLATE] currentTemplate useMemo: Pending save check", {
				matches,
				templateElementsCount: normalizedTemplate.length,
				pendingElementsCount: normalizedPending.length,
			});
			
			// If template elements match our pending save, use template (realtime confirmed)
			// Otherwise, use draftElements if available (still waiting for confirmation)
			if (matches) {
				// Realtime update confirmed our save - use template elements
				elementsToUse = template.elements ?? [];
				debugLog("[TEMPLATE] Using template elements (realtime confirmed)");
			} else if (draftElements) {
				// Template hasn't been updated yet, but we have draftElements - use them
				elementsToUse = draftElements;
				debugLog("[TEMPLATE] Using draftElements (waiting for realtime confirmation)");
			} else {
				// No draftElements and template doesn't match - use template (fallback)
				elementsToUse = template.elements ?? [];
				debugLog("[TEMPLATE] Using template elements (fallback, no draftElements)");
			}
		}
		
		// Merge draft state for optimistic UI updates
		const result = {
			...template,
			elements: elementsToUse,
			brand: draftBrand ?? template.brand,
		} as Template;
		
		debugLog("[TEMPLATE] currentTemplate useMemo: Final result", {
			elementsCount: result.elements.length,
			hasBrand: !!result.brand,
		});
		
		return result;
	}, [templates, contextCurrentTemplateId, state.currentTemplateId, draftElements, draftBrand]);

	useEffect(() => {
		if (!currentTemplate) return;
		const families = new Set<string>();
		currentTemplate.brand?.fonts?.forEach((font) => {
			if (typeof font === "string" && font.trim().length > 0) families.add(font.trim());
		});
		for (const element of currentTemplate.elements ?? []) {
			if (element.type === "text" && element.typography?.fontFamily) {
				families.add(element.typography.fontFamily);
			}
			if (element.type === "input" && element.fontFamily) {
				families.add(element.fontFamily);
			}
			if (element.type === "currency" && element.fontFamily) {
				families.add(element.fontFamily);
			}
			if (element.type === "table") {
				if (element.headerStyle?.fontFamily) families.add(element.headerStyle.fontFamily);
				if (element.rowStyle?.fontFamily) families.add(element.rowStyle.fontFamily);
				if (element.footerStyle?.fontFamily) families.add(element.footerStyle.fontFamily);
			}
			if (element.type === "stamp" && element.fontFamily) {
				families.add(element.fontFamily);
			}
		}
		const uniqueFamilies = Array.from(families).sort();
		const nextSignature = uniqueFamilies.join("|");
		if (nextSignature === loadedFontSignatureRef.current) return;
		loadedFontSignatureRef.current = nextSignature;
		loadGoogleFonts(uniqueFamilies);
	}, [currentTemplate]);

	// Effect to clear draftElements when realtime update confirms our save
	useEffect(() => {
		const pendingSave = pendingSaveRef.current;
		if (!pendingSave) {
			debugLog("[SAVE] useEffect: No pending save, skipping check");
			return;
		}
		
		// Get the raw template from realtime subscription (not the merged currentTemplate)
		const templateId = contextCurrentTemplateId ?? state.currentTemplateId;
		const rawTemplate = templates.find((t: Template) => t.id === templateId);
		if (!rawTemplate) {
			debugLog("[SAVE] useEffect: No raw template found for templateId:", templateId);
			return;
		}
		
		debugLog("[SAVE] useEffect: Checking realtime confirmation", {
			templateId,
			pendingSaveElementsCount: pendingSave.elements.length,
			rawTemplateElementsCount: rawTemplate.elements?.length ?? 0,
			hasDraftElements: !!draftElements,
			pendingSaveTimestamp: new Date(pendingSave.timestamp).toISOString(),
			timeSincePending: Date.now() - pendingSave.timestamp,
		});
		
		// Compare raw template elements (from realtime) with pending save
		// Use a normalized comparison that handles floating point precision
		const normalizeElements = (elements: TemplateElement[]) => {
			return elements.map(el => ({
				...el,
				x: Math.round(el.x * 100) / 100,
				y: Math.round(el.y * 100) / 100,
				width: Math.round(el.width * 100) / 100,
				height: Math.round(el.height * 100) / 100,
			})).sort((a, b) => a.id.localeCompare(b.id));
		};
		
		const normalizedTemplate = normalizeElements(rawTemplate.elements ?? []);
		const normalizedPending = normalizeElements(pendingSave.elements);
		
		const templateElementsStr = JSON.stringify(normalizedTemplate);
		const pendingElementsStr = JSON.stringify(normalizedPending);
		
		debugLog("[SAVE] useEffect: Comparison result", {
			stringsMatch: templateElementsStr === pendingElementsStr,
			templateElementsLength: templateElementsStr.length,
			pendingElementsLength: pendingElementsStr.length,
			first100CharsTemplate: templateElementsStr.substring(0, 100),
			first100CharsPending: pendingElementsStr.substring(0, 100),
		});
		
		// If template elements match our pending save, the realtime update confirmed our save
		if (templateElementsStr === pendingElementsStr && draftElements) {
			debugLog("[SAVE] ✅ Realtime update confirmed save, clearing draftElements", {
				elementsCount: pendingSave.elements.length,
				timeSinceSave: Date.now() - pendingSave.timestamp,
			});
			// Realtime update confirmed our save - clear pending and draftElements
			pendingSaveRef.current = null;
			setDraftElements(null);
		} else if (templateElementsStr !== pendingElementsStr && draftElements) {
			debugLog("[SAVE] ⏳ Realtime update doesn't match yet, keeping draftElements", {
				rawTemplateElementIds: (rawTemplate.elements ?? []).map(el => el.id),
				pendingSaveElementIds: pendingSave.elements.map(el => el.id),
			});
		}
	}, [templates, contextCurrentTemplateId, state.currentTemplateId, draftElements]);

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
			? Math.max(...existingElements.map(el => {
				// For tables, use preview height (headerHeight + rowHeight)
				if (el.type === "table") {
					return el.y + el.headerHeight + el.rowHeight;
				}
				return el.y + el.height;
			}))
			: 80;
		const yPosition = maxY + 20;
		
		if (elementType === "table") {
			// Add table for items
			// Height is preview height: headerHeight (28) + rowHeight (28) for one preview row
			const headerHeight = 28;
			const rowHeight = 28;
			const tableElement: TemplateElement = {
				id: crypto.randomUUID(),
				type: "table",
				x: 60,
				y: yPosition,
				width: 500,
				height: headerHeight + rowHeight, // Preview height
				rotation: 0,
				zIndex: 1,
				visible: true,
				rowHeight,
				headerHeight,
				stripe: true,
				columns: [
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.description'),
						width: "44%",
						align: "left",
						type: "text",
						binding: "description",
						format: { kind: "none" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.quantity'),
						width: "16%",
						align: "right",
						type: "number",
						binding: "quantity",
						format: { kind: "none" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.price'),
						width: "20%",
						align: "right",
						type: "number",
						binding: "unitPrice",
						format: { kind: "currency", currency: "USD" },
						showTotal: false,
					},
					{
						id: crypto.randomUUID(),
						header: t('designer.tableColumns.total'),
						width: "20%",
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
			draftRef.current = next;
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [tableElement.id] }));
			// Don't save automatically - user will save via properties panel
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
			draftRef.current = next;
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [inputElement.id] }));
			// Don't save automatically - user will save via properties panel
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
			draftRef.current = next;
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [currencyElement.id] }));
			// Don't save automatically - user will save via properties panel
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
			draftRef.current = next;
			setDraftElements(next);
			setState((s) => ({ ...s, selectedElementIds: [textElement.id] }));
			// Don't save automatically - user will save via properties panel
		}
	}

	// Keep refs in sync for stable event handlers
	// Use flushSync to ensure refs are updated synchronously before saves
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



		const saveMutation = useMutation({
			mutationFn: async (partial: Partial<TemplateData>) => {
			debugLog("[SAVE] 🔄 mutationFn called", {
				hasElements: !!partial.elements,
				elementsCount: partial.elements?.length ?? 0,
				hasBrand: !!partial.brand,
				otherFields: Object.keys(partial).filter(k => k !== 'elements' && k !== 'brand'),
			});
			
			// Use refs to get latest values, avoiding stale closures
			const templateId = currentTemplateIdRef.current;
			if (!templateId) {
				debugWarn("[SAVE] ⚠️ mutationFn: No templateId in ref");
				return;
			}
			
			const templates = templatesRef.current;
			const template = templates.find((t: Template) => t.id === templateId);
			if (!template) {
				debugWarn("[SAVE] ⚠️ mutationFn: Template not found", { templateId, templatesCount: templates.length });
				return;
			}
			
			debugLog("[SAVE] mutationFn: Calling templateService.updateDraft", {
				templateId,
				elementsCount: partial.elements?.length ?? 0,
				existingElementsCount: template.elements?.length ?? 0,
			});
			
				// For brand updates, we need to ensure we merge with existing brand data
				// since Firebase Realtime Database update does shallow merge
				if (partial.brand && template.brand) {
				partial = {
					...partial,
					brand: {
						...template.brand,
						...partial.brand,
						// Deep merge watermark if it exists in both
						watermark: partial.brand.watermark
							? {
									...(template.brand.watermark || {}),
									...partial.brand.watermark,
								}
							: template.brand.watermark,
						},
					};
				}

				const nextLayoutModel = partial.layoutModel || template.layoutModel;
				const nextBlocksV2 = partial.blocksV2 ?? template.blocksV2;
				const hasHybridBlocks = nextLayoutModel === "hybrid_v2" && Array.isArray(nextBlocksV2);
				const compileTriggeredBySettings =
					partial.pageSettings != null ||
					partial.theme != null ||
					partial.repeating != null;

				if (hasHybridBlocks && (partial.blocksV2 != null || compileTriggeredBySettings || partial.layoutModel === "hybrid_v2")) {
					const compiled = compileInvoiceBlocksToElements({
						blocks: nextBlocksV2,
						template: {
							pageSettings: partial.pageSettings ?? template.pageSettings,
							theme: partial.theme ?? template.theme,
							repeating: partial.repeating ?? template.repeating,
						},
					});
					partial = {
						...partial,
						layoutModel: "hybrid_v2",
						elements: compiled,
						schemaVersion: 2,
					};
				}
				
				const startTime = Date.now();
				await templateService.updateDraft(templateId, partial);
			const duration = Date.now() - startTime;
			debugLog("[SAVE] ✅ mutationFn: templateService.updateDraft completed", {
				templateId,
				duration,
				elementsCount: partial.elements?.length ?? 0,
			});
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
			debugLog("[SAVE] 🎉 saveMutation.onSuccess called", {
				hasElements: !!partial.elements,
				elementsCount: partial.elements?.length ?? 0,
				hasBrand: !!partial.brand,
				hasOtherFields: Object.keys(partial).filter(k => k !== 'elements' && k !== 'brand').length > 0,
			});
			
			// Mark that we have a pending save - this prevents realtime updates from overwriting
			if (partial.elements) {
				const savedElements = partial.elements; // Store for timeout closure
				const saveTimestamp = Date.now();
				pendingSaveRef.current = {
					elements: savedElements,
					timestamp: saveTimestamp,
				};
				debugLog("[SAVE] ✅ Mutation successful, set pendingSaveRef", {
					elementsCount: savedElements.length,
					elementIds: savedElements.map(el => el.id),
					timestamp: new Date(saveTimestamp).toISOString(),
				});
				
				// Fallback: clear draftElements after 2 seconds if realtime update doesn't arrive
				// This prevents draftElements from staying forever if something goes wrong
				setTimeout(() => {
					const pending = pendingSaveRef.current;
					if (pending) {
						// Check if pending save is still there (realtime update didn't clear it)
						const pendingStr = JSON.stringify(pending.elements);
						const savedStr = JSON.stringify(savedElements);
						const stillMatches = pendingStr === savedStr;
						
						debugLog("[SAVE] ⏰ 2s timeout check", {
							hasPending: !!pending,
							stillMatches,
							pendingElementsCount: pending.elements.length,
							savedElementsCount: savedElements.length,
							timeSinceSave: Date.now() - saveTimestamp,
						});
						
						if (stillMatches) {
							// Realtime update hasn't confirmed our save yet, but clear anyway to prevent stuck state
							debugWarn("[SAVE] ⚠️ Realtime update didn't confirm save within 2s, clearing draftElements", {
								pendingElementsCount: pending.elements.length,
								savedElementsCount: savedElements.length,
								timeSinceSave: Date.now() - saveTimestamp,
								pendingElementIds: pending.elements.map(el => el.id),
								savedElementIds: savedElements.map(el => el.id),
							});
							pendingSaveRef.current = null;
							setDraftElements(null);
						} else {
							// Pending save was updated (different elements), which means a new save happened
							debugLog("[SAVE] ℹ️ Pending save was updated during timeout (new save happened), keeping it", {
								oldCount: savedElements.length,
								newCount: pending.elements.length,
							});
						}
					} else {
						debugLog("[SAVE] ✅ Pending save was already cleared (realtime confirmed)");
					}
				}, 2000);
			}
			
			// Don't invalidate queries - let realtime subscription handle the update
			// This prevents race conditions where invalidation triggers a refetch with stale data
			// queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
			
			// Clear draft brand after successful save (real-time update will handle it)
			setTimeout(() => setDraftBrand(null), 100);

			// Auto-create version when elements are changed
			const templateId = currentTemplateIdRef.current;
			if (partial.elements && templateId && clerkUser?.id && canAutoCreateVersion) {
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
								silent: true,
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
					margins: getDefaultPrintMarginsPx(),
				},
				pageSettings: {
					size: "A4",
					orientation: "portrait",
					margins: getDefaultPrintMarginsPx(),
					marginUnit: DEFAULT_MARGIN_UNIT,
					padding: { top: 0, right: 0, bottom: 0, left: 0 },
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
			debugLog("[CREATE] creating new template for orgId:", orgId);
			const id = await templateService.createDraft(empty);
			debugLog("[CREATE] template created with id:", id);
			return id;
		},
		onSuccess: (id: string) => {
			debugLog("[CREATE] onSuccess called with id:", id);
			setState((s: DesignerState) => ({ ...s, currentTemplateId: id }));
			queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
		},
		onError: (error) => {
			console.error("[CREATE] failed to create template:", error);
		},
	});

		function getPageDimensions(templateData: Template | undefined): { width: number; height: number } {
			const pageSettings = templateData?.pageSettings;
			const sizeKey = pageSettings?.size && pageSettings.size !== "Custom"
				? pageSettings.size
				: (templateData?.pageSize ?? "A4");

			const base = pageSettings?.size === "Custom" && pageSettings.customSize
				? {
					width: pageSettings.customSize.width,
					height: pageSettings.customSize.height,
				}
				: {
					width: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.w ?? PAGE_SIZES_PX.A4.w,
					height: PAGE_SIZES_PX[sizeKey as keyof typeof PAGE_SIZES_PX]?.h ?? PAGE_SIZES_PX.A4.h,
				};

			if (pageSettings?.orientation === "landscape") {
				return { width: base.height, height: base.width };
			}

			return base;
		}
		
		const pageDimensions = getPageDimensions(currentTemplate);
	const PAGE_WIDTH = pageDimensions.width;
	const PAGE_HEIGHT = pageDimensions.height;
	const templateMargins = resolveTemplateMarginsPx(
		currentTemplate?.pageSettings?.margins,
		currentTemplate?.brand?.margins
	);
	const printableBounds = {
		left: templateMargins.left,
		top: templateMargins.top,
		right: Math.max(templateMargins.left, PAGE_WIDTH - templateMargins.right),
		bottom: Math.max(templateMargins.top, PAGE_HEIGHT - templateMargins.bottom),
	};
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
		if (state.snapEnabled === false) {
			return { snappedX: dragX, snappedY: dragY, guides: [] };
		}
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
			otherBounds: { left: number; right: number; top: number; bottom: number };
		} | null = null;
		let bestYSnap: {
			distance: number;
			position: number;
			otherBounds: { left: number; right: number; top: number; bottom: number };
		} | null = null;

		const comparableBounds: Array<{ id: string; left: number; right: number; top: number; bottom: number }> = [
			...allElements
				.filter((el) => el.id !== draggingElement.id)
				.map((el) => ({
					id: el.id,
					left: el.x,
					right: el.x + el.width,
					top: el.y,
					bottom: el.y + el.height,
				})),
			{
				id: "__printable__",
				left: printableBounds.left,
				right: printableBounds.right,
				top: printableBounds.top,
				bottom: printableBounds.bottom,
			},
			{
				id: "__center__",
				left: (printableBounds.left + printableBounds.right) / 2,
				right: (printableBounds.left + printableBounds.right) / 2,
				top: (printableBounds.top + printableBounds.bottom) / 2,
				bottom: (printableBounds.top + printableBounds.bottom) / 2,
			},
		];

		// Check against all other elements + printable bounds + center guides
		for (const target of comparableBounds) {
			const elLeft = target.left;
			const elRight = target.right;
			const elTop = target.top;
			const elBottom = target.bottom;
			const elCenterX = (elLeft + elRight) / 2;
			const elCenterY = (elTop + elBottom) / 2;

			// Check vertical alignments (X axis)
			const xAlignments = [
				{ dragPos: dragLeft, elPos: elLeft },
				{ dragPos: dragLeft, elPos: elRight },
				{ dragPos: dragRight, elPos: elLeft },
				{ dragPos: dragRight, elPos: elRight },
				{ dragPos: dragCenterX, elPos: elCenterX },
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
						otherBounds: {
							left: elLeft,
							right: elRight,
							top: elTop,
							bottom: elBottom,
						},
					};
				}
			}

			// Check horizontal alignments (Y axis)
			const yAlignments = [
				{ dragPos: dragTop, elPos: elTop },
				{ dragPos: dragTop, elPos: elBottom },
				{ dragPos: dragBottom, elPos: elTop },
				{ dragPos: dragBottom, elPos: elBottom },
				{ dragPos: dragCenterY, elPos: elCenterY },
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
						otherBounds: {
							left: elLeft,
							right: elRight,
							top: elTop,
							bottom: elBottom,
						},
					};
				}
			}
		}

		// Apply snapping
		if (bestXSnap) {
			snappedX = bestXSnap.position;
			const snappedCenterX = snappedX + draggingElement.width / 2;
			const otherCenterX = (bestXSnap.otherBounds.left + bestXSnap.otherBounds.right) / 2;

			// Determine guide position based on alignment type
			let guideX = snappedX;
			if (Math.abs(snappedCenterX - otherCenterX) < 1) {
				guideX = snappedCenterX;
			} else if (
				Math.abs(
					snappedX +
						draggingElement.width -
						bestXSnap.otherBounds.right
				) < 1
			) {
				guideX = snappedX + draggingElement.width;
			}

			guides.push({
				type: "vertical",
				position: guideX,
				start: Math.min(dragY, bestXSnap.otherBounds.top),
				end: Math.max(
					dragY + draggingElement.height,
					bestXSnap.otherBounds.bottom
				),
				kind: "snap",
			});
		}

		if (bestYSnap) {
			snappedY = bestYSnap.position;
			const snappedCenterY = snappedY + draggingElement.height / 2;
			const otherCenterY = (bestYSnap.otherBounds.top + bestYSnap.otherBounds.bottom) / 2;

			// Determine guide position based on alignment type
			let guideY = snappedY;
			if (Math.abs(snappedCenterY - otherCenterY) < 1) {
				guideY = snappedCenterY;
			} else if (
				Math.abs(
					snappedY +
						draggingElement.height -
						bestYSnap.otherBounds.bottom
				) < 1
			) {
				guideY = snappedY + draggingElement.height;
			}

			guides.push({
				type: "horizontal",
				position: guideY,
				start: Math.min(
					dragX,
					bestXSnap?.otherBounds.left ?? bestYSnap.otherBounds.left
				),
				end: Math.max(
					dragX + draggingElement.width,
					bestXSnap?.otherBounds
						? bestXSnap.otherBounds.right
						: bestYSnap.otherBounds.right
				),
				kind: "snap",
			});
		}

		return { snappedX, snappedY, guides };
	}

		function clampMove(x: number, y: number, width: number, height: number) {
			const minX = printableBounds.left;
			const minY = printableBounds.top;
			const maxX = Math.max(minX, printableBounds.right - width);
			const maxY = Math.max(minY, printableBounds.bottom - height);
			return {
				x: Math.min(Math.max(minX, x), maxX),
				y: Math.min(Math.max(minY, y), maxY),
			};
		}

		function clampResize(x: number, y: number, width: number, height: number) {
			const minW = 8;
			const minH = 8;
			let nextX = x;
			let nextY = y;
			let nextW = Math.max(minW, width);
			let nextH = Math.max(minH, height);
			if (nextX < printableBounds.left) {
				nextW = Math.max(minW, nextW + (nextX - printableBounds.left));
				nextX = printableBounds.left;
			}
			if (nextY < printableBounds.top) {
				nextH = Math.max(minH, nextH + (nextY - printableBounds.top));
				nextY = printableBounds.top;
			}
			if (nextX + nextW > printableBounds.right) {
				nextW = Math.max(minW, printableBounds.right - nextX);
			}
			if (nextY + nextH > printableBounds.bottom) {
				nextH = Math.max(minH, printableBounds.bottom - nextY);
			}
			return { x: nextX, y: nextY, width: nextW, height: nextH };
		}

	const HISTORY_LIMIT = 100;

	function getWorkingElements(): TemplateElement[] {
		return draftRef.current ?? currentTemplateRef.current?.elements ?? [];
	}

	function cloneElements(elements: TemplateElement[]): TemplateElement[] {
		return elements.map((el) => ({ ...el }));
	}

	type PathElement = Extract<TemplateElement, { type: "path" }>;
	type PathSubpath = NonNullable<PathElement["subpaths"]>[number];
	type PathNode = PathSubpath["nodes"][number];

	type PathPoint = { x: number; y: number };

	function resolveHandleType(node: PathNode): "corner" | "smooth" | "symmetric" {
		if ("handleType" in node && node.handleType) return node.handleType;
		if ("type" in node && node.type) return node.type;
		return "corner";
	}

	function computeRoundedCorner(
		prev: PathNode | undefined,
		current: PathNode,
		next: PathNode | undefined
	): { entry: PathPoint; exit: PathPoint; c1: PathPoint; c2: PathPoint } | null {
		const radius = Math.max(0, current.cornerRadius ?? 0);
		if (!prev || !next || radius === 0) return null;
		if (current.handleIn || current.handleOut) return null;
		const inVec = { x: prev.x - current.x, y: prev.y - current.y };
		const outVec = { x: next.x - current.x, y: next.y - current.y };
		const inLen = Math.hypot(inVec.x, inVec.y);
		const outLen = Math.hypot(outVec.x, outVec.y);
		if (inLen === 0 || outLen === 0) return null;
		const inUnit = { x: inVec.x / inLen, y: inVec.y / inLen };
		const outUnit = { x: outVec.x / outLen, y: outVec.y / outLen };
		const dot = Math.max(-1, Math.min(1, inUnit.x * outUnit.x + inUnit.y * outUnit.y));
		const angle = Math.acos(dot);
		if (!Number.isFinite(angle) || angle === 0) return null;
		const tangent = Math.tan(angle / 2);
		if (!Number.isFinite(tangent) || tangent === 0) return null;
		const offset = Math.min(radius * tangent, inLen * 0.5, outLen * 0.5);
		const effectiveRadius = offset / tangent;
		const entry = { x: current.x + inUnit.x * offset, y: current.y + inUnit.y * offset };
		const exit = { x: current.x + outUnit.x * offset, y: current.y + outUnit.y * offset };
		const k = (4 / 3) * Math.tan(angle / 4);
		const controlDist = k * effectiveRadius;
		const c1 = { x: entry.x - inUnit.x * controlDist, y: entry.y - inUnit.y * controlDist };
		const c2 = { x: exit.x - outUnit.x * controlDist, y: exit.y - outUnit.y * controlDist };
		return { entry, exit, c1, c2 };
	}

	function buildPathDataFromSubpaths(subpaths: NonNullable<PathElement["subpaths"]>): string {
		return subpaths
			.map((subpath) => {
				const nodes = subpath.nodes;
				if (nodes.length === 0) return "";
				const isClosed = subpath.closed && nodes.length > 2;
				const roundedById = new Map<string, { entry: PathPoint; exit: PathPoint; c1: PathPoint; c2: PathPoint }>();
				nodes.forEach((node, index) => {
					const prev = isClosed
						? nodes[(index - 1 + nodes.length) % nodes.length]
						: index > 0
							? nodes[index - 1]
							: undefined;
					const next = isClosed
						? nodes[(index + 1) % nodes.length]
						: index < nodes.length - 1
							? nodes[index + 1]
							: undefined;
					const rounded = computeRoundedCorner(prev, node, next);
					if (rounded) roundedById.set(node.id, rounded);
				});
				const segments: string[] = [];
				const start = nodes[0];
				const startRound = roundedById.get(start.id);
				const startPoint = startRound ? startRound.entry : { x: start.x, y: start.y };
				segments.push(`M ${startPoint.x} ${startPoint.y}`);
				if (startRound && !isClosed) {
					segments.push(`C ${startRound.c1.x} ${startRound.c1.y} ${startRound.c2.x} ${startRound.c2.y} ${startRound.exit.x} ${startRound.exit.y}`);
				}
				let startRoundHandled = Boolean(startRound && !isClosed);
				for (let i = 0; i < nodes.length; i += 1) {
					if (!isClosed && i === nodes.length - 1) break;
					const current = nodes[i];
					const next = nodes[(i + 1) % nodes.length];
					const currentRound = roundedById.get(current.id);
					const nextRound = roundedById.get(next.id);
					const endPoint = nextRound ? nextRound.entry : { x: next.x, y: next.y };
					const hasHandles = !currentRound && !nextRound && (current.handleOut || next.handleIn);
					if (hasHandles) {
						const h1 = current.handleOut
							? { x: current.x + current.handleOut.x, y: current.y + current.handleOut.y }
							: { x: current.x, y: current.y };
						const h2 = next.handleIn
							? { x: next.x + next.handleIn.x, y: next.y + next.handleIn.y }
							: { x: next.x, y: next.y };
						segments.push(`C ${h1.x} ${h1.y} ${h2.x} ${h2.y} ${endPoint.x} ${endPoint.y}`);
					} else {
						segments.push(`L ${endPoint.x} ${endPoint.y}`);
					}
					if (nextRound) {
						if (!(isClosed && next.id === start.id && startRoundHandled)) {
							segments.push(`C ${nextRound.c1.x} ${nextRound.c1.y} ${nextRound.c2.x} ${nextRound.c2.y} ${nextRound.exit.x} ${nextRound.exit.y}`);
							if (isClosed && next.id === start.id) startRoundHandled = true;
						}
					}
				}
				if (isClosed) segments.push("Z");
				return segments.join(" ");
			})
			.filter((segment) => segment.length > 0)
			.join(" ");
	}

	function clonePathSubpaths(subpaths: NonNullable<PathElement["subpaths"]>): NonNullable<PathElement["subpaths"]> {
		return subpaths.map((subpath) => ({
			...subpath,
			nodes: subpath.nodes.map((node) => ({
				...node,
				handleIn: node.handleIn ? { ...node.handleIn } : node.handleIn,
				handleOut: node.handleOut ? { ...node.handleOut } : node.handleOut,
			})),
		}));
	}

	function createDefaultPathSubpaths(width: number, height: number): NonNullable<PathElement["subpaths"]> {
		const w = Math.max(40, width);
		const h = Math.max(40, height);
		return [
			{
				id: crypto.randomUUID(),
				closed: false,
				nodes: [
					{ id: crypto.randomUUID(), x: 0, y: h * 0.5, type: "corner", handleType: "corner", cornerRadius: 0 },
					{ id: crypto.randomUUID(), x: w * 0.33, y: h * 0.2, type: "corner", handleType: "corner", cornerRadius: 0 },
					{ id: crypto.randomUUID(), x: w * 0.66, y: h * 0.8, type: "corner", handleType: "corner", cornerRadius: 0 },
					{ id: crypto.randomUUID(), x: w, y: h * 0.5, type: "corner", handleType: "corner", cornerRadius: 0 },
				],
			},
		];
	}

	function clampPathPoint(x: number, y: number, width: number, height: number): { x: number; y: number } {
		return {
			x: Math.max(0, Math.min(width, x)),
			y: Math.max(0, Math.min(height, y)),
		};
	}

	function getCommandBounds(): Bounds {
		return {
			left: printableBounds.left,
			top: printableBounds.top,
			right: printableBounds.right,
			bottom: printableBounds.bottom,
		};
	}

	function queueCommandSave() {
		if (commandSaveTimerRef.current) {
			clearTimeout(commandSaveTimerRef.current);
		}
		commandSaveTimerRef.current = setTimeout(() => {
			const latest = draftRef.current;
			if (latest && latest.length >= 0) {
				saveMutation.mutate({ elements: latest });
			}
			commandSaveTimerRef.current = null;
		}, 140);
	}

	function createHistoryEntry(elements: TemplateElement[]) {
		return {
			elements: cloneElements(elements),
			selectedElementIds: [...(selectedElementIdsRef.current ?? [])],
			showGrid: state.showGrid !== false,
			snapEnabled: state.snapEnabled !== false,
			editingTextElementId: state.editingTextElementId,
		};
	}

	function pushUndoHistory(sourceElements?: TemplateElement[]) {
		const elements = sourceElements ?? getWorkingElements();
		const entry = createHistoryEntry(elements);
		undoStackRef.current = [...undoStackRef.current, entry].slice(-HISTORY_LIMIT);
		redoStackRef.current = [];
	}

	function applyHistoryEntry(entry: {
		elements: TemplateElement[];
		selectedElementIds: string[];
		showGrid: boolean;
		snapEnabled: boolean;
		editingTextElementId?: string;
	}) {
		const nextElements = cloneElements(entry.elements);
		draftRef.current = nextElements;
		setDraftElements(nextElements);
		selectedElementIdsRef.current = [...entry.selectedElementIds];
		setState((s) => ({
			...s,
			selectedElementIds: [...entry.selectedElementIds],
			showGrid: entry.showGrid,
			snapEnabled: entry.snapEnabled,
			editingTextElementId: entry.editingTextElementId,
			selectedPathNodeId: undefined,
			selectedPathSubpathId: undefined,
		}));
	}

	function undo() {
		const undoStack = undoStackRef.current;
		if (undoStack.length === 0) return;
		const current = createHistoryEntry(getWorkingElements());
		const previous = undoStack[undoStack.length - 1];
		undoStackRef.current = undoStack.slice(0, -1);
		redoStackRef.current = [...redoStackRef.current, current].slice(-HISTORY_LIMIT);
		applyHistoryEntry(previous);
		queueCommandSave();
	}

	function redo() {
		const redoStack = redoStackRef.current;
		if (redoStack.length === 0) return;
		const current = createHistoryEntry(getWorkingElements());
		const next = redoStack[redoStack.length - 1];
		redoStackRef.current = redoStack.slice(0, -1);
		undoStackRef.current = [...undoStackRef.current, current].slice(-HISTORY_LIMIT);
		applyHistoryEntry(next);
		queueCommandSave();
	}

	function applyCommandResult(options: {
		nextElements: TemplateElement[];
		nextSelectedIds?: string[];
		pushHistory?: boolean;
		save?: boolean;
		clearEditing?: boolean;
	}) {
		const {
			nextElements,
			nextSelectedIds,
			pushHistory = true,
			save = true,
			clearEditing = false,
		} = options;
		const currentElements = getWorkingElements();
		if (pushHistory) {
			pushUndoHistory(currentElements);
		}
		draftRef.current = nextElements;
		setDraftElements(nextElements);
		if (nextSelectedIds) {
			selectedElementIdsRef.current = [...nextSelectedIds];
		}
		setState((s) => ({
			...s,
			selectedElementIds: nextSelectedIds ?? s.selectedElementIds ?? [],
			editingTextElementId: clearEditing ? undefined : s.editingTextElementId,
		}));
		if (save) queueCommandSave();
	}

	function deleteSelectedElements() {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		if (selectedIds.length === 0) return;
		const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
		const requiredSelected = selectedElements.filter((el) => {
			const binding =
				el.type === "text" || el.type === "input" || el.type === "image" || el.type === "currency"
					? el.binding
					: el.type === "table"
						? el.itemsBinding
						: undefined;
			return isRequired(binding);
		});
		if (requiredSelected.length > 0) {
			toast.warning(t("designer.toast.requiredDeleteWarning", "Deleted required compliance fields. Template marked as non-compliant."));
		}
		const { elements: nextElements, removedIds } = deleteSelection(elements, selectedIds);
		if (removedIds.length === 0) return;
		applyCommandResult({
			nextElements,
			nextSelectedIds: [],
			clearEditing: true,
		});
	}

	function duplicateSelectedElements(offsetX = 20, offsetY = 20) {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		const { elements: nextElements, newIds } = duplicateSelection(
			elements,
			selectedIds,
			getCommandBounds(),
			{ offsetX, offsetY, clearBindings: true }
		);
		if (newIds.length === 0) return;
		applyCommandResult({
			nextElements,
			nextSelectedIds: newIds,
			clearEditing: true,
		});
	}

	function alignSelected(mode: AlignMode) {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		const nextElements = alignSelection(elements, selectedIds, mode);
		applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
	}

	function reorderSelectedLayer(mode: "forward" | "backward" | "front" | "back") {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		const nextElements = reorderSelectionLayer(elements, selectedIds, mode);
		applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
	}

	function lockSelection(locked: boolean) {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		if (selectedIds.length === 0) return;
		const nextElements = setLockSelection(elements, selectedIds, locked);
		applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
	}

	function groupSelected() {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		const { elements: nextElements } = groupSelection(elements, selectedIds);
		applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
	}

	function ungroupSelected() {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		const nextElements = ungroupSelection(elements, selectedIds);
		applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
	}

	function copySelectedToClipboard() {
		const elements = getWorkingElements();
		const selectedIds = selectedElementIdsRef.current ?? [];
		clipboardRef.current = createClipboardPayload(elements, selectedIds);
	}

	function pasteFromClipboard(target?: { x: number; y: number } | null) {
		const clipboard = clipboardRef.current;
		if (!clipboard) return;
		const elements = getWorkingElements();
		const { elements: nextElements, newIds } = pasteClipboard(
			elements,
			clipboard,
			getCommandBounds(),
			{
				target: target ?? lastCursorCanvasPointRef.current,
				offsetX: 20,
				offsetY: 20,
				clearBindings: true,
			}
		);
		if (newIds.length === 0) return;
		applyCommandResult({ nextElements, nextSelectedIds: newIds, clearEditing: true });
	}

	function handleCanvasDragOver(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		debugLog("[DND] canvas dragover", {
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
		debugLog("[DND] canvas drop", {
			raw,
			type,
			target: (e.target as HTMLElement)?.className,
			currentTarget: (e.currentTarget as HTMLElement)?.className,
		});
		if (!type) return;
		if (!currentTemplate) {
			debugLog(
				"[DND] no current template; creating one before drop..."
			);
			try {
				// Try to ensure authentication for better security, but don't block if it fails
				if (!firebase.auth.currentUser) {
					try {
						debugLog("[AUTH] attempting anonymous sign-in...");
						await signInAnonymously(firebase.auth);
						debugLog("[AUTH] signed in anonymously");
					} catch (authErr) {
						debugWarn(
							"[AUTH] anonymous sign-in failed, continuing without auth:",
							authErr
						);
						// Continue without auth for development/demo purposes
					}
				}
				debugLog("[DND] calling createMutation.mutateAsync...");
				const newId = await (
					createMutation as unknown as {
						mutateAsync: () => Promise<string | undefined>;
					}
				).mutateAsync();
				debugLog("[DND] mutateAsync returned:", newId);
				if (newId && typeof newId === "string") {
					setState((s: DesignerState) => ({
						...s,
						currentTemplateId: newId,
					}));
					debugLog("[DND] set currentTemplateId to", newId);
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
		debugLog("[DND] page rect", rect);
		if (!rect) return;
			const x = (e.clientX - rect.left) / state.zoom;
			const y = (e.clientY - rect.top) / state.zoom;
			debugLog("[DND] computed drop coords", { x, y, zoom: state.zoom });
			addElement(type, {
				x: Math.max(printableBounds.left, Math.min(Math.round(x), printableBounds.right - 1)),
				y: Math.max(printableBounds.top, Math.min(Math.round(y), printableBounds.bottom - 1)),
			});
		}

	function addElement(
		kind: TemplateElement["type"],
		at?: { x: number; y: number }
	) {
		if (!currentTemplate) return;
		debugLog("[ADD] addElement called", {
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
								height: 56, // Preview height: headerHeight (28) + rowHeight (28) for one preview row
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
										width: "50%",
										align: "left",
										type: "text",
										format: { kind: "none" },
										showTotal: false,
									},
									{
										id: crypto.randomUUID(),
										header: t('designer.tableColumns.column2'),
										width: "50%",
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
									: kind === "icon"
										? {
												id: crypto.randomUUID(),
												type: "icon",
											x: at?.x ?? 60,
											y: at?.y ?? 80,
											width: 32,
											height: 32,
											rotation: 0,
											zIndex: 1,
												visible: true,
												iconName: "file-text",
												color: "#111827",
											}
									: kind === "spacer"
										? {
												id: crypto.randomUUID(),
												type: "spacer",
												x: at?.x ?? 40,
												y: at?.y ?? 140,
												width: 320,
												height: 24,
												rotation: 0,
												zIndex: 0,
												visible: true,
												showDivider: false,
												dividerStyle: "solid",
												dividerColor: "#d1d5db",
												dividerWidth: 1,
											}
									: kind === "pageBreak"
										? {
												id: crypto.randomUUID(),
												type: "pageBreak",
												x: at?.x ?? 40,
												y: at?.y ?? 520,
												width: PAGE_WIDTH - 80,
												height: 24,
												rotation: 0,
												zIndex: 0,
												visible: true,
												breakType: "always",
												showInEditor: true,
												style: "dashed",
											}
									: kind === "qrCode"
										? {
												id: crypto.randomUUID(),
												type: "qrCode",
												x: at?.x ?? 60,
												y: at?.y ?? 80,
												width: 120,
												height: 120,
												rotation: 0,
												zIndex: 1,
												visible: true,
												content: "",
												binding: defaultBinding,
												dataType: "text",
												foregroundColor: "#111827",
												backgroundColor: "#ffffff",
												errorCorrection: "medium",
												margin: 2,
											}
									: kind === "barcode"
										? {
												id: crypto.randomUUID(),
												type: "barcode",
												x: at?.x ?? 60,
												y: at?.y ?? 80,
												width: 260,
												height: 80,
												rotation: 0,
												zIndex: 1,
												visible: true,
												value: "",
												binding: defaultBinding,
												format: "CODE128",
												color: "#111827",
												backgroundColor: "#ffffff",
												showText: true,
												textPosition: "bottom",
											}
									: kind === "signature"
										? {
												id: crypto.randomUUID(),
												type: "signature",
												x: at?.x ?? 60,
												y: at?.y ?? 80,
												width: 240,
												height: 80,
												rotation: 0,
												zIndex: 1,
												visible: true,
												signatureType: "placeholder",
												placeholderText: "Signature",
												showDate: false,
											}
									: kind === "stamp"
										? {
												id: crypto.randomUUID(),
												type: "stamp",
												x: at?.x ?? 60,
												y: at?.y ?? 80,
												width: 160,
												height: 80,
												rotation: -12,
												zIndex: 1,
												visible: true,
												text: "PAID",
												stampType: "paid",
												shape: "rectangle",
												size: 120,
												fontFamily: "Inter",
												fontSize: 24,
												fontWeight: "bold",
												textColor: "#991b1b",
												backgroundColor: "#fee2e2",
												opacity: 0.85,
												effect: "stamped",
												pattern: "diagonal-lines",
											}
									: kind === "path"
										? (() => {
												const defaultSubpaths = createDefaultPathSubpaths(200, 150);
												return {
													id: crypto.randomUUID(),
													type: "path",
													x: at?.x ?? 60,
													y: at?.y ?? 80,
													width: 200,
													height: 150,
													rotation: 0,
													zIndex: 1,
													visible: true,
													subpaths: defaultSubpaths,
													pathData: buildPathDataFromSubpaths(defaultSubpaths),
													fill: "#3b82f6",
													opacity: 0.8,
													strokeWidth: 0,
													fillRule: "nonzero",
													scaleStroke: false,
												};
											})()
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
			debugLog("[ADD] new element", newElement);
			const maxPrintableWidth = Math.max(8, printableBounds.right - printableBounds.left);
			const maxPrintableHeight = Math.max(8, printableBounds.bottom - printableBounds.top);
			const boundedSizeElement = {
				...newElement,
				width: Math.min(newElement.width, maxPrintableWidth),
				height: Math.min(newElement.height, maxPrintableHeight),
			} as TemplateElement;
			// Clamp initial position so element appears fully in frame
			const clampedAt = clampMove(
				boundedSizeElement.x,
				boundedSizeElement.y,
				boundedSizeElement.width,
				boundedSizeElement.height
			);
			const nextElement = {
				...boundedSizeElement,
				x: clampedAt.x,
				y: clampedAt.y,
			} as TemplateElement;
		const next = [...(currentTemplate?.elements ?? []), nextElement];
		debugLog("[ADD] next elements length", next.length);
		// optimistic UI update so drop shows immediately
		draftRef.current = next;
		setDraftElements(next);
		setState((s: DesignerState) => ({
			...s,
			selectedElementIds: [nextElement.id],
		}));
		// Don't save automatically - user will save via properties panel
	}

	// Helper function to handle multi-select with Shift+click
	const handleSelectElement = (elementId: string, event?: React.MouseEvent | React.PointerEvent) => {
		if (!elementId) {
			selectedElementIdsRef.current = [];
			setState((s) => ({
				...s,
				selectedElementIds: [],
				editingTextElementId: undefined,
				selectedPathNodeId: undefined,
				selectedPathSubpathId: undefined,
			}));
			return;
		}
		const isShiftPressed = Boolean(event?.shiftKey);
		const isMetaToggle = Boolean(event?.metaKey || event?.ctrlKey);
		const isToggleSelection = isShiftPressed || isMetaToggle;
		const currentSelected = state.selectedElementIds || [];
		
		if (isToggleSelection) {
			// Toggle selection: add if not selected, remove if already selected
			if (currentSelected.includes(elementId)) {
				const newSelected = currentSelected.filter((id) => id !== elementId);
				debugLog('[SELECT] Removing from selection:', newSelected);
				selectedElementIdsRef.current = newSelected;
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
					selectedPathNodeId: newSelected.includes(s.editingPathElementId ?? "") ? s.selectedPathNodeId : undefined,
					selectedPathSubpathId: newSelected.includes(s.editingPathElementId ?? "") ? s.selectedPathSubpathId : undefined,
				}));
			} else {
				const newSelected = [...currentSelected, elementId];
				debugLog('[SELECT] Adding to selection:', newSelected);
				selectedElementIdsRef.current = newSelected;
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
					selectedPathNodeId: s.editingPathElementId === elementId ? s.selectedPathNodeId : undefined,
					selectedPathSubpathId: s.editingPathElementId === elementId ? s.selectedPathSubpathId : undefined,
				}));
			}
		} else {
			// Single select: replace selection
			debugLog('[SELECT] Single select:', [elementId]);
			selectedElementIdsRef.current = [elementId];
			setState((s) => ({
				...s,
				selectedElementIds: [elementId],
				selectedPathNodeId: s.editingPathElementId === elementId ? s.selectedPathNodeId : undefined,
				selectedPathSubpathId: s.editingPathElementId === elementId ? s.selectedPathSubpathId : undefined,
			}));
		}
	};

	function updateSelected(partial: Partial<TemplateElement>) {
		// Use ref to get latest selection state (avoids stale closures)
		const selectedIds = selectedElementIdsRef.current.length > 0 
			? selectedElementIdsRef.current 
			: state.selectedElementIds || [];
		
		debugLog("[SAVE] updateSelected called", {
			selectedIds,
			partial,
			hasCurrentTemplate: !!currentTemplate,
			hasDraftElements: !!draftElements,
			draftElementsCount: draftElements?.length ?? 0,
			currentTemplateElementsCount: currentTemplate?.elements?.length ?? 0,
		});
		
		if (!currentTemplate) {
			debugWarn("[SAVE] updateSelected called but no currentTemplate");
			return;
		}
		
		if (selectedIds.length === 0) {
			debugWarn("[SAVE] updateSelected called but no elements selected", {
				refIds: selectedElementIdsRef.current,
				stateIds: state.selectedElementIds,
			});
			return;
		}
		
		// Use draftElements if available, otherwise use currentTemplate.elements
		const currentElements = draftElements ?? currentTemplate.elements ?? [];
		debugLog("[SAVE] Updating elements", {
			usingDraftElements: !!draftElements,
			currentElementsCount: currentElements.length,
			selectedIds,
		});
		
		const next = currentElements.map(
			(el: TemplateElement) =>
				selectedIds.includes(el.id)
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
							const updated = {
								...merged,
								x: clamped.x,
								y: clamped.y,
							} as TemplateElement;
							debugLog(`[SAVE] Updated element ${el.id}`, {
								before: { x: el.x, y: el.y, width: el.width, height: el.height },
								after: { x: updated.x, y: updated.y, width: updated.width, height: updated.height },
							});
							return updated;
						})()
					: el
		);
		// Update ref synchronously
		draftRef.current = next;
		setDraftElements(next);
		debugLog("[SAVE] Set draftElements", {
			count: next.length,
			elementIds: next.map(el => el.id),
		});
		
		// Debounce saves per selected element - each input saves individually after 50ms of no changes
		selectedIds.forEach((elementId) => {
			// Clear existing timer for this element
			const existingTimer = elementSaveTimersRef.current.get(elementId);
			if (existingTimer) {
				debugLog(`[SAVE] Clearing existing timer for element ${elementId}`);
				clearTimeout(existingTimer);
			}
			
			// Set new timer for this element
			const timer = setTimeout(() => {
				// Get the latest elements at save time (in case multiple properties changed)
				const latestElements = draftRef.current;
				if (!latestElements || latestElements.length === 0) {
					debugWarn(`[SAVE] No elements to save for element ${elementId}`, {
						draftRef: !!draftRef.current,
						draftRefLength: draftRef.current?.length,
					});
					elementSaveTimersRef.current.delete(elementId);
					return;
				}
				
				// Verify the element still exists
				const elementToSave = latestElements.find((el) => el.id === elementId);
				if (!elementToSave) {
					debugWarn(`[SAVE] Element ${elementId} not found in latestElements`);
					elementSaveTimersRef.current.delete(elementId);
					return;
				}
				
				debugLog(`[SAVE] ⚡ Triggering saveMutation for element ${elementId}`, {
					totalElements: latestElements.length,
					elementToSave: {
						id: elementToSave.id,
						x: elementToSave.x,
						y: elementToSave.y,
						width: elementToSave.width,
						height: elementToSave.height,
					},
				});
				saveMutation.mutate({ elements: latestElements });
				elementSaveTimersRef.current.delete(elementId);
			}, 50); // 50ms debounce per input
			
			debugLog(`[SAVE] Set 50ms debounce timer for element ${elementId}`);
			elementSaveTimersRef.current.set(elementId, timer);
		});
	}

	function setPathEditMode(elementId: string, enabled: boolean) {
		const pathElement = getWorkingElements().find(
			(el) => el.id === elementId && el.type === "path"
		) as PathElement | undefined;
		const firstSubpathId = pathElement?.subpaths?.[0]?.id;
		setState((s) => {
			const keepSubpath =
				enabled &&
				s.selectedPathSubpathId &&
				Boolean(pathElement?.subpaths?.some((subpath) => subpath.id === s.selectedPathSubpathId))
					? s.selectedPathSubpathId
					: firstSubpathId;
			return {
				...s,
				editingPathElementId: enabled ? elementId : undefined,
				activeTool: enabled ? s.activeTool ?? "select" : "select",
				selectedPathNodeId: undefined,
				selectedPathSubpathId: enabled ? keepSubpath : undefined,
			};
		});
	}

	function setPathTool(tool: "select" | "pen") {
		setState((s) => ({ ...s, activeTool: tool }));
	}

	function ensurePathSubpaths(pathEl: PathElement): NonNullable<PathElement["subpaths"]> {
		const source = pathEl.subpaths && pathEl.subpaths.length > 0
			? pathEl.subpaths
			: createDefaultPathSubpaths(pathEl.width, pathEl.height);
		return clonePathSubpaths(source);
	}

	function normalizeVector(vector: { x: number; y: number } | null | undefined): { x: number; y: number } {
		if (!vector) return { x: 1, y: 0 };
		const length = Math.hypot(vector.x, vector.y);
		if (length === 0) return { x: 1, y: 0 };
		return { x: vector.x / length, y: vector.y / length };
	}

	function getNodeTangentDirection(subpath: PathSubpath, index: number): { x: number; y: number } {
		const nodes = subpath.nodes;
		const node = nodes[index];
		const isClosed = subpath.closed && nodes.length > 2;
		const prev = isClosed
			? nodes[(index - 1 + nodes.length) % nodes.length]
			: index > 0
				? nodes[index - 1]
				: undefined;
		const next = isClosed
			? nodes[(index + 1) % nodes.length]
			: index < nodes.length - 1
				? nodes[index + 1]
				: undefined;
		if (prev && next) {
			return normalizeVector({ x: next.x - prev.x, y: next.y - prev.y });
		}
		if (next) {
			return normalizeVector({ x: next.x - node.x, y: next.y - node.y });
		}
		if (prev) {
			return normalizeVector({ x: node.x - prev.x, y: node.y - prev.y });
		}
		return { x: 1, y: 0 };
	}

	function convertNodeHandleType(
		node: PathNode,
		type: "corner" | "smooth" | "symmetric",
		direction: { x: number; y: number }
	): PathNode {
		const handleIn = node.handleIn ? { ...node.handleIn } : null;
		const handleOut = node.handleOut ? { ...node.handleOut } : null;
		const defaultLength = 28;
		if (type === "corner") {
			return { ...node, type, handleType: type, handleIn, handleOut };
		}
		let baseDirection = direction;
		if (handleOut && Math.hypot(handleOut.x, handleOut.y) > 0) {
			baseDirection = normalizeVector(handleOut);
		} else if (handleIn && Math.hypot(handleIn.x, handleIn.y) > 0) {
			baseDirection = normalizeVector({ x: -handleIn.x, y: -handleIn.y });
		}
		const inLength = handleIn ? Math.max(1, Math.hypot(handleIn.x, handleIn.y)) : defaultLength;
		const outLength = handleOut ? Math.max(1, Math.hypot(handleOut.x, handleOut.y)) : defaultLength;
		if (type === "smooth") {
			return {
				...node,
				type: "smooth",
				handleType: "smooth",
				handleIn: { x: -baseDirection.x * inLength, y: -baseDirection.y * inLength },
				handleOut: { x: baseDirection.x * outLength, y: baseDirection.y * outLength },
			};
		}
		const symmetricLength = Math.max(defaultLength, inLength, outLength);
		return {
			...node,
			type: "symmetric",
			handleType: "symmetric",
			handleIn: { x: -baseDirection.x * symmetricLength, y: -baseDirection.y * symmetricLength },
			handleOut: { x: baseDirection.x * symmetricLength, y: baseDirection.y * symmetricLength },
		};
	}

	type PathMutationResult = {
		subpaths: NonNullable<PathElement["subpaths"]>;
		selectedNodeId?: string | null;
		selectedSubpathId?: string | null;
	};

	function commitPathMutation(
		elementId: string,
		mutate: (pathEl: PathElement, subpaths: NonNullable<PathElement["subpaths"]>) => PathMutationResult | null
	) {
		const elements = getWorkingElements();
		let nextSelectionNodeId: string | null | undefined;
		let nextSelectionSubpathId: string | null | undefined;
		let updated = false;
		const nextElements = elements.map((el) => {
			if (el.id !== elementId || el.type !== "path") return el;
			const pathEl = el as PathElement;
			const subpaths = ensurePathSubpaths(pathEl);
			const result = mutate(pathEl, subpaths);
			if (!result) return pathEl;
			updated = true;
			nextSelectionNodeId = result.selectedNodeId;
			nextSelectionSubpathId = result.selectedSubpathId;
			return {
				...pathEl,
				subpaths: result.subpaths,
				pathData: buildPathDataFromSubpaths(result.subpaths),
			};
		});
		if (!updated) return;
		applyCommandResult({ nextElements, nextSelectedIds: [elementId], clearEditing: false });
		setState((s) => ({
			...s,
			selectedPathNodeId: nextSelectionNodeId === undefined ? s.selectedPathNodeId : nextSelectionNodeId ?? undefined,
			selectedPathSubpathId:
				nextSelectionSubpathId === undefined ? s.selectedPathSubpathId : nextSelectionSubpathId ?? undefined,
		}));
	}

	function handleSelectPathNode(options: { elementId: string; subpathId: string; nodeId: string }) {
		selectedElementIdsRef.current = [options.elementId];
		setState((s) => ({
			...s,
			selectedElementIds: [options.elementId],
			selectedPathNodeId: options.nodeId,
			selectedPathSubpathId: options.subpathId,
		}));
	}

	function handleCreatePathSubpath(elementId: string) {
		commitPathMutation(elementId, (pathEl, subpaths) => {
			const start = clampPathPoint(pathEl.width * 0.25, pathEl.height * 0.5, pathEl.width, pathEl.height);
			const end = clampPathPoint(start.x + Math.min(70, Math.max(30, pathEl.width * 0.2)), start.y, pathEl.width, pathEl.height);
			const firstNodeId = crypto.randomUUID();
			const secondNodeId = crypto.randomUUID();
			const newSubpathId = crypto.randomUUID();
			const nextSubpaths = [
				...subpaths,
				{
					id: newSubpathId,
					closed: false,
						nodes: [
							{ id: firstNodeId, x: start.x, y: start.y, type: "corner", handleType: "corner" as const, cornerRadius: 0 },
							{ id: secondNodeId, x: end.x, y: end.y, type: "corner", handleType: "corner" as const, cornerRadius: 0 },
						],
					},
				];
			return {
				subpaths: nextSubpaths,
				selectedNodeId: secondNodeId,
				selectedSubpathId: newSubpathId,
			};
		});
	}

	function handleTogglePathSubpathClosed(elementId: string, subpathId: string, closed: boolean) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			const target = subpaths.find((item) => item.id === subpathId);
			if (!target) return null;
			const nextClosed = closed && target.nodes.length > 2;
			const nextSubpaths = subpaths.map((subpath) =>
				subpath.id === subpathId ? { ...subpath, closed: nextClosed } : subpath
			);
			return {
				subpaths: nextSubpaths,
				selectedSubpathId: subpathId,
			};
		});
	}

	function handleAddPathNode(elementId: string, point: { x: number; y: number }) {
		commitPathMutation(elementId, (pathEl, subpaths) => {
			const clamped = clampPathPoint(point.x, point.y, pathEl.width, pathEl.height);
			const activeSubpathId = state.selectedPathSubpathId;
			const preferred = activeSubpathId
				? subpaths.find((subpath) => subpath.id === activeSubpathId)
				: undefined;
			const target = preferred ?? [...subpaths].reverse().find((subpath) => !subpath.closed) ?? subpaths[0];
			if (!target) return null;
			const targetIndex = subpaths.findIndex((subpath) => subpath.id === target.id);
			if (targetIndex === -1) return null;

			if (target.closed) {
				const newSubpathId = crypto.randomUUID();
				const firstNodeId = crypto.randomUUID();
				const secondNodeId = crypto.randomUUID();
				const secondPoint = clampPathPoint(
					clamped.x + Math.min(60, Math.max(24, pathEl.width * 0.16)),
					clamped.y,
					pathEl.width,
					pathEl.height
				);
				const nextSubpaths = [
					...subpaths,
					{
						id: newSubpathId,
						closed: false,
						nodes: [
							{ id: firstNodeId, x: clamped.x, y: clamped.y, type: "corner", handleType: "corner" as const, cornerRadius: 0 },
							{ id: secondNodeId, x: secondPoint.x, y: secondPoint.y, type: "corner", handleType: "corner" as const, cornerRadius: 0 },
						],
					},
				];
				return {
					subpaths: nextSubpaths,
					selectedNodeId: secondNodeId,
					selectedSubpathId: newSubpathId,
				};
			}

			const firstNode = target.nodes[0];
			if (firstNode && target.nodes.length > 2) {
				const dist = Math.hypot(firstNode.x - clamped.x, firstNode.y - clamped.y);
				if (dist <= 10) {
					const nextSubpaths = subpaths.map((subpath) =>
						subpath.id === target.id ? { ...subpath, closed: true } : subpath
					);
					return {
						subpaths: nextSubpaths,
						selectedNodeId: firstNode.id,
						selectedSubpathId: target.id,
					};
				}
			}

			const newNodeId = crypto.randomUUID();
			const updatedTarget = {
				...target,
				nodes: [
					...target.nodes,
					{ id: newNodeId, x: clamped.x, y: clamped.y, type: "corner", handleType: "corner" as const, cornerRadius: 0 },
				],
			};
			const nextSubpaths = subpaths.map((subpath) =>
				subpath.id === target.id ? updatedTarget : subpath
			);
			return {
				subpaths: nextSubpaths,
				selectedNodeId: newNodeId,
				selectedSubpathId: target.id,
			};
		});
	}

	function handleInsertPathNodeOnSegment(options: {
		elementId: string;
		subpathId: string;
		segmentStartNodeId: string;
		point: { x: number; y: number };
		t?: number;
	}) {
		commitPathMutation(options.elementId, (pathEl, subpaths) => {
			const subpathIndex = subpaths.findIndex((subpath) => subpath.id === options.subpathId);
			if (subpathIndex === -1) return null;
			const targetSubpath = subpaths[subpathIndex];
			const startIndex = targetSubpath.nodes.findIndex((node) => node.id === options.segmentStartNodeId);
			if (startIndex === -1) return null;
			const isClosed = targetSubpath.closed && targetSubpath.nodes.length > 2;
			if (!isClosed && startIndex >= targetSubpath.nodes.length - 1) return null;
			const nextIndex = (startIndex + 1) % targetSubpath.nodes.length;
			const current = targetSubpath.nodes[startIndex];
			const nextNode = targetSubpath.nodes[nextIndex];
			const clampedPoint = clampPathPoint(options.point.x, options.point.y, pathEl.width, pathEl.height);
			const insertedNodeId = crypto.randomUUID();
			let insertedNode: PathNode = {
				id: insertedNodeId,
				x: clampedPoint.x,
				y: clampedPoint.y,
				type: "corner",
				handleType: "corner",
				cornerRadius: 0,
			};
			let updatedCurrent = current;
			let updatedNext = nextNode;
			const hasCurve = Boolean(current.handleOut || nextNode.handleIn);
			const t = Math.max(0.001, Math.min(0.999, options.t ?? 0.5));
			if (hasCurve) {
				const p0 = { x: current.x, y: current.y };
				const p1 = current.handleOut
					? { x: current.x + current.handleOut.x, y: current.y + current.handleOut.y }
					: p0;
				const p3 = { x: nextNode.x, y: nextNode.y };
				const p2 = nextNode.handleIn
					? { x: nextNode.x + nextNode.handleIn.x, y: nextNode.y + nextNode.handleIn.y }
					: p3;
				const a = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
				const b = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
				const c = { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t };
				const d = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
				const e = { x: b.x + (c.x - b.x) * t, y: b.y + (c.y - b.y) * t };
				const f = { x: d.x + (e.x - d.x) * t, y: d.y + (e.y - d.y) * t };
				insertedNode = {
					...insertedNode,
					x: f.x,
					y: f.y,
					type: "smooth",
					handleType: "smooth",
					handleIn: { x: d.x - f.x, y: d.y - f.y },
					handleOut: { x: e.x - f.x, y: e.y - f.y },
				};
				updatedCurrent = {
					...current,
					handleOut: { x: a.x - current.x, y: a.y - current.y },
				};
				updatedNext = {
					...nextNode,
					handleIn: { x: c.x - nextNode.x, y: c.y - nextNode.y },
				};
			}
			const nextNodes = targetSubpath.nodes.map((node, index) => {
				if (index === startIndex) return updatedCurrent;
				if (index === nextIndex) return updatedNext;
				return node;
			});
			nextNodes.splice(startIndex + 1, 0, insertedNode);
			const nextSubpaths = subpaths.map((subpath, index) =>
				index === subpathIndex ? { ...targetSubpath, nodes: nextNodes } : subpath
			);
			return {
				subpaths: nextSubpaths,
				selectedNodeId: insertedNodeId,
				selectedSubpathId: targetSubpath.id,
			};
		});
	}

	function handleSetPathNodeType(
		elementId: string,
		nodeId: string,
		type: "corner" | "smooth" | "symmetric"
	) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			let selectedSubpathId: string | undefined;
			const nextSubpaths = subpaths.map((subpath) => {
				const nodeIndex = subpath.nodes.findIndex((node) => node.id === nodeId);
				if (nodeIndex === -1) return subpath;
				selectedSubpathId = subpath.id;
				const direction = getNodeTangentDirection(subpath, nodeIndex);
				const nextNodes = subpath.nodes.map((node, index) =>
					index === nodeIndex ? convertNodeHandleType(node, type, direction) : node
				);
				return { ...subpath, nodes: nextNodes };
			});
			if (!selectedSubpathId) return null;
			return {
				subpaths: nextSubpaths,
				selectedNodeId: nodeId,
				selectedSubpathId,
			};
		});
	}

	function handleAddPathNodeHandles(elementId: string, nodeId: string) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			let selectedSubpathId: string | undefined;
			const nextSubpaths = subpaths.map((subpath) => {
				const nodeIndex = subpath.nodes.findIndex((node) => node.id === nodeId);
				if (nodeIndex === -1) return subpath;
				selectedSubpathId = subpath.id;
				const direction = getNodeTangentDirection(subpath, nodeIndex);
				const defaultLength = 28;
				const nextNodes = subpath.nodes.map((node, index) => {
					if (index !== nodeIndex) return node;
					const currentType = resolveHandleType(node);
					const hasIn = Boolean(node.handleIn);
					const hasOut = Boolean(node.handleOut);
					if (hasIn && hasOut) return node;
					const inLength = node.handleIn ? Math.max(1, Math.hypot(node.handleIn.x, node.handleIn.y)) : defaultLength;
					const outLength = node.handleOut ? Math.max(1, Math.hypot(node.handleOut.x, node.handleOut.y)) : defaultLength;
					let nextHandleIn = node.handleIn ? { ...node.handleIn } : null;
					let nextHandleOut = node.handleOut ? { ...node.handleOut } : null;
					if (!hasIn && !hasOut) {
						nextHandleIn = { x: -direction.x * defaultLength, y: -direction.y * defaultLength };
						nextHandleOut = { x: direction.x * defaultLength, y: direction.y * defaultLength };
					} else if (!hasIn && nextHandleOut) {
						const dir = normalizeVector(nextHandleOut);
						const len = currentType === "symmetric" ? outLength : inLength;
						nextHandleIn = { x: -dir.x * len, y: -dir.y * len };
					} else if (!hasOut && nextHandleIn) {
						const dir = normalizeVector({ x: -nextHandleIn.x, y: -nextHandleIn.y });
						const len = currentType === "symmetric" ? inLength : outLength;
						nextHandleOut = { x: dir.x * len, y: dir.y * len };
					}
					return {
						...node,
						handleIn: nextHandleIn,
						handleOut: nextHandleOut,
					};
				});
				return { ...subpath, nodes: nextNodes };
			});
			if (!selectedSubpathId) return null;
			return {
				subpaths: nextSubpaths,
				selectedNodeId: nodeId,
				selectedSubpathId,
			};
		});
	}

	function handleRemovePathNodeHandles(
		elementId: string,
		nodeId: string,
		handle: "in" | "out" | "both"
	) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			let selectedSubpathId: string | undefined;
			const nextSubpaths = subpaths.map((subpath) => {
				const nodeIndex = subpath.nodes.findIndex((node) => node.id === nodeId);
				if (nodeIndex === -1) return subpath;
				selectedSubpathId = subpath.id;
				const nextNodes = subpath.nodes.map((node, index) => {
					if (index !== nodeIndex) return node;
					const nextHandleIn = handle === "out" ? node.handleIn ?? null : handle === "in" ? null : null;
					const nextHandleOut = handle === "in" ? node.handleOut ?? null : handle === "out" ? null : null;
					const keepBoth = handle !== "both";
					const finalHandleIn = keepBoth ? nextHandleIn : null;
					const finalHandleOut = keepBoth ? nextHandleOut : null;
					const nextType = finalHandleIn && finalHandleOut ? resolveHandleType(node) : "corner";
					return {
						...node,
						type: nextType,
						handleType: nextType,
						handleIn: finalHandleIn,
						handleOut: finalHandleOut,
					};
				});
				return { ...subpath, nodes: nextNodes };
			});
			if (!selectedSubpathId) return null;
			return {
				subpaths: nextSubpaths,
				selectedNodeId: nodeId,
				selectedSubpathId,
			};
		});
	}

	function handleDeletePathNode(elementId: string, nodeId: string) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			let nextSelectedNodeId: string | undefined;
			let nextSelectedSubpathId: string | undefined;
			const nextSubpaths = subpaths
				.map((subpath) => {
					const index = subpath.nodes.findIndex((node) => node.id === nodeId);
					if (index === -1) return subpath;
					const nextNodes = subpath.nodes.filter((node) => node.id !== nodeId);
					if (nextNodes.length > 0) {
						const fallbackIndex = Math.max(0, Math.min(index - 1, nextNodes.length - 1));
						nextSelectedNodeId = nextNodes[fallbackIndex]?.id;
						nextSelectedSubpathId = subpath.id;
					}
					const nextClosed = nextNodes.length > 2 ? subpath.closed : false;
					return { ...subpath, nodes: nextNodes, closed: nextClosed };
				})
				.filter((subpath) => subpath.nodes.length > 0);

			return {
				subpaths: nextSubpaths,
				selectedNodeId: nextSelectedNodeId ?? null,
				selectedSubpathId: nextSelectedSubpathId ?? null,
			};
		});
	}

	function handlePathNodeCornerRadiusChange(
		elementId: string,
		nodeId: string,
		cornerRadius: number
	) {
		commitPathMutation(elementId, (_pathEl, subpaths) => {
			const clampedRadius = Math.max(0, Math.min(200, cornerRadius));
			let selectedSubpathId: string | undefined;
			const nextSubpaths = subpaths.map((subpath) => {
				const hasNode = subpath.nodes.some((node) => node.id === nodeId);
				if (!hasNode) return subpath;
				selectedSubpathId = subpath.id;
				return {
					...subpath,
					nodes: subpath.nodes.map((node) =>
						node.id === nodeId ? { ...node, cornerRadius: clampedRadius } : node
					),
				};
			});
			if (!selectedSubpathId) return null;
			return {
				subpaths: nextSubpaths,
				selectedNodeId: nodeId,
				selectedSubpathId,
			};
		});
	}

	function handleStartPathNodeDrag(options: {
		elementId: string;
		nodeId: string;
		subpathId?: string;
		handleType?: "in" | "out";
		clientX: number;
		clientY: number;
		breakHandles: boolean;
	}) {
		const elements = getWorkingElements();
		const element = elements.find((el) => el.id === options.elementId && el.type === "path") as PathElement | undefined;
		if (!element) return;
		const node = element.subpaths
			?.flatMap((subpath) => subpath.nodes)
			.find((item) => item.id === options.nodeId);
		if (!node) return;
		const handle = options.handleType === "in" ? node.handleIn : options.handleType === "out" ? node.handleOut : undefined;
		setPathNodeDrag({
			elementId: options.elementId,
			subpathId: options.subpathId,
			nodeId: options.nodeId,
			handleType: options.handleType,
			startClientX: options.clientX,
			startClientY: options.clientY,
			startNodeX: node.x,
			startNodeY: node.y,
			startHandleX: handle?.x ?? 0,
			startHandleY: handle?.y ?? 0,
			breakHandles: options.breakHandles,
		});
		setState((s) => ({
			...s,
			selectedPathNodeId: options.nodeId,
			selectedPathSubpathId: options.subpathId ?? s.selectedPathSubpathId,
		}));
	}

	useEffect(() => {
		if (!state.editingPathElementId) return;
		const selected = state.selectedElementIds ?? [];
		if (!selected.includes(state.editingPathElementId)) {
			setState((s) => ({
				...s,
				editingPathElementId: undefined,
				activeTool: "select",
				selectedPathNodeId: undefined,
				selectedPathSubpathId: undefined,
			}));
		}
	}, [state.editingPathElementId, state.selectedElementIds]);

	useEffect(() => {
		if (!state.editingPathElementId) return;
		const pathElement = (getWorkingElements().find(
			(el) => el.id === state.editingPathElementId && el.type === "path"
		) as PathElement | undefined);
		if (!pathElement?.subpaths?.length) return;
		const hasSelectedSubpath = state.selectedPathSubpathId
			? pathElement.subpaths.some((subpath) => subpath.id === state.selectedPathSubpathId)
			: false;
		const allNodes = pathElement.subpaths.flatMap((subpath) => subpath.nodes);
		const hasSelectedNode = state.selectedPathNodeId
			? allNodes.some((node) => node.id === state.selectedPathNodeId)
			: false;
		if (hasSelectedSubpath && (state.selectedPathNodeId ? hasSelectedNode : true)) return;
		setState((s) => ({
			...s,
			selectedPathSubpathId: hasSelectedSubpath ? s.selectedPathSubpathId : pathElement.subpaths?.[0]?.id,
			selectedPathNodeId: s.selectedPathNodeId && hasSelectedNode ? s.selectedPathNodeId : undefined,
		}));
	}, [
		currentTemplate?.elements,
		draftElements,
		state.editingPathElementId,
		state.selectedPathNodeId,
		state.selectedPathSubpathId,
	]);

	useEffect(() => {
		if (!pathNodeDrag) return;
		const {
			elementId,
			nodeId,
			handleType,
			startClientX,
			startClientY,
			startNodeX,
			startNodeY,
			startHandleX = 0,
			startHandleY = 0,
			breakHandles = false,
		} = pathNodeDrag;

		function handlePointerMove(event: PointerEvent) {
			const dx = (event.clientX - startClientX) / state.zoom;
			const dy = (event.clientY - startClientY) / state.zoom;
			setDraftElements((current) => {
				const base = current ?? getWorkingElements();
				const next = base.map((el) => {
					if (el.id !== elementId || el.type !== "path") return el;
					const pathEl = el as PathElement;
					if (!pathEl.subpaths || pathEl.subpaths.length === 0) return pathEl;
					const subpaths = clonePathSubpaths(pathEl.subpaths);
					let updated = false;
					const updatedSubpaths = subpaths.map((subpath) => {
					const nodes = subpath.nodes.map((node) => {
							if (node.id !== nodeId) return node;
							updated = true;
							if (handleType === "in" || handleType === "out") {
								const nextHandle = { x: startHandleX + dx, y: startHandleY + dy };
							const handleTypeForNode = resolveHandleType(node);
							let nextHandleIn = handleType === "in" ? nextHandle : node.handleIn ?? null;
							let nextHandleOut = handleType === "out" ? nextHandle : node.handleOut ?? null;
							const shouldBreak = breakHandles || handleTypeForNode === "corner";
							if (!shouldBreak) {
								if (handleTypeForNode === "symmetric") {
									if (handleType === "in") {
										nextHandleOut = { x: -nextHandle.x, y: -nextHandle.y };
									} else {
										nextHandleIn = { x: -nextHandle.x, y: -nextHandle.y };
									}
								} else if (handleTypeForNode === "smooth") {
									if (handleType === "in" && nextHandleOut) {
										const length = Math.hypot(nextHandleOut.x, nextHandleOut.y);
										if (length > 0) {
											const angle = Math.atan2(nextHandle.y, nextHandle.x) + Math.PI;
											nextHandleOut = { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
										}
									}
									if (handleType === "out" && nextHandleIn) {
										const length = Math.hypot(nextHandleIn.x, nextHandleIn.y);
										if (length > 0) {
											const angle = Math.atan2(nextHandle.y, nextHandle.x) + Math.PI;
											nextHandleIn = { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
										}
									}
								}
							}
							const nextHandleType = breakHandles ? "corner" : handleTypeForNode;
							return {
								...node,
								type: nextHandleType,
								handleType: nextHandleType,
								handleIn: nextHandleIn,
								handleOut: nextHandleOut,
							};
							}
							const nextPoint = clampPathPoint(startNodeX + dx, startNodeY + dy, pathEl.width, pathEl.height);
							return { ...node, x: nextPoint.x, y: nextPoint.y };
						});
						return { ...subpath, nodes };
					});
					if (!updated) return pathEl;
					const pathData = buildPathDataFromSubpaths(updatedSubpaths);
					return {
						...pathEl,
						subpaths: updatedSubpaths,
						pathData,
					};
				});
				draftRef.current = next;
				return next;
			});
		}

		function handlePointerUp() {
			const latest = draftRef.current ?? getWorkingElements();
			applyCommandResult({ nextElements: latest, nextSelectedIds: [elementId], clearEditing: false });
			setPathNodeDrag(null);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [pathNodeDrag, state.zoom]);

	useEffect(() => {
		const KEYBOARD_NUDGE_SAVE_DEBOUNCE_MS = 220;
		const clampZoom = (value: number) => Math.max(0.5, Math.min(3, value));

		function isEditableTarget(target: EventTarget | null): boolean {
			if (!(target instanceof HTMLElement)) return false;
			if (target.isContentEditable) return true;
			return Boolean(
				target.closest(
					'input, textarea, select, [contenteditable="true"], [role="textbox"]'
				)
			);
		}

		function moveSelectedBy(dx: number, dy: number) {
			const selectedIds = selectedElementIdsRef.current;
			if (!selectedIds?.length) return;

			const sourceElements = draftRef.current ?? currentTemplateRef.current?.elements ?? [];
			if (!sourceElements.length) return;

			const next = moveSelection(
				sourceElements,
				selectedIds,
				dx,
				dy,
				getCommandBounds()
			);
			const changed = next.some((element, index) => {
				const prev = sourceElements[index];
				return element.x !== prev.x || element.y !== prev.y;
			});

			if (!changed) return;

			if (!keyboardNudgeHistoryOpenRef.current) {
				pushUndoHistory(sourceElements);
				keyboardNudgeHistoryOpenRef.current = true;
			}

			draftRef.current = next;
			setDraftElements(next);
			setSnapGuides((prev) => (prev.length > 0 ? [] : prev));

			if (keyboardNudgeSaveTimerRef.current) {
				clearTimeout(keyboardNudgeSaveTimerRef.current);
			}
			keyboardNudgeSaveTimerRef.current = setTimeout(() => {
				const latestElements = draftRef.current;
				if (latestElements && latestElements.length > 0) {
					saveMutation.mutate({ elements: latestElements });
				}
				keyboardNudgeSaveTimerRef.current = null;
				keyboardNudgeHistoryOpenRef.current = false;
			}, KEYBOARD_NUDGE_SAVE_DEBOUNCE_MS);
		}

		function scheduleKeyboardNudge(dx: number, dy: number) {
			keyboardNudgeDeltaRef.current = {
				dx: keyboardNudgeDeltaRef.current.dx + dx,
				dy: keyboardNudgeDeltaRef.current.dy + dy,
			};

			if (keyboardNudgeRafRef.current != null) return;

			keyboardNudgeRafRef.current = window.requestAnimationFrame(() => {
				keyboardNudgeRafRef.current = null;
				const { dx: totalDx, dy: totalDy } = keyboardNudgeDeltaRef.current;
				keyboardNudgeDeltaRef.current = { dx: 0, dy: 0 };
				if (totalDx !== 0 || totalDy !== 0) {
					moveSelectedBy(totalDx, totalDy);
				}
			});
		}

		function handleKeyDown(event: KeyboardEvent) {
			const isEditable = isEditableTarget(event.target);
			const key = event.key;
			const lowerKey = key.toLowerCase();
			const hasMeta = event.metaKey || event.ctrlKey;
			const hasShift = event.shiftKey;

			if (!isEditable && event.code === "Space") {
				isSpacePressedRef.current = true;
				event.preventDefault();
			}

			const selectedIds = selectedElementIdsRef.current ?? [];
			const sourceElements = getWorkingElements();
			const selectedElements = sourceElements.filter((el) => selectedIds.includes(el.id));
			const selectedTextElement = selectedElements.length === 1 && selectedElements[0].type === "text"
				? (selectedElements[0] as Extract<TemplateElement, { type: "text" }>)
				: null;
			const isEditingText = Boolean(state.editingTextElementId);

			if (isEditable && !isEditingText) return;

			if (isEditingText) {
				if (key === "Escape") {
					event.preventDefault();
					setState((s) => ({ ...s, editingTextElementId: undefined }));
					return;
				}
				if (hasMeta && lowerKey === "b") {
					event.preventDefault();
					if (selectedTextElement && !selectedTextElement.locked) {
						const nextWeight =
							selectedTextElement.typography.fontWeight === "bold" ? "normal" : "bold";
						updateSelected({
							typography: {
								...selectedTextElement.typography,
								fontWeight: nextWeight,
							},
						} as Partial<TemplateElement>);
					}
					return;
				}
				if (hasMeta && lowerKey === "i") {
					event.preventDefault();
					if (selectedTextElement && !selectedTextElement.locked) {
						const nextStyle =
							selectedTextElement.typography.fontStyle === "italic" ? "normal" : "italic";
						updateSelected({
							typography: {
								...selectedTextElement.typography,
								fontStyle: nextStyle,
							},
						} as Partial<TemplateElement>);
					}
					return;
				}
				return;
			}

			if (key === "Escape") {
				if (state.editingPathElementId && state.selectedPathNodeId) {
					event.preventDefault();
					setState((s) => ({
						...s,
						selectedPathNodeId: undefined,
					}));
					return;
				}
				if ((selectedElementIdsRef.current?.length ?? 0) > 0 || state.editingTextElementId) {
					event.preventDefault();
					selectedElementIdsRef.current = [];
					setState((s) => ({
						...s,
						selectedElementIds: [],
						editingTextElementId: undefined,
						selectedPathNodeId: undefined,
						selectedPathSubpathId: undefined,
					}));
				}
				return;
			}

			if (key === "Enter" && selectedTextElement && !selectedTextElement.locked) {
				event.preventDefault();
				setState((s) => ({ ...s, editingTextElementId: selectedTextElement.id }));
				return;
			}

			if (hasMeta && lowerKey === "z") {
				event.preventDefault();
				if (hasShift) {
					redo();
				} else {
					undo();
				}
				return;
			}
			if (event.ctrlKey && lowerKey === "y") {
				event.preventDefault();
				redo();
				return;
			}

			if (hasMeta && lowerKey === "c") {
				event.preventDefault();
				copySelectedToClipboard();
				return;
			}
			if (hasMeta && lowerKey === "v") {
				event.preventDefault();
				pasteFromClipboard(lastCursorCanvasPointRef.current);
				return;
			}
			if (hasMeta && lowerKey === "d") {
				event.preventDefault();
				duplicateSelectedElements();
				return;
			}
			if (hasMeta && lowerKey === "g") {
				event.preventDefault();
				if (hasShift) {
					ungroupSelected();
				} else {
					groupSelected();
				}
				return;
			}
			if (hasMeta && lowerKey === "l") {
				event.preventDefault();
				if (hasShift) {
					lockSelection(false);
				} else {
					lockSelection(true);
				}
				return;
			}

			if (hasMeta && hasShift) {
				if (lowerKey === "l") {
					event.preventDefault();
					alignSelected("left");
					return;
				}
				if (lowerKey === "r") {
					event.preventDefault();
					alignSelected("right");
					return;
				}
				if (lowerKey === "t") {
					event.preventDefault();
					alignSelected("top");
					return;
				}
				if (lowerKey === "b") {
					event.preventDefault();
					alignSelected("bottom");
					return;
				}
				if (lowerKey === "c") {
					event.preventDefault();
					alignSelected("center-horizontal");
					return;
				}
				if (lowerKey === "m") {
					event.preventDefault();
					alignSelected("center-vertical");
					return;
				}
			}

			if (hasMeta && key === "]") {
				event.preventDefault();
				reorderSelectedLayer(hasShift ? "front" : "forward");
				return;
			}
			if (hasMeta && key === "[") {
				event.preventDefault();
				reorderSelectedLayer(hasShift ? "back" : "backward");
				return;
			}

			if (hasMeta && (key === "'" || event.code === "Quote")) {
				event.preventDefault();
				setState((s) => ({ ...s, snapEnabled: s.snapEnabled === false ? true : false }));
				return;
			}

			if (hasMeta && (key === "+" || key === "=")) {
				event.preventDefault();
				setState((s) => ({ ...s, zoom: clampZoom(s.zoom + 0.1) }));
				return;
			}
			if (hasMeta && key === "-") {
				event.preventDefault();
				setState((s) => ({ ...s, zoom: clampZoom(s.zoom - 0.1) }));
				return;
			}
			if (hasMeta && key === "0") {
				event.preventDefault();
				setState((s) => ({ ...s, zoom: 1 }));
				return;
			}

			if (key === "Tab") {
				event.preventDefault();
				const nextSelected = cycleSelection(sourceElements, selectedIds, hasShift);
				selectedElementIdsRef.current = nextSelected;
				setState((s) => ({ ...s, selectedElementIds: nextSelected }));
				return;
			}

			if (key === "g" || key === "G") {
				event.preventDefault();
				setState((s) => ({ ...s, showGrid: s.showGrid === false ? true : false }));
				return;
			}

			if ((key === "Delete" || key === "Backspace") && !isEditable) {
				event.preventDefault();
				if (state.editingPathElementId && state.selectedPathNodeId) {
					handleDeletePathNode(state.editingPathElementId, state.selectedPathNodeId);
					return;
				}
				deleteSelectedElements();
				return;
			}

			if (state.editingPathElementId && state.selectedPathNodeId && !hasMeta) {
				if (key === "1") {
					event.preventDefault();
					handleSetPathNodeType(state.editingPathElementId, state.selectedPathNodeId, "corner");
					return;
				}
				if (key === "2") {
					event.preventDefault();
					handleSetPathNodeType(state.editingPathElementId, state.selectedPathNodeId, "smooth");
					return;
				}
				if (key === "3") {
					event.preventDefault();
					handleSetPathNodeType(state.editingPathElementId, state.selectedPathNodeId, "symmetric");
					return;
				}
			}

			if (drag?.mode === "resize" && key.startsWith("Arrow")) {
				const step = hasShift ? 10 : 1;
				let dw = 0;
				let dh = 0;
				if (key === "ArrowLeft") dw = -step;
				if (key === "ArrowRight") dw = step;
				if (key === "ArrowUp") dh = -step;
				if (key === "ArrowDown") dh = step;
				const nextElements = resizeSelectionByKeyboard(
					sourceElements,
					selectedIds,
					dw,
					dh,
					getCommandBounds()
				);
				applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
				event.preventDefault();
				return;
			}

			if (hasMeta && hasShift && key.startsWith("Arrow")) {
				event.preventDefault();
				const resizeStep = 10;
				let dw = 0;
				let dh = 0;
				if (key === "ArrowLeft") dw = -resizeStep;
				if (key === "ArrowRight") dw = resizeStep;
				if (key === "ArrowUp") dh = -resizeStep;
				if (key === "ArrowDown") dh = resizeStep;
				const nextElements = resizeSelectionByKeyboard(
					sourceElements,
					selectedIds,
					dw,
					dh,
					getCommandBounds()
				);
				applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
				return;
			}

			if (hasMeta && key.startsWith("Arrow")) {
				event.preventDefault();
				let nextElements = sourceElements;
				if (key === "ArrowLeft") {
					nextElements = jumpSelectionToEdge(sourceElements, selectedIds, "left", getCommandBounds());
				} else if (key === "ArrowRight") {
					nextElements = jumpSelectionToEdge(sourceElements, selectedIds, "right", getCommandBounds());
				} else if (key === "ArrowUp") {
					nextElements = jumpSelectionToEdge(sourceElements, selectedIds, "top", getCommandBounds());
				} else if (key === "ArrowDown") {
					nextElements = jumpSelectionToEdge(sourceElements, selectedIds, "bottom", getCommandBounds());
				}
				applyCommandResult({ nextElements, nextSelectedIds: selectedIds });
				return;
			}

			if (drag) return;
			if (hasMeta) return;
			if ((selectedElementIdsRef.current?.length ?? 0) === 0) return;
			const step = event.shiftKey ? 10 : event.altKey ? 0.5 : 1;
			switch (event.key) {
				case "ArrowUp":
					event.preventDefault();
					scheduleKeyboardNudge(0, -step);
					break;
				case "ArrowDown":
					event.preventDefault();
					scheduleKeyboardNudge(0, step);
					break;
				case "ArrowLeft":
					event.preventDefault();
					scheduleKeyboardNudge(-step, 0);
					break;
				case "ArrowRight":
					event.preventDefault();
					scheduleKeyboardNudge(step, 0);
					break;
			}
		}

		function handleKeyUp(event: KeyboardEvent) {
			if (event.code === "Space") {
				isSpacePressedRef.current = false;
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			if (keyboardNudgeRafRef.current != null) {
				cancelAnimationFrame(keyboardNudgeRafRef.current);
				keyboardNudgeRafRef.current = null;
				keyboardNudgeDeltaRef.current = { dx: 0, dy: 0 };
			}
			keyboardNudgeHistoryOpenRef.current = false;
		};
	}, [
		drag,
		state.editingTextElementId,
		state.editingPathElementId,
		state.selectedPathNodeId,
		printableBounds.bottom,
		printableBounds.left,
		printableBounds.right,
		printableBounds.top,
		saveMutation,
	]);

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
		const elements = getWorkingElements();
		const { elements: nextElements, removedIds } = deleteSelection(elements, [id]);
		if (removedIds.length === 0) return;
		const removedRequired = elements.find((el) => el.id === id);
		if (removedRequired) {
			const binding =
				removedRequired.type === "text" || removedRequired.type === "input" || removedRequired.type === "image" || removedRequired.type === "currency"
					? removedRequired.binding
					: removedRequired.type === "table"
						? removedRequired.itemsBinding
						: undefined;
			if (isRequired(binding)) {
				toast.warning(t("designer.toast.requiredDeleteWarning", "Deleted required compliance fields. Template marked as non-compliant."));
			}
		}
		applyCommandResult({
			nextElements,
			nextSelectedIds: [],
			clearEditing: true,
		});
	}

	function duplicateElement(id: string) {
		const { elements: nextElements, newIds } = duplicateSelection(
			getWorkingElements(),
			[id],
			getCommandBounds(),
			{ clearBindings: true, offsetX: 20, offsetY: 20 }
		);
		if (newIds.length === 0) return;
		applyCommandResult({
			nextElements,
			nextSelectedIds: newIds,
			clearEditing: true,
		});
		toast.success(t('designer.duplicateSuccess'));
	}

	function reorderElementsByLayer(fromIndex: number, toIndex: number) {
		if (!currentTemplate) return;
		const base = draftElements ?? currentTemplate.elements ?? [];
		if (base.length < 2) return;
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= base.length || toIndex >= base.length) return;
		if (fromIndex === toIndex) return;

		const ordered = base
			.map((el, index) => ({ el, index }))
			.sort((a, b) => {
				const aZ = a.el.zIndex ?? 0;
				const bZ = b.el.zIndex ?? 0;
				if (aZ !== bZ) return bZ - aZ;
				return b.index - a.index;
			});

		const reordered = [...ordered];
		const [movedEntry] = reordered.splice(fromIndex, 1);
		if (!movedEntry) return;
		reordered.splice(toIndex, 0, movedEntry);

		const total = reordered.length;
		const zIndexById = new Map<string, number>();
		reordered.forEach((entry, index) => {
			zIndexById.set(entry.el.id, total - index);
		});

		const next = base.map((el) => ({
			...el,
			zIndex: zIndexById.get(el.id) ?? (el.zIndex ?? 0),
		}));

		applyCommandResult({
			nextElements: next,
			nextSelectedIds: selectedElementIdsRef.current ?? [],
		});
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

				let updated: TemplateElement[];
				
				if (mode === "move") {
					// Check if we have multiple selected elements to move together
					const selectedPositions = selectedElementPositions;
					const selectedIds = selectedElementIdsRef.current;
					
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
						updated = base.map((item) => {
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
						updated = base.map((item) => {
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
				} else {
					// resize logic - clear snap guides during resize
					setSnapGuides([]);
					updated = base.map((item) => {
						if (item.id !== elementId) return item;
						
						// For tables, only allow width resizing (height is calculated dynamically)
						if (item.type === "table") {
							let nextX = startX;
							let nextW = startWidth ?? item.width;
							if (edge?.includes("e"))
								nextW = Math.max(1, (startWidth ?? item.width) + dx);
							if (edge?.includes("w")) {
								nextX = startX + dx;
								nextW = Math.max(1, (startWidth ?? item.width) - dx);
							}
							const clamped = clampResize(nextX, startY, nextW, item.height);
							return {
								...item,
								x: clamped.x,
								y: clamped.y,
								width: clamped.width,
								// Keep original height for tables (it's just preview height)
								height: item.height,
							};
						}
						
						// For other elements, allow full resize
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
				}
				
				// Update ref synchronously to ensure pointer up handler has latest value
				draftRef.current = updated;
				return updated;
			});
		}

		function handlePointerUp() {
			// Get the latest draft from ref (updated synchronously in pointer move)
			const latestDraft = draftRef.current;
			const tmpl = currentTemplateRef.current;
			
			// Check if element position actually changed (more reliable than hasMoved closure)
			let positionChanged = false;
			if (latestDraft && tmpl) {
				const changedElement = latestDraft.find((el) => el.id === elementId);
				const initialElement = (tmpl.elements ?? []).find((el) => el.id === elementId);
				
				if (changedElement && initialElement) {
					// Check if position changed (for move) or size changed (for resize)
					if (mode === "move") {
						const dx = Math.abs(changedElement.x - startX);
						const dy = Math.abs(changedElement.y - startY);
						positionChanged = dx > 0.1 || dy > 0.1; // Use small threshold (0.1px) to account for rounding
					} else if (mode === "resize") {
						const dw = Math.abs((changedElement.width ?? 0) - (startWidth ?? initialElement.width ?? 0));
						const dh = Math.abs((changedElement.height ?? 0) - (startHeight ?? initialElement.height ?? 0));
						const dx = Math.abs(changedElement.x - startX);
						const dy = Math.abs(changedElement.y - startY);
						positionChanged = dw > 0.1 || dh > 0.1 || dx > 0.1 || dy > 0.1;
					}
				}
			}
			
			// Save if drag started (movement detected) OR if position actually changed
			const shouldSave = dragStartedRef.current || positionChanged;
			
			debugLog("[CANVAS] handlePointerUp called", {
				elementId,
				mode,
				hasMoved,
				dragStarted: dragStartedRef.current,
				positionChanged,
				shouldSave,
			});
			
			// If we never moved and position didn't change, it was just a click - don't save drag state
			// The click handler will handle selection
			if (shouldSave) {
				debugLog("[CANVAS] Pointer up after move", {
					hasLatestDraft: !!latestDraft,
					latestDraftCount: latestDraft?.length ?? 0,
					hasTemplate: !!tmpl,
				});
				
				if (latestDraft && tmpl) {
					// Get the element that was dragged/resized
					const changedElement = latestDraft.find((el) => el.id === elementId);
					if (changedElement) {
						// Ensure the dragged element is selected (it should be, but ensure it)
						const currentSelectedIds = selectedElementIdsRef.current;
						if (!currentSelectedIds.includes(elementId)) {
							// If not selected, select it first and update ref synchronously
							selectedElementIdsRef.current = [elementId];
							setState((s) => ({
								...s,
								selectedElementIds: [elementId],
							}));
							debugLog("[CANVAS] Element not selected, selecting it first:", elementId);
						}
						
						// Use updateSelected to trigger the same debounced save mechanism as property panel
						// This ensures canvas drags/resizes save with the same 50ms debounce
						// Pass only the properties that could have changed (position for move, size for resize)
						const changes: Partial<TemplateElement> = {
							x: changedElement.x,
							y: changedElement.y,
						};
						
						// If it was a resize, also include width/height
						if (mode === "resize") {
							changes.width = changedElement.width;
							changes.height = changedElement.height;
						}
						
						debugLog("[CANVAS] 🎯 Calling updateSelected from pointer up", {
							elementId,
							mode,
							changes,
							selectedIds: selectedElementIdsRef.current,
							elementBefore: {
								x: changedElement.x,
								y: changedElement.y,
								width: changedElement.width,
								height: changedElement.height,
							},
						});
						
						// Call updateSelected directly - it will use selectedElementIdsRef which we just updated
						updateSelected(changes);
					} else {
						debugWarn("[CANVAS] ⚠️ Changed element not found in latestDraft", { 
							elementId, 
							latestDraftLength: latestDraft.length,
							latestDraftIds: latestDraft.map(el => el.id),
						});
					}
				} else {
					debugWarn("[CANVAS] ⚠️ Missing latestDraft or template", {
						hasLatestDraft: !!latestDraft,
						hasTemplate: !!tmpl,
					});
				}
			} else {
				debugLog("[CANVAS] Pointer up without move (click only)", {
					dragStarted: dragStartedRef.current,
					positionChanged,
				});
			}
			
			// Reset drag started flag immediately - click handler will have already checked it
			// We use requestAnimationFrame to ensure the click handler runs first
			requestAnimationFrame(() => {
				dragStartedRef.current = false;
			});
			setDrag(null);
			// Don't clear draftElements immediately - keep them until realtime update confirms
			// The currentTemplate useMemo will clear them when it detects the save is confirmed
			setSnapGuides([]);
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp, { once: true });
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [drag, state.zoom, saveMutation]);

	const sidebarContent = (
		<TemplateSidebar
			templates={templates}
			currentTemplate={currentTemplate}
			state={state}
			hoveredElementId={hoveredElementId}
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
				if (isMobile && event && !event.defaultPrevented) {
					setMobilePanelTab("properties");
					setMobilePanelOpen(true);
				}
			}}
			onHoverElement={setHoveredElementId}
			onDuplicateElement={duplicateElement}
			onDeleteElement={deleteElement}
			onReorderElements={reorderElementsByLayer}
			missingRequiredFields={missingRequiredFields}
			onAddRequiredElement={addRequiredElement}
			isRequired={isRequired}
		/>
	);

	const elementsForInspector = draftElements ?? currentTemplate?.elements ?? [];
	const editingPathElement = state.editingPathElementId
		? (elementsForInspector.find((el) => el.id === state.editingPathElementId && el.type === "path") as PathElement | undefined)
		: undefined;
	const activePathSubpath = editingPathElement?.subpaths?.find(
		(subpath) => subpath.id === state.selectedPathSubpathId
	) ?? editingPathElement?.subpaths?.[0];
	const activePathNode = state.selectedPathNodeId
		? editingPathElement?.subpaths?.flatMap((subpath) => subpath.nodes).find((node) => node.id === state.selectedPathNodeId)
		: undefined;
	const selectedPathNodeForInspector = activePathNode
		? {
				id: activePathNode.id,
				handleType: resolveHandleType(activePathNode),
				cornerRadius: activePathNode.cornerRadius ?? 0,
				hasHandleIn: Boolean(activePathNode.handleIn),
				hasHandleOut: Boolean(activePathNode.handleOut),
			}
		: undefined;
	const activePathSubpathForInspector = activePathSubpath
		? {
				id: activePathSubpath.id,
				closed: activePathSubpath.closed,
				nodesCount: activePathSubpath.nodes.length,
			}
		: undefined;

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
			editingPathElementId={state.editingPathElementId}
			activePathTool={state.activeTool}
			onPathEditModeChange={setPathEditMode}
			onPathToolChange={setPathTool}
			selectedPathNode={selectedPathNodeForInspector}
			activePathSubpath={activePathSubpathForInspector}
			onPathNodeTypeChange={(type) => {
				if (!state.editingPathElementId || !state.selectedPathNodeId) return;
				handleSetPathNodeType(state.editingPathElementId, state.selectedPathNodeId, type);
			}}
			onDeletePathNode={() => {
				if (!state.editingPathElementId || !state.selectedPathNodeId) return;
				handleDeletePathNode(state.editingPathElementId, state.selectedPathNodeId);
			}}
			onAddPathNodeHandles={() => {
				if (!state.editingPathElementId || !state.selectedPathNodeId) return;
				handleAddPathNodeHandles(state.editingPathElementId, state.selectedPathNodeId);
			}}
			onRemovePathNodeHandles={(handle) => {
				if (!state.editingPathElementId || !state.selectedPathNodeId) return;
				handleRemovePathNodeHandles(state.editingPathElementId, state.selectedPathNodeId, handle);
			}}
			onPathNodeCornerRadiusChange={(radius) => {
				if (!state.editingPathElementId || !state.selectedPathNodeId) return;
				handlePathNodeCornerRadiusChange(state.editingPathElementId, state.selectedPathNodeId, radius);
			}}
			onTogglePathSubpathClosed={(closed) => {
				if (!state.editingPathElementId || !activePathSubpathForInspector?.id) return;
				handleTogglePathSubpathClosed(state.editingPathElementId, activePathSubpathForInspector.id, closed);
			}}
			onCreatePathSubpath={() => {
				if (!state.editingPathElementId) return;
				handleCreatePathSubpath(state.editingPathElementId);
			}}
			onClearPathNodeSelection={() =>
				setState((s) => ({
					...s,
					selectedPathNodeId: undefined,
				}))
			}
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
					hoveredElementId={hoveredElementId}
					onHoverElement={setHoveredElementId}
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
					onAddPathNode={handleAddPathNode}
					onStartPathNodeDrag={handleStartPathNodeDrag}
					onSelectPathNode={handleSelectPathNode}
					onInsertPathNodeOnSegment={handleInsertPathNodeOnSegment}
					onSetPathNodeType={({ elementId, nodeId, type }) =>
						handleSetPathNodeType(elementId, nodeId, type)
					}
					onDeletePathNode={({ elementId, nodeId }) =>
						handleDeletePathNode(elementId, nodeId)
					}
					onAddPathNodeHandles={({ elementId, nodeId }) =>
						handleAddPathNodeHandles(elementId, nodeId)
					}
					onRemovePathNodeHandles={({ elementId, nodeId, handle }) =>
						handleRemovePathNodeHandles(elementId, nodeId, handle)
					}
					onTogglePathSubpathClosed={({ elementId, subpathId, closed }) =>
						handleTogglePathSubpathClosed(elementId, subpathId, closed)
					}
					onDuplicateElement={duplicateElement}
					onDeleteElement={deleteElement}
					onCreateTemplate={() => createMutation.mutate()}
					isRequired={isRequired}
					onTableHeaderChange={(tableId, columnId, header) => {
						const elements = draftElements ?? currentTemplate?.elements ?? [];
						const tbl = elements.find((e) => e.id === tableId && e.type === "table") as Extract<TemplateElement, { type: "table" }> | undefined;
						if (!tbl) return;
						const baseColumns = tbl.columns.length > 0 ? tbl.columns : [
							{ id: "c1", header: t('designer.tableColumns.column1'), width: "50%", align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
							{ id: "c2", header: t('designer.tableColumns.column2'), width: "50%", align: "left" as const, type: "text" as const, format: { kind: "none" as const } },
						];
						const next = baseColumns.map((col) => col.id === columnId ? { ...col, header } : col);
						// Update draft elements but don't save - save will happen when user edits in properties panel
						setDraftElements((prev) => {
							const base = prev ?? currentTemplateRef.current?.elements ?? [];
							const updated = base.map((it) => it.id === tableId ? ({ ...tbl, columns: next } as TemplateElement) : it);
							// Update ref synchronously
							draftRef.current = updated;
							return updated;
						});
						// Trigger updateSelected to use the debounced save mechanism
						// This ensures table header changes are saved like other property changes
						updateSelected({ ...tbl, columns: next } as Partial<TemplateElement>);
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
			) : isWideLayout ? (
				<div className="flex min-h-0 w-full flex-1 overflow-hidden">
					<aside className="max-w-48 shrink-0 overflow-y-auto border-r bg-background">
						{sidebarContent}
					</aside>
					<main className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{canvasContent}
					</main>
					<aside className="w-72 shrink-0 overflow-y-auto border-l bg-background">
						{propertiesContent}
					</aside>
				</div>
			) : (
				<div className="flex min-h-0 w-full flex-1 overflow-hidden">
					<aside className="w-72 shrink-0 flex flex-col overflow-hidden border-r bg-background">
						{state.selectedElementIds?.length ? (
							<>
								<div className="shrink-0 flex items-center gap-2 border-b bg-background px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										className="-ml-1"
										onClick={() => setState((s) => ({ ...s, selectedElementIds: [] }))}
									>
										<ChevronLeft className="h-4 w-4 mr-1" />
										{t("designer.back", "Back")}
									</Button>
								</div>
								<div className="flex-1 overflow-y-auto">
									{propertiesContent}
								</div>
							</>
						) : (
							sidebarContent
						)}
					</aside>
					<main className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{canvasContent}
					</main>
				</div>
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
