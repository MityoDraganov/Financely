import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { GeminiService } from "../services/gemini-service";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";

interface GenerateSiteInput {
  organizationId: string;
  brandName?: string;
  tone?: string;
}

interface GenerateSiteConfig {
  geminiApiKey: string;
  cloudflareApiToken: string;
  cloudflareZoneId: string;
  cloudflareBaseDomain: string;
  firebaseProjectId: string;
}

export async function handleGenerateSite(
  input: GenerateSiteInput,
  config: GenerateSiteConfig,
): Promise<{ id: string; url: string; status: string }> {
  const startTime = Date.now();
  let brandSiteId: string | undefined;
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
    logger.info("Organization retrieved", {
      duration: Date.now() - orgStartTime,
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

    logger.debug("Step 4: Finding existing brand site", {
      organizationId: input.organizationId,
    });
    errorContext.stage = "brand_site_fetch";
    const existingSites = await brandSiteRepository.getAll({
      queryConstraints: [
        { field: "organizationId", operator: "==", value: input.organizationId },
      ],
    });

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
    const geminiStartTime = Date.now();
    const geminiService = new GeminiService({
      apiKey: config.geminiApiKey,
      model: "gemini-2.5-flash",
    });

    // Check if this is a section regeneration
    const sectionType = (brandSite.metadata as { regenerateSectionType?: "hero" | "about" | "features" | "contact" })?.regenerateSectionType;

    logger.debug("Step 7: Generating HTML with Gemini", {
      brandSiteId,
      sectionType: sectionType || "full",
      hasExistingHtml: !!brandSite.html,
    });
    errorContext.stage = "gemini_generation";
    let html: string;

    try {
      if (sectionType && brandSite.html) {
        logger.info("Calling Gemini API for section regeneration", {
          brandName,
          sectionType,
          model: "gemini-2.5-flash",
        });

        html = await geminiService.regenerateSection(
          {
            brandName,
            colors: brandColors,
            logoUrl,
            tone,
          },
          sectionType,
          brandSite.html,
        );

        logger.info("Section regenerated by Gemini", {
          duration: Date.now() - geminiStartTime,
          sectionType,
          htmlLength: html.length,
        });
      } else {
        logger.info("Calling Gemini API for HTML generation", {
          brandName,
          model: "gemini-2.5-flash",
        });

        html = await geminiService.generateSiteHtml({
          brandName,
          colors: brandColors,
          logoUrl,
          tone,
        });

        logger.info("HTML generated by Gemini", {
          duration: Date.now() - geminiStartTime,
          htmlLength: html.length,
        });
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

    logger.debug("Step 8: Saving HTML and updating status to deploying", {
      brandSiteId,
      htmlLength: html.length,
    });
    errorContext.stage = "html_save";
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        html,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: "gemini-2.5-flash",
          version: (brandSite?.metadata?.version || 0) + 1,
        },
        status: "deploying",
      },
    });

    logger.debug("Step 9: Preparing deployment configuration", {
      brandSiteId,
      brandName,
    });
    errorContext.stage = "deployment_prep";
    const subdomain = generateSubdomain(brandName);
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
    logger.info("Firebase Hosting site ready", {
      duration: Date.now() - hostingStartTime,
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
      deployedUrl = await hostingService.deploySite(
        siteId,
        [{ path: "index.html", contents: html }],
        `Deploy ${brandName} site`,
      );
      logger.info("Site deployed to Firebase Hosting", {
        duration: Date.now() - deployStartTime,
        deployedUrl,
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
            version: brandSite.metadata?.version || 1,
            generatedAt: brandSite.metadata?.generatedAt,
            model: brandSite.metadata?.model,
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
        logger.info("Cloudflare subdomain created", {
          duration: Date.now() - cloudflareStartTime,
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
        },
      });
    }

    const totalDuration = Date.now() - startTime;
    logger.info("Site generated and deployed successfully", {
      brandSiteId,
      subdomain: isRegeneration ? undefined : subdomain,
      url: finalUrl,
      isRegeneration,
      totalDuration,
      totalDurationSeconds: Math.round(totalDuration / 1000),
      stages: {
        organization_fetch: "✓",
        brand_config: "✓",
        brand_site_fetch: "✓",
        gemini_generation: "✓",
        hosting_site_creation: "✓",
        hosting_deployment: "✓",
        url_configuration: "✓",
      },
    });

    return {
      id: brandSiteId,
      url: finalUrl,
      status: "success",
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
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

