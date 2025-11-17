import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getProductRepository } from "../repositories/product-repository";
import { GeminiService } from "../services/gemini-service";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { firestore } from "firebase-admin";

interface GenerateSiteInput {
  organizationId: string;
  brandName?: string;
  tone?: string;
  context?: string;
  contextImages?: string[];
  pages?: SitePageInput[];
}

interface GenerateSiteConfig {
  geminiApiKey: string;
  cloudflareApiToken: string;
  cloudflareZoneId: string;
  cloudflareBaseDomain: string;
  firebaseProjectId: string;
}

interface PageContentEntry {
  id?: string;
  title?: string;
  summary?: string;
  link?: string;
  image?: string;
}

interface SitePageInput {
  id?: string;
  title?: string;
  slug?: string;
  description?: string;
  context?: string;
  type?: "standard" | "blog" | "contact";
  order?: number;
  contentEntries?: PageContentEntry[];
}

type NormalizedContentEntry = {
  id: string;
  title: string;
  summary?: string;
  link?: string;
  image?: string;
};

type NormalizedSitePage = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  context?: string;
  type: "standard" | "blog" | "contact";
  order: number;
  contentEntries: NormalizedContentEntry[];
};

const DEFAULT_PAGES: NormalizedSitePage[] = [
  {
    id: "home",
    title: "Home",
    slug: "index",
    description: "Primary landing page",
    type: "standard",
    order: 0,
    contentEntries: [],
  },
  {
    id: "about",
    title: "About",
    slug: "about",
    description: "Company story and core values",
    type: "standard",
    order: 1,
    contentEntries: [],
  },
  {
    id: "contact",
    title: "Contact",
    slug: "contact",
    description: "Contact details and lead capture",
    type: "contact",
    order: 2,
    contentEntries: [],
  },
];

function sanitizeSlug(value?: string): string {
  if (!value) return "";
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!normalized || normalized === "index" || normalized === "home") {
    return "index";
  }
  return normalized;
}

function normalizePages(pages?: SitePageInput[]): NormalizedSitePage[] {
  const source: SitePageInput[] =
    !pages || pages.length === 0 ? DEFAULT_PAGES : pages;
  const seenSlugs = new Set<string>();

  const normalized = source
    .map((page, index) => {
      let slug = sanitizeSlug(page.slug);
      if (!slug) {
        slug = `page-${index + 1}`;
      }
      if (index === 0) {
        slug = "index";
      }
      while (seenSlugs.has(slug)) {
        slug = `${slug}-${index + 1}`;
      }
      seenSlugs.add(slug);

      const contentEntries: NormalizedContentEntry[] = (page.contentEntries || []).map(
        (entry, entryIndex) => ({
          id: entry.id || `entry-${index}-${entryIndex}-${Date.now()}`,
          title: entry.title?.trim() || `Entry ${entryIndex + 1}`,
          summary: entry.summary?.trim() || undefined,
          link: entry.link?.trim() || undefined,
          image: entry.image?.trim() || undefined,
        }),
      );

      return {
        id: page.id || `page-${index + 1}`,
        title: page.title?.trim() || `Page ${index + 1}`,
        slug,
        order: page.order ?? index,
        type: (page.type as "standard" | "blog" | "contact") || "standard",
        description: page.description?.trim() || undefined,
        context: page.context?.trim() || undefined,
        contentEntries,
      };
    })
    .sort((a, b) => a.order - b.order);

  return normalized;
}

const NAVIGATION_STYLES = `
<style>
.site-nav-wrapper {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}
.site-nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}
.nav-brand {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text, #111827);
  text-decoration: none;
  white-space: nowrap;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  list-style: none;
  margin: 0;
  padding: 0;
}
.nav-link {
  font-weight: 500;
  font-size: 0.9375rem;
  color: var(--color-text, #111827);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  display: inline-block;
}
.nav-link:hover {
  background: var(--color-surface, rgba(0, 0, 0, 0.05));
  color: var(--color-primary);
}
.nav-link.active {
  background: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
@media (max-width: 768px) {
  .site-nav {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
  }
  .nav-links {
    width: 100%;
    flex-direction: column;
    gap: 0.25rem;
  }
  .nav-link {
    width: 100%;
    padding: 0.75rem 1rem;
  }
}
</style>
`;

function buildNavigationMarkup(
  pages: SitePageInput[],
  currentSlug: string,
  brandName: string,
): string {
  const links = pages
    .map((page) => {
      const href =
        page.slug === "index" || page.slug === "home" ? "/" : `/${page.slug}`;
      const activeClass =
        page.slug === currentSlug ? "nav-link active" : "nav-link";
      return `<a class="${activeClass}" href="${href}">${page.title}</a>`;
    })
    .join("");

  return `
  <div class="site-nav-wrapper">
    <div class="site-nav">
      <a href="/" class="nav-brand" aria-label="${brandName} Home">${brandName}</a>
      <nav class="nav-links" role="navigation" aria-label="Main navigation">
        ${links}
      </nav>
    </div>
  </div>`;
}

