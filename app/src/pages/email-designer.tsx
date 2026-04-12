import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Menu, Settings, Eye, Loader2, Mail, AlertCircle, CreditCard } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
	EmailTemplate,
	EmailTemplateData,
	EmailTemplateBlock,
	EmailSection,
	EmailTemplateDesignTokens,
	EmailTemplatePlaceholder,
} from "@/core";
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
import {
	EmailMissingValuesAlert,
	hasEmailMissingValues,
} from "@/components/email-designer/email-missing-values-alert";
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
import { useContactsByOrg } from "@/hooks/repository-hooks/use-contacts";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useProposalsByOrg } from "@/hooks/repository-hooks/use-proposals";
import {
	useContactMetafieldDefinitions,
	useContactMetafields,
} from "@/hooks/repository-hooks/use-contact-metafields";
import {
	useProductMetafieldDefinitions,
	useProductMetafields,
} from "@/hooks/repository-hooks/use-product-metafields";
import {
	getEntityDynamicSourceFields,
	getEntityDynamicSourceMapByPlaceholderKey,
} from "@/utils/dynamic-sources";
import { getCompatibleTemplateContexts } from "@/utils/email-template-compatibility";
import {
	buildPreviewPlaceholderValues,
	chooseDefaultPreviewRecordIds,
	formatContactPreviewLabel,
	formatInvoicePreviewLabel,
	formatProductPreviewLabel,
	formatProposalPreviewLabel,
} from "@/utils/email-preview-context";
import { extractEmailTemplateRequirements } from "@/utils/email-template-requirements";
import {
	useEmailTemplateVersions,
	useRestoreEmailTemplateVersion,
} from "@/hooks/repository-hooks/use-email-template-versions";

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
const AUTO_PREVIEW_VALUE = "__auto_preview__";
const EMPTY_PREVIEW_ENTITY_ID = "__preview_none__";
const LEGACY_ARTIFACT_PLACEHOLDER_KEY_REGEX = /^key_\d+$/i;

const isLegacyArtifactPlaceholderKey = (key: string | undefined): boolean =>
	Boolean(key && LEGACY_ARTIFACT_PLACEHOLDER_KEY_REGEX.test(key.trim()));

const sanitizePlaceholders = (
	placeholders: EmailTemplatePlaceholder[] | undefined,
): EmailTemplatePlaceholder[] =>
	(placeholders ?? []).filter(
		(placeholder) => !isLegacyArtifactPlaceholderKey(placeholder.key),
	);

const canonicalizeForSignature = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) => canonicalizeForSignature(item));
	}
	if (value && typeof value === "object") {
		const input = value as Record<string, unknown>;
		const output: Record<string, unknown> = {};
		for (const key of Object.keys(input).sort()) {
			const normalized = canonicalizeForSignature(input[key]);
			if (normalized !== undefined) {
				output[key] = normalized;
			}
		}
		return output;
	}
	return value;
};

const removeUndefinedDeep = (obj: unknown): unknown => {
	if (obj === null || obj === undefined) {
		return null;
	}
	if (Array.isArray(obj)) {
		return obj.map(removeUndefinedDeep).filter((item) => item !== undefined);
	}
	if (typeof obj === "object") {
		const cleaned: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			if (value !== undefined) {
				cleaned[key] = removeUndefinedDeep(value);
			}
		}
		return cleaned;
	}
	return obj;
};

