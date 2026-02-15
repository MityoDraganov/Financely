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
import type { DesignerState, DragState, SnapGuide } from "@/components/designer/designer-types";
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
	const [state, setState] = useState<DesignerState>({ zoom: 1, selectedElementIds: [] });
	const [drag, setDrag] = useState<DragState | null>(null);
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
			setState((s) => ({ ...s, selectedElementIds: [] }));
			return;
		}
		const isShiftPressed = Boolean(event?.shiftKey);
		const currentSelected = state.selectedElementIds || [];
		
		if (isShiftPressed) {
			// Toggle selection: add if not selected, remove if already selected
			if (currentSelected.includes(elementId)) {
				const newSelected = currentSelected.filter((id) => id !== elementId);
				debugLog('[SELECT] Removing from selection:', newSelected);
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
				}));
			} else {
				const newSelected = [...currentSelected, elementId];
				debugLog('[SELECT] Adding to selection:', newSelected);
				setState((s) => ({
					...s,
					selectedElementIds: newSelected,
				}));
			}
		} else {
			// Single select: replace selection
			debugLog('[SELECT] Single select:', [elementId]);
			setState((s) => ({
				...s,
				selectedElementIds: [elementId],
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

	useEffect(() => {
		const KEYBOARD_NUDGE_SAVE_DEBOUNCE_MS = 220;

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

			let changed = false;
			const next = sourceElements.map((element) => {
				if (!selectedIds.includes(element.id)) return element;

				const targetX = element.x + dx;
				const targetY = element.y + dy;
				const minX = printableBounds.left;
				const minY = printableBounds.top;
				const maxX = Math.max(minX, printableBounds.right - element.width);
				const maxY = Math.max(minY, printableBounds.bottom - element.height);
				const x = Math.min(Math.max(minX, targetX), maxX);
				const y = Math.min(Math.max(minY, targetY), maxY);

				if (x === element.x && y === element.y) {
					return element;
				}

				changed = true;
				return {
					...element,
					x,
					y,
				};
			});

			if (!changed) return;

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
			if (isEditableTarget(event.target)) return;

			if (event.key === "Escape") {
				if ((selectedElementIdsRef.current?.length ?? 0) > 0) {
					event.preventDefault();
					setState((s) => ({ ...s, selectedElementIds: [] }));
				}
				return;
			}

			if (drag) return;
			if (event.metaKey || event.ctrlKey) return;
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

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			if (keyboardNudgeRafRef.current != null) {
				cancelAnimationFrame(keyboardNudgeRafRef.current);
				keyboardNudgeRafRef.current = null;
				keyboardNudgeDeltaRef.current = { dx: 0, dy: 0 };
			}
		};
	}, [
		drag,
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
		if (!currentTemplate) return;
		const next = (currentTemplate.elements ?? []).filter(
			(e) => e.id !== id
		);
		draftRef.current = next;
		setDraftElements(next);
		// Don't save automatically - user will save via properties panel
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
		draftRef.current = next;
		setDraftElements(next);
		// Don't save automatically - user will save via properties panel
		setState((s: DesignerState) => ({
			...s,
			selectedElementIds: [duplicated.id],
		}));
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

		draftRef.current = next;
		setDraftElements(next);
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