function injectNavigation(
  html: string,
  pages: SitePageInput[],
  currentSlug: string,
  brandName: string,
): string {
  let output = html;
  if (output.includes("</head>")) {
    output = output.replace("</head>", `${NAVIGATION_STYLES}\n</head>`);
  } else {
    output = `${NAVIGATION_STYLES}\n${output}`;
  }

  const navMarkup = buildNavigationMarkup(pages, currentSlug, brandName);
  const bodyMatch = output.match(/<body[^>]*>/i);
  if (bodyMatch) {
    const bodyTag = bodyMatch[0];
    output = output.replace(bodyTag, `${bodyTag}\n${navMarkup}`);
  } else {
    output = `${navMarkup}\n${output}`;
  }

  return output;
}

function applyIntegrations(
  html: string,
  options: {
    widgets?: any;
    organizationId: string;
    analyticsConfig?: any;
    brandSiteId?: string;
    firebaseProjectId?: string;
    tempSiteId: string;
    brandName: string;
  },
): string {
  let output = html;

  if (options.widgets?.enabled) {
    const widgetScript = generateWidgetScript(
      options.organizationId,
      options.firebaseProjectId || "",
    );
    if (output.includes("</body>")) {
      output = output.replace("</body>", `${widgetScript}\n</body>`);
    } else {
      output += `\n${widgetScript}`;
    }
  }

  if (options.analyticsConfig?.enabled) {
    const analyticsScript = generateAnalyticsScript(
      options.analyticsConfig,
      options.organizationId,
      options.tempSiteId,
      options.brandName ?? "",
      options.firebaseProjectId || "",
    );
    if (analyticsScript) {
      if (output.includes("</head>")) {
        output = output.replace("</head>", `${analyticsScript}\n</head>`);
      } else if (output.includes("</body>")) {
        output = output.replace("</body>", `${analyticsScript}\n</body>`);
      } else {
        output += `\n${analyticsScript}`;
      }
    }
  }

  return output;
}

