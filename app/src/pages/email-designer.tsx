import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { Card, CardContent } from "@/components/ui/card";
import { Menu, Settings, Eye, Loader2, Mail } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
	EmailTemplate,
	EmailTemplateBlock,
	EmailSection,
	EmailTemplateDesignTokens,
	EmailTemplatePlaceholder,
} from "@/core";
import { Pattern } from "@/core/patterns/email-patterns";
import { emailTemplateService } from "@/services/email-template-service";
import { parseHtmlToBlocks, convertBlocksToHtml } from "@/utils/email-html-sync";
import { useCreateEmailTemplate } from "@/hooks/repository-hooks/use-create-email-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useEmailDesignerTemplate } from "@/contexts/email-designer-template-context";
import { EmailSidebar } from "@/components/email-designer/email-sidebar";
import { EmailCanvasHeader } from "@/components/email-designer/email-canvas-header";
import { EmailDesignerCanvas } from "@/components/email-designer/email-designer-canvas";
import { EmailBlockProperties } from "@/components/email-designer/email-block-properties";
import { EmailTemplateSettings } from "@/components/email-designer/email-template-settings";
import { EmailMissingValuesAlert } from "@/components/email-designer/email-missing-values-alert";
import { BrandImagePickerDialog } from "@/components/brand-image-picker-dialog";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresence } from "@/hooks/use-presence";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { useGenerateEmailTemplate } from "@/hooks/service-hooks/use-email-template-generation";
import { AIEmailBuilderDialog } from "@/components/email-designer/ai-email-builder-dialog";
import { useProductsByOrg } from "@/hooks/repository-hooks/use-products";

type BrandAssets = {
	logo?: string;
	favicon?: string;
	gallery: string[];
};

const defaultDesignTokens: EmailTemplateDesignTokens = {
	background: "#ffffff",
	surface: "#f8fafc",
	text: "#0f172a",
	primary: "#2563eb",
	fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
	borderRadius: 12,
};

const AUTOSAVE_DEBOUNCE_MS = 500;
const PLACEHOLDER_KEY_REGEX = /^[A-Za-z0-9_-]+$/;

