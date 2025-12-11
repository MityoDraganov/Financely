import { logger } from "firebase-functions";
import { BrandContext, BrandContextForAI } from "../core/entities/brand-context";
import { Organization } from "../core/entities/organization";
import { Product } from "../core/entities/product";
import { OrganizationRepository } from "../core/ports/repositories/organization-repository";
import { ProductRepository } from "../core/ports/repositories/product-repository";
import { getBrandContextCache } from "./brand-context-cache";
import { listOrganizationImages, filterValidProductImages } from "../utils/list-organization-images";

/**
 * Service for assembling and caching Brand Context.
 * 
 * Brand Context is assembled from:
 * - Organization data (name, branding, settings, widgets, etc.)
 * - Products (active products for the organization)
 * - Available images from organization storage
 * 
 * The service uses an in-memory cache to reduce Firestore reads.
 */
export class BrandContextService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private productRepository: ProductRepository,
    private firebaseProjectId?: string,
  ) {}

  /**
   * Get brand context for an organization.
   * Uses cache if available, otherwise assembles from data sources.
   * 
   * @param organizationId - The organization ID
   * @param options - Optional configuration
   * @returns Brand context data
   */
  async getBrandContext(
    organizationId: string,
    options?: {
      includeImages?: boolean;
      includeProducts?: boolean;
      forceRefresh?: boolean;
    },
  ): Promise<BrandContext> {
    const cache = getBrandContextCache();
    const includeImages = options?.includeImages !== false; // Default true
    const includeProducts = options?.includeProducts !== false; // Default true
    const forceRefresh = options?.forceRefresh === true;

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = cache.get(organizationId);
      if (cached) {
        logger.debug("Brand context cache hit", { organizationId });
        return cached;
      }
    }

    logger.debug("Assembling brand context", {
      organizationId,
      includeImages,
      includeProducts,
    });

    // Fetch organization
    const organization = await this.organizationRepository.get({
      id: organizationId,
    });

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Fetch products if needed
    let products: Product[] = [];
    if (includeProducts) {
      products = await this.productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organizationId },
          { field: "status", operator: "==", value: "active" },
        ],
      });
    }

    // Fetch images if needed
    let brandImages: string[] = [];
    if (includeImages && this.firebaseProjectId) {
      brandImages = await listOrganizationImages(
        organizationId,
        this.firebaseProjectId,
      );
    }

    // Assemble brand context
    const brandContext = this.assembleBrandContext(
      organization,
      products,
      brandImages,
    );

    // Cache the result
    cache.set(organizationId, brandContext);

    logger.info("Brand context assembled and cached", {
      organizationId,
      productCount: products.length,
      imageCount: brandImages.length,
    });

    return brandContext;
  }

  /**
   * Get brand context in the format expected by AI services (Gemini).
   * This is a simplified format optimized for AI prompts.
   * 
   * @param organizationId - The organization ID
   * @param additionalContext - Optional additional context (from brand site, etc.)
   * @param additionalImages - Optional additional images (from brand site, etc.)
   * @returns Brand context formatted for AI
   */
  async getBrandContextForAI(
    organizationId: string,
    additionalContext?: {
      context?: string;
      contextImages?: string[];
      pageTitle?: string;
      pagePurpose?: string;
      pageSlug?: string;
      pageType?: string;
      pageContentEntries?: Array<{
        title: string;
        summary?: string;
        link?: string;
        image?: string;
        description?: string;
      }>;
      availablePages?: Array<{
        slug: string;
        title: string;
        href: string;
      }>;
    },
  ): Promise<BrandContextForAI> {
    const brandContext = await this.getBrandContext(organizationId, {
      includeImages: true,
      includeProducts: true,
    });

    // Get all available images (brand + additional)
    const allAvailableImages = [
      ...brandContext.brandImages,
      ...(additionalContext?.contextImages || []),
    ];

    // Filter product images to only include those that exist
    const productsForAI = brandContext.products.map((p) => {
      const validImages = p.images
        ? filterValidProductImages(p.images, allAvailableImages)
        : [];
      return {
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        images: validImages,
      };
    });

    // Build widget context
    const widgets = brandContext.widgets?.enabled
      ? {
          enabled: true,
          contactForm: brandContext.widgets.contactForm?.enabled
            ? {
                enabled: true,
                title: brandContext.widgets.contactForm.title || "Contact Us",
                description: brandContext.widgets.contactForm.description,
                position: brandContext.widgets.contactForm.position || "bottom-right",
                displayMode: brandContext.widgets.contactForm.displayMode || "floating",
              }
            : undefined,
          invoiceRequest: brandContext.widgets.invoiceRequest?.enabled
            ? {
                enabled: true,
                title: brandContext.widgets.invoiceRequest.title || "Request Invoice",
                description: brandContext.widgets.invoiceRequest.description,
                position: brandContext.widgets.invoiceRequest.position || "bottom-right",
                displayMode: "floating",
              }
            : undefined,
          quoteRequest: brandContext.widgets.quoteRequest?.enabled
            ? {
                enabled: true,
                title: brandContext.widgets.quoteRequest.title || "Request Quote",
                description: brandContext.widgets.quoteRequest.description,
                position: brandContext.widgets.quoteRequest.position || "bottom-right",
                displayMode: "floating",
              }
            : undefined,
        }
      : undefined;

    return {
      brandName: brandContext.brandName,
      colors: {
        primary: brandContext.brandColors.primary,
        secondary: brandContext.brandColors.secondary,
        accent: brandContext.brandColors.accent,
      },
      logoUrl: brandContext.logoUrl,
      tone: brandContext.tone,
      description: brandContext.description,
      brandImages: allAvailableImages,
      context: additionalContext?.context,
      contextImages: additionalContext?.contextImages || [],
      products: productsForAI,
      widgets,
      pageTitle: additionalContext?.pageTitle,
      pagePurpose: additionalContext?.pagePurpose,
      pageSlug: additionalContext?.pageSlug,
      pageType: additionalContext?.pageType,
      pageContentEntries: additionalContext?.pageContentEntries,
      availablePages: additionalContext?.availablePages,
    };
  }

  /**
   * Invalidate brand context cache for an organization.
   * Should be called when organization or product data changes.
   * 
   * @param organizationId - The organization ID
   */
  invalidateCache(organizationId: string): void {
    const cache = getBrandContextCache();
    cache.invalidate(organizationId);
    logger.info("Brand context cache invalidated", { organizationId });
  }

  /**
   * Assemble brand context from organization and products.
   */
  private assembleBrandContext(
    organization: Organization,
    products: Product[],
    brandImages: string[],
  ): BrandContext {
    const brandColors = organization.settings?.brandColors || {
      primary: "#2563eb",
      secondary: "#6b7280",
      accent: "#10b981",
    };

    const logoUrl =
      organization.settings?.branding?.customLogo || organization.logoUrl;

    const widgets = organization.settings?.widgets;

    return {
      organizationId: organization.id,
      brandName: organization.name,
      description:
        organization.settings?.branding?.description || organization.description,
      brandColors,
      logoUrl,
      customFavicon: organization.settings?.branding?.customFavicon,
      brandImages,
      tone: "professional", // Default, can be overridden by brand site
      defaultLanguage: organization.settings?.defaultLanguage || "en",
      defaultCurrency: organization.settings?.defaultCurrency || "USD",
      defaultTimezone: organization.settings?.defaultTimezone || "UTC",
      website: organization.website || organization.settings?.branding?.customDomain,
      email: organization.settings?.email,
      phone: organization.settings?.phone,
      address: organization.settings?.address,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        images: p.images || [],
      })),
      widgets: widgets?.enabled
        ? {
            enabled: true,
            contactForm: widgets.contactForm?.enabled
              ? {
                  enabled: true,
                  title: widgets.contactForm.title || "Contact Us",
                  description: widgets.contactForm.description,
                  position: widgets.contactForm.position || "bottom-right",
                  displayMode: widgets.contactForm.displayMode || "floating",
                  submitButtonText:
                    widgets.contactForm.submitButtonText || "Send Message",
                  successMessage:
                    widgets.contactForm.successMessage ||
                    "Thank you! We'll get back to you soon.",
                }
              : undefined,
            invoiceRequest: widgets.invoiceRequest?.enabled
              ? {
                  enabled: true,
                  title: widgets.invoiceRequest.title || "Request Invoice",
                  description: widgets.invoiceRequest.description,
                  position: widgets.invoiceRequest.position || "bottom-right",
                  submitButtonText:
                    widgets.invoiceRequest.submitButtonText || "Request Invoice",
                  successMessage:
                    widgets.invoiceRequest.successMessage ||
                    "Invoice request submitted successfully!",
                }
              : undefined,
            quoteRequest: widgets.quoteRequest?.enabled
              ? {
                  enabled: true,
                  title: widgets.quoteRequest.title || "Request Quote",
                  description: widgets.quoteRequest.description,
                  position: widgets.quoteRequest.position || "bottom-right",
                  submitButtonText:
                    widgets.quoteRequest.submitButtonText || "Request Quote",
                  successMessage:
                    widgets.quoteRequest.successMessage ||
                    "Quote request submitted successfully!",
                }
              : undefined,
          }
        : undefined,
      branding: organization.settings?.branding
        ? {
            companyName: organization.settings.branding.companyName,
            customDomain: organization.settings.branding.customDomain,
            emailFromName: organization.settings.branding.emailFromName,
            emailFromAddress: organization.settings.branding.emailFromAddress,
            footerText: organization.settings.branding.footerText,
          }
        : undefined,
      country: organization.settings?.country,
      region: organization.settings?.region,
      invoicePrefix: organization.settings?.invoicePrefix || "INV",
      invoiceNumberStart:
        organization.settings?.invoiceNumberStart || 1,
      version: 1,
    };
  }
}

/**
 * Factory function to create a BrandContextService instance.
 */
export function getBrandContextService(
  organizationRepository: OrganizationRepository,
  productRepository: ProductRepository,
  firebaseProjectId?: string,
): BrandContextService {
  return new BrandContextService(
    organizationRepository,
    productRepository,
    firebaseProjectId,
  );
}