const buildTemplateSavePayload = (
	template: EmailTemplate,
): {
	data: Partial<EmailTemplateData>;
	htmlContent: string;
	saveSignature: string;
	blocks: EmailTemplateBlock[];
} => {
	const blocks = Array.isArray(template.blocks) ? template.blocks : [];

	let htmlContent = template.htmlContent || "";
	if (blocks.length === 0) {
		htmlContent = "";
	} else if (!htmlContent || !htmlContent.trim()) {
		htmlContent = convertBlocksToHtml(
			blocks,
			template.designTokens || defaultDesignTokens,
			template.subject,
			template.preheader,
		);
	}

	const sections = blocks.reduce(
		(acc, block) => {
			acc[(block.section || "body") as "header" | "body" | "footer"].push(block.id);
			return acc;
		},
		{
			header: [] as string[],
			body: [] as string[],
			footer: [] as string[],
		},
	);

	const compatMode = template.compatMode ?? "legacy_v1";
	const data = removeUndefinedDeep({
		name: template.name,
		subject: template.subject || "Email",
		preheader: template.preheader,
		allowedContexts: template.allowedContexts ?? [],
		htmlContent,
		blocks,
		designTokens: template.designTokens ?? defaultDesignTokens,
		sections,
		placeholders: sanitizePlaceholders(template.placeholders),
		compatMode,
		requirements:
			compatMode === "canonical_v1"
				? extractEmailTemplateRequirements({
						subject: template.subject,
						preheader: template.preheader,
						htmlContent,
						allowedContexts: template.allowedContexts ?? [],
						compatMode: "canonical_v1",
					})
				: template.requirements,
		normalizationVersion: "email_vm_v1" as const,
	}) as Partial<EmailTemplateData>;

	const saveSignature = JSON.stringify(canonicalizeForSignature(data));

	return {
		data,
		htmlContent,
		saveSignature,
		blocks,
	};
};

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
	const isWideLayout = useMediaQuery("(min-width: 1600px)");
	const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
	const [mobilePanelTab, setMobilePanelTab] = useState<"blocks" | "preview" | "properties">("blocks");
	const [isReorderingBlocks, setIsReorderingBlocks] = useState(false);
	const [imagePickerOpen, setImagePickerOpen] = useState(false);
	const [imagePickerTargetBlockId, setImagePickerTargetBlockId] = useState<string | null>(null);
	const [brandAssets, setBrandAssets] = useState<BrandAssets>({ gallery: [] });
	const [uploadState, setUploadState] = useState<{ preview: string; progress: number } | null>(null);
	const fileUpload = useFileUpload();
	const updateOrganization = useUpdateOrganization();
	const authUser = useFirebaseAuthUser();
	const generateEmailTemplate = useGenerateEmailTemplate();
	const { data: products = [] } = useProductsByOrg(orgId);
	const { data: contacts = [] } = useContactsByOrg(orgId);
	const { data: invoices = [] } = useInvoices(orgId);
	const { data: proposals = [] } = useProposalsByOrg(orgId);
	const { data: productMetafieldDefinitions = [] } = useProductMetafieldDefinitions(orgId);
	const { data: contactMetafieldDefinitions = [] } = useContactMetafieldDefinitions(orgId);
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const [previewOverrides, setPreviewOverrides] = useState<{
		productId?: string;
		contactId?: string;
		invoiceId?: string;
		proposalId?: string;
	}>({});
	const [previewOverrideMode, setPreviewOverrideMode] = useState<{
		product: "auto" | "manual";
		contact: "auto" | "manual";
		invoice: "auto" | "manual";
		proposal: "auto" | "manual";
	}>({
		product: "auto",
		contact: "auto",
		invoice: "auto",
		proposal: "auto",
	});
	const dynamicSourceRuntimeOptions = useMemo(
		() => ({
			productMetafieldDefinitions,
			contactMetafieldDefinitions,
		}),
		[productMetafieldDefinitions, contactMetafieldDefinitions],
	);
	const dynamicSources = useMemo(
		() => getEntityDynamicSourceFields(dynamicSourceRuntimeOptions),
		[dynamicSourceRuntimeOptions],
	);
	const dynamicSourceByPlaceholderKey = useMemo(
		() => getEntityDynamicSourceMapByPlaceholderKey(dynamicSourceRuntimeOptions),
		[dynamicSourceRuntimeOptions],
	);
	
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
		cloned.placeholders = sanitizePlaceholders(cloned.placeholders);
		
		const inferSectionFromType = (type?: string): EmailSection => {
			if (type === "subject" || type === "preheader" || type === "logo" || type === "navigation") {
				return "header";
			}
			if (type === "footerText" || type === "socialLinks" || type === "unsubscribe") {
				return "footer";
			}
			return "body";
		};

		const normalizeBlockSections = (
			block: unknown,
			parentSection: EmailSection = "body"
		): EmailTemplateBlock => {
			const sourceBlock = (block ?? {}) as Record<string, unknown>;
			const typedBlock = sourceBlock as { section?: EmailSection; type?: string };
			const blockSection = typedBlock.section ?? inferSectionFromType(typedBlock.type) ?? parentSection;

			if (typedBlock.type === "columns") {
				const columnsBlock = sourceBlock as Extract<EmailTemplateBlock, { type: "columns" }>;
				return {
					...columnsBlock,
					section: blockSection,
					columns: (columnsBlock.columns || []).map((column) => ({
						...column,
						blocks: (column.blocks || []).map((nested) =>
							normalizeBlockSections(nested as EmailTemplateBlock, blockSection)
						),
					})),
				} as EmailTemplateBlock;
			}

			if (typedBlock.type === "container") {
				const containerBlock = sourceBlock as Extract<EmailTemplateBlock, { type: "container" }>;
				return {
					...containerBlock,
					section: blockSection,
					blocks: (containerBlock.blocks || []).map((nested) =>
						normalizeBlockSections(nested as EmailTemplateBlock, blockSection)
					),
				} as EmailTemplateBlock;
			}

			if (typedBlock.type === "paymentInstructions") {
				const paymentBlock = sourceBlock as Extract<
					EmailTemplateBlock,
					{ type: "paymentInstructions" }
				>;
				return {
					...paymentBlock,
					section: "body",
				} as EmailTemplateBlock;
			}

			return {
				...sourceBlock,
				section: blockSection,
			} as EmailTemplateBlock;
		};

		const buildSectionsFromBlocks = (blocks: EmailTemplateBlock[]) => {
			return blocks.reduce(
				(acc, block) => {
					acc[block.section ?? "body"].push(block.id);
					return acc;
				},
				{
					header: [] as string[],
					body: [] as string[],
					footer: [] as string[],
				}
			);
		};

		// Prefer existing saved blocks for visual editing and normalize section metadata.
		// Re-parsing HTML on each real-time update can collapse structure and lose editor fidelity.
		if (Array.isArray(cloned.blocks) && cloned.blocks.length > 0) {
			cloned.blocks = cloned.blocks.map((block) => normalizeBlockSections(block));
			cloned.sections = buildSectionsFromBlocks(cloned.blocks);

			console.log("[EMAIL-DESIGNER] Using stored blocks from template", {
				blocksCount: cloned.blocks.length,
				header: cloned.sections.header.length,
				body: cloned.sections.body.length,
				footer: cloned.sections.footer.length,
			});

			// Ensure HTML content exists for send/export flows.
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
		const canonicalize = (value: unknown): unknown => {
			if (Array.isArray(value)) {
				return value.map((item) => canonicalize(item));
			}
			if (value && typeof value === "object") {
				const input = value as Record<string, unknown>;
				const output: Record<string, unknown> = {};
				for (const key of Object.keys(input).sort()) {
					const normalized = canonicalize(input[key]);
					if (normalized !== undefined) {
						output[key] = normalized;
					}
				}
				return output;
			}
			return value;
		};

		const deepEqual = (left: unknown, right: unknown) =>
			JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

		// Don't compare htmlContent - it's regenerated from blocks, so slight differences are expected
		// Only compare the actual user-editable fields
		if (overrides.name !== undefined && overrides.name !== base.name) {
			return false;
		}
		if (overrides.subject !== undefined && overrides.subject !== base.subject) {
			return false;
		}
		if (overrides.preheader !== undefined && overrides.preheader !== base.preheader) {
			return false;
		}
		if (overrides.blocks && !deepEqual(overrides.blocks, base.blocks ?? [])) {
			return false;
		}
		if (overrides.sections && !deepEqual(overrides.sections, base.sections ?? {})) {
			return false;
		}
		if (overrides.designTokens && !deepEqual(overrides.designTokens, base.designTokens ?? defaultDesignTokens)) {
			return false;
		}
		if (overrides.placeholders && !deepEqual(overrides.placeholders, base.placeholders ?? [])) {
			return false;
		}
		if (
			overrides.allowedContexts &&
			!deepEqual(overrides.allowedContexts, base.allowedContexts ?? [])
		) {
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
			allowedContexts:
				overrides.allowedContexts ?? normalizedBaseTemplate.allowedContexts ?? [],
		};
	}, [normalizedBaseTemplate, draftOverrides]);
	const templateId = baseTemplate?.id;
	const { data: versions = [] } = useEmailTemplateVersions(templateId);
	const restoreVersion = useRestoreEmailTemplateVersion();
	const currentVersion = versions.length > 0
		? versions.reduce((max, item) => Math.max(max, item.version), 0)
		: null;

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
		lastSavedSignatureRef.current = ""; // Reset saved signature when template changes
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
	// Track the last saved payload signature to prevent unnecessary saves
	const lastSavedSignatureRef = useRef<string>("");

	const hasChanges = useMemo(() => {
		if (!draftOverrides) {
			return false;
		}

		// Only consider it a change if there are actual overrides
		// and they differ from the base template
		if (!normalizedBaseTemplate) {
			return Object.keys(draftOverrides).length > 0;
		}

		// Use areOverridesSynced to check if there are real differences
		return !areOverridesSynced(draftOverrides, normalizedBaseTemplate);
	}, [draftOverrides, normalizedBaseTemplate]);

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
				template.preheader,
			);
			if (invalid.length > 0) {
				const errorMessage = `Cannot save: Invalid placeholder patterns detected. Please fix empty placeholders like {{}} before saving.`;
				console.error("[EMAIL-DESIGNER] Save blocked - invalid placeholders:", invalid);
				throw new Error(errorMessage);
			}

			const { data: savedData, htmlContent, saveSignature, blocks } = buildTemplateSavePayload(template);
			if (
				lastSavedSignatureRef.current === saveSignature &&
				lastSavedSignatureRef.current !== ""
			) {
				console.log("[EMAIL-DESIGNER] Save skipped - payload unchanged");
				return;
			}

			const timestamp = new Date().toISOString();
			console.log("[EMAIL-DESIGNER] SAVE MUTATION START:", {
				timestamp,
				templateId: template.id,
				htmlLength: htmlContent.length,
				blocksCount: blocks.length,
			});

			console.log("[EMAIL-DESIGNER] Saving HTML:", {
				templateId: template.id,
				htmlLength: htmlContent.length,
				blocksCount: savedData.blocks?.length ?? 0,
			});

			await emailTemplateService.updateDraft(template.id, savedData);

			// Update last saved signature to prevent duplicate saves
			lastSavedSignatureRef.current = saveSignature;

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
	const currentDraftSaveSignature = useMemo(() => {
		if (!draftTemplate) {
			return "";
		}
		return buildTemplateSavePayload(draftTemplate).saveSignature;
	}, [draftTemplate]);
	const hasUnsavedChangesForHeader = (() => {
		if (!draftTemplate || !hasChanges) {
			return false;
		}
		// While the mutation is in-flight, keep "Unsaved changes" semantics true.
		if (isSavePending) {
			return true;
		}
		const lastSavedSignature = lastSavedSignatureRef.current;
		if (!lastSavedSignature) {
			return true;
		}
		return currentDraftSaveSignature !== lastSavedSignature;
	})();

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

		if (isReorderingBlocks) {
			return;
		}

		// Avoid scheduling another auto-save if one is in progress
		if (isSavePending) {
			return;
		}

		autoSaveTimerRef.current = setTimeout(() => {
			// Double-check we're not already saving (race condition protection)
			if (isSavePending) {
				return;
			}

			// Keep empty templates truly empty to avoid persisting scaffold-only wrapper tables.
			// For non-empty blocks, regenerate HTML so properties stay in sync.
			const htmlContent = draftTemplate.blocks.length === 0
				? ""
				: convertBlocksToHtml(
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
						draftTemplate.preheader,
					);

			const { saveSignature } = buildTemplateSavePayload({
				...draftTemplate,
				htmlContent,
			});
			if (
				lastSavedSignatureRef.current === saveSignature &&
				lastSavedSignatureRef.current !== ""
			) {
				console.log("[EMAIL-DESIGNER] Auto-save skipped - payload unchanged");
				return;
			}
			
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
	}, [draftTemplate, normalizedBaseTemplate, hasChanges, isSavePending, autoSaveMutate, isReorderingBlocks]);

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
			if (block.type === "paymentInstructions") {
				const paymentBlock = block as Extract<EmailTemplateBlock, { type: "paymentInstructions" }>;
				extractFromText(paymentBlock.ctaLabel || "");
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
			if (block.type === "paymentInstructions") {
				const paymentBlock = block as Extract<EmailTemplateBlock, { type: "paymentInstructions" }>;
				checkText(paymentBlock.ctaLabel || "", "payment instructions CTA label");
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

	const handleInsertSmartPaymentInstructions = useCallback(() => {
		if (!draftTemplate) return;
		if ((draftTemplate.blocks ?? []).some((block) => block.type === "paymentInstructions")) {
			return;
		}
		const newBlock = createBlock("paymentInstructions", "body");
		handleDraftChange({ blocks: [...draftTemplate.blocks, newBlock] });
		handleSelectBlock(newBlock.id);
		toast.success(
			t(
				"emailDesigner.paymentInstructions.inserted",
				"Smart Payment Instructions inserted.",
			),
		);
	}, [draftTemplate, handleDraftChange, handleSelectBlock, t]);


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

	const handleMoveBlockToContainer = (blockId: string, containerId: string) => {
		if (!draftTemplate || blockId === containerId) return;

		// Prevent moving a block into itself or its own descendants.
		if (blockContainsId(draftTemplate.blocks, blockId, containerId)) return;

		const { blocks: blocksWithoutMoved, removedBlock } = removeBlockFromTree(
			draftTemplate.blocks,
			blockId,
		);
		if (!removedBlock) return;

		const target = findBlockById(blocksWithoutMoved, containerId);
		if (!target || target.type !== "container") return;

		const containerBlock = target as Extract<EmailTemplateBlock, { type: "container" }>;
		const targetSection: EmailSection =
			containerBlock.section || removedBlock.section || "body";
		const movedBlock = withMovedBlockSection(removedBlock, targetSection);
		const updatedContainer: EmailTemplateBlock = {
			...containerBlock,
			blocks: [...(containerBlock.blocks || []), movedBlock],
		};
		const { blocks: nextBlocks, updated } = updateBlockTree(
			blocksWithoutMoved,
			containerId,
			updatedContainer,
		);
		if (!updated) return;

		handleDraftChange({ blocks: nextBlocks });
		handleSelectBlock(movedBlock.id);
	};

	const handleRestoreVersion = async (version: number) => {
		if (!templateId) return;
		await restoreVersion.mutateAsync({
			templateId,
			version,
		});
		setDraftOverrides(null);
		setSelectedBlockId(undefined);
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

		const placeholders = sanitizePlaceholders(draftTemplate.placeholders);
		const contentKeys = extractPlaceholderKeysFromContent(draftTemplate.blocks, draftTemplate.subject, draftTemplate.preheader);
		const contentKeysSet = new Set(Array.from(contentKeys).map(k => k.toLowerCase()));
		const registeredKeys = new Set(placeholders.map(p => p.key.toLowerCase()));
		
		// Find missing keys (in content but not registered)
		const missingKeys = Array.from(contentKeys).filter(
			(key) =>
				!registeredKeys.has(key.toLowerCase()) &&
				!isLegacyArtifactPlaceholderKey(key),
		);
		
		// Find unused keys (registered but not in content)
		const unusedKeys = placeholders.filter(p => !contentKeysSet.has(p.key.toLowerCase()));

		// Only update if there are changes
		if (missingKeys.length > 0 || unusedKeys.length > 0) {
			const buildDynamicSourceMetadata = (key: string) => {
				const source = dynamicSourceByPlaceholderKey[key.toLowerCase()];
				if (!source) {
					return {
						label: undefined,
						description: undefined,
						source: undefined,
					};
				}
				return {
					label: source.label,
					description: source.description,
					source: {
						type: "entity_field" as const,
						entity: source.entity,
						path: source.path,
						valueType: source.valueType,
					},
				};
			};

			const newPlaceholders: EmailTemplatePlaceholder[] = missingKeys.map((key) => {
				const dynamicSourceMetadata = buildDynamicSourceMetadata(key);
				return {
					id: crypto.randomUUID(),
					key,
					label: dynamicSourceMetadata.label,
					description: dynamicSourceMetadata.description,
					source: dynamicSourceMetadata.source,
				};
			});

			// Use functional update to ensure we merge with latest placeholders
			setDraftOverrides((prev) => {
				const currentPlaceholders = sanitizePlaceholders(
					prev?.placeholders ?? normalizedBaseTemplate?.placeholders,
				);
				const existingKeys = new Set(currentPlaceholders.map(p => p.key.toLowerCase()));
				const trulyMissing = newPlaceholders.filter(p => !existingKeys.has(p.key.toLowerCase()));
				
				// Remove placeholders that are no longer in content
				const filteredPlaceholders = currentPlaceholders.filter(p => 
					contentKeysSet.has(p.key.toLowerCase())
				);
				const enrichedPlaceholders = filteredPlaceholders.map((placeholder) => {
					const dynamicSourceMetadata = buildDynamicSourceMetadata(placeholder.key);
					if (!dynamicSourceMetadata.source) {
						return placeholder;
					}
					return {
						...placeholder,
						label: placeholder.label?.trim() || dynamicSourceMetadata.label,
						description:
							placeholder.description?.trim() || dynamicSourceMetadata.description,
						source: placeholder.source ?? dynamicSourceMetadata.source,
					};
				});
				
				// Add new placeholders
				const updatedPlaceholders = [...enrichedPlaceholders, ...trulyMissing];
				
				// Only update if there are actual changes
				const didEnrichExisting =
					JSON.stringify(filteredPlaceholders) !== JSON.stringify(enrichedPlaceholders);
				if (
					trulyMissing.length === 0 &&
					filteredPlaceholders.length === currentPlaceholders.length &&
					!didEnrichExisting
				) {
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
	}, [
		draftTemplate?.blocks,
		draftTemplate?.subject,
		draftTemplate?.preheader,
		extractPlaceholderKeysFromContent,
		normalizedBaseTemplate?.placeholders,
		dynamicSourceByPlaceholderKey,
	]);

	const placeholders = useMemo(
		() => sanitizePlaceholders(draftTemplate?.placeholders ?? normalizedBaseTemplate?.placeholders),
		[draftTemplate?.placeholders, normalizedBaseTemplate?.placeholders],
	);
	const templateAllowedContexts = useMemo(
		() => draftTemplate?.allowedContexts ?? normalizedBaseTemplate?.allowedContexts ?? [],
		[draftTemplate?.allowedContexts, normalizedBaseTemplate?.allowedContexts],
	);
	const insertableDynamicSources = useMemo(() => {
		return dynamicSources.filter((source) => {
			const placeholderKey = source.placeholderKey.toLowerCase();
			if (placeholders.some((placeholder) => placeholder.key.toLowerCase() === placeholderKey)) {
				return true;
			}

			const candidatePlaceholder: EmailTemplatePlaceholder = {
				id: "__candidate__",
				key: source.placeholderKey,
				label: source.label,
				description: source.description,
				source: {
					type: "entity_field",
					entity: source.entity,
					path: source.path,
					valueType: source.valueType,
				},
			};

			return (
				getCompatibleTemplateContexts({
					allowedContexts: templateAllowedContexts,
					placeholders: [...placeholders, candidatePlaceholder],
				}).length > 0
			);
		});
	}, [dynamicSources, placeholders, templateAllowedContexts]);
	const isInvoiceSendCompatible = useMemo(() => {
		const contexts = getCompatibleTemplateContexts({
			allowedContexts: templateAllowedContexts,
			placeholders,
		});
		return contexts.includes("invoice_send");
	}, [placeholders, templateAllowedContexts]);
	const hasSmartPaymentInstructionsBlock = useMemo(
		() => (draftTemplate?.blocks ?? []).some((block) => block.type === "paymentInstructions"),
		[draftTemplate?.blocks],
	);
	const shouldShowSmartPaymentWarning = isInvoiceSendCompatible && !hasSmartPaymentInstructionsBlock;
	const draftBlocks = draftTemplate?.blocks;
	const draftSubject = draftTemplate?.subject;
	const draftPreheader = draftTemplate?.preheader;
	const usedPlaceholderKeys = useMemo(
		() => {
			if (!draftBlocks?.length && !draftSubject && !draftPreheader) {
				return new Set<string>();
			}
			return extractPlaceholderKeysFromContent(
				draftBlocks ?? [],
				draftSubject,
				draftPreheader,
			);
		},
		[
			draftBlocks,
			draftSubject,
			draftPreheader,
			extractPlaceholderKeysFromContent,
		],
	);
	const defaultPreviewRecordIds = useMemo(
		() =>
			chooseDefaultPreviewRecordIds({
				placeholders,
				usedPlaceholderKeys,
				products,
				contacts,
				invoices,
				proposals,
				dynamicSourceByPlaceholderKey,
			}),
		[
			placeholders,
			usedPlaceholderKeys,
			products,
			contacts,
			invoices,
			proposals,
			dynamicSourceByPlaceholderKey,
		],
	);
	const selectedProductId =
		previewOverrideMode.product === "manual"
			? previewOverrides.productId
			: defaultPreviewRecordIds.productId;
	const selectedContactId =
		previewOverrideMode.contact === "manual"
			? previewOverrides.contactId
			: defaultPreviewRecordIds.contactId;
	const selectedInvoiceId =
		previewOverrideMode.invoice === "manual"
			? previewOverrides.invoiceId
			: defaultPreviewRecordIds.invoiceId;
	const selectedProposalId =
		previewOverrideMode.proposal === "manual"
			? previewOverrides.proposalId
			: defaultPreviewRecordIds.proposalId;
	const { data: selectedProductMetafields = [] } = useProductMetafields(
		orgId,
		selectedProductId ?? EMPTY_PREVIEW_ENTITY_ID,
	);
	const { data: selectedContactMetafields = [] } = useContactMetafields(
		orgId,
		selectedContactId ?? EMPTY_PREVIEW_ENTITY_ID,
	);
	const selectedProductMetafieldsByDefinitionId = useMemo(() => {
		const lookup: Record<string, unknown> = {};
		selectedProductMetafields.forEach((metafield) => {
			lookup[metafield.definitionId] = metafield.value;
		});
		return lookup;
	}, [selectedProductMetafields]);
	const selectedContactMetafieldsByDefinitionId = useMemo(() => {
		const lookup: Record<string, unknown> = {};
		selectedContactMetafields.forEach((metafield) => {
			lookup[metafield.definitionId] = metafield.value;
		});
		return lookup;
	}, [selectedContactMetafields]);
	const selectedProduct = useMemo(
		() => products.find((product) => product.id === selectedProductId),
		[products, selectedProductId],
	);
	const autoSelectedProduct = useMemo(
		() => products.find((product) => product.id === defaultPreviewRecordIds.productId),
		[products, defaultPreviewRecordIds.productId],
	);
	const selectedContact = useMemo(
		() => contacts.find((contact) => contact.id === selectedContactId),
		[contacts, selectedContactId],
	);
	const autoSelectedContact = useMemo(
		() => contacts.find((contact) => contact.id === defaultPreviewRecordIds.contactId),
		[contacts, defaultPreviewRecordIds.contactId],
	);
	const selectedInvoice = useMemo(
		() => invoices.find((invoice) => invoice.id === selectedInvoiceId),
		[invoices, selectedInvoiceId],
	);
	const autoSelectedInvoice = useMemo(
		() => invoices.find((invoice) => invoice.id === defaultPreviewRecordIds.invoiceId),
		[invoices, defaultPreviewRecordIds.invoiceId],
	);
	const selectedProposal = useMemo(
		() => proposals.find((proposal) => proposal.id === selectedProposalId),
		[proposals, selectedProposalId],
	);
	const autoSelectedProposal = useMemo(
		() => proposals.find((proposal) => proposal.id === defaultPreviewRecordIds.proposalId),
		[proposals, defaultPreviewRecordIds.proposalId],
	);
	const previewPlaceholderValues = useMemo(
		() =>
			buildPreviewPlaceholderValues({
				placeholders,
				usedPlaceholderKeys,
				selectedProduct,
				selectedContact,
				selectedInvoice,
				selectedProposal,
				selectedProductMetafieldsByDefinitionId,
				selectedContactMetafieldsByDefinitionId,
				dynamicSourceByPlaceholderKey,
			}),
		[
			placeholders,
			usedPlaceholderKeys,
			selectedProduct,
			selectedContact,
			selectedInvoice,
			selectedProposal,
			selectedProductMetafieldsByDefinitionId,
			selectedContactMetafieldsByDefinitionId,
			dynamicSourceByPlaceholderKey,
		],
	);
	const hasPreviewableDynamicSources = useMemo(() => {
		const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));
		return placeholders.some((placeholder) => {
			if (!usedKeysLower.has(placeholder.key.toLowerCase())) {
				return false;
			}
			if (placeholder.source?.type === "entity_field") {
				return true;
			}
			return Boolean(dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()]);
		});
	}, [placeholders, usedPlaceholderKeys, dynamicSourceByPlaceholderKey]);
	const usesProductSources = useMemo(() => {
		const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));
		return placeholders.some((placeholder) => {
			if (!usedKeysLower.has(placeholder.key.toLowerCase())) return false;
			if (placeholder.source?.type === "entity_field") return placeholder.source.entity === "product";
			return dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()]?.entity === "product";
		});
	}, [placeholders, usedPlaceholderKeys, dynamicSourceByPlaceholderKey]);
	const usesContactSources = useMemo(() => {
		const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));
		return placeholders.some((placeholder) => {
			if (!usedKeysLower.has(placeholder.key.toLowerCase())) return false;
			if (placeholder.source?.type === "entity_field") return placeholder.source.entity === "contact";
			return dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()]?.entity === "contact";
		});
	}, [placeholders, usedPlaceholderKeys, dynamicSourceByPlaceholderKey]);
	const usesInvoiceSources = useMemo(() => {
		const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));
		return placeholders.some((placeholder) => {
			if (!usedKeysLower.has(placeholder.key.toLowerCase())) return false;
			if (placeholder.source?.type === "entity_field") return placeholder.source.entity === "invoice";
			return dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()]?.entity === "invoice";
		});
	}, [placeholders, usedPlaceholderKeys, dynamicSourceByPlaceholderKey]);
	const usesProposalSources = useMemo(() => {
		const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));
		return placeholders.some((placeholder) => {
			if (!usedKeysLower.has(placeholder.key.toLowerCase())) return false;
			if (placeholder.source?.type === "entity_field") return placeholder.source.entity === "proposal";
			return dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()]?.entity === "proposal";
		});
	}, [placeholders, usedPlaceholderKeys, dynamicSourceByPlaceholderKey]);
	const previewProductOptions = useMemo(
		() =>
			products.map((product) => ({
				id: product.id,
				label: formatProductPreviewLabel(product),
			})),
		[products],
	);
	const previewContactOptions = useMemo(
		() =>
			contacts.map((contact) => ({
				id: contact.id,
				label: formatContactPreviewLabel(contact),
			})),
		[contacts],
	);
	const previewInvoiceOptions = useMemo(
		() =>
			invoices.map((invoice) => ({
				id: invoice.id,
				label: formatInvoicePreviewLabel(invoice),
			})),
		[invoices],
	);
	const previewProposalOptions = useMemo(
		() =>
			proposals.map((proposal) => ({
				id: proposal.id,
				label: formatProposalPreviewLabel(proposal),
			})),
		[proposals],
	);
	const defaultProductLabel = autoSelectedProduct
		? formatProductPreviewLabel(autoSelectedProduct)
		: t("emailDesigner.previewContext.noMatchingProduct");
	const defaultContactLabel = autoSelectedContact
		? formatContactPreviewLabel(autoSelectedContact)
		: t("emailDesigner.previewContext.noMatchingContact");
	const defaultInvoiceLabel = autoSelectedInvoice
		? formatInvoicePreviewLabel(autoSelectedInvoice)
		: t("emailDesigner.previewContext.noMatchingInvoice");
	const defaultProposalLabel = autoSelectedProposal
		? formatProposalPreviewLabel(autoSelectedProposal)
		: t("emailDesigner.previewContext.noMatchingProposal");

	useEffect(() => {
		if (!draftTemplate?.id) return;
		setPreviewOverrides({});
		setPreviewOverrideMode({
			product: "auto",
			contact: "auto",
			invoice: "auto",
			proposal: "auto",
		});
	}, [draftTemplate?.id]);

	if (isLoadingTemplates) {
		return (
			<div className="py-6 pr-6 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[600px] w-full" />
			</div>
		);
	}

	if (!emailDesignerContext) {
		console.error("EmailDesignerContext is null - this should not happen if wrapper is correct");
		return (
			<div className="py-6 pr-6 space-y-4">
				<div className="text-destructive">
					<h2 className="text-xl font-bold">
						{t("emailDesigner.contextError.title")}
					</h2>
					<p className="text-sm">
						{t("emailDesigner.contextError.description")}
					</p>
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
			<div className="py-6 pr-6 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[600px] w-full" />
			</div>
		);
	}

	// Detect invalid placeholder patterns in content
	const invalidPlaceholders = draftTemplate?.blocks
		? detectInvalidPlaceholders(
				draftTemplate.blocks,
				draftTemplate.subject,
				draftTemplate.preheader
			)
		: [];

	const handleAddPlaceholder = (): EmailTemplatePlaceholder | null => {
		toast.error("Manual placeholder keys are no longer supported.");
		return null;
	};

	const handlePreviewProductChange = (value: string) => {
		if (value === AUTO_PREVIEW_VALUE) {
			setPreviewOverrideMode((prev) => ({ ...prev, product: "auto" }));
			setPreviewOverrides((prev) => ({ ...prev, productId: undefined }));
			return;
		}
		setPreviewOverrideMode((prev) => ({ ...prev, product: "manual" }));
		setPreviewOverrides((prev) => ({ ...prev, productId: value }));
	};

	const handlePreviewContactChange = (value: string) => {
		if (value === AUTO_PREVIEW_VALUE) {
			setPreviewOverrideMode((prev) => ({ ...prev, contact: "auto" }));
			setPreviewOverrides((prev) => ({ ...prev, contactId: undefined }));
			return;
		}
		setPreviewOverrideMode((prev) => ({ ...prev, contact: "manual" }));
		setPreviewOverrides((prev) => ({ ...prev, contactId: value }));
	};

	const handlePreviewInvoiceChange = (value: string) => {
		if (value === AUTO_PREVIEW_VALUE) {
			setPreviewOverrideMode((prev) => ({ ...prev, invoice: "auto" }));
			setPreviewOverrides((prev) => ({ ...prev, invoiceId: undefined }));
			return;
		}
		setPreviewOverrideMode((prev) => ({ ...prev, invoice: "manual" }));
		setPreviewOverrides((prev) => ({ ...prev, invoiceId: value }));
	};

	const handlePreviewProposalChange = (value: string) => {
		if (value === AUTO_PREVIEW_VALUE) {
			setPreviewOverrideMode((prev) => ({ ...prev, proposal: "auto" }));
			setPreviewOverrides((prev) => ({ ...prev, proposalId: undefined }));
			return;
		}
		setPreviewOverrideMode((prev) => ({ ...prev, proposal: "manual" }));
		setPreviewOverrides((prev) => ({ ...prev, proposalId: value }));
	};

	const handleSelectDynamicSource = (source: (typeof dynamicSources)[number]): EmailTemplatePlaceholder => {
		const existingPlaceholder = placeholders.find(
			(placeholder) => placeholder.key.toLowerCase() === source.placeholderKey.toLowerCase(),
		);
		const sourceMetadata = {
			type: "entity_field" as const,
			entity: source.entity,
			path: source.path,
			valueType: source.valueType,
		};

		if (existingPlaceholder) {
			const enrichedPlaceholder: EmailTemplatePlaceholder = {
				...existingPlaceholder,
				label: existingPlaceholder.label?.trim() || source.label,
				description: existingPlaceholder.description?.trim() || source.description,
				source: existingPlaceholder.source ?? sourceMetadata,
			};
			if (JSON.stringify(existingPlaceholder) !== JSON.stringify(enrichedPlaceholder)) {
				handleDraftChange({
					placeholders: placeholders.map((placeholder) =>
						placeholder.id === existingPlaceholder.id ? enrichedPlaceholder : placeholder,
					),
				});
			}
			return enrichedPlaceholder;
		}

		const newPlaceholder: EmailTemplatePlaceholder = {
			id: crypto.randomUUID(),
			key: source.placeholderKey,
			label: source.label,
			description: source.description,
			source: sourceMetadata,
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
			onOpenAIBuilder={() => setAiBuilderOpen(true)}
			blocks={draftTemplate.blocks ?? []}
			selectedBlockId={selectedBlockId}
			onSelectBlock={handleSelectBlock}
			onReorderBlocks={handleReorderBlocks}
			onReorderStart={() => setIsReorderingBlocks(true)}
			onReorderEnd={() => setIsReorderingBlocks(false)}
			onDuplicateBlock={handleDuplicateBlock}
			onDeleteBlock={handleDeleteBlock}
			onMoveBlockToContainer={handleMoveBlockToContainer}
			currentSection={currentSection}
			onSectionChange={setCurrentSection}
		/>
	);

	const propertiesContent = (
		<div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden bg-background">
			{shouldShowSmartPaymentWarning && (
				<div className="p-3 border-b shrink-0">
					<Alert className="border-blue-200 bg-blue-50 text-blue-900">
						<AlertCircle className="h-4 w-4 text-blue-600" />
						<AlertTitle>
							{t(
								"emailDesigner.paymentInstructions.warningTitle",
								"Smart Payment Instructions missing",
							)}
						</AlertTitle>
						<AlertDescription className="mt-2 space-y-2">
							<p>
								{t(
									"emailDesigner.paymentInstructions.warningDescription",
									"Invoice emails should include Smart Payment Instructions so recipients always get the correct payment path.",
								)}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="border-blue-300 text-blue-900 hover:bg-blue-100"
								onClick={handleInsertSmartPaymentInstructions}
							>
								<CreditCard className="h-4 w-4 mr-2" />
								{t(
									"emailDesigner.paymentInstructions.insertAction",
									"Insert Smart Payment Instructions",
								)}
							</Button>
						</AlertDescription>
					</Alert>
				</div>
			)}
				{/* Missing Values Alert - Top Priority */}
			{hasEmailMissingValues(draftTemplate.blocks ?? []) && (
				<div className="p-3 border-b shrink-0">
					<EmailMissingValuesAlert
						blocks={draftTemplate.blocks ?? []}
						onNavigateToField={handleNavigateToField}
					/>
				</div>
			)}
			
			<div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
				{selectedBlock ? (
					<EmailBlockProperties
						key={selectedBlock.id}
						block={selectedBlock}
						onChange={(updatedBlock) => handleUpdateBlock(updatedBlock.id, updatedBlock)}
						onDelete={handleDeleteBlock}
						onOpenImagePicker={handleOpenImagePicker}
						placeholders={placeholders}
						dynamicSources={insertableDynamicSources}
						onSelectDynamicSource={handleSelectDynamicSource}
						invalidPlaceholders={invalidPlaceholders}
						onAddPlaceholder={handleAddPlaceholder}
					/>
				) : (
						<EmailTemplateSettings
							name={draftTemplate.name ?? ""}
							versions={versions}
						currentVersion={currentVersion}
							onRestoreVersion={handleRestoreVersion}
						isRestoringVersion={restoreVersion.isPending}
						currentUserId={authUser?.uid}
							designTokens={draftTemplate.designTokens ?? {
								background: "#ffffff",
								surface: "#f8fafc",
								text: "#0f172a",
								primary: "#2563eb",
								fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
								borderRadius: 12,
							}}
							allowedContexts={draftTemplate.allowedContexts ?? []}
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
								allowedContexts:
									updates.allowedContexts ?? draftTemplate.allowedContexts ?? [],
							});
						}}
					/>
				)}
			</div>
		</div>
	);

	const canvasContent = (
		<div className="flex flex-col h-full min-h-0 bg-muted/10">
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
					hasChanges={hasUnsavedChangesForHeader}
					isSaving={isSavePending}
				/>
			{hasPreviewableDynamicSources && (
				<div className="shrink-0 border-b border-border/70 bg-background px-4 py-2 flex items-center gap-3">
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
						<Eye className="h-3.5 w-3.5" />
						<span className="font-medium">
							{t("emailDesigner.previewContext.previewWith")}
						</span>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						{usesProductSources && (
							<Select
								value={
									previewOverrideMode.product === "manual" && previewOverrides.productId
										? previewOverrides.productId
										: AUTO_PREVIEW_VALUE
								}
								onValueChange={handlePreviewProductChange}
							>
								<SelectTrigger className="h-7 text-xs w-52 bg-background">
									<SelectValue
										placeholder={t("emailDesigner.previewContext.product")}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO_PREVIEW_VALUE} className="text-xs">
										<span className="text-muted-foreground">
											{t("emailDesigner.previewContext.autoPrefix")}
										</span>{" "}
										{defaultProductLabel}
									</SelectItem>
									{previewProductOptions.map((option) => (
										<SelectItem key={option.id} value={option.id} className="text-xs">
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{usesContactSources && (
							<Select
								value={
									previewOverrideMode.contact === "manual" && previewOverrides.contactId
										? previewOverrides.contactId
										: AUTO_PREVIEW_VALUE
								}
								onValueChange={handlePreviewContactChange}
							>
								<SelectTrigger className="h-7 text-xs w-52 bg-background">
									<SelectValue
										placeholder={t("emailDesigner.previewContext.contact")}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO_PREVIEW_VALUE} className="text-xs">
										<span className="text-muted-foreground">
											{t("emailDesigner.previewContext.autoPrefix")}
										</span>{" "}
										{defaultContactLabel}
									</SelectItem>
									{previewContactOptions.map((option) => (
										<SelectItem key={option.id} value={option.id} className="text-xs">
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{usesInvoiceSources && (
							<Select
								value={
									previewOverrideMode.invoice === "manual" && previewOverrides.invoiceId
										? previewOverrides.invoiceId
										: AUTO_PREVIEW_VALUE
								}
								onValueChange={handlePreviewInvoiceChange}
							>
								<SelectTrigger className="h-7 text-xs w-52 bg-background">
									<SelectValue
										placeholder={t("emailDesigner.previewContext.invoice")}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO_PREVIEW_VALUE} className="text-xs">
										<span className="text-muted-foreground">
											{t("emailDesigner.previewContext.autoPrefix")}
										</span>{" "}
										{defaultInvoiceLabel}
									</SelectItem>
									{previewInvoiceOptions.map((option) => (
										<SelectItem key={option.id} value={option.id} className="text-xs">
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
						{usesProposalSources && (
							<Select
								value={
									previewOverrideMode.proposal === "manual" && previewOverrides.proposalId
										? previewOverrides.proposalId
										: AUTO_PREVIEW_VALUE
								}
								onValueChange={handlePreviewProposalChange}
							>
								<SelectTrigger className="h-7 text-xs w-52 bg-background">
									<SelectValue
										placeholder={t("emailDesigner.previewContext.proposal")}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={AUTO_PREVIEW_VALUE} className="text-xs">
										<span className="text-muted-foreground">
											{t("emailDesigner.previewContext.autoPrefix")}
										</span>{" "}
										{defaultProposalLabel}
									</SelectItem>
									{previewProposalOptions.map((option) => (
										<SelectItem key={option.id} value={option.id} className="text-xs">
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>
			)}
			<div className="flex-1 min-h-0 overflow-auto">
				<EmailDesignerCanvas
					blocks={draftTemplate.blocks ?? []}
					placeholders={placeholders}
					previewPlaceholderValues={previewPlaceholderValues}
					previewRecords={{
						product: selectedProduct,
						contact: selectedContact,
						invoice: selectedInvoice,
						proposal: selectedProposal,
					}}
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
		<div className="flex h-screen overflow-hidden bg-muted/10">
			{isMobile ? (
				<>
					<div className="flex-1 flex flex-col min-w-0 pb-16">
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
											placeholders={placeholders}
											previewPlaceholderValues={previewPlaceholderValues}
											previewRecords={{
												product: selectedProduct,
												contact: selectedContact,
												invoice: selectedInvoice,
												proposal: selectedProposal,
											}}
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
			) : isWideLayout ? (
				<div className="flex min-h-0 w-full flex-1 overflow-hidden border-t border-border/70">
					<aside className="w-80 shrink-0 overflow-y-auto border-r bg-background">
						{sidebarContent}
					</aside>
					<main className="min-h-0 min-w-0 flex-1 overflow-hidden">
						{canvasContent}
					</main>
					<aside className="w-[22rem] shrink-0 overflow-y-auto overflow-x-auto border-l bg-background">
						{propertiesContent}
					</aside>
				</div>
			) : (
				<div className="flex min-h-0 w-full flex-1 overflow-hidden border-t border-border/70">
					<aside
						className={[
							"shrink-0 min-w-0 flex flex-col overflow-hidden border-r bg-background",
							selectedBlockId ? "w-[22rem]" : "w-80",
						].join(" ")}
					>
						{selectedBlockId ? (
							<>
								<div className="shrink-0 flex items-center gap-2 border-b bg-background px-3 py-2">
									<Button
										variant="ghost"
										size="sm"
										className="-ml-1"
										onClick={() => setSelectedBlockId(undefined)}
									>
										<ChevronLeft className="h-4 w-4 mr-1" />
										{t("designer.back", "Back")}
									</Button>
								</div>
								<div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto pr-3">
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
			allowedContexts={draftTemplate.allowedContexts ?? []}
			dynamicSources={insertableDynamicSources}
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
			layoutDirection: "vertical",
			contentAlign: "left",
			justifyContent: "start",
			gap: 16,
			padding: "md",
			blocks: [],
		};
	}
	if (type === "table") {
		return {
			id: crypto.randomUUID(),
			type: "table",
			section: section,
			dataSource: "email.invoice.items",
			columns: [
				{
					id: crypto.randomUUID(),
					header: "Description",
					binding: "description",
					type: "text",
					align: "left",
					priority: "high",
					format: "none",
				},
				{
					id: crypto.randomUUID(),
					header: "Quantity",
					binding: "quantity",
					type: "number",
					align: "center",
					priority: "medium",
					format: "number",
				},
				{
					id: crypto.randomUUID(),
					header: "Price",
					binding: "unitPrice",
					type: "currency",
					align: "right",
					priority: "high",
					format: "currency",
					currency: "USD",
				},
				{
					id: crypto.randomUUID(),
					header: "Total",
					binding: "total",
					type: "currency",
					align: "right",
					priority: "high",
					format: "currency",
					currency: "USD",
				},
			],
			rows: [],
			style: {
				borderStyle: "light",
				headerBackground: "",
				headerTextColor: "",
				alternatingRows: false,
				alternatingRowBackground: "",
				paddingDensity: "comfortable",
				showBorders: true,
				borderColor: "#e5e7eb",
			},
			responsive: {
				stackOnMobile: true,
				hideLowPriorityColumns: true,
				mobileLabelPosition: "above",
			},
			emptyMessage: "No data available",
		};
	}
	if (type === "paymentInstructions") {
		return {
			id: crypto.randomUUID(),
			type: "paymentInstructions",
			section: "body",
			ctaLabel: "Pay now",
			fallbackMode: "bank_transfer",
			showReference: true,
			backgroundColor: "#f8fafc",
			border: {
				borderWidth: 1,
				borderColor: "#e2e8f0",
				borderStyle: "solid",
				borderRadius: 10,
			},
			spacing: {
				paddingTop: 12,
				paddingRight: 12,
				paddingBottom: 12,
				paddingLeft: 12,
				marginTop: 8,
				marginRight: 0,
				marginBottom: 8,
				marginLeft: 0,
			},
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

function blockContainsId(
	blocks: EmailTemplateBlock[],
	parentBlockId: string,
	targetBlockId: string,
): boolean {
	const parent = findBlockById(blocks, parentBlockId);
	if (!parent) return false;

	const walk = (block: EmailTemplateBlock): boolean => {
		if (block.id === targetBlockId) return true;
		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			return colsBlock.columns?.some((column) => (column.blocks || []).some(walk)) || false;
		}
		if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			return (containerBlock.blocks || []).some(walk);
		}
		return false;
	};

	return walk(parent);
}

function removeBlockFromTree(
	blocks: EmailTemplateBlock[],
	blockId: string,
): { blocks: EmailTemplateBlock[]; removedBlock: EmailTemplateBlock | null } {
	let removedBlock: EmailTemplateBlock | null = null;

	const nextBlocks: EmailTemplateBlock[] = [];
	for (const block of blocks) {
		if (block.id === blockId) {
			removedBlock = block;
			continue;
		}

		if (block.type === "columns") {
			const colsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
			let hasColumnChange = false;
			const nextColumns = colsBlock.columns.map((column) => {
				const result = removeBlockFromTree(column.blocks || [], blockId);
				if (result.removedBlock) {
					removedBlock = result.removedBlock;
					hasColumnChange = true;
					return { ...column, blocks: result.blocks };
				}
				return column;
			});
			if (hasColumnChange) {
				nextBlocks.push({ ...colsBlock, columns: nextColumns } as EmailTemplateBlock);
				continue;
			}
		}

		if (block.type === "container") {
			const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
			const result = removeBlockFromTree(containerBlock.blocks || [], blockId);
			if (result.removedBlock) {
				removedBlock = result.removedBlock;
				nextBlocks.push({
					...containerBlock,
					blocks: result.blocks,
				} as EmailTemplateBlock);
				continue;
			}
		}

		nextBlocks.push(block);
	}

	return { blocks: nextBlocks, removedBlock };
}

function withMovedBlockSection(
	block: EmailTemplateBlock,
	requestedSection: EmailSection,
): EmailTemplateBlock {
	switch (block.type) {
		case "subject":
		case "preheader":
		case "logo":
		case "navigation":
			return { ...block, section: "header" };
		case "footerText":
		case "socialLinks":
		case "unsubscribe":
			return { ...block, section: "footer" };
		case "paymentInstructions":
			return { ...block, section: "body" };
		default:
			return { ...block, section: requestedSection };
	}
}