export default function EmailDesignerPage() {
	const { t } = useTranslation();
	const { id: templateIdFromUrl } = useParams<{ id?: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const locationState = (location.state as { templateId?: string; action?: "create" } | null) || null;
	const [selectedBlockId, setSelectedBlockId] = useState<string>();
	const [draftOverrides, setDraftOverrides] = useState<Partial<EmailTemplate> | null>(null);
	const [currentSection, setCurrentSection] = useState<EmailSection>("body");
	const isCreatingTemplateRef = useRef<boolean>(false);
	const { data: currentOrg } = useCurrentOrganization();
	const orgId = currentOrg?.id || "";
	const emailDesignerContext = useEmailDesignerTemplate();
	const createTemplate = useCreateEmailTemplate();
	const isMobile = useMediaQuery("(max-width: 768px)");
	const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
	const [mobilePanelTab, setMobilePanelTab] = useState<"blocks" | "preview" | "properties">("blocks");
	const [imagePickerOpen, setImagePickerOpen] = useState(false);
	const [imagePickerTargetBlockId, setImagePickerTargetBlockId] = useState<string | null>(null);
	const [brandAssets, setBrandAssets] = useState<BrandAssets>({ gallery: [] });
	const [uploadState, setUploadState] = useState<{ preview: string; progress: number } | null>(null);
	const fileUpload = useFileUpload();
	const updateOrganization = useUpdateOrganization();
	const authUser = useFirebaseAuthUser();
	const generateEmailTemplate = useGenerateEmailTemplate();
	const { data: products = [] } = useProductsByOrg(orgId);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	
	// Use context values with safe defaults
	const safeTemplates = useMemo(() => {
		try {
			return emailDesignerContext?.templates ?? [];
		} catch (error) {
			console.error("Error accessing templates from context:", error);
			return [];
		}
	}, [emailDesignerContext?.templates]);
	const safeContextCurrentTemplateId = emailDesignerContext?.currentTemplateId;
	const safeSetContextCurrentTemplateId = emailDesignerContext?.setCurrentTemplateId ?? (() => {});
	const safeContextOnTemplateChange = emailDesignerContext?.onTemplateChange ?? (() => {});
	const safeContextHandleCreateNewTemplate = emailDesignerContext?.onCreateNewTemplate ?? (() => {});
	const isLoadingTemplates = emailDesignerContext?.isLoadingTemplates ?? true;
	const isSubscribed = emailDesignerContext?.isSubscribed ?? false;

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
	
	// Helper to load template: HTML is source of truth, parse to blocks for editing
	const loadTemplateFromHtml = (template: EmailTemplate): EmailTemplate => {
		const cloned = JSON.parse(JSON.stringify(template)) as EmailTemplate;
		if (!Array.isArray(cloned.placeholders)) {
			cloned.placeholders = [];
		}
		
		// CRITICAL: If template has blocks already with proper sections structure, use them directly
		// This is especially important for AI-generated templates that come with structured blocks
		if (cloned.blocks && cloned.blocks.length > 0 && cloned.sections) {
			// Check if blocks have proper section assignments
			const blocksWithSections = cloned.blocks.filter(block => {
				const section = block.section || "body";
				return section === "header" || section === "body" || section === "footer";
			});
			
			// If we have blocks with sections AND a sections object, use them as-is
			// This preserves AI-generated structure
			if (blocksWithSections.length > 0 && cloned.sections.header && cloned.sections.body && cloned.sections.footer) {
				// Verify that sections object matches the blocks
				const sectionIds = [
					...(cloned.sections.header || []),
					...(cloned.sections.body || []),
					...(cloned.sections.footer || []),
				];
				const blockIds = cloned.blocks.map(b => b.id);
				const allSectionIdsMatch = sectionIds.length > 0 && sectionIds.every(id => blockIds.includes(id));
				
				if (allSectionIdsMatch) {
					// Blocks are already properly structured - use them directly without parsing HTML
					console.log("[EMAIL-DESIGNER] Using pre-structured blocks from template (likely AI-generated)", {
						header: cloned.sections.header.length,
						body: cloned.sections.body.length,
						footer: cloned.sections.footer.length,
					});
					
					// Ensure HTML content exists (generate from blocks if needed)
					if (!cloned.htmlContent || cloned.htmlContent.trim() === "") {
						cloned.htmlContent = convertBlocksToHtml(
							cloned.blocks,
							cloned.designTokens || {
								background: "#ffffff",
								surface: "#f8fafc",
								text: "#0f172a",
								primary: "#2563eb",
								fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
								borderRadius: 12,
							},
							cloned.subject,
							cloned.preheader
						);
					}
					
					return cloned;
				}
			}
		}
		
		// Get HTML content (source of truth)
		// If HTML is explicitly empty, respect that - don't regenerate from blocks
		// This allows users to clear HTML and have a blank template
		let htmlContent = cloned.htmlContent ?? "";
		
		// Only generate HTML from blocks if:
		// 1. HTML is truly missing (undefined/null) AND
		// 2. We have blocks to convert
		// This is for backward compatibility with old templates that only had blocks
		// But if HTML is explicitly empty string, respect that as user intent
		if (htmlContent === undefined && cloned.blocks && cloned.blocks.length > 0) {
			htmlContent = convertBlocksToHtml(
				cloned.blocks,
				cloned.designTokens || {
					background: "#ffffff",
					surface: "#f8fafc",
					text: "#0f172a",
					primary: "#2563eb",
					fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
					borderRadius: 12,
				},
				cloned.subject,
				cloned.preheader
			);
			cloned.htmlContent = htmlContent;
		} else if (htmlContent === undefined) {
			// HTML is undefined and no blocks - set to empty string
			htmlContent = "";
			cloned.htmlContent = "";
		}
		
		// Parse HTML to blocks for visual editing (fallback for templates without structured blocks)
		// If HTML is empty, blocks should be empty too (no default content)
		if (htmlContent && htmlContent.trim() !== "") {
			try {
				const parsed = parseHtmlToBlocks(
					htmlContent,
					cloned.designTokens || {
						background: "#ffffff",
						surface: "#f8fafc",
						text: "#0f172a",
						primary: "#2563eb",
						fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
						borderRadius: 12,
					}
				);
				
				// Update blocks from parsed HTML (only if parsing succeeded)
				if (parsed.blocks && parsed.blocks.length > 0) {
					cloned.blocks = parsed.blocks.map((block) => {
						// Ensure section is set
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const typedBlock = block as any;
					if (!typedBlock.section) {
							const blockType = typedBlock.type;
						if (blockType === "subject" || blockType === "preheader" || blockType === "logo" || blockType === "navigation") {
								typedBlock.section = "header";
								return typedBlock as EmailTemplateBlock;
						}
						if (blockType === "footerText" || blockType === "socialLinks" || blockType === "unsubscribe") {
								typedBlock.section = "footer";
								return typedBlock as EmailTemplateBlock;
						}
							typedBlock.section = "body";
							return typedBlock as EmailTemplateBlock;
			}
						return typedBlock as EmailTemplateBlock;
					});
				} else {
					// Parsing produced no blocks - use empty array
					cloned.blocks = [];
				}
				
				// Update subject/preheader from parsed HTML if available
				if (parsed.subject && !cloned.subject) {
					cloned.subject = parsed.subject;
				}
				if (parsed.preheader && !cloned.preheader) {
					cloned.preheader = parsed.preheader;
				}
			} catch (error) {
				// Parsing failed - HTML is still saved, but blocks remain empty
				console.warn("[EMAIL-DESIGNER] Failed to parse HTML to blocks in loadTemplateFromHtml:", error);
				cloned.blocks = [];
			}
		} else {
			// No HTML - start with empty blocks
			cloned.blocks = [];
		}
		
		return cloned;
	};
	
	const areOverridesSynced = (overrides: Partial<EmailTemplate>, base: EmailTemplate) => {
		if (overrides.name !== undefined && overrides.name !== base.name) {
			return false;
		}
		if (overrides.subject !== undefined && overrides.subject !== base.subject) {
			return false;
		}
		if (overrides.preheader !== undefined && overrides.preheader !== base.preheader) {
			return false;
		}
		if (overrides.htmlContent !== undefined && overrides.htmlContent !== base.htmlContent) {
			return false;
		}
		if (overrides.blocks && JSON.stringify(overrides.blocks) !== JSON.stringify(base.blocks ?? [])) {
			return false;
		}
		if (overrides.sections && JSON.stringify(overrides.sections) !== JSON.stringify(base.sections ?? {})) {
			return false;
		}
		if (overrides.designTokens && JSON.stringify(overrides.designTokens) !== JSON.stringify(base.designTokens ?? defaultDesignTokens)) {
			return false;
		}
		return true;
	};
	
	// Get base template from context (without draft state)
	const baseTemplate = useMemo(() => {
		const templateId = safeContextCurrentTemplateId;
		const template = safeTemplates.find((t: EmailTemplate) => t.id === templateId) ?? safeTemplates[0];
		console.log("[EMAIL-DESIGNER] baseTemplate computed:", {
			timestamp: new Date().toISOString(),
			requestedTemplateId: templateId,
			templateFound: !!template,
			foundTemplateId: template?.id,
			templateName: template?.name,
			blocksCount: template?.blocks?.length ?? 0,
			totalTemplates: safeTemplates.length,
		});
		return template;
	}, [safeTemplates, safeContextCurrentTemplateId]);

	const normalizedBaseTemplate = useMemo(() => {
		if (!baseTemplate) {
			return null;
		}
		return loadTemplateFromHtml(baseTemplate);
	}, [baseTemplate]);

	const draftTemplate = useMemo(() => {
		if (!normalizedBaseTemplate) {
			return null;
		}

		const overrides = draftOverrides ?? null;
		if (!overrides) {
			return normalizedBaseTemplate;
		}

		return {
			...normalizedBaseTemplate,
			...overrides,
			blocks: overrides.blocks ?? normalizedBaseTemplate.blocks ?? [],
			designTokens: overrides.designTokens ?? normalizedBaseTemplate.designTokens ?? defaultDesignTokens,
			placeholders: overrides.placeholders ?? normalizedBaseTemplate.placeholders ?? [],
			sections: overrides.sections ?? normalizedBaseTemplate.sections,
			htmlContent: overrides.htmlContent ?? normalizedBaseTemplate.htmlContent ?? "",
			name: overrides.name ?? normalizedBaseTemplate.name,
			subject: overrides.subject ?? normalizedBaseTemplate.subject,
			preheader: overrides.preheader ?? normalizedBaseTemplate.preheader,
		};
	}, [normalizedBaseTemplate, draftOverrides]);

	// Track last processed content to avoid duplicate processing
	const lastProcessedContentRef = useRef<string>("");

	useEffect(() => {
		if (!draftOverrides || !normalizedBaseTemplate) {
			return;
		}
		
		if (areOverridesSynced(draftOverrides, normalizedBaseTemplate)) {
			setDraftOverrides(null);
		}
	}, [draftOverrides, normalizedBaseTemplate]);

	// Reset local overrides when template changes
	useEffect(() => {
		setDraftOverrides(null);
		lastProcessedContentRef.current = "";
	}, [baseTemplate?.id]);

	const { activeUsers, updateSelection, updateCursor } = usePresence(baseTemplate?.id);

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

	const selectedBlock = useMemo(() => {
		if (!draftTemplate?.blocks || !selectedBlockId) {
			return undefined;
		}
		return findBlockById(draftTemplate.blocks, selectedBlockId);
	}, [draftTemplate?.blocks, selectedBlockId]);

	// Handle block selection with automatic section switching
	const handleSelectBlock = (blockId: string | undefined) => {
		setSelectedBlockId(blockId);
		
		// If a block is selected, check its section and switch sidebar if needed
		if (blockId && draftTemplate?.blocks) {
			const block = findBlockById(draftTemplate.blocks, blockId);
			if (block?.section && block.section !== currentSection) {
				setCurrentSection(block.section);
			}
		}
	};

	// Reset selection when template changes
	useEffect(() => {
		setSelectedBlockId(undefined);
		updateSelection(undefined);
	}, [safeContextCurrentTemplateId, updateSelection]);
		
	// Update selection in presence when selectedBlockId changes
	useEffect(() => {
		if (baseTemplate?.id) {
			updateSelection(selectedBlockId);
		}
	}, [selectedBlockId, baseTemplate?.id, updateSelection]);

	// Sync context currentTemplateId with URL
	useEffect(() => {
		if (templateIdFromUrl) {
			const templateExists = safeTemplates.some((t: EmailTemplate) => t.id === templateIdFromUrl);
			if (templateExists && safeContextCurrentTemplateId !== templateIdFromUrl) {
				safeSetContextCurrentTemplateId(templateIdFromUrl);
			} else if (!templateExists && safeTemplates.length > 0) {
				// Template not found, redirect to templates list
				// navigate("/templates");
			}
		} else if (
			!safeContextCurrentTemplateId && 
			!createTemplate.isPending && 
			!createTemplate.isSuccess && 
			!isCreatingTemplateRef.current && 
			safeTemplates.length === 0 && 
			// CRITICAL: Don't auto-create if we're coming from templates page with action: "create"
			// The wrapper is already handling that case
			locationState?.action !== "create"
		) {
			// No template ID in URL and no template selected - auto-create a new one
			// But only if we're NOT coming from the templates page with action: "create"
			isCreatingTemplateRef.current = true;
			const createPromise = safeContextHandleCreateNewTemplate();
			if (createPromise && typeof createPromise.then === "function") {
				createPromise
					.then(() => {
						setTimeout(() => {
							isCreatingTemplateRef.current = false;
						}, 1000);
					})
					.catch(() => {
						isCreatingTemplateRef.current = false;
					});
			} else {
				setTimeout(() => {
					isCreatingTemplateRef.current = false;
				}, 2000);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [safeTemplates, safeContextCurrentTemplateId, templateIdFromUrl, createTemplate.isPending, createTemplate.isSuccess]);

	const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);


	const hasChanges = useMemo(() => {
		if (!draftOverrides) {
		return false;
		}

		return Object.keys(draftOverrides).length > 0;
	}, [draftOverrides]);

	const saveMutation = useMutation({
		mutationFn: async (template: EmailTemplate) => {
			if (!template?.id) {
				console.error("[EMAIL-DESIGNER] Save failed - template missing id");
				return;
			}

			// Check for invalid placeholder patterns before saving
			const invalid = detectInvalidPlaceholders(
				template.blocks ?? [],
				template.subject,
				template.preheader
			);
			if (invalid.length > 0) {
				const errorMessage = `Cannot save: Invalid placeholder patterns detected. Please fix empty placeholders like {{}} before saving.`;
				console.error("[EMAIL-DESIGNER] Save blocked - invalid placeholders:", invalid);
				throw new Error(errorMessage);
			}
			
			const timestamp = new Date().toISOString();
			console.log("[EMAIL-DESIGNER] SAVE MUTATION START:", {
				timestamp,
				templateId: template.id,
				htmlLength: template.htmlContent?.length || 0,
				blocksCount: template.blocks?.length ?? 0,
			});
			
			// HTML is the source of truth - convert blocks to HTML if needed
			let htmlContent = template.htmlContent || "";
			if ((!htmlContent || !htmlContent.trim()) && template.blocks && template.blocks.length > 0) {
				htmlContent = convertBlocksToHtml(
					template.blocks,
					template.designTokens || defaultDesignTokens,
					template.subject,
					template.preheader
				);
			}
			
			// Ensure blocks is always an array (even if empty)
			const blocks = Array.isArray(template.blocks) ? template.blocks : [];
			
			// Remove undefined values recursively (Firebase Realtime Database doesn't allow undefined)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const removeUndefined = (obj: any): any => {
				if (obj === null || obj === undefined) {
					return null;
				}
				if (Array.isArray(obj)) {
					return obj.map(removeUndefined).filter(item => item !== undefined);
				}
				if (typeof obj === "object") {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const cleaned: any = {};
					for (const [key, value] of Object.entries(obj)) {
						if (value !== undefined) {
							cleaned[key] = removeUndefined(value);
						}
					}
					return cleaned;
				}
				return obj;
			};
			
			// Always save all fields to ensure all property changes are persisted
			const savedData = removeUndefined({
				name: template.name,
				subject: template.subject || "Email", // Ensure subject is never empty
				preheader: template.preheader,
				htmlContent: htmlContent, // Save HTML as source of truth
				blocks: blocks, // Always an array (can be empty if HTML can't be parsed)
				designTokens: template.designTokens ?? defaultDesignTokens,
				sections: template.sections,
				placeholders: template.placeholders ?? [], // Save placeholders
			});
			
			console.log("[EMAIL-DESIGNER] Saving HTML:", {
				templateId: template.id,
				htmlLength: htmlContent.length,
				blocksCount: savedData.blocks.length,
			});
			
			await emailTemplateService.updateDraft(template.id, savedData);
			console.log("[EMAIL-DESIGNER] SAVE MUTATION COMPLETE - HTML saved to database:", {
				timestamp: new Date().toISOString(),
				templateId: template.id,
			});
		},
		onSuccess: async () => {
			const timestamp = new Date().toISOString();
			console.log("[EMAIL-DESIGNER] SAVE MUTATION SUCCESS:", {
				timestamp,
				templateId: draftTemplate?.id,
			});
			// Invalidate queries to trigger refetch
			// The real-time subscription will update baseTemplate automatically
			queryClient.invalidateQueries({ queryKey: ["email-templates", orgId] });
			toast.success(t("emailDesigner.toast.saved"));
		},
		onError: (error) => {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[EMAIL-DESIGNER] SAVE MUTATION ERROR:", {
				error,
				errorMessage,
				templateId: draftTemplate?.id,
				timestamp: new Date().toISOString(),
			});
			// Skip toast for invalid placeholder errors - alerts are shown in UI
			if (errorMessage.includes("Invalid placeholder patterns")) {
				return;
			}
			// Show detailed error message to help debug
			toast.error(`${t("emailDesigner.toast.saveFailed")}: ${errorMessage}`, {
				duration: 5000,
			});
		},
	});

	const isSavePending = saveMutation.isPending;
	const autoSaveMutate = saveMutation.mutate;

	// Auto-save draft changes similar to the invoice template designer
	useEffect(() => {
		// Clear any pending timers when dependencies change
		if (autoSaveTimerRef.current) {
			clearTimeout(autoSaveTimerRef.current);
			autoSaveTimerRef.current = null;
		}

		if (!draftTemplate || !normalizedBaseTemplate) {
			return;
		}

		if (!hasChanges) {
			return;
		}

		// Avoid scheduling another auto-save if one is in progress
		if (isSavePending) {
			return;
		}

		autoSaveTimerRef.current = setTimeout(() => {
			// Always regenerate HTML from blocks to ensure it's in sync
			// This ensures that any property changes (design tokens, name, etc.) are reflected in HTML
			const htmlContent = convertBlocksToHtml(
				draftTemplate.blocks,
				draftTemplate.designTokens || {
					background: "#ffffff",
					surface: "#f8fafc",
					text: "#0f172a",
					primary: "#2563eb",
					fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
					borderRadius: 12,
				},
				draftTemplate.subject,
				draftTemplate.preheader
			);
			
			// Save all fields including the regenerated HTML
			autoSaveMutate({
				...draftTemplate,
				htmlContent, // Always use regenerated HTML to ensure sync
			});
		}, AUTOSAVE_DEBOUNCE_MS); // debounce to avoid excessive writes

		return () => {
			if (autoSaveTimerRef.current) {
				clearTimeout(autoSaveTimerRef.current);
				autoSaveTimerRef.current = null;
			}
		};
	}, [draftTemplate, normalizedBaseTemplate, hasChanges, isSavePending, autoSaveMutate]);

	const handleDraftChange = useCallback((updates: Partial<EmailTemplate>) => {
		setDraftOverrides((prev) => ({
			...(prev ?? {}),
			...updates,
		}));
	}, []);

	// Extract placeholder keys from all text content in blocks
	const extractPlaceholderKeysFromContent = useCallback((blocks: EmailTemplateBlock[], subject?: string, preheader?: string): Set<string> => {
		const keys = new Set<string>();
		const placeholderRegex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

		const extractFromText = (text: string) => {
			if (!text) return;
			let match;
			while ((match = placeholderRegex.exec(text)) !== null) {
				keys.add(match[1]);
			}
		};

		const processBlock = (block: EmailTemplateBlock) => {
			if (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "footerText") {
				extractFromText((block as Extract<EmailTemplateBlock, { type: "subject" | "preheader" | "text" | "footerText" }>).content || "");
			}
			if (block.type === "button") {
				const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
				extractFromText(buttonBlock.label || "");
				extractFromText(buttonBlock.url || "");
			}
			if (block.type === "unsubscribe") {
				const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
				extractFromText(unsubscribeBlock.text || "");
				extractFromText(unsubscribeBlock.url || "");
			}
			if (block.type === "navigation") {
				const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
				navBlock.links?.forEach(link => {
					extractFromText(link.label || "");
					extractFromText(link.url || "");
				});
			}
			if (block.type === "columns") {
				const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
				colsBlock.columns?.forEach(col => {
					col.blocks?.forEach(processBlock);
				});
			}
			if (block.type === "container") {
				const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
				containerBlock.blocks?.forEach(processBlock);
			}
		};

		blocks.forEach(processBlock);
		// Also check subject and preheader at template level
		if (subject) extractFromText(subject);
		if (preheader) extractFromText(preheader);

		return keys;
	}, []);

	// Detect invalid placeholder patterns (like {{}})
	const detectInvalidPlaceholders = useCallback((blocks: EmailTemplateBlock[], subject?: string, preheader?: string): string[] => {
		const invalidPatterns: string[] = [];
		// Match {{}} or {{ }} (empty or whitespace-only)
		const invalidPlaceholderRegex = /\{\{\s*\}\}/g;

		const checkText = (text: string, context: string) => {
			if (!text) return;
			let match;
			while ((match = invalidPlaceholderRegex.exec(text)) !== null) {
				invalidPatterns.push(`Invalid placeholder ${match[0]} found in ${context}`);
			}
		};

		const processBlock = (block: EmailTemplateBlock) => {
			if (block.type === "subject" || block.type === "preheader" || block.type === "text" || block.type === "footerText") {
				const content = (block as Extract<EmailTemplateBlock, { type: "subject" | "preheader" | "text" | "footerText" }>).content || "";
				checkText(content, `${block.type} block`);
			}
			if (block.type === "button") {
				const buttonBlock = block as Extract<EmailTemplateBlock, { type: "button" }>;
				checkText(buttonBlock.label || "", "button label");
				checkText(buttonBlock.url || "", "button URL");
			}
			if (block.type === "unsubscribe") {
				const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
				checkText(unsubscribeBlock.text || "", "unsubscribe text");
				checkText(unsubscribeBlock.url || "", "unsubscribe URL");
			}
			if (block.type === "navigation") {
				const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
				navBlock.links?.forEach((link, index) => {
					checkText(link.label || "", `navigation link ${index + 1} label`);
					checkText(link.url || "", `navigation link ${index + 1} URL`);
				});
			}
			if (block.type === "columns") {
				const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
				colsBlock.columns?.forEach(col => {
					col.blocks?.forEach(processBlock);
				});
			}
			if (block.type === "container") {
				const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
				containerBlock.blocks?.forEach(processBlock);
			}
		};

		blocks.forEach(processBlock);
		if (subject) checkText(subject, "subject");
		if (preheader) checkText(preheader, "preheader");

		return invalidPatterns;
	}, []);

	const handleAddBlock = (type: EmailTemplateBlock["type"], section: EmailSection) => {
		if (!draftTemplate) return;
		const newBlock = createBlock(type, section);
		handleDraftChange({ blocks: [...draftTemplate.blocks, newBlock] });
		handleSelectBlock(newBlock.id);
		if (isMobile) {
			setMobilePanelTab("properties");
			setMobilePanelOpen(true);
		}
	};

	const handleAddPattern = (pattern: Pattern) => {
		if (!draftTemplate) return;
		
		// Convert pattern to blocks using columns structure
		const newBlocks: EmailTemplateBlock[] = [];
		
		for (const row of pattern.defaultRows) {
			// For multi-column rows, create a columns block
			if (row.layoutVariant !== "1col") {
				const columnCount = row.layoutVariant === "3col" ? "3" : "2";
				const columnsBlock = createBlock("columns", pattern.allowedSectionKinds[0]) as Extract<EmailTemplateBlock, { type: "columns" }>;
				columnsBlock.columnCount = columnCount;
				columnsBlock.gap = row.gap === "sm" ? 8 : row.gap === "md" ? 16 : row.gap === "lg" ? 24 : 16;
				columnsBlock.stackOnMobile = row.stackOnMobile ?? true;
				
				// Create columns with blocks
				columnsBlock.columns = row.columns.map((col) => ({
					id: crypto.randomUUID(),
					width: col.widthPercent,
					blocks: col.defaultBlocks.map((patternBlock) => {
						const block = createBlock(patternBlock.type, pattern.allowedSectionKinds[0]);
						if (patternBlock.defaults) {
							Object.assign(block, patternBlock.defaults);
						}
						return block;
					}),
				}));
				
				newBlocks.push(columnsBlock);
			} else {
				// For single column rows, add blocks directly
				for (const column of row.columns) {
					for (const patternBlock of column.defaultBlocks) {
						const block = createBlock(patternBlock.type, pattern.allowedSectionKinds[0]);
						if (patternBlock.defaults) {
							Object.assign(block, patternBlock.defaults);
						}
						newBlocks.push(block);
					}
				}
			}
		}
		
		handleDraftChange({ blocks: [...draftTemplate.blocks, ...newBlocks] });
		if (newBlocks.length > 0) {
			handleSelectBlock(newBlocks[0].id);
		}
		if (isMobile) {
			setMobilePanelTab("properties");
			setMobilePanelOpen(true);
		}
	};

	const handleOpenImagePicker = (blockId: string) => {
		setImagePickerTargetBlockId(blockId);
		setImagePickerOpen(true);
	};

	const handleImagePickerOpenChange = (open: boolean) => {
		setImagePickerOpen(open);
		if (!open) {
			setImagePickerTargetBlockId(null);
		}
	};

	const handleSelectBrandImage = (url: string) => {
		if (!draftTemplate || !imagePickerTargetBlockId) return;
		const targetBlock = findBlockById(draftTemplate.blocks, imagePickerTargetBlockId);
		if (!targetBlock || (targetBlock.type !== "image" && targetBlock.type !== "logo")) {
			toast.error(t("emailDesigner.toast.imagePickerMissing"));
			handleImagePickerOpenChange(false);
			return;
		}
		handleUpdateBlock(targetBlock.id, { ...targetBlock, src: url });
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
		const path = `organizations/${currentOrg.id}/branding/email-designer-${Date.now()}.${extension}`;
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

	const handleUpdateBlock = (blockId: string, updatedBlock: EmailTemplateBlock) => {
		if (!draftTemplate) return;
		const { blocks: nextBlocks, updated } = updateBlockTree(draftTemplate.blocks, blockId, updatedBlock);
		if (!updated) return;

		// Sync subject/preheader blocks with template fields
		const updates: Partial<EmailTemplate> = { blocks: nextBlocks };
		if (updatedBlock.type === "subject") {
			updates.subject = updatedBlock.content;
		} else if (updatedBlock.type === "preheader") {
			updates.preheader = updatedBlock.content;
		}

		handleDraftChange(updates);
	};

	const handleAddNestedBlock = (parentBlockId: string, blockType: EmailTemplateBlock["type"], columnId?: string) => {
		if (!draftTemplate) return;
		const parentBlock = draftTemplate.blocks.find(b => b.id === parentBlockId);
		if (!parentBlock) return;

		const newBlock = createBlock(blockType, parentBlock.section || "body");
		
		if (parentBlock.type === "columns" && columnId) {
			const colsBlock = parentBlock as Extract<EmailTemplateBlock, { type: "columns" }>;
			const updatedColumns = colsBlock.columns.map(col => 
				col.id === columnId 
					? { ...col, blocks: [...(col.blocks || []), newBlock] }
					: col
			);
			handleUpdateBlock(parentBlockId, { ...parentBlock, columns: updatedColumns } as EmailTemplateBlock);
		} else if (parentBlock.type === "container") {
			const containerBlock = parentBlock as Extract<EmailTemplateBlock, { type: "container" }>;
			handleUpdateBlock(parentBlockId, { ...containerBlock, blocks: [...(containerBlock.blocks || []), newBlock] } as EmailTemplateBlock);
		}
		handleSelectBlock(newBlock.id);
	};

	const handleDeleteBlock = (blockId: string) => {
		if (!draftTemplate) return;
		
		// Helper to recursively find and remove a block (including nested ones)
		const removeBlock = (blocks: EmailTemplateBlock[], id: string): EmailTemplateBlock[] => {
			return blocks
				.filter(block => block.id !== id)
				.map(block => {
					if (block.type === "columns") {
						const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
						return {
							...colsBlock,
							columns: colsBlock.columns.map(col => ({
								...col,
								blocks: removeBlock(col.blocks || [], id),
							})),
						} as EmailTemplateBlock;
					}
					if (block.type === "container") {
						const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
						return {
							...containerBlock,
							blocks: removeBlock(containerBlock.blocks || [], id),
						} as EmailTemplateBlock;
					}
					return block;
				});
		};
		
		const nextBlocks = removeBlock(draftTemplate.blocks, blockId);
		handleDraftChange({ blocks: nextBlocks });
		if (selectedBlockId === blockId) {
			setSelectedBlockId(undefined);
		}
	};

	const handleDuplicateBlock = (blockId: string) => {
		if (!draftTemplate) return;
		
		// Helper to recursively duplicate a block (including nested ones)
		const duplicateBlockRecursive = (block: EmailTemplateBlock): EmailTemplateBlock => {
			const duplicated = {
				...block,
				id: crypto.randomUUID(),
			};
			
			if (block.type === "columns") {
				const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
				return {
					...duplicated,
					columns: colsBlock.columns.map(col => ({
						...col,
						id: crypto.randomUUID(),
						blocks: (col.blocks || []).map(duplicateBlockRecursive),
					})),
				} as EmailTemplateBlock;
			}
			
			if (block.type === "container") {
				const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
				return {
					...duplicated,
					blocks: (containerBlock.blocks || []).map(duplicateBlockRecursive),
				} as EmailTemplateBlock;
			}
			
			return duplicated;
		};
		
		const blockToDuplicate = draftTemplate.blocks.find(b => b.id === blockId);
		if (!blockToDuplicate) return;
		
		const duplicated = duplicateBlockRecursive(blockToDuplicate);
		const blockIndex = draftTemplate.blocks.findIndex(b => b.id === blockId);
		const nextBlocks = [
			...draftTemplate.blocks.slice(0, blockIndex + 1),
			duplicated,
			...draftTemplate.blocks.slice(blockIndex + 1),
		];
		
		handleDraftChange({ blocks: nextBlocks });
		handleSelectBlock(duplicated.id);
		toast.success(t("emailDesigner.toast.duplicated"));
	};

	const handleReorderBlocks = (fromIndex: number, toIndex: number) => {
		if (!draftTemplate) return;
		const blocks = [...(draftTemplate.blocks ?? [])];
		const [moved] = blocks.splice(fromIndex, 1);
		blocks.splice(toIndex, 0, moved);
		handleDraftChange({ blocks });
	};

	// Auto-register placeholders found in content but not in registry
	useEffect(() => {
		if (!draftTemplate?.blocks) return;

		// Create a content hash to track if we've already processed this content
		const contentHash = JSON.stringify({
			blocks: draftTemplate.blocks,
			subject: draftTemplate.subject,
			preheader: draftTemplate.preheader,
		});

		// Skip if we've already processed this exact content
		if (lastProcessedContentRef.current === contentHash) {
			return;
		}

		const placeholders = draftTemplate.placeholders ?? [];
		const contentKeys = extractPlaceholderKeysFromContent(draftTemplate.blocks, draftTemplate.subject, draftTemplate.preheader);
		const contentKeysSet = new Set(Array.from(contentKeys).map(k => k.toLowerCase()));
		const registeredKeys = new Set(placeholders.map(p => p.key.toLowerCase()));
		
		// Find missing keys (in content but not registered)
		const missingKeys = Array.from(contentKeys).filter(key => !registeredKeys.has(key.toLowerCase()));
		
		// Find unused keys (registered but not in content)
		const unusedKeys = placeholders.filter(p => !contentKeysSet.has(p.key.toLowerCase()));

		// Only update if there are changes
		if (missingKeys.length > 0 || unusedKeys.length > 0) {
			const newPlaceholders: EmailTemplatePlaceholder[] = missingKeys.map(key => ({
				id: crypto.randomUUID(),
				key,
				label: undefined,
				description: undefined,
			}));

			// Use functional update to ensure we merge with latest placeholders
			setDraftOverrides((prev) => {
				const currentPlaceholders = prev?.placeholders ?? normalizedBaseTemplate?.placeholders ?? [];
				const existingKeys = new Set(currentPlaceholders.map(p => p.key.toLowerCase()));
				const trulyMissing = newPlaceholders.filter(p => !existingKeys.has(p.key.toLowerCase()));
				
				// Remove placeholders that are no longer in content
				const filteredPlaceholders = currentPlaceholders.filter(p => 
					contentKeysSet.has(p.key.toLowerCase())
				);
				
				// Add new placeholders
				const updatedPlaceholders = [...filteredPlaceholders, ...trulyMissing];
				
				// Only update if there are actual changes
				if (trulyMissing.length === 0 && filteredPlaceholders.length === currentPlaceholders.length) {
					return prev;
				}

				return {
					...(prev ?? {}),
					placeholders: updatedPlaceholders,
				};
			});
		}

		// Update the ref to mark this content as processed
		lastProcessedContentRef.current = contentHash;
		// We intentionally exclude draftTemplate.placeholders from deps to avoid infinite loops
		// since this effect updates placeholders. We read placeholders inside the effect.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [draftTemplate?.blocks, draftTemplate?.subject, draftTemplate?.preheader, extractPlaceholderKeysFromContent, normalizedBaseTemplate?.placeholders]);

	if (isLoadingTemplates) {
		return (
			<div className="p-6 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[600px] w-full" />
			</div>
		);
	}

	if (!emailDesignerContext) {
		console.error("EmailDesignerContext is null - this should not happen if wrapper is correct");
		return (
			<div className="p-6 space-y-4">
				<div className="text-destructive">
					<h2 className="text-xl font-bold">Context Error</h2>
					<p className="text-sm">Email designer context is not available. Please refresh the page.</p>
				</div>
			</div>
		);
	}

	if (!safeTemplates.length) {
		return (
			<div className="p-4 md:p-6 space-y-6">
				<div>
					<p className="text-sm text-muted-foreground">{t("emailDesigner.subtitle")}</p>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{t("emailDesigner.title")}
					</h1>
				</div>
				<Card className="border border-dashed">
					<CardContent className="py-12 flex flex-col items-center text-center space-y-4">
						<Mail className="h-12 w-12 text-muted-foreground" />
						<div className="space-y-2">
							<p className="text-xl font-semibold text-foreground">
								{t("emailDesigner.empty.title")}
							</p>
							<p className="text-muted-foreground max-w-md">
								{t("emailDesigner.empty.description")}
							</p>
						</div>
						<Button onClick={safeContextHandleCreateNewTemplate} disabled={createTemplate.isPending}>
							{createTemplate.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Mail className="h-4 w-4 mr-2" />
							)}
							{t("emailDesigner.empty.action")}
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

if (!draftTemplate || !normalizedBaseTemplate) {
	return (
		<div className="p-6 space-y-4">
			<Skeleton className="h-10 w-64" />
			<Skeleton className="h-[600px] w-full" />
		</div>
	);
}

	const placeholders = draftTemplate.placeholders ?? [];

	// Detect invalid placeholder patterns in content
	const invalidPlaceholders = draftTemplate?.blocks
		? detectInvalidPlaceholders(
				draftTemplate.blocks,
				draftTemplate.subject,
				draftTemplate.preheader
			)
		: [];

	const validatePlaceholderKey = (key: string, currentId?: string): string | null => {
		const trimmed = key?.trim() || "";
		if (!trimmed) {
			return "Placeholders cannot be empty. Example: {{key_1}}.";
		}
		if (!PLACEHOLDER_KEY_REGEX.test(trimmed)) {
			return "Use only English letters, numbers, underscores (_) or hyphens (-). No spaces allowed.";
		}
		const isDuplicate = placeholders.some(
			(placeholder) =>
				placeholder.key.toLowerCase() === trimmed.toLowerCase() &&
				placeholder.id !== currentId,
		);
		if (isDuplicate) {
			return "This key already exists in this template. Choose a unique name.";
		}
		return null;
	};

	const getNextPlaceholderKey = () => {
		let index = placeholders.length + 1;
		let candidate = `key_${index}`;
		const existing = new Set(placeholders.map((p) => p.key.toLowerCase()));
		while (existing.has(candidate.toLowerCase())) {
			index += 1;
			candidate = `key_${index}`;
		}
		return candidate;
	};

	const handleAddPlaceholder = (): EmailTemplatePlaceholder | null => {
		const newKey = getNextPlaceholderKey();
		const validationError = validatePlaceholderKey(newKey);
		if (validationError) {
			toast.error(validationError);
			return null;
		}

		const newPlaceholder: EmailTemplatePlaceholder = {
			id: crypto.randomUUID(),
			key: newKey,
			label: undefined,
			description: undefined,
		};
		handleDraftChange({
			placeholders: [...placeholders, newPlaceholder],
		});
		return newPlaceholder;
	};

	const handleNavigateToField = (blockId: string, field: string) => {
		// Select the block first (this will automatically switch section via handleSelectBlock)
		handleSelectBlock(blockId);
		
		// Scroll to the properties panel (if mobile, switch to properties tab)
		if (isMobile) {
			setMobilePanelTab("properties");
			setMobilePanelOpen(true);
		}
		
		// The EmailBlockProperties component should handle focusing the specific field
		// We'll use a small delay to ensure the component has rendered
		setTimeout(() => {
			// Trigger a custom event that the properties component can listen to
			window.dispatchEvent(new CustomEvent("email-designer:focus-field", {
				detail: { blockId, field }
			}));
		}, 100);
	};

	const sidebarContent = (
		<EmailSidebar
			templates={safeTemplates}
			currentTemplate={baseTemplate}
			onCreateNewTemplate={safeContextHandleCreateNewTemplate}
			isCreating={createTemplate.isPending}
			onAddBlock={handleAddBlock}
			onAddPattern={handleAddPattern}
			onOpenAIBuilder={() => setAiBuilderOpen(true)}
			blocks={draftTemplate.blocks ?? []}
			selectedBlockId={selectedBlockId}
			onSelectBlock={handleSelectBlock}
			onReorderBlocks={handleReorderBlocks}
			onDuplicateBlock={handleDuplicateBlock}
			onDeleteBlock={handleDeleteBlock}
			currentSection={currentSection}
			onSectionChange={setCurrentSection}
		/>
	);

	const propertiesContent = (
		<div className="h-full flex flex-col overflow-hidden">
			{/* Missing Values Alert - Top Priority */}
			<div className="p-3 border-b shrink-0">
				<EmailMissingValuesAlert
					blocks={draftTemplate.blocks ?? []}
					onNavigateToField={handleNavigateToField}
				/>
			</div>
			
			<div className="flex-1 min-h-0 overflow-y-auto">
			{selectedBlock ? (
			<EmailBlockProperties
				block={selectedBlock}
				onChange={(updatedBlock) => handleUpdateBlock(updatedBlock.id, updatedBlock)}
				onDelete={handleDeleteBlock}
				onAddNestedBlock={handleAddNestedBlock}
				onOpenImagePicker={handleOpenImagePicker}
				placeholders={placeholders}
				invalidPlaceholders={invalidPlaceholders}
				onAddPlaceholder={handleAddPlaceholder}
			/>
			) : (
					<EmailTemplateSettings
						name={draftTemplate.name ?? ""}
						designTokens={draftTemplate.designTokens ?? {
							background: "#ffffff",
							surface: "#f8fafc",
							text: "#0f172a",
							primary: "#2563eb",
							fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
							borderRadius: 12,
						}}
						onChange={(updates) => {
							const nextTokens = updates.designTokens ?? draftTemplate.designTokens ?? {
								background: "#ffffff",
								surface: "#f8fafc",
								text: "#0f172a",
								primary: "#2563eb",
								fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
								borderRadius: 12,
							};
							handleDraftChange({
								name: updates.name ?? draftTemplate.name ?? "",
								designTokens: nextTokens,
							});
						}}
					/>
			)}
			</div>
		</div>
	);

	const canvasContent = (
		<div className="flex flex-col">
			<EmailCanvasHeader
				templates={safeTemplates}
				currentTemplate={baseTemplate}
				onTemplateChange={async (id: string) => {
					setDraftOverrides(null);
					setSelectedBlockId(undefined);
					await safeContextOnTemplateChange(id);
				}}
				onCreateNewTemplate={safeContextHandleCreateNewTemplate}
				isMobile={isMobile}
				isLive={isSubscribed}
				activeUsers={activeUsers}
			/>
			<div>
				<EmailDesignerCanvas
					blocks={draftTemplate.blocks ?? []}
					selectedBlockId={selectedBlockId}
					onSelectBlock={(id) => {
						handleSelectBlock(id);
						if (isMobile) {
							setMobilePanelTab("properties");
							setMobilePanelOpen(true);
						}
					}}
					designTokens={draftTemplate.designTokens ?? {
						background: "#ffffff",
						surface: "#f8fafc",
						text: "#0f172a",
						primary: "#2563eb",
						fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
						borderRadius: 12,
					}}
					activeUsers={activeUsers}
					currentUserId={authUser?.uid}
					onCursorMove={updateCursor}
					onBlockUpdate={(blockId, updates) => {
						if (draftTemplate) {
							const updatedBlocks = draftTemplate.blocks.map(block => 
								block.id === blockId ? { ...block, ...updates } as EmailTemplateBlock : block
							);
							// Update HTML content when rawHtml block is updated
							if ('html' in updates && updates.html !== undefined) {
								const newHtml = convertBlocksToHtml(
									updatedBlocks,
									draftTemplate.designTokens ?? {
										background: "#ffffff",
										surface: "#f8fafc",
										text: "#0f172a",
										primary: "#2563eb",
										fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
										borderRadius: 12,
									},
									draftTemplate.subject,
									draftTemplate.preheader
								);
								handleDraftChange({ blocks: updatedBlocks, htmlContent: newHtml });
							} else {
								handleDraftChange({ blocks: updatedBlocks });
							}
						}
					}}
				/>
			</div>
		</div>
	);

	return (
		<>
		<div className="flex min-h-screen">
			{isMobile ? (
				<>
					<div className="flex-1 flex flex-col min-w-0 pb-16">
						{/* Mobile Header */}
						<div className="flex items-center justify-between p-4 border-b">
							<h1 className="text-xl font-semibold text-foreground">
								{draftTemplate?.name || t("emailDesigner.title")}
							</h1>
						</div>
						{canvasContent}
					</div>
					{/* Mobile Bottom Navigation */}
					<div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:hidden">
						<div className="flex items-center justify-around h-16 px-2">
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "blocks" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "blocks") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("blocks");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Menu className="h-5 w-5" />
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.blocks")}
								</span>
							</Button>
							<Button
								variant={mobilePanelOpen && mobilePanelTab === "preview" ? "secondary" : "ghost"}
								className="flex-1 flex flex-col items-center justify-center gap-1 h-full"
								onClick={() => {
									if (mobilePanelOpen && mobilePanelTab === "preview") {
										setMobilePanelOpen(false);
									} else {
										setMobilePanelTab("preview");
										setMobilePanelOpen(true);
									}
								}}
							>
								<Eye className="h-5 w-5" />
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.preview")}
								</span>
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
								<span className="text-xs font-medium">
									{t("emailDesigner.mobile.properties")}
								</span>
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
								onValueChange={(v) =>
									setMobilePanelTab(
										v as "blocks" | "preview" | "properties",
									)
								}
								className="flex flex-col flex-1 min-h-0"
							>
								<div className="px-4 pt-2 pb-1 border-b shrink-0">
									<TabsList className="w-full">
										<TabsTrigger value="blocks" className="flex-1">
											{t("emailDesigner.mobile.blocks")}
										</TabsTrigger>
										<TabsTrigger value="preview" className="flex-1">
											{t("emailDesigner.mobile.preview")}
										</TabsTrigger>
										<TabsTrigger value="properties" className="flex-1">
											{t("emailDesigner.mobile.properties")}
										</TabsTrigger>
									</TabsList>
								</div>
								<div className="flex-1 overflow-y-auto min-h-0">
									<TabsContent
										value="blocks"
										className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
									>
										<div className="h-full overflow-y-auto">
											{sidebarContent}
										</div>
									</TabsContent>
									<TabsContent
										value="preview"
										className="m-0 p-0"
									>
											<EmailDesignerCanvas
											blocks={draftTemplate.blocks ?? []}
												selectedBlockId={selectedBlockId}
												onSelectBlock={(id) => {
													handleSelectBlock(id);
													setMobilePanelTab("properties");
												}}
											designTokens={draftTemplate.designTokens ?? {
												background: "#ffffff",
												surface: "#f8fafc",
												text: "#0f172a",
												primary: "#2563eb",
												fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
												borderRadius: 12,
											}}
											activeUsers={activeUsers}
											currentUserId={authUser?.uid}
											onCursorMove={updateCursor}
											onBlockUpdate={(blockId, updates) => {
												if (draftTemplate) {
													const updatedBlocks = draftTemplate.blocks.map(block => 
														block.id === blockId ? { ...block, ...updates } as EmailTemplateBlock : block
													);
													// Update HTML content when rawHtml block is updated
													if ('html' in updates && updates.html !== undefined) {
														const newHtml = convertBlocksToHtml(
															updatedBlocks,
															draftTemplate.designTokens ?? {
																background: "#ffffff",
																surface: "#f8fafc",
																text: "#0f172a",
																primary: "#2563eb",
																fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
																borderRadius: 12,
															},
															draftTemplate.subject,
															draftTemplate.preheader
														);
														handleDraftChange({ blocks: updatedBlocks, htmlContent: newHtml });
													} else {
														handleDraftChange({ blocks: updatedBlocks });
													}
												}
											}}
										/>
									</TabsContent>
									<TabsContent
										value="properties"
										className="h-full m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
									>
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
					<ResizablePanel defaultSize={18} minSize={16} maxSize={25} className="overflow-hidden">
						{sidebarContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel minSize={40}>
						{canvasContent}
					</ResizablePanel>
					<ResizableHandle withHandle />
					<ResizablePanel defaultSize={22} minSize={18} maxSize={30} className="overflow-hidden">
						{propertiesContent}
					</ResizablePanel>
				</ResizablePanelGroup>
			)}
		</div>
		<BrandImagePickerDialog
			open={imagePickerOpen}
			onOpenChange={handleImagePickerOpenChange}
			assets={brandAssets}
			onSelect={handleSelectBrandImage}
			onUploadImage={handleBrandImageUpload}
			isUploading={fileUpload.isUploading}
			uploadState={uploadState}
		/>
		<AIEmailBuilderDialog
			open={aiBuilderOpen}
			onOpenChange={setAiBuilderOpen}
			currentOrg={currentOrg ?? undefined}
			currentTemplate={baseTemplate ?? undefined}
			templates={safeTemplates}
			generateTemplate={generateEmailTemplate}
			onTemplateCreated={(templateId) => {
				safeSetContextCurrentTemplateId(templateId);
				setAiBuilderOpen(false);
				// Navigate to the newly created template
				navigate(`/email-designer/${templateId}`, { replace: true });
			}}
			products={products.map((p) => ({
				name: p.name,
				description: p.description,
				price: p.price,
				imageUrl: p.images?.[0],
			}))}
			galleryImages={brandAssets.gallery}
		/>
		</>
	);
}

function createBlock(type: EmailTemplateBlock["type"], section: EmailSection): EmailTemplateBlock {
	if (type === "subject") {
		return {
			id: crypto.randomUUID(),
			type: "subject",
			section: "header",
			content: "Email subject",
		};
	}
	if (type === "preheader") {
		return {
			id: crypto.randomUUID(),
			type: "preheader",
			section: "header",
			content: "Email preheader",
		};
	}
	if (type === "logo") {
		return {
			id: crypto.randomUUID(),
			type: "logo",
			section: "header",
			src: "",
			alt: "Logo",
			width: 120,
			align: "center",
			aspectRatio: "auto",
			borderRadius: 0,
		};
	}
	if (type === "navigation") {
		return {
			id: crypto.randomUUID(),
			type: "navigation",
			section: "header",
			links: [],
			align: "center",
		};
	}
	if (type === "text") {
		return {
			id: crypto.randomUUID(),
			type: "text",
			section: section,
			content: "New text block",
			align: "left",
			emphasize: false,
		};
	}
	if (type === "button") {
		return {
			id: crypto.randomUUID(),
			type: "button",
			section: section,
			label: "Call to action",
			url: "https://example.com",
			variant: "primary",
			align: "center",
			buttonWidth: "auto",
			buttonHeight: 44,
		};
	}
	if (type === "divider") {
		return {
			id: crypto.randomUUID(),
			type: "divider",
			section: section,
			style: "solid",
			color: "#e5e7eb",
			width: 1,
			align: "center",
			dividerWidth: 100,
		};
	}
	if (type === "spacer") {
		return {
			id: crypto.randomUUID(),
			type: "spacer",
			section: section,
			height: 16,
		};
	}
	if (type === "image") {
		return {
			id: crypto.randomUUID(),
			type: "image",
			section: section,
			src: "",
			alt: "",
			width: 400,
			align: "center",
			aspectRatio: "auto",
			borderRadius: 0,
		};
	}
	if (type === "rawHtml") {
		return {
			id: crypto.randomUUID(),
			type: "rawHtml",
			section: section,
			html: "",
		};
	}
	if (type === "footerText") {
		return {
			id: crypto.randomUUID(),
			type: "footerText",
			section: "footer",
			content: "Footer text",
			align: "center",
		};
	}
	if (type === "socialLinks") {
		return {
			id: crypto.randomUUID(),
			type: "socialLinks",
			section: "footer",
			links: [],
			align: "center",
			iconSize: 24,
		};
	}
	if (type === "unsubscribe") {
		return {
			id: crypto.randomUUID(),
			type: "unsubscribe",
			section: "footer",
			text: "Unsubscribe",
			url: "#unsubscribe",
			align: "center",
		};
	}
	if (type === "columns") {
		const columnCount = 2;
		return {
			id: crypto.randomUUID(),
			type: "columns",
			section: section,
			columnCount: "2",
			gap: 16,
			align: "left",
			stackOnMobile: true,
			columns: Array.from({ length: columnCount }, () => ({
				id: crypto.randomUUID(),
				width: 100 / columnCount,
				blocks: [],
			})),
		};
	}
	if (type === "container") {
		return {
			id: crypto.randomUUID(),
			type: "container",
			section: section,
			maxWidth: 600,
			align: "center",
			padding: "md",
			blocks: [],
		};
	}
	// Fallback
	return {
		id: crypto.randomUUID(),
		type: "text",
		section: section,
		content: "New text block",
		align: "left",
		emphasize: false,
	};
}

function findBlockById(blocks: EmailTemplateBlock[], blockId: string): EmailTemplateBlock | undefined {
	for (const block of blocks) {
		if (block.id === blockId) {
			return block;
		}
		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			for (const column of colsBlock.columns ?? []) {
				const nested = findBlockById(column.blocks || [], blockId);
				if (nested) {
					return nested;
				}
			}
		} else if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			const nested = findBlockById(containerBlock.blocks || [], blockId);
			if (nested) {
				return nested;
			}
		}
	}
	return undefined;
}

function updateBlockTree(
	blocks: EmailTemplateBlock[],
	blockId: string,
	updatedBlock: EmailTemplateBlock,
): { blocks: EmailTemplateBlock[]; updated: boolean } {
	let hasUpdated = false;

	const nextBlocks = blocks.map((block) => {
		if (block.id === blockId) {
			hasUpdated = true;
			return updatedBlock;
		}

		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			let columnUpdated = false;
			const nextColumns = colsBlock.columns.map((column) => {
				const result = updateBlockTree(column.blocks || [], blockId, updatedBlock);
				if (result.updated) {
					columnUpdated = true;
					return { ...column, blocks: result.blocks };
				}
				return column;
			});
			if (columnUpdated) {
				hasUpdated = true;
				return { ...colsBlock, columns: nextColumns } as EmailTemplateBlock;
			}
		} else if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			const result = updateBlockTree(containerBlock.blocks || [], blockId, updatedBlock);
			if (result.updated) {
				hasUpdated = true;
				return { ...containerBlock, blocks: result.blocks } as EmailTemplateBlock;
			}
		}

		return block;
	});

	return { blocks: hasUpdated ? nextBlocks : blocks, updated: hasUpdated };
}


