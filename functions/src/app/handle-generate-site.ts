import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getProductRepository } from "../repositories/product-repository";
import { GeminiService } from "../services/gemini-service";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { CloudflarePublisherService } from "../services/cloudflare-publisher-service";
import { logger } from "firebase-functions";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { firestore } from "firebase-admin";
import { listOrganizationImages, filterValidProductImages } from "../utils/list-organization-images";

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
  // Cloudflare publisher config (for R2 + KV)
  cloudflareAccountId: string;
  cloudflareR2BucketName: string;
  cloudflareKvNamespaceId: string;
}

interface PageContentEntry {
  id?: string;
  title?: string;
  summary?: string;
  link?: string;
  image?: string;
  description?: string;
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
  description?: string;
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
          description: entry.description?.trim() || undefined,
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

export function injectNavigation(
  html: string,
  pages: SitePageInput[],
  currentSlug: string,
  brandName: string,
): string {
  let output = html;
  
  // Remove existing navigation if present (to avoid duplicates)
  // Remove navigation styles
  output = output.replace(/<style>[\s\S]*?\.site-nav-wrapper[\s\S]*?<\/style>/gi, '');
  // Remove navigation markup
  output = output.replace(/<div class="site-nav-wrapper">[\s\S]*?<\/div>/gi, '');
  
  // Inject navigation styles (only once)
  if (!output.includes('site-nav-wrapper')) {
    if (output.includes("</head>")) {
      output = output.replace("</head>", `${NAVIGATION_STYLES}\n</head>`);
    } else {
      output = `${NAVIGATION_STYLES}\n${output}`;
    }
  }

  // Inject navigation markup (only once, right after body tag)
  const navMarkup = buildNavigationMarkup(pages, currentSlug, brandName);
  const bodyMatch = output.match(/<body[^>]*>/i);
  if (bodyMatch) {
    const bodyTag = bodyMatch[0];
    // Check if navigation already exists after body tag
    const afterBody = output.substring(output.indexOf(bodyTag) + bodyTag.length);
    if (!afterBody.trim().startsWith(navMarkup.trim())) {
      output = output.replace(bodyTag, `${bodyTag}\n${navMarkup}`);
    }
  } else {
    // No body tag, prepend navigation
    if (!output.includes('site-nav-wrapper')) {
      output = `${navMarkup}\n${output}`;
    }
  }

  return output;
}

/**
 * Generate JavaScript to dynamically load blog articles
 */
function generateBlogLoaderScript(
  brandSiteId: string,
  pageSlug: string,
  firebaseProjectId: string,
): string {
  const functionUrl = `https://us-central1-${firebaseProjectId}.cloudfunctions.net/getBlogArticles`;
  
  return `
<script>
(function() {
  const container = document.getElementById('blog-articles-container');
  if (!container) {
    console.warn('Blog articles container not found');
    return;
  }

  // Show loading state
  container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">Loading articles...</p>';

  // Fetch articles from Cloud Function
  fetch('${functionUrl}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        brandSiteId: '${brandSiteId}',
        pageSlug: '${pageSlug}'
      }
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch articles');
    }
    return response.json();
  })
  .then(result => {
    const articles = result.result?.articles || [];
    
    if (articles.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No articles yet. Check back soon!</p>';
      return;
    }

    // Render articles
    container.innerHTML = articles.map(article => {
      const image = article.image ? \`<img src="\${article.image}" alt="\${article.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;">\` : '';
      const summary = article.summary ? \`<p style="color: #666; margin: 0.5rem 0;">\${article.summary}</p>\` : '';
      const description = article.description ? \`<div style="margin-top: 0.5rem; color: #444;">\${article.description}</div>\` : '';
      const link = article.link ? \`<a href="\${article.link}" style="display: inline-block; margin-top: 1rem; color: #2563eb; text-decoration: none; font-weight: 600;">Read more →</a>\` : '';
      
      return \`
        <article style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
          \${image}
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #111;">\${article.title}</h3>
          \${summary}
          \${description}
          \${link}
        </article>
      \`;
    }).join('');
  })
  .catch(error => {
    console.error('Error loading blog articles:', error);
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #dc2626;">Failed to load articles. Please try again later.</p>';
  });
})();
</script>`;
}

export function applyIntegrations(
  html: string,
  options: {
    widgets?: any;
    organizationId: string;
    analyticsConfig?: any;
    brandSiteId?: string;
    firebaseProjectId?: string;
    tempSiteId: string;
    brandName: string;
    pageType?: "standard" | "blog" | "contact";
    pageSlug?: string;
    customFavicon?: string;
    availablePages?: Array<{ slug: string; title: string; href: string }>;
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

  // Inject blog loader script for blog pages
  if (options.pageType === "blog" && options.brandSiteId && options.pageSlug && options.firebaseProjectId) {
    const blogLoaderScript = generateBlogLoaderScript(
      options.brandSiteId,
      options.pageSlug,
      options.firebaseProjectId,
    );
    if (output.includes("</body>")) {
      output = output.replace("</body>", `${blogLoaderScript}\n</body>`);
    } else {
      output += `\n${blogLoaderScript}`;
    }
  }

  // Inject favicon link tag (use custom favicon if available, otherwise skip)
  if (options.customFavicon) {
    const faviconLink = `<link rel="icon" type="image/x-icon" href="${options.customFavicon}">`;
    if (output.includes("</head>")) {
      output = output.replace("</head>", `${faviconLink}\n</head>`);
    } else if (output.includes("<head>")) {
      output = output.replace("<head>", `<head>\n${faviconLink}`);
    } else {
      // If no head tag, try to add before body or at the start
      if (output.includes("<body")) {
        output = output.replace("<body", `<head>${faviconLink}</head>\n<body`);
      } else {
        output = `<head>${faviconLink}</head>\n${output}`;
      }
    }
  }

  // Remove invalid placeholder image URLs (like B84A62?text=..., 000000?text=..., etc.)
  // These are placeholder image services that Gemini sometimes generates
  output = output.replace(
    /<img[^>]+src=["']([^"']*(?:B84A62|000000|placeholder|via\.placeholder|dummyimage|placehold\.it)[^"']*)["'][^>]*>/gi,
    (match, url) => {
      // Remove the entire img tag if it's a placeholder URL
      return '';
    }
  );
  
  // Remove invalid image URLs from background-image CSS
  output = output.replace(
    /background-image:\s*url\(["']?([^"')]*(?:B84A62|000000|placeholder|via\.placeholder|dummyimage|placehold\.it)[^"')]*)["']?\)/gi,
    (match, url) => {
      // Remove the background-image property
      return '';
    }
  );
  
  // Remove data URIs that might be placeholder images (but keep valid ones)
  output = output.replace(
    /<img[^>]+src=["']data:image\/[^"']*B84A62[^"']*["'][^>]*>/gi,
    ''
  );
  output = output.replace(
    /<img[^>]+src=["']data:image\/[^"']*000000[^"']*["'][^>]*>/gi,
    ''
  );

  // Remove links to non-existent pages (404 prevention)
  if (options.availablePages && options.availablePages.length > 0) {
    const validPaths = options.availablePages.map((p: { href: string }) => p.href);
    // Also add common valid paths
    validPaths.push('/', '/index', '/index.html', '/home', '/home.html');
    
    // Remove internal links that don't match valid paths (but keep external links and anchors)
    output = output.replace(
      /<a([^>]*)\s+href=["'](\/[^"']+)["']([^>]*)>(.*?)<\/a>/gi,
      (match, before, href, after, content) => {
        // Skip if it's an anchor link (#) or external link (http/https)
        if (href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return match;
        }
        // Normalize href (remove trailing slash, handle index)
        const normalizedHref = href === '/' || href === '/index' || href === '/home' ? '/' : href.replace(/\/$/, '');
        // Check if it's a valid path
        const isValid = validPaths.some((path: string) => {
          const normalizedPath = path === '/' || path === '/index' || path === '/home' ? '/' : path.replace(/\/$/, '');
          return normalizedHref === normalizedPath || normalizedHref.startsWith(normalizedPath + '/');
        });
        
        if (isValid || href.endsWith('.html') || href.endsWith('.pdf') || href.endsWith('.jpg') || href.endsWith('.png') || href.endsWith('.jpeg') || href.endsWith('.webp')) {
          return match;
        }
        // Remove the link but keep the content - convert to button or span
        return `<button${before}${after} type="button">${content}</button>`;
      }
    );
  }

  // Rewrite Firebase Storage image URLs to use proxy (fixes CORS issues)
  if (options.firebaseProjectId) {
    const proxyUrl = `https://us-central1-${options.firebaseProjectId}.cloudfunctions.net/proxyStorageImage`;
    // Match Firebase Storage URLs and rewrite them to use the proxy
    output = output.replace(
      /https:\/\/storage\.googleapis\.com\/([^"'\s>]+)/g,
      (match, path) => {
        // Extract the path from the full URL
        const storagePath = path.split('/').slice(1).join('/');
        return `${proxyUrl}?path=${encodeURIComponent(storagePath)}`;
      }
    );
    // Also handle firebasestorage.googleapis.com URLs
    output = output.replace(
      /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^"'\s>]+)/g,
      (match, fullPath) => {
        // Extract path from firebasestorage URL format
        const pathMatch = fullPath.match(/o\/([^?]+)/);
        if (pathMatch) {
          const storagePath = decodeURIComponent(pathMatch[1]);
          return `${proxyUrl}?path=${encodeURIComponent(storagePath)}`;
        }
        return match;
      }
    );
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
    // Get all available images from organization's storage
    const allAvailableImages = await listOrganizationImages(
      input.organizationId,
      config.firebaseProjectId,
    );
    const customFavicon = organization.settings?.branding?.customFavicon;

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

  // Verify status is pending or generating (generating means another instance started it)
  if (brandSite.status !== "pending" && brandSite.status !== "generating") {
    logger.warn("Brand site status is not pending/generating, updating to generating", {
      brandSiteId,
      currentStatus: brandSite.status,
    });
    errorContext.stage = "status_update";
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "generating",
      },
    });
  } else if (brandSite.status === "generating") {
    // Status is already generating - this is fine, continue processing
    logger.info("Brand site already in generating status, continuing", {
      brandSiteId,
    });
  }

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
            brandImages: allAvailableImages, // Use all available images from storage
            context: brandSite.context,
            contextImages: [...(brandSite.contextImages || []), ...allAvailableImages], // Combine with all available images
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

      // Inject favicon if available (for section regeneration)
      if (customFavicon) {
        const faviconLink = `<link rel="icon" type="image/x-icon" href="${customFavicon}">`;
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${faviconLink}\n</head>`);
        } else if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n${faviconLink}`);
        } else if (html.includes("<body")) {
          html = html.replace("<body", `<head>${faviconLink}</head>\n<body`);
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

      // Filter product images to only include those that exist in storage
      const productsForContext = products.map((p) => {
        const validImages = p.images
          ? filterValidProductImages(p.images, allAvailableImages)
          : [];
        return {
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          category: p.category,
          images: validImages, // Only include images that actually exist
        };
      });

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
      const existingFiles = (brandSite.files as Record<string, string>) || {};
      const existingHtml = brandSite.html || "";
      
      // Get pages from the last generation (stored in metadata) to compare against current pages
      // This allows us to detect which pages have actually changed
      const lastGeneratedPages = (brandSite.metadata as any)?.lastGeneratedPages || (brandSite.pages as any[]) || [];
      const lastGeneratedPageMap = new Map(
        lastGeneratedPages.map((p: any) => [p.slug, p])
      );
      
      // Helper to check if a page needs regeneration
      const shouldRegeneratePage = (page: any): boolean => {
        const filePath = page.slug === "index" || page.slug === "home"
          ? "index.html"
          : `${page.slug}/index.html`;
        
        // If no HTML exists for this page, it needs to be generated
        const existingPageHtml = page.slug === "index" || page.slug === "home"
          ? existingHtml
          : existingFiles[filePath];
        
        if (!existingPageHtml || existingPageHtml.trim().length === 0) {
          return true; // New page, needs generation
        }
        
        // Check if this is a new page (not in last generated pages)
        const lastGeneratedPage = lastGeneratedPageMap.get(page.slug) as any;
        if (!lastGeneratedPage) {
          return true; // New page, needs generation
        }
        
        // Check if page metadata has changed in ways that require regeneration
        // Compare critical fields that affect page content
        const hasChanged = 
          lastGeneratedPage.title !== page.title ||
          lastGeneratedPage.description !== page.description ||
          lastGeneratedPage.context !== page.context ||
          lastGeneratedPage.type !== page.type;
          // Note: For blog pages, contentEntries (articles) are loaded dynamically,
          // so changes to articles don't require page regeneration
        
        if (hasChanged) {
          return true; // Page content changed, needs regeneration
        }
        
        // Page is unchanged, preserve existing HTML
        return false;
      };
      
      for (const page of pagesToGenerate) {
        const filePath = page.slug === "index" || page.slug === "home"
          ? "index.html"
          : `${page.slug}/index.html`;
        
        // Check if we should regenerate this page or preserve existing HTML
        if (!shouldRegeneratePage(page)) {
          // Preserve existing HTML for unchanged pages
          const existingPageHtml = page.slug === "index" || page.slug === "home"
            ? existingHtml
            : existingFiles[filePath];
          
          if (existingPageHtml && existingPageHtml.trim().length > 0) {
            // Update navigation in existing HTML to reflect any page structure changes
            let preservedHtml = injectNavigation(
              existingPageHtml,
              pagesToGenerate,
              page.slug,
              brandName,
            );
            
            // Re-apply integrations in case widget/analytics config changed
            const availablePagesForPreserved = pagesToGenerate.map((p) => ({
              slug: p.slug,
              title: p.title,
              href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
            }));
            preservedHtml = applyIntegrations(preservedHtml, {
              widgets,
              organizationId: organization.id,
              analyticsConfig,
              brandSiteId,
              firebaseProjectId: config.firebaseProjectId,
              tempSiteId: `brand-${brandSiteId}`,
              brandName,
              customFavicon,
              availablePages: availablePagesForPreserved,
            });
            
            generatedPageFiles[filePath] = preservedHtml;
            logger.info("Preserving existing HTML for unchanged page", {
              pageSlug: page.slug,
              pageTitle: page.title,
            });
            continue; // Skip regeneration for this page
          }
        }
        
        // Regenerate this page (new or explicitly changed)
        logger.info("Regenerating page", {
          pageSlug: page.slug,
          pageTitle: page.title,
          reason: "new or changed",
        });
        
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
                  (entry, entryIndex) => {
                    let entryText = `${entryIndex + 1}. ${entry.title}`;
                    // Use description (rich HTML) if available, otherwise use summary
                    if (entry.description) {
                      entryText += `\n   Description: ${entry.description}`;
                    } else if (entry.summary) {
                      entryText += ` — ${entry.summary}`;
                    }
                    if (entry.image) {
                      entryText += `\n   Image: ${entry.image}`;
                    }
                    if (entry.link) {
                      entryText += `\n   Link: ${entry.link}`;
                    }
                    return entryText;
                  }
                )
                .join("\n\n")
            : undefined;

        const pagePurpose = [page.description, entriesSummary]
          .filter(Boolean)
          .join("\n\n");

        // Use streaming generation for live preview
        // Update Firestore progressively as HTML chunks arrive
        let pageHtml = "";
        // Build available pages list for this page to know what it can link to
        const availablePages = pagesToGenerate.map((p) => ({
          slug: p.slug,
          title: p.title,
          href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
        }));

        const pageContextForPrompt = {
          brandName,
          colors: brandColors,
          logoUrl,
          tone,
          description,
          brandImages: allAvailableImages, // Use all available images from storage
          context: pageContext || brandSite.context,
          contextImages: [...(brandSite.contextImages || []), ...allAvailableImages], // Combine with all available images
          products: productsForContext,
          widgets: widgetContext,
          pageTitle: page.title,
          pagePurpose: pagePurpose || page.description || description || "",
          pageSlug: page.slug,
          pageType: page.type,
          pageContentEntries: page.contentEntries,
          availablePages, // List of pages that exist and can be linked to
        };

        // Throttle Firestore updates to avoid excessive writes (max 1 update per 500ms)
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 500; // Update every 500ms

        pageHtml = await geminiService.generateSiteHtmlStream(
          pageContextForPrompt,
          async (chunk: string, accumulated: string) => {
            pageHtml = accumulated; // Update local variable
            
            // Throttle Firestore updates
            const now = Date.now();
            if (now - lastUpdateTime < UPDATE_INTERVAL && accumulated.length < 10000) {
              // Skip update if too soon (unless we're near the end or have substantial content)
              return;
            }
            lastUpdateTime = now;

            // Update Firestore with progressive HTML for live preview
            if (!brandSiteId) {
              logger.warn("Cannot update Firestore preview: brandSiteId is undefined");
              return;
            }

            try {
              // Store the page HTML in the files map for preview
              const pageFiles = {
                ...((brandSite.files as Record<string, string>) || {}),
                [`${page.slug}/index.html`]: accumulated,
              };

              await brandSiteRepository.update({
                id: brandSiteId,
                data: {
                  files: pageFiles,
                  // Keep status as "generating" to indicate preview is updating
                  status: "generating",
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                } as any,
              });

              logger.debug("Updated Firestore with HTML chunk", {
                brandSiteId,
                pageSlug: page.slug,
                htmlLength: accumulated.length,
                chunkLength: chunk.length,
              });
            } catch (updateError) {
              // Don't fail the entire generation if preview update fails
              logger.warn("Failed to update Firestore preview", {
                error: updateError instanceof Error ? updateError.message : "Unknown error",
                brandSiteId,
                pageSlug: page.slug,
              });
            }
          }
        );

        // Fallback to non-streaming if streaming fails (for backward compatibility)
        if (!pageHtml || pageHtml.length === 0) {
          logger.warn("Streaming returned empty HTML, falling back to non-streaming", {
            brandSiteId,
            pageSlug: page.slug,
          });
          // Build available pages list
          const availablePagesForFallback = pagesToGenerate.map((p) => ({
            slug: p.slug,
            title: p.title,
            href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
          }));

          pageHtml = await geminiService.generateSiteHtml({
            brandName,
            colors: brandColors,
            logoUrl,
            tone,
            description,
            brandImages: allAvailableImages, // Use all available images from storage
            context: pageContext || brandSite.context,
            contextImages: [...(brandSite.contextImages || []), ...allAvailableImages], // Combine with all available images
            products: productsForContext,
            widgets: widgetContext,
            pageTitle: page.title,
            pagePurpose: pagePurpose || page.description || description || "",
            pageSlug: page.slug,
            pageType: page.type,
            pageContentEntries: page.contentEntries,
            availablePages: availablePagesForFallback,
          });
        }

        // Process the HTML (inject navigation and integrations) after generation
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
          pageType: page.type,
          pageSlug: page.slug,
          customFavicon,
          availablePages, // Pass available pages for link validation
        });

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
    const currentVersionNumber = (brandSite?.metadata?.version || 0) + 1;
    const existingVersionsForSave = brandSite?.versions || [];
    const versionsToSave = [...existingVersionsForSave];
    
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
          version: currentVersionNumber,
          // Store current pages so we can compare against them in the next generation
          lastGeneratedPages: pagesToGenerate.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            description: p.description,
            context: p.context,
            type: p.type,
            contentEntries: p.contentEntries || [],
          })),
      },
        status: "deploying",
        versions: versionsToSave,
      },
    });

    const deploymentPrepStart = Date.now();
    logger.debug("Step 9: Preparing Cloudflare deployment", {
      brandSiteId,
      brandName,
    });
    errorContext.stage = "deployment_prep";
    const subdomain = generateSubdomain(brandName);
    const fullSubdomain = `${subdomain}.${config.cloudflareBaseDomain}`;

    // Validate Cloudflare publisher config
    if (!config.cloudflareAccountId || !config.cloudflareR2BucketName || !config.cloudflareKvNamespaceId) {
      const error = "Cloudflare publisher configuration is required";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Cloudflare publisher config missing", {
        brandSiteId,
        errorContext,
      });
      throw new Error(error);
    }

    markTiming("deployment_prep", deploymentPrepStart);
    logger.info("Initializing Cloudflare Publisher Service", {
      accountId: config.cloudflareAccountId,
      r2Bucket: config.cloudflareR2BucketName,
    });
    errorContext.stage = "cloudflare_publisher_init";
    const publisherStartTime = Date.now();
    
    const publisherService = new CloudflarePublisherService({
      accountId: config.cloudflareAccountId,
      apiToken: config.cloudflareApiToken,
      r2BucketName: config.cloudflareR2BucketName,
      kvNamespaceId: config.cloudflareKvNamespaceId,
    });

    // Generate versionId
    const versionId = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    logger.debug("Step 10: Preparing files for Cloudflare R2 upload", {
      brandSiteId,
      versionId,
      htmlLength: html.length,
      fileCount: Object.keys(files).length,
    });
    errorContext.stage = "cloudflare_file_prep";
    const filePrepStart = Date.now();

    // Prepare files for upload to R2
    const filesToUpload = Object.entries(files).map(([path, contents]) => {
      // Determine content type
      let contentType = "text/html; charset=utf-8";
      if (path.endsWith(".css")) {
        contentType = "text/css; charset=utf-8";
      } else if (path.endsWith(".js")) {
        contentType = "application/javascript; charset=utf-8";
      } else if (path.endsWith(".png")) {
        contentType = "image/png";
      } else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
        contentType = "image/jpeg";
      } else if (path.endsWith(".svg")) {
        contentType = "image/svg+xml";
      } else if (path.endsWith(".webp")) {
        contentType = "image/webp";
      }

      return {
        path,
        content: contents,
        contentType,
      };
    });

    // Add widget-loader.js if widgets are enabled
    const widgets = organization.settings?.widgets;
    if (widgets?.enabled) {
      try {
        let widgetLoaderPath: string | null = null;
        const possiblePaths = [
          join(__dirname, "../../public/widget-loader.js"),
          join(__dirname, "../../../app/public/widget-loader.js"),
          join(process.cwd(), "functions/public/widget-loader.js"),
        ];
        
        for (const path of possiblePaths) {
          if (existsSync(path)) {
            widgetLoaderPath = path;
            break;
          }
        }
        
        if (widgetLoaderPath) {
          try {
            const widgetLoaderContent = readFileSync(widgetLoaderPath, "utf-8");
            filesToUpload.push({
              path: "widget-loader.js",
              content: widgetLoaderContent,
              contentType: "application/javascript; charset=utf-8",
            });
            logger.info("Added widget-loader.js to deployment", { brandSiteId });
          } catch (readError) {
            logger.warn("Could not read widget-loader.js", {
              error: readError instanceof Error ? readError.message : "Unknown error",
            });
          }
        }
      } catch (error) {
        logger.warn("Failed to add widget-loader.js to deployment", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Add analytics-loader.js if analytics is enabled
    if (analyticsConfig?.enabled) {
      try {
        let analyticsLoaderPath: string | null = null;
        const possibleAnalyticsPaths = [
          join(__dirname, "../../public/analytics-loader.js"),
          join(__dirname, "../../../app/public/analytics-loader.js"),
          join(process.cwd(), "functions/public/analytics-loader.js"),
        ];
        
        for (const path of possibleAnalyticsPaths) {
          if (existsSync(path)) {
            analyticsLoaderPath = path;
            break;
          }
        }
        
        if (analyticsLoaderPath) {
          try {
            const analyticsLoaderContent = readFileSync(analyticsLoaderPath, "utf-8");
            filesToUpload.push({
              path: "analytics-loader.js",
              content: analyticsLoaderContent,
              contentType: "application/javascript; charset=utf-8",
            });
            logger.info("Added analytics-loader.js to deployment", { brandSiteId });
          } catch (readError) {
            logger.warn("Could not read analytics-loader.js", {
              error: readError instanceof Error ? readError.message : "Unknown error",
            });
          }
        }
      } catch (error) {
        logger.warn("Failed to add analytics-loader.js to deployment", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    markTiming("cloudflare_file_prep", filePrepStart);
    logger.info("Files prepared for Cloudflare upload", {
      duration: timings.cloudflare_file_prep,
      fileCount: filesToUpload.length,
    });

    // Upload to R2
    logger.debug("Step 11: Uploading files to Cloudflare R2", {
      brandSiteId,
      versionId,
      fileCount: filesToUpload.length,
    });
    errorContext.stage = "cloudflare_r2_upload";
    const r2UploadStart = Date.now();
    
    try {
      const r2Keys = await publisherService.uploadSiteVersionToR2(
        brandSiteId,
        versionId,
        filesToUpload
      );
      markTiming("cloudflare_r2_upload", r2UploadStart);
      logger.info("Files uploaded to R2", {
        duration: timings.cloudflare_r2_upload,
        r2KeyCount: r2Keys.length,
      });
    } catch (uploadError) {
      const error = uploadError instanceof Error ? uploadError.message : "Unknown R2 upload error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("R2 upload failed", {
        brandSiteId,
        versionId,
        error,
        errorContext,
      });
      throw uploadError;
    }

    // Create Cloudflare subdomain DNS (points to Worker, not Firebase Hosting)
    logger.debug("Step 12: Creating Cloudflare subdomain DNS", {
      subdomain,
      brandSiteId,
    });
    errorContext.stage = "cloudflare_dns";
    const dnsStartTime = Date.now();
    
    const cloudflareService = new CloudflareService({
      apiToken: config.cloudflareApiToken,
      zoneId: config.cloudflareZoneId,
      baseDomain: config.cloudflareBaseDomain,
    });

    // Point subdomain to Worker
    // Note: For automatic routing, configure a wildcard route in Cloudflare:
    // Route: *.financely.app/* → financely-sites-worker
    // This allows all subdomains to route to the Worker automatically
    // The DNS CNAME below ensures the subdomain exists and is proxied
    const workerSubdomain = "financely-sites-worker.mityodraganow.workers.dev";
    let finalUrl: string;
    
    try {
      logger.info("Creating Cloudflare subdomain DNS", { subdomain, target: workerSubdomain });
      finalUrl = await cloudflareService.createSubdomain(
        subdomain,
        workerSubdomain,
      );
      
      // Verify DNS record was actually created
      logger.debug("Verifying DNS record was created", { subdomain, fullSubdomain });
      const allRecords = await cloudflareService.listDnsRecords();
      const createdRecord = allRecords.find(
        (record) => record.name.toLowerCase() === fullSubdomain.toLowerCase() && record.type === "CNAME"
      );
      
      if (!createdRecord) {
        const errorMessage = `DNS record creation reported success but record not found: ${fullSubdomain}. This usually means the Cloudflare API token lacks DNS write permissions (Zone:DNS:Edit). Please check your API token permissions in Cloudflare Dashboard.`;
        logger.error("DNS verification failed", {
          brandSiteId,
          subdomain,
          fullSubdomain,
          allRecordsCount: allRecords.length,
          error: errorMessage,
        });
        // Throw error to make it clear DNS creation failed
        // User needs to fix API token permissions or create DNS manually
        throw new Error(errorMessage);
      }
      
      logger.info("DNS record verified", {
        recordId: createdRecord.id,
        name: createdRecord.name,
        content: createdRecord.content,
      });
      
      markTiming("cloudflare_dns", dnsStartTime);
      logger.info("Cloudflare subdomain DNS created and verified", {
        duration: timings.cloudflare_dns,
        subdomainUrl: finalUrl,
        recordId: createdRecord.id,
      });
    } catch (dnsError) {
      const error = dnsError instanceof Error ? dnsError.message : "Unknown DNS error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("Cloudflare DNS creation failed", {
        brandSiteId,
        subdomain,
        fullSubdomain,
        error,
        errorContext,
      });
      throw dnsError;
    }

    // Update KV with hostname mapping
    logger.debug("Step 13: Updating Cloudflare KV mapping", {
      hostname: fullSubdomain,
      brandSiteId,
      versionId,
    });
    errorContext.stage = "cloudflare_kv_update";
    const kvStartTime = Date.now();
    
    try {
      await publisherService.updateSiteHostMapping(
        fullSubdomain,
        brandSiteId,
        versionId
      );
      markTiming("cloudflare_kv_update", kvStartTime);
      logger.info("KV mapping updated", {
        duration: timings.cloudflare_kv_update,
        hostname: fullSubdomain,
      });
    } catch (kvError) {
      const error = kvError instanceof Error ? kvError.message : "Unknown KV update error";
      errorContext.errors.push({
        stage: errorContext.stage,
        error,
        timestamp: new Date().toISOString(),
      });
      logger.error("KV update failed", {
        brandSiteId,
        hostname: fullSubdomain,
        error,
        errorContext,
      });
      throw kvError;
    }

    // Create version document and update BrandSite
    logger.debug("Step 14: Updating Firestore with version info", {
      brandSiteId,
      versionId,
    });
    errorContext.stage = "firestore_update";
    const firestoreStartTime = Date.now();

    const existingVersions = (brandSite.versions || []) as Array<{
      version: number;
      html: string;
      createdAt: string;
      versionId?: string;
      files?: Record<string, string>;
      deployedUrl?: string;
      previewUrl?: string;
      sourceType?: "ai-builder" | "manual" | "imported";
      aiPrompt?: string;
      notes?: string;
      layoutConfig?: unknown;
      metadata?: {
        generatedAt?: string;
        model?: string;
        regenerateSectionType?: "hero" | "about" | "features" | "contact";
      };
      createdByUserId?: string;
      description?: string;
    }>;
    const nextVersionNumber =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.version)) + 1
        : 1;

    const newVersion = {
      version: nextVersionNumber,
      versionId,
      html,
      files: files,
      sourceType: "ai-builder" as const,
      metadata: brandSite.metadata || {},
      createdAt: new Date().toISOString(),
      description: `AI-generated site version ${nextVersionNumber}`,
    };

    const updatedVersions = [...existingVersions, newVersion];

    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "success",
        subdomain,
        primaryDomain: fullSubdomain,
        currentVersionId: versionId,
        hostingProvider: "cloudflare",
        deployedUrl: finalUrl,
        pages: pagesToGenerate,
        versions: updatedVersions,
        metadata: {
          ...(brandSite.metadata || {}),
          version: nextVersionNumber,
          generatedAt: brandSite.metadata?.generatedAt || new Date().toISOString(),
          model: brandSite.metadata?.model || "gemini-2.5-flash",
          regenerateSectionType: undefined,
        },
      },
    });

    markTiming("firestore_update", firestoreStartTime);
    markTiming("cloudflare_publisher_init", publisherStartTime);
    logger.info("Cloudflare deployment completed", {
      duration: timings.cloudflare_publisher_init,
      brandSiteId,
      versionId,
      deployedUrl: finalUrl,
    });

    const totalDuration = Date.now() - startTime;
    timings.total = totalDuration;
    logger.info("Site generated and deployed successfully", {
      brandSiteId,
      subdomain,
      url: finalUrl,
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