export async function handleGenerateSite(
  input: GenerateSiteInput,
  config: GenerateSiteConfig,
): Promise<{ id: string; url: string; status: string }> {
  const startTime = Date.now();
  const timings: Record<string, number> = {};
  const markTiming = (label: string, start: number) => {
    timings[label] = Date.now() - start;
  };
  let brandSiteId: string | undefined;
  let generatedHtmlFiles: Record<string, string> = {};
  const errorContext: {
    stage: string;
    errors: Array<{ stage: string; error: string; timestamp: string }>;
  } = {
    stage: "initialization",
    errors: [],
  };

  logger.info("Starting site generation", {
    organizationId: input.organizationId,
    timestamp: new Date().toISOString(),
  });

  try {
    logger.debug("Step 1: Initializing repositories", {
      organizationId: input.organizationId,
    });
  const databaseService = getDatabaseService();
  const organizationRepository = getOrganizationRepository(databaseService);
  const brandSiteRepository = getBrandSiteRepository(databaseService);
  const productRepository = getProductRepository(databaseService);

    logger.debug("Step 2: Fetching organization", {
      organizationId: input.organizationId,
    });
  const orgStartTime = Date.now();
    errorContext.stage = "organization_fetch";
  const organization = await organizationRepository.get({ id: input.organizationId });
  if (!organization) {
      const error = "Organization not found";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Organization not found", {
        organizationId: input.organizationId,
        errorContext,
      });
      throw new Error(error);
  }
  markTiming("organization_fetch", orgStartTime);
  logger.info("Organization retrieved", {
    duration: timings.organization_fetch,
    organizationName: organization.name,
  });

    logger.debug("Step 3: Extracting brand configuration", {
      organizationId: input.organizationId,
      hasBrandName: !!input.brandName,
      hasTone: !!input.tone,
    });
    errorContext.stage = "brand_config";
  const brandName = input.brandName || organization.name;
  const tone = input.tone || "professional";
  const brandColors = organization.settings?.brandColors || {
    primary: "#2563eb",
    secondary: "#6b7280",
    accent: "#10b981",
  };
  const logoUrl = organization.settings?.branding?.customLogo || organization.logoUrl;
    const description = organization.settings?.branding?.description;
    const brandImages = organization.settings?.branding?.brandImages || [];

    logger.debug("Step 4: Finding existing brand site", {
      organizationId: input.organizationId,
    });
    errorContext.stage = "brand_site_fetch";
  const siteFetchStart = Date.now();
  const existingSites = await brandSiteRepository.getAll({
    queryConstraints: [
      { field: "organizationId", operator: "==", value: input.organizationId },
    ],
  });
  markTiming("brand_site_fetch", siteFetchStart);

  if (existingSites.length === 0) {
      const error = "Brand site not found. Please initiate generation first.";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Brand site not found", {
        organizationId: input.organizationId,
        errorContext,
      });
      throw new Error(error);
  }

  const brandSite = existingSites[0];
    brandSiteId = brandSite.id;
    logger.debug("Brand site found", {
      brandSiteId,
      currentStatus: brandSite.status,
    });

  const pagesToGenerate = normalizePages((brandSite as any).pages);

  // Verify status is pending (should be set by init function)
  if (brandSite.status !== "pending") {
    logger.warn("Brand site status is not pending, updating to pending", {
      brandSiteId,
      currentStatus: brandSite.status,
    });
      errorContext.stage = "status_update";
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "pending",
      },
    });
  }

    logger.debug("Step 5: Updating status to generating", {
      brandSiteId,
    });
    errorContext.stage = "status_update_to_generating";
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "generating",
      },
    });

    logger.debug("Step 6: Initializing Gemini service", {
      brandSiteId,
      model: "gemini-2.5-flash",
    });
    errorContext.stage = "gemini_init";
    const geminiInitStart = Date.now();
    const geminiService = new GeminiService({
      apiKey: config.geminiApiKey,
      model: "gemini-2.5-flash",
    });
    markTiming("gemini_init", geminiInitStart);

    // Check if this is a section regeneration
    const sectionType = (brandSite.metadata as { regenerateSectionType?: "hero" | "about" | "features" | "contact" })?.regenerateSectionType;

    logger.debug("Step 7: Generating HTML with Gemini", {
      brandSiteId,
      sectionType: sectionType || "full",
      hasExistingHtml: !!brandSite.html,
    });
    errorContext.stage = "gemini_generation";
    const geminiGenerationStart = Date.now();
    let html: string;
    
    // Fetch analytics config early (will be used for injection and deployment)
    let analyticsConfig: any | null = null;
    try {
      analyticsConfig = await getAnalyticsConfig(organization.id);
    } catch (error) {
      logger.warn("Failed to fetch analytics config during HTML generation", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    try {
    if (sectionType && brandSite.html) {
      logger.info("Calling Gemini API for section regeneration", {
        brandName,
        sectionType,
        model: "gemini-2.5-flash",
      });

      // Get products for the organization
      const products = await productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: input.organizationId },
          { field: "status", operator: "==", value: "active" },
        ],
      });

      const productsForContext = products.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        images: p.images,
      }));

      // Prepare widget configuration for section regeneration
      const widgets = organization.settings?.widgets;
      const widgetContext = widgets?.enabled ? {
        enabled: true,
        contactForm: widgets.contactForm?.enabled ? {
          enabled: true,
          title: widgets.contactForm.title || "Contact Us",
          description: widgets.contactForm.description || "",
          position: widgets.contactForm.position || "bottom-right",
          displayMode: widgets.contactForm.displayMode || "floating",
          submitButtonText: widgets.contactForm.submitButtonText || "Send Message",
          successMessage: widgets.contactForm.successMessage || "Thank you! We'll get back to you soon.",
        } : undefined,
        invoiceRequest: widgets.invoiceRequest?.enabled ? {
          enabled: true,
          title: widgets.invoiceRequest.title || "Request Invoice",
          description: widgets.invoiceRequest.description || "",
          position: widgets.invoiceRequest.position || "bottom-right",
          displayMode: "floating", // Invoice request widgets are always floating
          submitButtonText: widgets.invoiceRequest.submitButtonText || "Request Invoice",
          successMessage: widgets.invoiceRequest.successMessage || "Invoice request submitted successfully!",
        } : undefined,
        quoteRequest: widgets.quoteRequest?.enabled ? {
          enabled: true,
          title: widgets.quoteRequest.title || "Request Quote",
          description: widgets.quoteRequest.description || "",
          position: widgets.quoteRequest.position || "bottom-right",
          displayMode: "floating", // Quote request widgets are always floating
          submitButtonText: widgets.quoteRequest.submitButtonText || "Request Quote",
          successMessage: widgets.quoteRequest.successMessage || "Quote request submitted successfully!",
        } : undefined,
      } : undefined;

      html = await geminiService.regenerateSection(
        {
          brandName,
          colors: brandColors,
          logoUrl,
          tone,
            description,
            brandImages,
            context: brandSite.context,
            contextImages: brandSite.contextImages || [],
            products: productsForContext,
            widgets: widgetContext,
        },
        sectionType,
        brandSite.html,
      );

      // Inject widget script if widgets are enabled (for section regeneration)
      if (widgets?.enabled) {
        const widgetScript = generateWidgetScript(organization.id, config.firebaseProjectId || "");
        // Inject before closing </body> tag
        if (html.includes("</body>")) {
          html = html.replace("</body>", `${widgetScript}\n</body>`);
        } else {
          // If no body tag, append to end
          html += `\n${widgetScript}`;
        }
      }

      // Inject analytics script if analytics is enabled (for section regeneration)
      if (analyticsConfig?.enabled) {
        const tempSiteId = `brand-${brandSiteId}`;
        const analyticsScript = generateAnalyticsScript(
          analyticsConfig,
          organization.id,
          tempSiteId,
          brandName,
          config.firebaseProjectId || "",
        );
        if (analyticsScript) {
          // Inject in <head> for analytics (should load early)
          if (html.includes("</head>")) {
            html = html.replace("</head>", `${analyticsScript}\n</head>`);
          } else if (html.includes("</body>")) {
            // Fallback to body if no head tag
            html = html.replace("</body>", `${analyticsScript}\n</body>`);
          } else {
            html += `\n${analyticsScript}`;
          }
        }
      }

      markTiming("gemini_generation", geminiGenerationStart);
      logger.info("Section regenerated by Gemini", {
        duration: timings.gemini_generation,
        sectionType,
        htmlLength: html.length,
      });
    } else {
      logger.info("Calling Gemini API for HTML generation", {
        brandName,
        model: "gemini-2.5-flash",
      });

      // Get products for the organization
      const products = await productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: input.organizationId },
          { field: "status", operator: "==", value: "active" },
        ],
      });

      const productsForContext = products.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        images: p.images,
      }));

      // Prepare widget configuration for AI context
      // Include complete widget information so AI knows what widgets are available
      const widgets = organization.settings?.widgets;
      const widgetContext = widgets?.enabled ? {
        enabled: true,
        contactForm: widgets.contactForm?.enabled ? {
          enabled: true,
          title: widgets.contactForm.title || "Contact Us",
          description: widgets.contactForm.description || "",
          position: widgets.contactForm.position || "bottom-right",
          displayMode: widgets.contactForm.displayMode || "floating",
          submitButtonText: widgets.contactForm.submitButtonText || "Send Message",
          successMessage: widgets.contactForm.successMessage || "Thank you! We'll get back to you soon.",
        } : undefined,
        invoiceRequest: widgets.invoiceRequest?.enabled ? {
          enabled: true,
          title: widgets.invoiceRequest.title || "Request Invoice",
          description: widgets.invoiceRequest.description || "",
          position: widgets.invoiceRequest.position || "bottom-right",
          displayMode: "floating", // Invoice request widgets are always floating
          submitButtonText: widgets.invoiceRequest.submitButtonText || "Request Invoice",
          successMessage: widgets.invoiceRequest.successMessage || "Invoice request submitted successfully!",
        } : undefined,
        quoteRequest: widgets.quoteRequest?.enabled ? {
          enabled: true,
          title: widgets.quoteRequest.title || "Request Quote",
          description: widgets.quoteRequest.description || "",
          position: widgets.quoteRequest.position || "bottom-right",
          displayMode: "floating", // Quote request widgets are always floating
          submitButtonText: widgets.quoteRequest.submitButtonText || "Request Quote",
          successMessage: widgets.quoteRequest.successMessage || "Quote request submitted successfully!",
        } : undefined,
      } : undefined;

      const generatedPageFiles: Record<string, string> = {};
      for (const page of pagesToGenerate) {
        const pageContext = [
          brandSite.context,
          page.context,
        ]
          .filter(Boolean)
          .join("\n\n");

        const entriesSummary =
          page.contentEntries && page.contentEntries.length > 0
            ? page.contentEntries
                .map(
                  (entry, entryIndex) =>
                    `${entryIndex + 1}. ${entry.title}${
                      entry.summary ? ` — ${entry.summary}` : ""
                    }${entry.link ? ` (Link: ${entry.link})` : ""}`,
                )
                .join("\n")
            : undefined;

        const pagePurpose = [page.description, entriesSummary]
          .filter(Boolean)
          .join("\n\n");

        let pageHtml = await geminiService.generateSiteHtml({
          brandName,
          colors: brandColors,
          logoUrl,
          tone,
          description,
          brandImages,
          context: pageContext || brandSite.context,
          contextImages: brandSite.contextImages || [],
          products: productsForContext,
          widgets: widgetContext,
          pageTitle: page.title,
          pagePurpose: pagePurpose || page.description || description || "",
          pageSlug: page.slug,
          pageType: page.type,
          pageContentEntries: page.contentEntries,
        });

        pageHtml = injectNavigation(
          pageHtml,
          pagesToGenerate,
          page.slug,
          brandName,
        );

        pageHtml = applyIntegrations(pageHtml, {
          widgets,
          organizationId: organization.id,
          analyticsConfig,
          brandSiteId,
          firebaseProjectId: config.firebaseProjectId,
          tempSiteId: `brand-${brandSiteId}`,
          brandName,
        });

        const filePath =
          page.slug === "index" || page.slug === "home"
            ? "index.html"
            : `${page.slug}/index.html`;
        generatedPageFiles[filePath] = pageHtml;
      }

      html =
        generatedPageFiles["index.html"] ||
        Object.values(generatedPageFiles)[0] ||
        "";

      markTiming("gemini_generation", geminiGenerationStart);
      logger.info("HTML generated by Gemini", {
        duration: timings.gemini_generation,
        htmlLength: html.length,
        pagesGenerated: Object.keys(generatedPageFiles).length,
      });

      generatedHtmlFiles = generatedPageFiles;
      }
    } catch (geminiError) {
      const error = geminiError instanceof Error ? geminiError.message : "Unknown Gemini error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Gemini generation failed", {
        brandSiteId,
        error,
        errorContext,
      });
      throw geminiError;
    }

    logger.debug("Step 8: Validating and saving HTML", {
      brandSiteId,
      htmlLength: html.length,
    });
    errorContext.stage = "html_validation";
    
    // Validate HTML is not empty
    if (!html || html.trim().length === 0) {
      const error = "Generated HTML is empty";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("HTML validation failed: empty HTML", {
        brandSiteId,
        errorContext,
      });
      throw new Error(error);
    }

    // Basic HTML structure validation
    const hasHtmlTag = html.includes("<html") || html.includes("<!DOCTYPE");
    const hasBodyTag = html.includes("<body");
    
    if (!hasHtmlTag && !hasBodyTag) {
      logger.warn("Generated HTML may be missing proper structure", {
        brandSiteId,
        htmlPreview: html.substring(0, 200),
      });
    }

    logger.debug("Step 8: Saving HTML and updating status to deploying", {
      brandSiteId,
      htmlLength: html.length,
      hasHtmlTag,
      hasBodyTag,
    });
    errorContext.stage = "html_save";
    
    // Save current version to history before updating (if there's existing HTML)
    const newVersion = (brandSite?.metadata?.version || 0) + 1;
    const existingVersions = brandSite?.versions || [];
    const versionsToSave = [...existingVersions];
    
    // If there's existing HTML, save it as a version before overwriting
    // Also deploy it to a preview channel so users can view it
    if (brandSite?.html && brandSite.html.trim().length > 0) {
      const versionToSave = {
        version: brandSite.metadata?.version || 1,
        html: brandSite.html,
        deployedUrl: brandSite.deployedUrl,
        metadata: brandSite.metadata,
        createdAt: brandSite.metadata?.generatedAt || new Date().toISOString(),
        description: sectionType ? `Regenerated ${sectionType} section` : "Previous version",
        previewUrl: undefined as string | undefined,
      };

      // Deploy to preview channel asynchronously (don't block on this)
      try {
        const hostingService = new FirebaseHostingService({
          projectId: config.firebaseProjectId.trim(),
        });
        const siteId = `brand-${brandSiteId}`;
        const channelId = `v${versionToSave.version}-${brandSiteId.substring(0, 8)}`;
        
        // Deploy to preview channel in background (fire and forget to not slow down the process)
        // Capture brandSiteId in a const to ensure it's available in the async callback
        const capturedBrandSiteId = brandSiteId;
        if (!capturedBrandSiteId) {
          logger.warn("Cannot deploy preview: brandSiteId is not set", {
            version: versionToSave.version,
          });
          versionsToSave.push(versionToSave);
        } else {
          hostingService.deployToPreviewChannel(
            siteId,
            [{ path: "index.html", contents: brandSite.html }],
            channelId,
            `Preview version ${versionToSave.version}`,
          ).then((previewUrl) => {
            // Update the version with preview URL after deployment completes
            const updatedVersions = [...versionsToSave];
            const versionIndex = updatedVersions.findIndex(v => v.version === versionToSave.version);
            if (versionIndex >= 0) {
              updatedVersions[versionIndex] = { ...updatedVersions[versionIndex], previewUrl };
              brandSiteRepository.update({
                id: capturedBrandSiteId,
                data: { versions: updatedVersions },
              }).catch((err) => {
                logger.error("Failed to update version with preview URL", {
                  brandSiteId: capturedBrandSiteId,
                  version: versionToSave.version,
                  error: err instanceof Error ? err.message : "Unknown error",
                });
              });
            }
          }).catch((err) => {
            logger.warn("Failed to deploy version to preview channel (non-blocking)", {
              brandSiteId: capturedBrandSiteId,
              version: versionToSave.version,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          });
          versionsToSave.push(versionToSave);
        }

      } catch (previewError) {
        // If preview deployment fails, still save the version (just without preview URL)
        logger.warn("Failed to start preview deployment (non-blocking)", {
          brandSiteId: brandSiteId || "unknown",
          version: versionToSave.version,
          error: previewError instanceof Error ? previewError.message : "Unknown error",
        });
        versionsToSave.push(versionToSave);
      }
    }
    
    // Ensure brandSiteId is defined before updating
    if (!brandSiteId) {
      const error = "Brand site ID is not set";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Brand site ID missing", {
        errorContext,
      });
      throw new Error(error);
    }

    // Save files structure (for manual editing support)
    const files: Record<string, string> =
      Object.keys(generatedHtmlFiles).length > 0
        ? generatedHtmlFiles
        : {
            "index.html": html,
          };

    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        html,
        files,
        pages: pagesToGenerate,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-flash",
          version: newVersion,
      },
        status: "deploying",
        versions: versionsToSave,
      },
    });

    const deploymentPrepStart = Date.now();
    logger.debug("Step 9: Preparing deployment configuration", {
      brandSiteId,
      brandName,
    });
    errorContext.stage = "deployment_prep";
    const subdomain = generateSubdomain(brandName);
    
    // brandSiteId is already validated above, safe to use here
    let siteId = `brand-${brandSiteId}`;

    const hostingStartTime = Date.now();
    
    if (!config.firebaseProjectId || config.firebaseProjectId.trim() === "") {
      const error = "Firebase Project ID is required for hosting";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Firebase Project ID missing", {
        brandSiteId,
        errorContext,
      });
      throw new Error(error);
    }

    markTiming("deployment_prep", deploymentPrepStart);
    logger.info("Initializing Firebase Hosting Service", {
      projectId: config.firebaseProjectId,
    });
    errorContext.stage = "hosting_init";
    const hostingService = new FirebaseHostingService({
      projectId: config.firebaseProjectId.trim(),
    });

    logger.debug("Step 10: Creating or getting Firebase Hosting site", {
      siteId,
      brandSiteId,
    });
    errorContext.stage = "hosting_site_creation";
    let createdSite;
    try {
      createdSite = await hostingService.createSite(siteId);
    } catch (siteError) {
      const error = siteError instanceof Error ? siteError.message : "Unknown site creation error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Firebase Hosting site creation failed", {
        brandSiteId,
        siteId,
        error,
        errorContext,
      });
      throw siteError;
    }
    
    // Validate response has siteId
    if (!createdSite?.siteId) {
      const error = "Firebase Hosting API returned invalid response: missing siteId";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Invalid site creation response", {
        brandSiteId,
        response: JSON.stringify(createdSite),
        errorContext,
      });
      throw new Error(error);
    }
    
    // Use the siteId from the response (works for both new and existing sites)
    siteId = createdSite.siteId;
    markTiming("hosting_site_init", hostingStartTime);
    logger.info("Firebase Hosting site ready", {
      duration: timings.hosting_site_init,
      siteId,
      originalSiteId: `brand-${brandSiteId}`,
      siteName: createdSite.name,
    });

    const deployStartTime = Date.now();
    
    // Validate siteId before deployment
    if (!siteId || typeof siteId !== 'string') {
      const error = "Invalid site ID: cannot deploy without a valid site ID";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Invalid site ID for deployment", {
        brandSiteId,
        siteId,
        errorContext,
      });
      throw new Error(error);
    }
    
    logger.debug("Step 11: Deploying site to Firebase Hosting", {
      siteId,
      htmlLength: html.length,
      brandSiteId,
    });
    errorContext.stage = "hosting_deployment";
    let deployedUrl: string;
    try {
      // Prepare files for deployment
      const filesToDeploy = Object.entries(files).map(([path, contents]) => ({
        path,
        contents,
      }));
      
      // If widgets are enabled, add widget-loader.js to deployment
      const widgets = organization.settings?.widgets;
      if (widgets?.enabled) {
        try {
          // Read widget-loader.js - try multiple paths to support both dev and production
          let widgetLoaderPath: string | null = null;
          const possiblePaths = [
            join(__dirname, "../../public/widget-loader.js"), // Production: functions/lib/app -> functions/public
            join(__dirname, "../../../app/public/widget-loader.js"), // Dev: functions/lib/app -> app/public
            join(process.cwd(), "functions/public/widget-loader.js"), // Fallback
          ];
          
          for (const path of possiblePaths) {
            if (existsSync(path)) {
              widgetLoaderPath = path;
              break;
            }
          }
          
          if (!widgetLoaderPath) {
            throw new Error("widget-loader.js not found in any expected location");
          }
          
          try {
            const widgetLoaderContent = readFileSync(widgetLoaderPath, "utf-8");
            filesToDeploy.push({
              path: "widget-loader.js",
              contents: widgetLoaderContent,
            });
            logger.info("Added widget-loader.js to deployment", { brandSiteId });
          } catch (readError) {
            logger.warn("Could not read widget-loader.js, widgets may not work", {
              error: readError instanceof Error ? readError.message : "Unknown error",
              path: widgetLoaderPath,
            });
            // Continue without widget-loader.js - the script tag will still be injected
          }
        } catch (error) {
          logger.warn("Failed to add widget-loader.js to deployment", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // If analytics is enabled, add analytics-loader.js to deployment
      // analyticsConfig was already fetched above
      if (analyticsConfig?.enabled) {
        try {
          // Read analytics-loader.js - try multiple paths to support both dev and production
          let analyticsLoaderPath: string | null = null;
          const possibleAnalyticsPaths = [
            join(__dirname, "../../public/analytics-loader.js"), // Production: functions/lib/app -> functions/public
            join(__dirname, "../../../app/public/analytics-loader.js"), // Dev: functions/lib/app -> app/public
            join(process.cwd(), "functions/public/analytics-loader.js"), // Fallback
          ];
          
          for (const path of possibleAnalyticsPaths) {
            if (existsSync(path)) {
              analyticsLoaderPath = path;
              break;
            }
          }
          
          if (!analyticsLoaderPath) {
            throw new Error("analytics-loader.js not found in any expected location");
          }
          
          try {
            const analyticsLoaderContent = readFileSync(analyticsLoaderPath, "utf-8");
            filesToDeploy.push({
              path: "analytics-loader.js",
              contents: analyticsLoaderContent,
            });
            logger.info("Added analytics-loader.js to deployment", { brandSiteId });
          } catch (readError) {
            logger.warn("Could not read analytics-loader.js, analytics may not work", {
              error: readError instanceof Error ? readError.message : "Unknown error",
              path: analyticsLoaderPath,
            });
          }
        } catch (error) {
          logger.warn("Failed to add analytics-loader.js to deployment", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      
      deployedUrl = await hostingService.deploySite(
      siteId,
      filesToDeploy,
      `Deploy ${brandName} site`,
    );
      markTiming("hosting_deployment", deployStartTime);
      logger.info("Site deployed to Firebase Hosting", {
        duration: timings.hosting_deployment,
      deployedUrl,
      fileCount: filesToDeploy.length,
    });
    } catch (deployError) {
      const error = deployError instanceof Error ? deployError.message : "Unknown deployment error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Firebase Hosting deployment failed", {
        brandSiteId,
        siteId,
        error,
        errorContext,
      });
      throw deployError;
    }

    // For regeneration, skip Cloudflare subdomain creation (use Firebase Hosting URL directly)
    // For new sites, create Cloudflare subdomain
    const isRegeneration = !!sectionType || !!brandSite.html;

    logger.debug("Step 12: Configuring final URL", {
      brandSiteId,
      isRegeneration,
      subdomain: isRegeneration ? undefined : subdomain,
    });
    errorContext.stage = "url_configuration";
    let finalUrl: string;

    if (isRegeneration) {
      // Regeneration: use Firebase Hosting URL directly
      finalUrl = deployedUrl;
      logger.info("Skipping Cloudflare subdomain for regeneration", {
        deployedUrl,
      });

      errorContext.stage = "status_update_success";
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          status: "success",
          deployedUrl: finalUrl,
          // Clear the regenerateSectionType from metadata
          metadata: {
            ...(brandSite.metadata || {}),
            version: newVersion,
            generatedAt: brandSite.metadata?.generatedAt || new Date().toISOString(),
            model: brandSite.metadata?.model || "gemini-2.5-flash",
            regenerateSectionType: undefined,
          },
        },
      });
    } else {
      // New site: create Cloudflare subdomain
      logger.debug("Step 13: Creating Cloudflare subdomain", {
        subdomain,
        deployedUrl,
        brandSiteId,
      });
      errorContext.stage = "cloudflare_subdomain";
      const cloudflareStartTime = Date.now();
      const cloudflareService = new CloudflareService({
        apiToken: config.cloudflareApiToken,
        zoneId: config.cloudflareZoneId,
        baseDomain: config.cloudflareBaseDomain,
      });

      try {
      logger.info("Creating Cloudflare subdomain", { subdomain });
      const deployedHost = new URL(deployedUrl).hostname;
      finalUrl = await cloudflareService.createSubdomain(
        subdomain,
        deployedHost,
      );
      markTiming("cloudflare_subdomain", cloudflareStartTime);
      logger.info("Cloudflare subdomain created", {
        duration: timings.cloudflare_subdomain,
        subdomainUrl: finalUrl,
      });
      } catch (cloudflareError) {
        const error = cloudflareError instanceof Error ? cloudflareError.message : "Unknown Cloudflare error";
        errorContext.errors.push({
          stage: errorContext.stage,
          error,
          timestamp: new Date().toISOString(),
        });
        logger.error("Cloudflare subdomain creation failed", {
          brandSiteId,
          subdomain,
          error,
          errorContext,
        });
        throw cloudflareError;
      }

      errorContext.stage = "status_update_success";
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          status: "success",
          subdomain,
          deployedUrl: finalUrl,
        pages: pagesToGenerate,
          metadata: {
            ...(brandSite.metadata || {}),
            version: newVersion,
            generatedAt: brandSite.metadata?.generatedAt || new Date().toISOString(),
            model: brandSite.metadata?.model || "gemini-2.5-flash",
          },
        },
      });
    }

    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;
    logger.info("Site generated and deployed successfully", {
      brandSiteId,
      subdomain: isRegeneration ? undefined : subdomain,
      url: finalUrl,
      isRegeneration,
      totalDuration,
      totalDurationSeconds: Math.round(totalDuration / 1000),
      durations: timings,
    });

    return {
      id: brandSiteId,
      url: finalUrl,
      status: "success",
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Ensure error is recorded in context
    if (!errorContext.errors.some(e => e.error === errorMessage && e.stage === errorContext.stage)) {
      errorContext.errors.push({
        stage: errorContext.stage,
      error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }

    // Create summarized error
    const errorSummary = {
      brandSiteId: brandSiteId || "unknown",
      totalDuration,
      totalDurationSeconds: Math.round(totalDuration / 1000),
      durations: timings,
      failedAtStage: errorContext.stage,
      errorCount: errorContext.errors.length,
      errors: errorContext.errors,
      finalError: errorMessage,
      errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    };

    logger.error("Failed to generate site - Summary", errorSummary);

    // Update brand site with error status
    try {
      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);
    await brandSiteRepository.update({
        id: brandSiteId || "unknown",
      data: {
        status: "failed",
        error: errorMessage,
      },
    });
    } catch (updateError) {
      logger.error("Failed to update brand site with error status", {
        brandSiteId,
        updateError: updateError instanceof Error ? updateError.message : "Unknown error",
        originalError: errorSummary,
      });
    }

    throw new Error(`Failed to generate site: ${errorMessage}`);
  }
}

