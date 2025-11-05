import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { logger } from "firebase-functions";

interface GenerateSiteInitInput {
  organizationId: string;
  brandName?: string;
  tone?: string;
  context?: string;
  contextImages?: string[];
}

/**
 * Initialize site generation - creates the brand site document and returns immediately.
 * The actual generation will be processed asynchronously by the Firestore trigger.
 */
export async function handleGenerateSiteInit(
  input: GenerateSiteInitInput,
): Promise<{ id: string; status: string }> {
  const databaseService = getDatabaseService();
  const organizationRepository = getOrganizationRepository(databaseService);
  const brandSiteRepository = getBrandSiteRepository(databaseService);

  logger.info("Initializing site generation", {
    organizationId: input.organizationId,
    brandName: input.brandName,
    tone: input.tone,
  });

  const organization = await organizationRepository.get({ id: input.organizationId });
  if (!organization) {
    throw new Error("Organization not found");
  }

  const brandName = input.brandName || organization.name;
  const tone = input.tone || "professional";
  const brandColors = organization.settings?.brandColors || {
    primary: "#2563eb",
    secondary: "#6b7280",
    accent: "#10b981",
  };
  const logoUrl = organization.settings?.branding?.customLogo || organization.logoUrl;

  // Check for existing site
  const existingSites = await brandSiteRepository.getAll({
    queryConstraints: [
      { field: "organizationId", operator: "==", value: input.organizationId },
    ],
  });

  let brandSiteId: string;

  if (existingSites.length > 0) {
    // Update existing site
    brandSiteId = existingSites[0].id;
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "pending",
        brandName,
        tone,
        brandColors,
        logoUrl,
        error: undefined, // Clear any previous errors
        context: input.context,
        contextImages: input.contextImages || [],
      },
    });
  } else {
    // Create new site
    brandSiteId = await brandSiteRepository.create({
      data: {
        organizationId: input.organizationId,
        brandName,
        brandColors,
        logoUrl,
        tone,
        status: "pending",
        context: input.context,
        contextImages: input.contextImages || [],
        versions: [],
      },
    });
  }

  logger.info("Site generation initialized", {
    brandSiteId,
    status: "pending",
  });

  return {
    id: brandSiteId,
    status: "pending",
  };
}

