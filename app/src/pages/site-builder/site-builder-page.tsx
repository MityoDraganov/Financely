import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	Sparkles,
	Loader2,
	Eye,
	RefreshCw,
	AlertCircle,
	ChevronRight,
	ChevronDown,
	Menu,
	X,
	ExternalLink,
	Pencil,
	Trash2,
	Plus,
} from "lucide-react";
import { useGenerateWidget } from "@/hooks/service-hooks/use-generate-widget";
import { useRestoreWidgetVersion } from "@/hooks/service-hooks/use-widget-versioning";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import {
	useGenerateSite,
	useRegenerateSite,
	useAddCustomDomain,
	useRestoreBrandSiteVersion,
	usePreviewBrandSiteVersion,
	useDeployManualSite,
	useUpdateBrandSitePages,
} from "@/hooks/service-hooks/use-brand-site";
import { useDeleteBrandSite } from "@/hooks/service-hooks/use-delete-brand-site";
import {
	useBrandSite,
	useBrandSitesByOrganization,
	useUpdateBrandSite,
} from "@/hooks/repository-hooks/use-brand-site";
import { projectId } from "@/infrastructure/firebase";
import { AIChatBuilder } from "@/components/site-builder/ai-chat-builder";
import { WidgetEnableToggle } from "@/components/site-builder/widget-enable-toggle";
import { AddPageDialog } from "@/components/site-builder/add-page-dialog";
import { AddArticleDialog } from "@/components/site-builder/add-article-dialog";
import { ContactFormWidgetConfig } from "@/components/site-builder/contact-form-widget-config";
import { InvoiceRequestWidgetConfig } from "@/components/site-builder/invoice-request-widget-config";
import { QuoteRequestWidgetConfig } from "@/components/site-builder/quote-request-widget-config";
import { WidgetVersionHistory } from "@/components/site-builder/widget-version-history";
import { EmbedScriptSection } from "@/components/site-builder/embed-script-section";
import { SiteStatusDisplay } from "@/components/site-builder/site-status-display";
import { SiteVersionHistory } from "@/components/site-builder/site-version-history";
import { CustomDomainInput } from "@/components/site-builder/custom-domain-input";
import type { WidgetPosition } from "@/components/site-builder/widget-types";
import { WidgetPreview } from "@/components/widget-preview";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileEditor } from "@/components/site-builder/file-editor";
import { MessageSquare, Code } from "lucide-react";

// Build default styling from organization branding
function buildDefaultStylingFromBranding(brandColors?: {
	primary?: string;
	secondary?: string;
	accent?: string;
}) {
	return {
		// Colors from organization branding
		primaryColor: brandColors?.primary || "#2563eb",
		secondaryColor: brandColors?.secondary || "#6b7280",
		backgroundColor: "#ffffff",
		textColor: "#111827",
		borderColor: "#d1d5db",
		errorColor: "#ef4444",
		successColor: brandColors?.accent || "#10b981",
		// Typography
		fontFamily:
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
		fontSize: "14px",
		fontWeight: "400",
		// Spacing
		padding: "12px",
		gap: "16px",
		borderRadius: "8px",
		// Button styling
		buttonPadding: "12px 24px",
		buttonBorderRadius: "8px",
		buttonFontWeight: "600",
		// Modal/Container styling
		modalBackdropOpacity: "0.5",
		modalBorderRadius: "12px",
		modalMaxWidth: "500px",
		// Shadow
		shadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
	};
}

type PageType = "standard" | "blog" | "contact";

type PageContentEntry = {
	id: string;
	title: string;
	summary?: string;
	link?: string;
	image?: string;
	description?: string; // Rich text HTML for AI
	localization?: {
		defaultLanguage: "en";
		languages: Record<string, {
			title: string;
			description: string;
			summary?: string;
			image?: string;
			link?: string;
		}>;
	};
};

type SitePage = {
	id: string;
	title: string;
	slug: string;
	description?: string;
	context?: string;
	type?: PageType;
	order?: number;
	contentEntries?: PageContentEntry[];
};

const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

const createPageId = () =>
	typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: `page-${Date.now()}`;