function generateSubdomain(brandName: string): string {
  if (!brandName || typeof brandName !== 'string') {
    throw new Error("Brand name is required to generate subdomain");
  }
  
  return brandName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Generate widget script tag for embedding widgets
 */
function generateWidgetScript(organizationId: string, projectId: string): string {
  const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  return `<script src="/widget-loader.js" data-org-id="${organizationId}" data-api-url="${apiUrl}"></script>`;
}

/**
 * Fetch analytics config for an organization
 */
async function getAnalyticsConfig(orgId: string): Promise<any | null> {
  try {
    const docRef = firestore()
      .collection("organizations")
      .doc(orgId)
      .collection("analyticsConfig")
      .doc("default");
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data();
  } catch (error) {
    logger.warn("Failed to fetch analytics config", {
      orgId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/**
 * Generate analytics script tag based on config
 */
function generateAnalyticsScript(
  analyticsConfig: any,
  orgId: string,
  siteId: string,
  brandName: string,
  projectId: string,
): string {
  if (!analyticsConfig || !analyticsConfig.enabled) {
    return "";
  }

  const attributes: string[] = [
    `data-analytics-org-id="${orgId}"`,
    `data-analytics-site-id="${siteId}"`,
    `data-analytics-brand-name="${brandName || ""}"`,
    `data-analytics-enabled="true"`,
    `data-analytics-consent-default="${analyticsConfig.consentDefault || "denied"}"`,
    `data-analytics-banner-provider="${analyticsConfig.bannerProvider || "custom"}"`,
  ];

  // Add provider enable flags
  if (analyticsConfig.enableGA4) {
    attributes.push(`data-analytics-enable-ga4="true"`);
  }
  if (analyticsConfig.enablePlausible) {
    attributes.push(`data-analytics-enable-plausible="true"`);
  }
  if (analyticsConfig.enableUmami) {
    attributes.push(`data-analytics-enable-umami="true"`);
  }
  if (analyticsConfig.enableClarity) {
    attributes.push(`data-analytics-enable-clarity="true"`);
  }

  // Add provider configuration
  if (analyticsConfig.ga4MeasurementId) {
    attributes.push(`data-analytics-ga4-id="${analyticsConfig.ga4MeasurementId}"`);
  }

  if (analyticsConfig.clarityProjectId) {
    attributes.push(`data-analytics-clarity-id="${analyticsConfig.clarityProjectId}"`);
  }

  if (analyticsConfig.plausibleDomain) {
    attributes.push(`data-analytics-plausible-domain="${analyticsConfig.plausibleDomain}"`);
  }

  if (analyticsConfig.umamiScriptUrl) {
    attributes.push(`data-analytics-umami-url="${analyticsConfig.umamiScriptUrl}"`);
  }

  if (analyticsConfig.umamiWebsiteId) {
    attributes.push(`data-analytics-umami-website-id="${analyticsConfig.umamiWebsiteId}"`);
  }

  // Legacy strategy field (for backward compatibility)
  if (analyticsConfig.strategy) {
    attributes.push(`data-analytics-strategy="${analyticsConfig.strategy}"`);
  }

  // Add Firebase project ID as data attribute so analytics-loader can call functions
  attributes.push(`data-firebase-project="${projectId || ""}"`);
  
  // Add function URL - Firebase Functions v2 uses Cloud Run URLs
  // Legacy format: https://{region}-{projectId}.cloudfunctions.net/{functionName} (may not work for v2)
  // Cloud Run format: https://{functionName}-{hash}-{region}.a.run.app
  // Since the hash is unpredictable, we'll try both formats in analytics-loader.js
  // For now, we'll pass the legacy format and let the loader try Cloud Run format if it fails
  const legacyUrl = projectId 
    ? `https://us-central1-${projectId}.cloudfunctions.net/storeAnalyticsEvent`
    : "";
  if (legacyUrl) {
    attributes.push(`data-analytics-function-url="${legacyUrl}"`);
  }

  // Add consent banner styling if it exists and consent is denied
  if (analyticsConfig.consentDefault === "denied" && analyticsConfig.bannerProvider === "custom" && analyticsConfig.consentBannerStyling) {
    const styling = analyticsConfig.consentBannerStyling;
    attributes.push(`data-consent-banner-styling="${encodeURIComponent(JSON.stringify(styling))}"`);
  }

  return `<script src="/analytics-loader.js" ${attributes.join(" ")}></script>`;
}