const createContentEntryId = () =>
	typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function SiteBuilderPage() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { data: organization, isLoading } = useCurrentOrganization();
	const updateOrganization = useUpdateOrganization();
	const [customDomainInput, setCustomDomainInput] = useState("");
	const [domainStatus, setDomainStatus] = useState<string | undefined>();
	const [dnsConfigured, setDnsConfigured] = useState<boolean | undefined>();
	const [dnsInstructions, setDnsInstructions] = useState<
		| {
				type: "A" | "CNAME";
				name: string;
				value: string;
				ttl?: number;
		  }
		| undefined
	>();
	const [domainMessage, setDomainMessage] = useState<string | undefined>();
	const [previewingVersion, setPreviewingVersion] = useState<number | null>(
		null
	);
	const [copiedScript, setCopiedScript] = useState(false);
	const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
	const [pageDialogMode, setPageDialogMode] = useState<"create" | "edit">(
		"create"
	);
	const [pageBeingEdited, setPageBeingEdited] = useState<SitePage | null>(
		null
	);
	const [pagePendingDelete, setPagePendingDelete] = useState<SitePage | null>(
		null
	);
	const [hasUnpublishedPages, setHasUnpublishedPages] = useState(false);
	
	// Article management for blog pages
	const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false);
	const [articleDialogMode, setArticleDialogMode] = useState<"create" | "edit">("create");
	const [articleBeingEdited, setArticleBeingEdited] = useState<PageContentEntry | null>(null);
	const [pageForArticle, setPageForArticle] = useState<SitePage | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showCreateSiteDialog, setShowCreateSiteDialog] = useState(false);
	const [siteDescription, setSiteDescription] = useState("");
	const updateBrandSitePages = useUpdateBrandSitePages();
	const updateBrandSite = useUpdateBrandSite(); // For file updates (not pages)
	const generateSite = useGenerateSite();
	const regenerateSite = useRegenerateSite();
	const addCustomDomain = useAddCustomDomain();
	const restoreVersion = useRestoreBrandSiteVersion();
	const previewVersion = usePreviewBrandSiteVersion();
	const deployManualSite = useDeployManualSite();
	const deleteBrandSite = useDeleteBrandSite();
	const [currentBrandSiteId, setCurrentBrandSiteId] = useState<string | null>(
		null
	);
	const brandSite = useBrandSite(currentBrandSiteId);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [expandedSections, setExpandedSections] = useState<
		Record<string, boolean>
	>({
		pages: false,
		widgets: false,
		advanced: false,
	});
	const [activeMainTab, setActiveMainTab] = useState<"chat" | "code">("chat");

	// Reset unpublished pages flag when site is successfully deployed
	useEffect(() => {
		if (brandSite?.data?.status === "success") {
			setHasUnpublishedPages(false);
		}
	}, [brandSite?.data?.status]);

	// AI Widget Generation
	const generateWidget = useGenerateWidget();
	const [aiWidgetDialogOpen, setAiWidgetDialogOpen] = useState(false);
	const [aiWidgetType, setAiWidgetType] = useState<
		"contactForm" | "invoiceRequest" | "quoteRequest"
	>("contactForm");
	const [aiWidgetStyle, setAiWidgetStyle] = useState<
		"modern" | "classic" | "minimal" | "professional" | "bold" | "elegant"
	>("modern");
	const [aiWidgetContext, setAiWidgetContext] = useState("");

	// Widget Versioning
	const restoreWidgetVersion = useRestoreWidgetVersion();

	// Widget Preview
	const [previewWidgetDialogOpen, setPreviewWidgetDialogOpen] =
		useState(false);
	const [previewWidgetVersion, setPreviewWidgetVersion] = useState<{
		version: number;
		widgets: Record<string, unknown>;
	} | null>(null);

	const [widgetsEnabled, setWidgetsEnabled] = useState(false);

	// Widget-specific styling state (initialized with branding defaults)
	const [contactFormStyling, setContactFormStyling] = useState(() =>
		buildDefaultStylingFromBranding()
	);
	const [invoiceRequestStyling, setInvoiceRequestStyling] = useState(() =>
		buildDefaultStylingFromBranding()
	);
	const [quoteRequestStyling, setQuoteRequestStyling] = useState(() =>
		buildDefaultStylingFromBranding()
	);

	// Update styling defaults when organization branding changes (if no widget-specific styling exists)
	useEffect(() => {
		if (!organization?.settings?.brandColors) return;

		const brandingDefaults = buildDefaultStylingFromBranding(
			organization.settings.brandColors
		);
		const widgets = organization.settings?.widgets;

		// Only update if widget config doesn't exist or doesn't have styling
		if (!widgets?.contactForm?.styling) {
			setContactFormStyling(brandingDefaults);
		}
		if (!widgets?.invoiceRequest?.styling) {
			setInvoiceRequestStyling(brandingDefaults);
		}
		if (!widgets?.quoteRequest?.styling) {
			setQuoteRequestStyling(brandingDefaults);
		}
	}, [organization?.settings?.brandColors, organization?.settings?.widgets]);

	// Helper function to normalize localization (backward compatibility)
	const normalizeLocalization = (
		localization: unknown
	): {
		defaultLanguage: "en";
		languages: Record<string, Record<string, string>>;
	} => {
		if (!localization || typeof localization !== "object") {
			return { defaultLanguage: "en", languages: {} };
		}

		// New format
		if ("defaultLanguage" in localization && "languages" in localization) {
			return {
				defaultLanguage: "en",
				languages:
					(
						localization as {
							languages?: Record<string, Record<string, string>>;
						}
					).languages || {},
			};
		}

		// Old format (backward compatibility)
		if ("language" in localization && "translations" in localization) {
			const oldLoc = localization as {
				language?: string;
				translations?: Record<string, string>;
			};
			const lang = oldLoc.language || "en";
			const translations = oldLoc.translations || {};

			// If language is not "en", migrate to new format
			if (lang !== "en") {
				return {
					defaultLanguage: "en",
					languages: {
						[lang]: translations,
					},
				};
			}

			// If language is "en", return empty languages (English is default)
			return {
				defaultLanguage: "en",
				languages: {},
			};
		}

		return { defaultLanguage: "en", languages: {} };
	};

	// Widget-specific localization state
	const [contactFormLocalization, setContactFormLocalization] = useState<{
		defaultLanguage: "en";
		languages: Record<string, Record<string, string>>;
	}>({
		defaultLanguage: "en",
		languages: {},
	});
	const [invoiceRequestLocalization, setInvoiceRequestLocalization] =
		useState<{
			defaultLanguage: "en";
			languages: Record<string, Record<string, string>>;
		}>({
			defaultLanguage: "en",
			languages: {},
		});
	const [quoteRequestLocalization, setQuoteRequestLocalization] = useState<{
		defaultLanguage: "en";
		languages: Record<string, Record<string, string>>;
	}>({
		defaultLanguage: "en",
		languages: {},
	});

	// Built-in fields state
	const [builtInFields, setBuiltInFields] = useState({
		name: { enabled: true, required: true, label: t('siteBuilder.widgets.defaultLabels.name') },
		email: { enabled: true, required: true, label: t('siteBuilder.widgets.defaultLabels.email') },
		phone: { enabled: false, required: false, label: t('siteBuilder.widgets.defaultLabels.phone') },
		company: { enabled: false, required: false, label: t('siteBuilder.widgets.defaultLabels.company') },
		message: { enabled: true, required: false, label: t('siteBuilder.widgets.defaultLabels.message') },
	});

	// Custom fields state
	const [customFields, setCustomFields] = useState<
		Array<{
			id: string;
			name: string;
			label: string;
			type:
				| "text"
				| "email"
				| "tel"
				| "textarea"
				| "number"
				| "select"
				| "checkbox"
				| "date";
			required: boolean;
			placeholder?: string;
			options?: string[];
			validation?: { min?: number; max?: number; pattern?: string };
			order: number;
		}>
	>([]);

	const [contactFormConfig, setContactFormConfig] = useState<{
		enabled: boolean;
		title: string;
		description: string;
		submitButtonText: string;
		successMessage: string;
		position: WidgetPosition;
		displayMode: "floating" | "inline";
	}>({
		enabled: false,
		title: t('siteBuilder.widgets.defaultConfig.contactForm.title'),
		description: "",
		submitButtonText: t('siteBuilder.widgets.defaultConfig.contactForm.submitButtonText'),
		successMessage: t('siteBuilder.widgets.defaultConfig.contactForm.successMessage'),
		position: "bottom-right",
		displayMode: "floating",
	});
	const [invoiceRequestConfig, setInvoiceRequestConfig] = useState<{
		enabled: boolean;
		title: string;
		description: string;
		submitButtonText: string;
		successMessage: string;
		position: WidgetPosition;
	}>({
		enabled: false,
		title: t('siteBuilder.widgets.defaultConfig.invoiceRequest.title'),
		description: "",
		submitButtonText: t('siteBuilder.widgets.defaultConfig.invoiceRequest.submitButtonText'),
		successMessage: t('siteBuilder.widgets.defaultConfig.invoiceRequest.successMessage'),
		position: "bottom-right",
	});
	const [quoteRequestConfig, setQuoteRequestConfig] = useState<{
		enabled: boolean;
		title: string;
		description: string;
		submitButtonText: string;
		successMessage: string;
		position: WidgetPosition;
	}>({
		enabled: false,
		title: t('siteBuilder.widgets.defaultConfig.quoteRequest.title'),
		description: "",
		submitButtonText: t('siteBuilder.widgets.defaultConfig.quoteRequest.submitButtonText'),
		successMessage: t('siteBuilder.widgets.defaultConfig.quoteRequest.successMessage'),
		position: "bottom-right",
	});

	// Load existing brand sites for this organization
	const { data: brandSites = [] } = useBrandSitesByOrganization(
		organization?.id
	);
	// Set current brand site ID from existing sites on mount
	useEffect(() => {
		if (brandSites.length > 0 && !currentBrandSiteId) {
			// Use the most recent site (first in the list since it's ordered by createdAt desc)
			setCurrentBrandSiteId(brandSites[0].id);
		}
	}, [brandSites, currentBrandSiteId]);

	const rawPages =
		((brandSite?.data as { pages?: SitePage[] })?.pages as
			| SitePage[]
			| undefined) ?? [];

	// Ensure all page IDs are unique strings
	const seenPageIds = new Set<string>();
	const currentPages: SitePage[] = rawPages
		.map((page, index) => {
			let pageId = page.id ? String(page.id) : createPageId();
			// If ID is already seen, generate a new one
			if (seenPageIds.has(pageId)) {
				pageId = createPageId();
			}
			seenPageIds.add(pageId);

			// Ensure all entry IDs are unique strings
			const seenEntryIds = new Set<string>();
			const contentEntries = (page.contentEntries || []).map((entry) => {
				let entryId = entry.id
					? String(entry.id)
					: createContentEntryId();
				// If ID is already seen, generate a new one
				if (seenEntryIds.has(entryId)) {
					entryId = createContentEntryId();
				}
				seenEntryIds.add(entryId);

				return {
					...entry,
					id: entryId,
				};
			});

			return {
				...page,
				id: pageId,
				order: page.order ?? index,
				contentEntries,
			};
		})
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	const persistPages = async (nextPages: SitePage[]) => {
		if (!currentBrandSiteId) {
			toast.error(t('siteBuilder.toasts.errors.generateSiteFirst'));
			return;
		}
		const normalized = nextPages.map((page, index) => ({
			...page,
			order: index,
		}));
		await updateBrandSitePages.mutateAsync({
			brandSiteId: currentBrandSiteId,
			pages: normalized,
		});
		setHasUnpublishedPages(true);
	};

	const handlePublishPages = () => {
		if (!currentBrandSiteId) return;
		setHasUnpublishedPages(false);
		regenerateSite.mutate({
			brandSiteId: currentBrandSiteId,
		});
	};

	const handleAddPage = async (pageForm: {
		title: string;
		slug: string;
		description: string;
		context: string;
		type: PageType;
	}) => {
		if (!pageForm.title.trim()) {
			toast.error(t('siteBuilder.toasts.errors.pageTitleRequired'));
			return;
		}

		const baseSlugInput = pageForm.slug.trim() || pageForm.title.trim();
		const isFirstPage = currentPages.length === 0;
		const normalizedSlug = isFirstPage
			? "index"
			: slugify(baseSlugInput) || `page-${currentPages.length + 1}`;

		const slugExists = currentPages.some(
			(page) => page.slug === normalizedSlug
		);
		const slug = slugExists
			? `${normalizedSlug}-${Date.now().toString(36)}`
			: normalizedSlug;

		const newPage: SitePage = {
			id: createPageId(),
			title: pageForm.title.trim(),
			slug,
			description: pageForm.description.trim() || undefined,
			context: pageForm.context.trim() || undefined,
			type: pageForm.type,
			order: currentPages.length,
			contentEntries: [],
		};

		await persistPages([...currentPages, newPage]);
		setIsPageDialogOpen(false);
	};

	const handleUpdatePage = async (
		pageId: string,
		pageForm: {
			title: string;
			slug: string;
			description: string;
			context: string;
			type: PageType;
		}
	) => {
		if (!pageForm.title.trim()) {
			toast.error(t('siteBuilder.toasts.errors.pageTitleRequired'));
			return;
		}

		const targetPage = currentPages.find((page) => page.id === pageId);
		if (!targetPage) {
			toast.error(t('siteBuilder.toasts.errors.pageNotFound'));
			return;
		}

		const baseSlugInput =
			pageForm.slug.trim() ||
			pageForm.title.trim() ||
			targetPage.slug ||
			`page-${Date.now().toString(36)}`;
		const fallbackSlug =
			(targetPage.order ?? 0) === 0
				? "index"
				: targetPage.slug || `page-${Date.now().toString(36)}`;
		const normalizedSlug = slugify(baseSlugInput) || fallbackSlug;
		const slugConflict = currentPages.some(
			(page) => page.id !== pageId && page.slug === normalizedSlug
		);
		const slug = slugConflict
			? `${normalizedSlug}-${Date.now().toString(36).slice(2, 7)}`
			: normalizedSlug;

		const updatedPages = currentPages.map((page) =>
			page.id === pageId
				? {
						...page,
						title: pageForm.title.trim(),
						slug,
						description: pageForm.description.trim() || undefined,
						context: pageForm.context.trim() || undefined,
						type: pageForm.type,
					}
				: page
		);

		await persistPages(updatedPages);
		setIsPageDialogOpen(false);
		setPageDialogMode("create");
		setPageBeingEdited(null);
	};

	const handleRemovePage = async (pageId: string) => {
		if (currentPages.length <= 1) {
			toast.error(t('siteBuilder.toasts.errors.siteNeedsOnePage'));
			return;
		}

		const nextPages = currentPages.filter((page) => page.id !== pageId);
		if (nextPages.length === currentPages.length) {
			toast.error(t('siteBuilder.toasts.errors.pageNotFound'));
			return;
		}

		await persistPages(nextPages);
		setPagePendingDelete(null);
	};

	const openCreatePageDialog = () => {
		setPageDialogMode("create");
		setPageBeingEdited(null);
		setIsPageDialogOpen(true);
	};

	const openEditPageDialog = (page: SitePage) => {
		setPageDialogMode("edit");
		setPageBeingEdited(page);
		setIsPageDialogOpen(true);
	};

	const openCreateArticleDialog = (page: SitePage) => {
		setArticleDialogMode("create");
		setArticleBeingEdited(null);
		setPageForArticle(page);
		setIsArticleDialogOpen(true);
	};

	const openEditArticleDialog = (page: SitePage, article: PageContentEntry) => {
		setArticleDialogMode("edit");
		setArticleBeingEdited(article);
		setPageForArticle(page);
		setIsArticleDialogOpen(true);
	};

	const handleAddArticle = async (articleForm: {
		title: string;
		summary: string;
		link: string;
		image: string;
		description: string;
		localization?: {
			defaultLanguage: "en";
			languages: Record<string, {
				title: string;
				description: string;
				summary?: string;
				image?: string;
				link?: string;
			}>;
		};
	}) => {
		if (!pageForArticle) {
			toast.error(t('siteBuilder.toasts.errors.pageNotFound'));
			return;
		}

		if (!articleForm.title.trim()) {
			toast.error(t('siteBuilder.toasts.errors.articleTitleRequired'));
			return;
		}

		// Helper to check if HTML content is empty (only whitespace/tags)
		const isHtmlEmpty = (html: string | undefined): boolean => {
			if (!html || html.trim() === "") return true;
			// Remove HTML tags and check if remaining text is empty
			const textContent = html.replace(/<[^>]*>/g, '').trim();
			return textContent.length === 0;
		};

		const newArticle: PageContentEntry = {
			id: createContentEntryId(),
			title: articleForm.title.trim(),
			summary: articleForm.summary.trim() || undefined,
			link: articleForm.link.trim() || undefined,
			image: articleForm.image.trim() || undefined,
			// Save description as-is if it has content, otherwise undefined
			description: articleForm.description && !isHtmlEmpty(articleForm.description) 
				? articleForm.description 
				: undefined,
			localization: articleForm.localization,
		};

		const updatedPages = currentPages.map((page) =>
			page.id === pageForArticle.id
				? {
						...page,
						contentEntries: [...(page.contentEntries || []), newArticle],
					}
				: page
		);

		await persistPages(updatedPages);
		setIsArticleDialogOpen(false);
		setArticleDialogMode("create");
		setArticleBeingEdited(null);
		setPageForArticle(null);
	};

	const handleUpdateArticle = async (
		pageId: string,
		articleId: string,
		articleForm: {
			title: string;
			summary: string;
			link: string;
			image: string;
			description: string;
			localization?: {
				defaultLanguage: "en";
				languages: Record<string, {
					title: string;
					description: string;
					summary?: string;
					image?: string;
					link?: string;
				}>;
			};
		}
	) => {
		if (!articleForm.title.trim()) {
			toast.error(t('siteBuilder.toasts.errors.articleTitleRequired'));
			return;
		}

		const updatedPages = currentPages.map((page) =>
			page.id === pageId
				? {
						...page,
						contentEntries: (page.contentEntries || []).map((article) => {
							// Helper to check if HTML content is empty (only whitespace/tags)
							const isHtmlEmpty = (html: string | undefined): boolean => {
								if (!html || html.trim() === "") return true;
								// Remove HTML tags and check if remaining text is empty
								const textContent = html.replace(/<[^>]*>/g, '').trim();
								return textContent.length === 0;
							};

							return article.id === articleId
								? {
										...article,
										title: articleForm.title.trim(),
										summary: articleForm.summary.trim() || undefined,
										link: articleForm.link.trim() || undefined,
										image: articleForm.image.trim() || undefined,
										// Save description as-is if it has content, otherwise undefined
										description: articleForm.description && !isHtmlEmpty(articleForm.description) 
											? articleForm.description 
											: undefined,
										localization: articleForm.localization,
									}
								: article;
						}),
					}
				: page
		);

		await persistPages(updatedPages);
		setIsArticleDialogOpen(false);
		setArticleDialogMode("create");
		setArticleBeingEdited(null);
		setPageForArticle(null);
	};

	const handleRemoveArticle = async (pageId: string, articleId: string) => {
		const updatedPages = currentPages.map((page) =>
			page.id === pageId
				? {
						...page,
						contentEntries: (page.contentEntries || []).filter(
							(article) => article.id !== articleId
						),
					}
				: page
		);

		await persistPages(updatedPages);
	};

	const editingPageFormValues = useMemo(() => {
		if (pageDialogMode !== "edit" || !pageBeingEdited) {
			return null;
		}

		return {
			title: pageBeingEdited.title,
			slug: pageBeingEdited.slug,
			description: pageBeingEdited.description ?? "",
			context: pageBeingEdited.context ?? "",
			type: pageBeingEdited.type ?? "standard",
		};
	}, [pageDialogMode, pageBeingEdited]);

	const editingArticleFormValues = useMemo(() => {
		if (articleDialogMode === "edit" && articleBeingEdited) {
			return articleBeingEdited;
		}
		return null;
	}, [articleDialogMode, articleBeingEdited]);

	const handleArticleDialogOpenChange = (open: boolean) => {
		setIsArticleDialogOpen(open);
		if (!open) {
			setArticleDialogMode("create");
			setArticleBeingEdited(null);
			setPageForArticle(null);
		}
	};

	const handlePageDialogOpenChange = (open: boolean) => {
		setIsPageDialogOpen(open);
		if (open) {
			return;
		}
		setPageDialogMode("create");
		setPageBeingEdited(null);
	};

	// Load widget configuration from organization
	useEffect(() => {
		if (!organization?.settings?.widgets) return;

		const widgets = organization.settings.widgets;
		const brandColors = organization.settings.brandColors;
		const brandingDefaults = buildDefaultStylingFromBranding(brandColors);
		setWidgetsEnabled(widgets.enabled || false);

			// Load contact form widget configuration
		if (widgets.contactForm) {
			setContactFormConfig({
				enabled: widgets.contactForm.enabled || false,
				title: widgets.contactForm.title || t('siteBuilder.widgets.defaultConfig.contactForm.title'),
				description: widgets.contactForm.description || "",
				submitButtonText:
					widgets.contactForm.submitButtonText || t('siteBuilder.widgets.defaultConfig.contactForm.submitButtonText'),
				successMessage:
					widgets.contactForm.successMessage ||
					t('siteBuilder.widgets.defaultConfig.contactForm.successMessage'),
				position: widgets.contactForm.position || "bottom-right",
				displayMode: widgets.contactForm.displayMode || "floating",
			});

			// Load contact form styling (merge with branding defaults)
			if (widgets.contactForm.styling) {
				setContactFormStyling({
					...brandingDefaults,
					...widgets.contactForm.styling,
				});
			} else {
				setContactFormStyling(brandingDefaults);
			}

			// Load contact form localization
			if (widgets.contactForm.localization) {
				setContactFormLocalization(
					normalizeLocalization(widgets.contactForm.localization)
				);
			}

			// Load built-in fields
			if (widgets.contactForm.builtInFields) {
				setBuiltInFields({
					name: widgets.contactForm.builtInFields.name || {
						enabled: true,
						required: true,
						label: t('siteBuilder.widgets.defaultLabels.name'),
					},
					email: widgets.contactForm.builtInFields.email || {
						enabled: true,
						required: true,
						label: t('siteBuilder.widgets.defaultLabels.email'),
					},
					phone: widgets.contactForm.builtInFields.phone || {
						enabled: false,
						required: false,
						label: t('siteBuilder.widgets.defaultLabels.phone'),
					},
					company: widgets.contactForm.builtInFields.company || {
						enabled: false,
						required: false,
						label: t('siteBuilder.widgets.defaultLabels.company'),
					},
					message: widgets.contactForm.builtInFields.message || {
						enabled: true,
						required: false,
						label: t('siteBuilder.widgets.defaultLabels.message'),
					},
				});
			}

			// Load custom fields
			if (widgets.contactForm.customFields) {
				setCustomFields(widgets.contactForm.customFields);
			}
		}

		// Load invoice request widget configuration
		if (widgets.invoiceRequest) {
			setInvoiceRequestConfig({
				enabled: widgets.invoiceRequest.enabled || false,
				title: widgets.invoiceRequest.title || t('siteBuilder.widgets.defaultConfig.invoiceRequest.title'),
				description: widgets.invoiceRequest.description || "",
				submitButtonText:
					widgets.invoiceRequest.submitButtonText ||
					t('siteBuilder.widgets.defaultConfig.invoiceRequest.submitButtonText'),
				successMessage:
					widgets.invoiceRequest.successMessage ||
					t('siteBuilder.widgets.defaultConfig.invoiceRequest.successMessage'),
				position: widgets.invoiceRequest.position || "bottom-right",
			});

			// Load invoice request styling (merge with branding defaults)
			if (widgets.invoiceRequest.styling) {
				setInvoiceRequestStyling({
					...brandingDefaults,
					...widgets.invoiceRequest.styling,
				});
			} else {
				setInvoiceRequestStyling(brandingDefaults);
			}

			// Load invoice request localization
			if (widgets.invoiceRequest.localization) {
				setInvoiceRequestLocalization(
					normalizeLocalization(widgets.invoiceRequest.localization)
				);
			}
		}

		// Load quote request widget configuration
		if (widgets.quoteRequest) {
			setQuoteRequestConfig({
				enabled: widgets.quoteRequest.enabled || false,
				title: widgets.quoteRequest.title || t('siteBuilder.widgets.defaultConfig.quoteRequest.title'),
				description: widgets.quoteRequest.description || "",
				submitButtonText:
					widgets.quoteRequest.submitButtonText || t('siteBuilder.widgets.defaultConfig.quoteRequest.submitButtonText'),
				successMessage:
					widgets.quoteRequest.successMessage ||
					t('siteBuilder.widgets.defaultConfig.quoteRequest.successMessage'),
				position: widgets.quoteRequest.position || "bottom-right",
			});

			// Load quote request styling (merge with branding defaults)
			if (widgets.quoteRequest.styling) {
				setQuoteRequestStyling({
					...brandingDefaults,
					...widgets.quoteRequest.styling,
				});
			} else {
				setQuoteRequestStyling(brandingDefaults);
			}

			// Load quote request localization
			if (widgets.quoteRequest.localization) {
				setQuoteRequestLocalization(
					normalizeLocalization(widgets.quoteRequest.localization)
				);
			}
		}
	}, [organization?.settings?.widgets, organization?.settings?.brandColors, t]);

	// Save widget configuration
	const handleSaveWidgets = async () => {
		if (!organization) return;

		try {
			const existingSettings = organization.settings || {};
			const existingWidgets = existingSettings.widgets;

			// Build widgets object, only including enabled widgets (Firestore doesn't accept undefined)
			const widgets: {
				enabled: boolean;
				metadata?: { version: number; lastSavedAt?: string };
				versions?: Array<{
					version: number;
					widgetType:
						| "contactForm"
						| "invoiceRequest"
						| "quoteRequest"
						| "all";
					widgets: Record<string, unknown>;
					createdAt: string;
					description?: string;
				}>;
				contactForm?: {
					enabled: boolean;
					title: string;
					description?: string;
					styling?: typeof contactFormStyling;
					localization?: typeof contactFormLocalization;
					builtInFields?: typeof builtInFields;
					customFields: typeof customFields;
					submitButtonText: string;
					successMessage: string;
					position: WidgetPosition;
					displayMode: "floating" | "inline";
				};
				invoiceRequest?: {
					enabled: boolean;
					title: string;
					description?: string;
					styling?: typeof invoiceRequestStyling;
					localization?: typeof invoiceRequestLocalization;
					submitButtonText: string;
					successMessage: string;
					position: WidgetPosition;
				};
				quoteRequest?: {
					enabled: boolean;
					title: string;
					description?: string;
					styling?: typeof quoteRequestStyling;
					localization?: typeof quoteRequestLocalization;
					submitButtonText: string;
					successMessage: string;
					position: WidgetPosition;
				};
			} = {
				enabled: widgetsEnabled,
			};

			if (widgetsEnabled && contactFormConfig.enabled) {
				widgets.contactForm = {
					...contactFormConfig,
					styling: contactFormStyling,
					localization: contactFormLocalization,
					builtInFields: builtInFields,
					customFields: customFields.length > 0 ? customFields : [],
				};
			}

			if (widgetsEnabled && invoiceRequestConfig.enabled) {
				widgets.invoiceRequest = {
					...invoiceRequestConfig,
					styling: invoiceRequestStyling,
					localization: invoiceRequestLocalization,
				};
			}

			if (widgetsEnabled && quoteRequestConfig.enabled) {
				widgets.quoteRequest = {
					...quoteRequestConfig,
					styling: quoteRequestStyling,
					localization: quoteRequestLocalization,
				};
			}

			// Save current version to history before updating (if widgets exist)
			const currentVersion = existingWidgets?.metadata?.version || 1;
			const existingVersions: Array<{
				version: number;
				widgetType:
					| "contactForm"
					| "invoiceRequest"
					| "quoteRequest"
					| "all";
				widgets: Record<string, unknown>;
				createdAt: string;
				description?: string;
			}> = (existingWidgets?.versions || []).filter(
				(
					v
				): v is {
					version: number;
					widgetType:
						| "contactForm"
						| "invoiceRequest"
						| "quoteRequest"
						| "all";
					widgets: Record<string, unknown>;
					createdAt: string;
					description?: string;
				} => v.widgets != null
			);

			if (existingWidgets?.enabled) {
				widgets.versions = [
					...existingVersions,
					{
						version: currentVersion,
						widgetType: "all",
						widgets: {
							enabled: existingWidgets.enabled,
							contactForm: existingWidgets.contactForm,
							invoiceRequest: existingWidgets.invoiceRequest,
							quoteRequest: existingWidgets.quoteRequest,
						},
						createdAt: new Date().toISOString(),
						description: "Version before save",
					},
				];
				widgets.metadata = {
					version: currentVersion + 1,
					lastSavedAt: new Date().toISOString(),
				};
			} else {
				widgets.metadata = {
					version: 1,
					lastSavedAt: new Date().toISOString(),
				};
				widgets.versions = [];
			}

			// Ensure versions is always an array (not undefined)
			const widgetsToSave = {
				...widgets,
				versions: widgets.versions || [],
			};

			await updateOrganization.mutateAsync({
				id: organization.id,
				data: {
					settings: {
						...existingSettings,
						widgets:
							widgetsToSave as unknown as typeof existingWidgets,
					},
				},
			});

			toast.success(t('siteBuilder.toasts.widgetSaved'));
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: t('siteBuilder.toasts.errors.saveWidgetFailed')
			);
		}
	};

	// Add custom field
	const handleAddCustomField = () => {
		const newField = {
			id: `custom-${Date.now()}`,
			name: `field_${customFields.length + 1}`,
			label: "New Field",
			type: "text" as const,
			required: false,
			order: customFields.length,
		};
		setCustomFields([...customFields, newField]);
	};

	// Remove custom field
	const handleRemoveCustomField = (id: string) => {
		setCustomFields(customFields.filter((f) => f.id !== id));
	};

	// Update custom field
	const handleUpdateCustomField = (
		id: string,
		updates: Partial<(typeof customFields)[0]>
	) => {
		setCustomFields(
			customFields.map((f) => (f.id === id ? { ...f, ...updates } : f))
		);
	};

	// Generate embed script
	const getEmbedScript = () => {
		if (!organization) return "";
		const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
		const widgetLoaderUrl = window.location.origin + "/widget-loader.js";
		return `<script src="${widgetLoaderUrl}" data-org-id="${organization.id}" data-api-url="${apiUrl}"></script>`;
	};

	const handleCopyScript = () => {
		const script = getEmbedScript();
		navigator.clipboard.writeText(script);
		setCopiedScript(true);
		toast.success(t('siteBuilder.toasts.embedScriptCopied'));
		setTimeout(() => setCopiedScript(false), 2000);
	};

	const toggleSection = (section: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	if (isLoading) {
		return (
			<div className="p-6 space-y-6">
				<div className="h-8 bg-gray-200 rounded animate-pulse" />
				<div className="h-64 bg-gray-200 rounded animate-pulse" />
			</div>
		);
	}

	const hasSite = brandSites.length > 0 && currentBrandSiteId;
	const deployedUrl = brandSite?.data?.deployedUrl;

	return (
		<div className="flex min-h-[calc(100vh-4rem)] w-full">
			{/* Main Chat Interface */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				<div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-6 py-4">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold tracking-tight">
								{t('siteBuilder.title')}
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								{t('siteBuilder.subtitle')}
							</p>
						</div>
						<div className="flex items-center gap-3 shrink-0">
							{hasSite && deployedUrl && (
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										window.open(deployedUrl, "_blank")
									}
									className="gap-2 whitespace-nowrap min-w-fit"
								>
									<ExternalLink className="h-4 w-4 shrink-0" />
									<span className="hidden sm:inline">
										{t('siteBuilder.viewSite')}
									</span>
								</Button>
							)}
							<Button
								variant="outline"
								size="icon"
								onClick={() => setSidebarOpen(!sidebarOpen)}
								className="lg:hidden shrink-0"
							>
								{sidebarOpen ? (
									<X className="h-4 w-4" />
								) : (
									<Menu className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				</div>

				{/* Main Content Area - Chat or Code Editor */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{hasSite ? (
						<Tabs
							value={activeMainTab}
							onValueChange={(value) =>
								setActiveMainTab(value as "chat" | "code")
							}
							className="flex-1 flex flex-col overflow-hidden"
						>
							<div className="px-6 pt-3">
								<TabsList className="grid w-full max-w-md grid-cols-2">
									<TabsTrigger value="chat" className="gap-2">
										<MessageSquare className="h-4 w-4" />
										{t('siteBuilder.tabs.chatBuilder')}
									</TabsTrigger>
									<TabsTrigger value="code" className="gap-2">
										<Code className="h-4 w-4" />
										{t('siteBuilder.tabs.codeEditor')}
									</TabsTrigger>
								</TabsList>
							</div>
							<TabsContent
								value="chat"
								className="flex-1 overflow-y-auto p-6 mt-0"
							>
								<AIChatBuilder
									brandSiteId={currentBrandSiteId}
									organizationId={organization?.id || ""}
									onSiteUpdated={() => {
										queryClient.invalidateQueries({
											queryKey: ["brandSite", currentBrandSiteId],
										});
									}}
								/>
							</TabsContent>
							<TabsContent
								value="code"
								className="flex-1 overflow-hidden p-6 mt-0"
							>
								<div className="h-full flex flex-col">
									<FileEditor
										files={
											brandSite?.data?.files ||
											(brandSite?.data?.html
												? { "index.html": brandSite.data.html }
												: {})
										}
										onSave={async (files) => {
											if (!currentBrandSiteId) return;
										await updateBrandSite.mutateAsync({
											id: currentBrandSiteId,
											data: { files },
										});
										toast.success(t('siteBuilder.toasts.filesSaved'));
										}}
										onDeploy={async (files) => {
											if (!currentBrandSiteId || !organization?.id) return;
											// Convert Record<string, string> to Array<{ path: string; content: string }>
											const filesArray = Object.entries(files).map(([path, content]) => ({
												path,
												content,
											}));
											await deployManualSite.mutateAsync({
												brandSiteId: currentBrandSiteId,
												files: filesArray,
											});
										}}
										organizationId={organization?.id || ""}
										projectId={projectId || ""}
									/>
								</div>
							</TabsContent>
						</Tabs>
					) : (
						<div className="flex-1 p-6 overflow-y-auto">
							<Card className="h-full flex flex-col">
								<CardContent className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
									<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
										<Sparkles className="h-8 w-8 text-primary" />
									</div>
									<div className="space-y-2">
										<h2 className="text-2xl font-semibold">
											{t('siteBuilder.emptyState.title')}
										</h2>
										<p className="text-muted-foreground max-w-md">
											{t('siteBuilder.emptyState.description')}
										</p>
									</div>
									<Button
										size="lg"
										onClick={() => {
											setShowCreateSiteDialog(true);
										}}
										disabled={!organization?.id}
										className="gap-2"
									>
										<Sparkles className="h-4 w-4" />
										{t('siteBuilder.emptyState.createSite')}
									</Button>
								</CardContent>
							</Card>
						</div>
					)}
				</div>
			</div>

			{/* Sidebar - Advanced Features */}
			<div
				className={`${
					sidebarOpen
						? "translate-x-0"
						: "translate-x-full lg:translate-x-0"
				} fixed lg:sticky top-0 right-0 h-full w-full lg:w-96 border-l bg-background z-40 transition-transform duration-300 ease-in-out overflow-y-auto`}
			>
				<div className="p-6 space-y-4">
					{/* Sidebar Header */}
					<div className="flex items-center justify-between mb-4 lg:hidden">
						<h2 className="text-lg font-semibold">
							{t('siteBuilder.sidebar.title')}
						</h2>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSidebarOpen(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>

					{/* Site Status */}
					{hasSite && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-base">
									{t('siteBuilder.sidebar.siteStatus')}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<SiteStatusDisplay
									brandSite={brandSite?.data || null}
									onRetry={() => {
										if (!currentBrandSiteId) return;
										regenerateSite.mutate({
											brandSiteId: currentBrandSiteId,
										});
									}}
									isRetrying={regenerateSite.isPending}
								/>
							</CardContent>
						</Card>
					)}

					{/* Pages Section */}
					<Collapsible
						open={expandedSections.pages}
						onOpenChange={() => toggleSection("pages")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base">
											{t('siteBuilder.pages.title')}
										</CardTitle>
										{expandedSections.pages ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="space-y-4 w-full">
									{hasUnpublishedPages && (
										<Alert
											variant="default"
											className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 w-full"
										>
											<AlertCircle className="h-4 w-4 text-blue-600" />
											<AlertTitle className="text-sm">
												{t('siteBuilder.pages.updated')}
											</AlertTitle>
											<AlertDescription className="text-xs">
												{t('siteBuilder.pages.updatedDescription')}
												<Button
													onClick={handlePublishPages}
													disabled={
														regenerateSite.isPending
													}
													className="mt-2 w-full"
												>
													{regenerateSite.isPending ? (
														<div className="flex flex-row w-full items-center gap-2">
															<Loader2 className="h-3 w-3 animate-spin" />
															{t('siteBuilder.pages.publishing')}
														</div>
													) : (
														<div className="flex flex-row w-full items-center gap-2">
															<RefreshCw />
															{t('siteBuilder.pages.publishChanges')}
														</div>
													)}
												</Button>
											</AlertDescription>
										</Alert>
									)}

									<Button
										onClick={openCreatePageDialog}
										disabled={
											!currentBrandSiteId ||
											updateBrandSitePages.isPending
										}
										size="sm"
										className="w-full"
									>
										{t('siteBuilder.pages.addPage')}
									</Button>
									{currentPages.length > 0 && (
										<div className="space-y-2">
											{currentPages.map((page) => (
												<div
													key={page.id}
													className="space-y-2"
												>
													<div className="flex items-start justify-between gap-3 rounded border bg-muted/30 p-3">
														<div className="flex-1">
															<div className="font-medium">
																{page.title}
															</div>
															<div className="text-xs text-muted-foreground">
																{page.slug ===
																"index"
																	? "/"
																	: `/${page.slug}`}
																{page.type === "blog" && (
																	<span className="ml-2 text-xs">
																		• {t('siteBuilder.pages.blog')}
																	</span>
																)}
															</div>
														</div>
														<div className="flex items-center gap-1">
															{page.type === "blog" && (
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-muted-foreground"
																	onClick={() =>
																		openCreateArticleDialog(
																			page
																		)
																	}
																	aria-label={t('siteBuilder.pages.addArticle') + ' ' + page.title}
																	disabled={
																		updateBrandSitePages.isPending
																	}
																	title={t('siteBuilder.pages.addArticle')}
																>
																	<Plus className="h-3.5 w-3.5" />
																</Button>
															)}
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7 text-muted-foreground"
																onClick={() =>
																	openEditPageDialog(
																		page
																	)
																}
																aria-label={`Edit ${page.title}`}
																disabled={
																	updateBrandSitePages.isPending
																}
															>
																<Pencil className="h-3.5 w-3.5" />
															</Button>
															<Button
																variant="ghost"
																size="icon"
																className="h-7 w-7 text-destructive"
																onClick={() =>
																	setPagePendingDelete(
																		page
																	)
																}
																aria-label={`Remove ${page.title}`}
																disabled={
																	updateBrandSitePages.isPending
																}
															>
																<Trash2 className="h-3.5 w-3.5" />
															</Button>
														</div>
													</div>
													{page.type === "blog" && page.contentEntries && page.contentEntries.length > 0 && (
														<div className="ml-3 space-y-1.5">
															{page.contentEntries.map((article) => (
																<div
																	key={article.id}
																	className="flex items-start justify-between gap-2 rounded border bg-background/50 p-2 text-sm"
																>
																	<div className="flex-1 min-w-0">
																		<div className="font-medium truncate">
																			{article.title}
																		</div>
																		{article.summary && (
																			<div className="text-xs text-muted-foreground line-clamp-1">
																				{article.summary}
																			</div>
																		)}
																	</div>
																	<div className="flex items-center gap-1 shrink-0">
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-6 w-6 text-muted-foreground"
																			onClick={() =>
																				openEditArticleDialog(
																					page,
																					article
																				)
																			}
																			aria-label={`Edit article ${article.title}`}
																			disabled={
																				updateBrandSitePages.isPending
																			}
																		>
																			<Pencil className="h-3 w-3" />
																		</Button>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-6 w-6 text-destructive"
																			onClick={() =>
																				handleRemoveArticle(
																					page.id,
																					article.id
																				)
																			}
																			aria-label={`Remove article ${article.title}`}
																			disabled={
																				updateBrandSitePages.isPending
																			}
																		>
																			<Trash2 className="h-3 w-3" />
																		</Button>
																	</div>
																</div>
															))}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>

					{/* Advanced Settings */}
					{hasSite && (
						<Collapsible
							open={expandedSections.advanced}
							onOpenChange={() => toggleSection("advanced")}
						>
							<Card>
								<CollapsibleTrigger asChild>
									<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
										<div className="flex items-center justify-between">
											<CardTitle className="text-base">
												{t('siteBuilder.advanced.title')}
											</CardTitle>
											{expandedSections.advanced ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</div>
									</CardHeader>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<CardContent className="space-y-4">
										<SiteVersionHistory
											brandSite={brandSite?.data || null}
											currentVersion={
												brandSite?.data?.metadata
													?.version ?? null
											}
											previewingVersion={
												previewingVersion
											}
											onPreviewVersion={async (
												version: number
											) => {
												const brandSiteId =
													currentBrandSiteId ||
													brandSites[0]?.id;
												if (!brandSiteId) return;
												setPreviewingVersion(version);
												try {
													const result =
														await previewVersion.mutateAsync(
															{
																brandSiteId,
																version,
															}
														);
													if (result?.previewUrl) {
														window.open(
															result.previewUrl,
															"_blank"
														);
														toast.success(
															t('siteBuilder.toasts.previewOpened')
														);
													}
												} catch (error) {
													console.error(
														"Failed to create preview:",
														error
													);
												} finally {
													setTimeout(
														() =>
															setPreviewingVersion(
																null
															),
														500
													);
												}
											}}
											onRestoreVersion={(
												version: number
											) => {
												const brandSiteId =
													currentBrandSiteId ||
													brandSites[0]?.id;
												if (!brandSiteId) return;
												restoreVersion.mutate({
													brandSiteId,
													version,
												});
											}}
											isRestoring={
												restoreVersion.isPending
											}
										/>
										<CustomDomainInput
											customDomain={customDomainInput}
											onCustomDomainChange={
												setCustomDomainInput
											}
											onAddDomain={() => {
												const brandSiteId =
													currentBrandSiteId ||
													brandSites[0]?.id;
												if (
													!brandSiteId ||
													!customDomainInput
												) {
													toast.error(
														t('siteBuilder.toasts.errors.enterDomain')
													);
													return;
												}
												addCustomDomain.mutate(
													{
														brandSiteId,
														customDomain:
															customDomainInput,
													},
													{
														onSuccess: (result) => {
															setDomainStatus(
																result.domainStatus
															);
															setDnsConfigured(
																result.dnsConfigured
															);
															setDnsInstructions(
																result.dnsInstructions
															);
															setDomainMessage(
																result.message
															);
														},
													}
												);
											}}
											isAdding={addCustomDomain.isPending}
											domainStatus={domainStatus}
											dnsConfigured={dnsConfigured}
											dnsInstructions={dnsInstructions}
											message={domainMessage}
										/>
										<div className="pt-4 border-t">
											<Card>
												<CardHeader className="pb-3">
													<CardTitle className="text-base flex items-center gap-2">
														<Code className="h-4 w-4" />
														{t('siteBuilder.advanced.codeEditor')}
													</CardTitle>
												</CardHeader>
												<CardContent>
													<p className="text-sm text-muted-foreground mb-4">
														{t('siteBuilder.advanced.codeEditorDescription')}
													</p>
													<Button
														onClick={() => {
															setActiveMainTab("code");
															setSidebarOpen(false);
														}}
														className="w-full"
														variant="outline"
													>
														<Code className="h-4 w-4 mr-2" />
														{t('siteBuilder.advanced.openCodeEditor')}
													</Button>
												</CardContent>
											</Card>
											{!hasSite && (
												<Card className="mt-4">
													<CardContent className="pt-6">
														<p className="text-sm text-muted-foreground mb-4 text-center">
															{t('siteBuilder.advanced.createBlankSiteDescription')}
														</p>
														<Button
															onClick={async () => {
																if (!organization?.id) return;
																const blankHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${organization.settings?.branding?.companyName || organization.name}</title>
</head>
<body>
  <h1>Welcome</h1>
  <p>Start editing your site files!</p>
</body>
</html>`;
																generateSite.mutate(
																	{
																		organizationId: organization.id,
																		brandName:
																			organization
																				.settings
																				?.branding
																				?.companyName ||
																			organization.name,
																		context: blankHtml,
																	},
																	{
																		onSuccess: (result) => {
																			setCurrentBrandSiteId(
																				result.id
																			);
																			setActiveMainTab("code");
																			toast.success(
																				t('siteBuilder.toasts.blankSiteCreated')
																			);
																		},
																	}
																);
															}}
															disabled={!organization?.id || generateSite.isPending}
															className="w-full"
														>
															{generateSite.isPending ? (
																<>
																	<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																	{t('siteBuilder.createSiteDialog.creating')}
																</>
															) : (
																<>
																	<Plus className="h-4 w-4 mr-2" />
																	{t('siteBuilder.advanced.createBlankSite')}
																</>
															)}
														</Button>
													</CardContent>
												</Card>
											)}
										</div>
										{/* Code Editor is now available in the main content area via tabs */}
									</CardContent>
								</CollapsibleContent>
							</Card>
						</Collapsible>
					)}

					{/* Widgets Section */}
					<Collapsible
						open={expandedSections.widgets}
						onOpenChange={() => toggleSection("widgets")}
					>
						<Card>
							<CollapsibleTrigger asChild>
								<CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base">
											{t('siteBuilder.sidebar.integrationWidgets')}
										</CardTitle>
										{expandedSections.widgets ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
									</div>
								</CardHeader>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="space-y-4">
									<WidgetEnableToggle
										enabled={widgetsEnabled}
										onToggle={setWidgetsEnabled}
									/>

									{widgetsEnabled && (
										<>
											<ContactFormWidgetConfig
												config={contactFormConfig}
												onConfigChange={
													setContactFormConfig
												}
												styling={contactFormStyling}
												onStylingChange={
													setContactFormStyling
												}
												localization={
													contactFormLocalization
												}
												onLocalizationChange={
													setContactFormLocalization
												}
												builtInFields={builtInFields}
												onBuiltInFieldsChange={
													setBuiltInFields
												}
												customFields={customFields}
												onCustomFieldsChange={
													setCustomFields
												}
												onAddCustomField={
													handleAddCustomField
												}
												onRemoveCustomField={
													handleRemoveCustomField
												}
												onUpdateCustomField={
													handleUpdateCustomField
												}
												onOpenAiBuilder={() => {
													setAiWidgetType(
														"contactForm"
													);
													setAiWidgetDialogOpen(true);
												}}
												organizationId={
													organization?.id || ""
												}
											/>

											<InvoiceRequestWidgetConfig
												config={invoiceRequestConfig}
												onConfigChange={
													setInvoiceRequestConfig
												}
												styling={invoiceRequestStyling}
												onStylingChange={
													setInvoiceRequestStyling
												}
												localization={
													invoiceRequestLocalization
												}
												onLocalizationChange={
													setInvoiceRequestLocalization
												}
												onOpenAiBuilder={() => {
													setAiWidgetType(
														"invoiceRequest"
													);
													setAiWidgetDialogOpen(true);
												}}
												organizationId={
													organization?.id || ""
												}
											/>

											<QuoteRequestWidgetConfig
												config={quoteRequestConfig}
												onConfigChange={
													setQuoteRequestConfig
												}
												styling={quoteRequestStyling}
												onStylingChange={
													setQuoteRequestStyling
												}
												localization={
													quoteRequestLocalization
												}
												onLocalizationChange={
													setQuoteRequestLocalization
												}
												onOpenAiBuilder={() => {
													setAiWidgetType(
														"quoteRequest"
													);
													setAiWidgetDialogOpen(true);
												}}
												organizationId={
													organization?.id || ""
												}
											/>

											<Button
												onClick={handleSaveWidgets}
												disabled={
													updateOrganization.isPending
												}
												className="w-full"
											>
												{updateOrganization.isPending ? (
													<>
														<Loader2 className="h-4 w-4 mr-2 animate-spin" />
														{t('siteBuilder.createSiteDialog.creating')}
													</>
												) : (
													t('siteBuilder.widgets.saveConfiguration')
												)}
											</Button>

											{organization?.settings?.widgets
												?.versions &&
												organization.settings.widgets
													.versions.length > 0 && (
													<WidgetVersionHistory
														versions={organization.settings.widgets.versions.map(
															(v) => ({
																version:
																	v.version,
																widgetType:
																	v.widgetType,
																widgets:
																	v.widgets,
																createdAt:
																	v.createdAt,
																description:
																	v.description,
															})
														)}
														currentVersion={
															organization
																.settings
																.widgets
																.metadata
																?.version ??
															null
														}
														onPreviewVersion={(
															version
														) => {
															setPreviewWidgetVersion(
																{
																	version:
																		version.version,
																	widgets:
																		version.widgets,
																}
															);
															setPreviewWidgetDialogOpen(
																true
															);
														}}
														onRestoreVersion={async (
															version
														) => {
															if (
																!organization?.id
															)
																return;
															await restoreWidgetVersion.mutateAsync(
																{
																	organizationId:
																		organization.id,
																	version,
																	widgetType:
																		"all",
																}
															);
														}}
														isRestoring={
															restoreWidgetVersion.isPending
														}
													/>
												)}

											<EmbedScriptSection
												script={getEmbedScript()}
												copied={copiedScript}
												onCopy={handleCopyScript}
											/>
										</>
									)}
								</CardContent>
							</CollapsibleContent>
						</Card>
					</Collapsible>

					{/* Delete Website Card */}
					{hasSite && (
						<Card className="border-red-200 dark:border-red-900/30">
							<CardHeader className="pb-3">
								<CardTitle className="text-base text-red-600 dark:text-red-500">
									{t('siteBuilder.dangerZone.title')}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground mb-4">
									{t('siteBuilder.dangerZone.description')}
								</p>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => setShowDeleteDialog(true)}
									className="w-full"
								>
									<Trash2 className="h-4 w-4 mr-2" />
									{t('siteBuilder.dangerZone.deleteWebsite')}
								</Button>
							</CardContent>
						</Card>
					)}
				</div>
			</div>

			{/* Overlay for mobile */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-30 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			{/* Delete Website Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent className="border-red-200 dark:border-red-900/30">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
							<AlertCircle className="h-5 w-5" />
							{t('siteBuilder.deleteDialog.title')}
						</AlertDialogTitle>
						<AlertDialogDescription className="text-left space-y-2">
							<p className="font-semibold text-foreground">
								{t('siteBuilder.deleteDialog.cannotUndo')}
							</p>
							<ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
								<li>{t('siteBuilder.deleteDialog.willDelete.website')}</li>
								<li>{t('siteBuilder.deleteDialog.willDelete.blogPosts')}</li>
								<li>{t('siteBuilder.deleteDialog.willDelete.deployedContent')}</li>
								<li>{t('siteBuilder.deleteDialog.willDelete.firebaseHosting')}</li>
								<li>{t('siteBuilder.deleteDialog.willDelete.versionHistory')}</li>
							</ul>
							<p className="font-semibold text-foreground mt-3">
								{t('siteBuilder.deleteDialog.willNotAffect')}
							</p>
							<ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
								<li>{t('siteBuilder.deleteDialog.willNotAffectList.widgets')}</li>
								<li>{t('siteBuilder.deleteDialog.willNotAffectList.organization')}</li>
							</ul>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('siteBuilder.deleteDialog.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (!currentBrandSiteId) return;
								deleteBrandSite.mutate(
									{ brandSiteId: currentBrandSiteId },
									{
										onSuccess: () => {
											setShowDeleteDialog(false);
											setCurrentBrandSiteId(null);
										},
									}
								);
							}}
							disabled={deleteBrandSite.isPending}
							className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
						>
							{deleteBrandSite.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t('siteBuilder.deleteDialog.deleting')}
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 mr-2" />
									{t('siteBuilder.deleteDialog.confirm')}
								</>
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Dialogs */}
			{/* AI Widget Generation Dialog */}
			<Dialog
				open={aiWidgetDialogOpen}
				onOpenChange={setAiWidgetDialogOpen}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-purple-500" />
							{t('siteBuilder.aiWidgetDialog.title')}
						</DialogTitle>
						<DialogDescription>
							{t('siteBuilder.aiWidgetDialog.description')}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>{t('siteBuilder.aiWidgetDialog.widgetType')}</Label>
							<Select
								value={aiWidgetType}
								onValueChange={(value) =>
									setAiWidgetType(
										value as typeof aiWidgetType
									)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="contactForm">
										{t('siteBuilder.aiWidgetDialog.widgetTypes.contactForm')}
									</SelectItem>
									<SelectItem value="invoiceRequest">
										{t('siteBuilder.aiWidgetDialog.widgetTypes.invoiceRequest')}
									</SelectItem>
									<SelectItem value="quoteRequest">
										{t('siteBuilder.aiWidgetDialog.widgetTypes.quoteRequest')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>{t('siteBuilder.aiWidgetDialog.designStyle')}</Label>
							<Select
								value={aiWidgetStyle}
								onValueChange={(value) =>
									setAiWidgetStyle(
										value as typeof aiWidgetStyle
									)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="modern">
										{t('siteBuilder.aiWidgetDialog.styles.modern')}
									</SelectItem>
									<SelectItem value="classic">
										{t('siteBuilder.aiWidgetDialog.styles.classic')}
									</SelectItem>
									<SelectItem value="minimal">
										{t('siteBuilder.aiWidgetDialog.styles.minimal')}
									</SelectItem>
									<SelectItem value="professional">
										{t('siteBuilder.aiWidgetDialog.styles.professional')}
									</SelectItem>
									<SelectItem value="bold">
										{t('siteBuilder.aiWidgetDialog.styles.bold')}
									</SelectItem>
									<SelectItem value="elegant">
										{t('siteBuilder.aiWidgetDialog.styles.elegant')}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>{t('siteBuilder.aiWidgetDialog.additionalContext')}</Label>
							<Textarea
								value={aiWidgetContext}
								onChange={(e) =>
									setAiWidgetContext(e.target.value)
								}
								placeholder={t('siteBuilder.aiWidgetDialog.additionalContextPlaceholder')}
								className="min-h-[80px]"
							/>
							<p className="text-xs text-muted-foreground">
								{t('siteBuilder.aiWidgetDialog.additionalContextHint')}
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setAiWidgetDialogOpen(false)}
							disabled={generateWidget.isPending}
						>
							{t('siteBuilder.aiWidgetDialog.cancel')}
						</Button>
						<Button
							onClick={async () => {
								if (!organization?.id) {
									toast.error(t('siteBuilder.toasts.errors.organizationNotFound'));
									return;
								}

								try {
									const result =
										await generateWidget.mutateAsync({
											organizationId: organization.id,
											widgetType: aiWidgetType,
											options: {
												style: aiWidgetStyle,
												context:
													aiWidgetContext.trim() ||
													undefined,
											},
										});

									// Apply generated styling and configuration
									if (aiWidgetType === "contactForm") {
										setContactFormStyling(result.styling);
										setContactFormConfig({
											...contactFormConfig,
											title: result.configuration.title,
											description:
												result.configuration
													.description || "",
											submitButtonText:
												result.configuration
													.submitButtonText,
											successMessage:
												result.configuration
													.successMessage,
										});
										if (
											result.configuration.builtInFields
										) {
											setBuiltInFields({
												name: result.configuration
													.builtInFields.name || {
													enabled: true,
													required: true,
													label: "Name",
												},
												email: result.configuration
													.builtInFields.email || {
													enabled: true,
													required: true,
													label: "Email",
												},
												phone: result.configuration
													.builtInFields.phone || {
													enabled: false,
													required: false,
													label: "Phone",
												},
												company: result.configuration
													.builtInFields.company || {
													enabled: false,
													required: false,
													label: "Company",
												},
												message: result.configuration
													.builtInFields.message || {
													enabled: true,
													required: false,
													label: "Message",
												},
											});
										}
										if (
											result.configuration.customFields &&
											result.configuration.customFields
												.length > 0
										) {
											setCustomFields(
												result.configuration
													.customFields
											);
										}
									} else if (
										aiWidgetType === "invoiceRequest"
									) {
										setInvoiceRequestStyling(
											result.styling
										);
										setInvoiceRequestConfig({
											...invoiceRequestConfig,
											title: result.configuration.title,
											description:
												result.configuration
													.description || "",
											submitButtonText:
												result.configuration
													.submitButtonText,
											successMessage:
												result.configuration
													.successMessage,
										});
									} else if (
										aiWidgetType === "quoteRequest"
									) {
										setQuoteRequestStyling(result.styling);
										setQuoteRequestConfig({
											...quoteRequestConfig,
											title: result.configuration.title,
											description:
												result.configuration
													.description || "",
											submitButtonText:
												result.configuration
													.submitButtonText,
											successMessage:
												result.configuration
													.successMessage,
										});
									}

									toast.success(
										t('siteBuilder.toasts.widgetGenerated')
									);
									setAiWidgetDialogOpen(false);
									setAiWidgetContext("");
								} catch (error) {
									const message =
										error instanceof Error
											? error.message
											: "Unknown error";
									toast.error(
										t('siteBuilder.toasts.errors.widgetGenerationFailed', { message })
									);
								}
							}}
							disabled={
								generateWidget.isPending || !organization?.id
							}
						>
							{generateWidget.isPending ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t('siteBuilder.aiWidgetDialog.generating')}
								</>
							) : (
								<>
									<Sparkles className="h-4 w-4 mr-2" />
									{t('siteBuilder.aiWidgetDialog.generateWidget')}
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Widget Version Preview Dialog */}
			<Dialog
				open={previewWidgetDialogOpen}
				onOpenChange={setPreviewWidgetDialogOpen}
			>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Eye className="h-5 w-5 text-blue-500" />
							{t('siteBuilder.widgets.previewDialog.title', { version: previewWidgetVersion?.version || '' })}
						</DialogTitle>
						<DialogDescription>
							{t('siteBuilder.widgets.previewDialog.description', { version: previewWidgetVersion?.version || '' })}
						</DialogDescription>
					</DialogHeader>
					{previewWidgetVersion && (
						<div className="space-y-6 py-4">
							{/* Contact Form Preview */}
							{Boolean(
								previewWidgetVersion.widgets.contactForm &&
									typeof previewWidgetVersion.widgets
										.contactForm === "object"
							) && (
								<Card>
									<CardHeader>
										<CardTitle className="text-lg">
											{t('siteBuilder.widgets.previewDialog.contactFormTitle')}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="p-6 border rounded-lg bg-gray-50">
											<WidgetPreview
												widgetType="contactForm"
												config={{
													title:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)?.title as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.contactUs'),
													description:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)
															?.description as string) ||
														undefined,
													submitButtonText:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)
															?.submitButtonText as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.submit'),
													successMessage:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)
															?.successMessage as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.thankYou'),
													builtInFields:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)
															?.builtInFields as Record<
															string,
															unknown
														>) || undefined,
													customFields:
														((
															previewWidgetVersion
																.widgets
																.contactForm as Record<
																string,
																unknown
															>
														)
															?.customFields as Array<{
															id: string;
															name: string;
															label: string;
															type:
																| "text"
																| "email"
																| "tel"
																| "textarea"
																| "number"
																| "select"
																| "checkbox"
																| "date";
															required: boolean;
															placeholder?: string;
															options?: string[];
															order: number;
														}>) || undefined,
												}}
												styling={
													((
														previewWidgetVersion
															.widgets
															.contactForm as Record<
															string,
															unknown
														>
													)?.styling ||
														{}) as Partial<{
														primaryColor: string;
														secondaryColor: string;
														backgroundColor: string;
														textColor: string;
														borderColor: string;
														errorColor: string;
														successColor: string;
														fontFamily: string;
														fontSize: string;
														fontWeight: string;
														padding: string;
														gap: string;
														borderRadius: string;
														buttonPadding: string;
														buttonBorderRadius: string;
														buttonFontWeight: string;
														modalBackdropOpacity: string;
														modalBorderRadius: string;
														modalMaxWidth: string;
														shadow: string;
													}>
												}
											/>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Invoice Request Preview */}
							{Boolean(
								previewWidgetVersion.widgets.invoiceRequest &&
									typeof previewWidgetVersion.widgets
										.invoiceRequest === "object"
							) && (
								<Card>
									<CardHeader>
										<CardTitle className="text-lg">
											{t('siteBuilder.widgets.previewDialog.invoiceRequestTitle')}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="p-6 border rounded-lg bg-gray-50">
											<WidgetPreview
												widgetType="invoiceRequest"
												config={{
													title:
														((
															previewWidgetVersion
																.widgets
																.invoiceRequest as Record<
																string,
																unknown
															>
														)?.title as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.requestInvoice'),
													description:
														((
															previewWidgetVersion
																.widgets
																.invoiceRequest as Record<
																string,
																unknown
															>
														)
															?.description as string) ||
														undefined,
													submitButtonText:
														((
															previewWidgetVersion
																.widgets
																.invoiceRequest as Record<
																string,
																unknown
															>
														)
															?.submitButtonText as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.submit'),
													successMessage:
														((
															previewWidgetVersion
																.widgets
																.invoiceRequest as Record<
																string,
																unknown
															>
														)
															?.successMessage as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.thankYou'),
												}}
												styling={
													((
														previewWidgetVersion
															.widgets
															.invoiceRequest as Record<
															string,
															unknown
														>
													)?.styling ||
														{}) as Partial<{
														primaryColor: string;
														secondaryColor: string;
														backgroundColor: string;
														textColor: string;
														borderColor: string;
														errorColor: string;
														successColor: string;
														fontFamily: string;
														fontSize: string;
														fontWeight: string;
														padding: string;
														gap: string;
														borderRadius: string;
														buttonPadding: string;
														buttonBorderRadius: string;
														buttonFontWeight: string;
														modalBackdropOpacity: string;
														modalBorderRadius: string;
														modalMaxWidth: string;
														shadow: string;
													}>
												}
											/>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Quote Request Preview */}
							{Boolean(
								previewWidgetVersion.widgets.quoteRequest &&
									typeof previewWidgetVersion.widgets
										.quoteRequest === "object"
							) && (
								<Card>
									<CardHeader>
										<CardTitle className="text-lg">
											{t('siteBuilder.widgets.previewDialog.quoteRequestTitle')}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="p-6 border rounded-lg bg-gray-50">
											<WidgetPreview
												widgetType="quoteRequest"
												config={{
													title:
														((
															previewWidgetVersion
																.widgets
																.quoteRequest as Record<
																string,
																unknown
															>
														)?.title as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.requestQuote'),
													description:
														((
															previewWidgetVersion
																.widgets
																.quoteRequest as Record<
																string,
																unknown
															>
														)
															?.description as string) ||
														undefined,
													submitButtonText:
														((
															previewWidgetVersion
																.widgets
																.quoteRequest as Record<
																string,
																unknown
															>
														)
															?.submitButtonText as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.submit'),
													successMessage:
														((
															previewWidgetVersion
																.widgets
																.quoteRequest as Record<
																string,
																unknown
															>
														)
															?.successMessage as string) ||
														t('siteBuilder.widgets.previewDialog.fallbacks.thankYou'),
												}}
												styling={
													((
														previewWidgetVersion
															.widgets
															.quoteRequest as Record<
															string,
															unknown
														>
													)?.styling ||
														{}) as Partial<{
														primaryColor: string;
														secondaryColor: string;
														backgroundColor: string;
														textColor: string;
														borderColor: string;
														errorColor: string;
														successColor: string;
														fontFamily: string;
														fontSize: string;
														fontWeight: string;
														padding: string;
														gap: string;
														borderRadius: string;
														buttonPadding: string;
														buttonBorderRadius: string;
														buttonFontWeight: string;
														modalBackdropOpacity: string;
														modalBorderRadius: string;
														modalMaxWidth: string;
														shadow: string;
													}>
												}
											/>
										</div>
									</CardContent>
								</Card>
							)}

							{!previewWidgetVersion.widgets.contactForm &&
								!previewWidgetVersion.widgets.invoiceRequest &&
								!previewWidgetVersion.widgets.quoteRequest && (
									<div className="text-center py-8 text-gray-500">
										{t('siteBuilder.widgets.previewDialog.noConfiguration')}
									</div>
								)}
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* Page Creation Dialog */}
			<AddPageDialog
				open={isPageDialogOpen}
				onOpenChange={handlePageDialogOpenChange}
				onSubmit={(pageForm) => {
					if (pageDialogMode === "edit" && pageBeingEdited) {
						return handleUpdatePage(pageBeingEdited.id, pageForm);
					}
					return handleAddPage(pageForm);
				}}
				isPending={updateBrandSitePages.isPending}
				initialValues={editingPageFormValues}
				mode={pageDialogMode}
			/>
			<AddArticleDialog
				open={isArticleDialogOpen}
				onOpenChange={handleArticleDialogOpenChange}
				onSubmit={(articleForm) => {
					if (articleDialogMode === "edit" && articleBeingEdited && pageForArticle) {
						return handleUpdateArticle(pageForArticle.id, articleBeingEdited.id, articleForm);
					}
					return handleAddArticle(articleForm);
				}}
				isPending={updateBrandSitePages.isPending}
				initialValues={editingArticleFormValues}
				mode={articleDialogMode}
				brandSiteId={currentBrandSiteId}
				organizationId={organization?.id || ""}
			/>
			<AlertDialog
				open={Boolean(pagePendingDelete)}
				onOpenChange={(open) => {
					if (open) {
						return;
					}
					setPagePendingDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('siteBuilder.pageDialog.removeTitle')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('siteBuilder.pageDialog.removeDescription', { title: pagePendingDelete?.title ?? t('siteBuilder.pageDialog.removeTitle') })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={updateBrandSitePages.isPending}
						>
							{t('siteBuilder.pageDialog.cancel')}
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={async () => {
								if (!pagePendingDelete) {
									return;
								}
								await handleRemovePage(pagePendingDelete.id);
							}}
							disabled={updateBrandSitePages.isPending}
						>
							{updateBrandSitePages.isPending
								? t('siteBuilder.pageDialog.removing')
								: t('siteBuilder.pageDialog.remove')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Create Site Dialog */}
			<Dialog open={showCreateSiteDialog} onOpenChange={setShowCreateSiteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('siteBuilder.createSiteDialog.title')}</DialogTitle>
						<DialogDescription>
							{t('siteBuilder.createSiteDialog.description')}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="site-description">{t('siteBuilder.createSiteDialog.websiteDescription')}</Label>
							<Textarea
								id="site-description"
								value={siteDescription}
								onChange={(e) => setSiteDescription(e.target.value)}
								placeholder={t('siteBuilder.createSiteDialog.websiteDescriptionPlaceholder')}
								className="min-h-[100px]"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowCreateSiteDialog(false);
								setSiteDescription("");
							}}
						>
							{t('siteBuilder.createSiteDialog.cancel')}
						</Button>
						<Button
							onClick={() => {
								if (!organization?.id) return;
								setShowCreateSiteDialog(false);
								generateSite.mutate(
									{
										organizationId: organization.id,
										brandName:
											organization.settings
												?.branding
												?.companyName ||
											organization.name,
										tone: "professional",
										pages: currentPages,
										context: siteDescription.trim() || undefined,
									},
									{
										onSuccess: (result) => {
											setCurrentBrandSiteId(result.id);
											setSiteDescription("");
											toast.success(
												t('siteBuilder.toasts.siteCreated')
											);
										},
									}
								);
							}}
							disabled={generateSite.isPending || !organization?.id}
						>
							{generateSite.isPending ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
									{t('siteBuilder.createSiteDialog.creating')}
								</>
							) : (
								t('siteBuilder.createSiteDialog.createSite')
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
