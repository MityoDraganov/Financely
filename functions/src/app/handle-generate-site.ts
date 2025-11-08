import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getProductRepository } from "../repositories/product-repository";
import { GeminiService } from "../services/gemini-service";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";
import { readFileSync } from "fs";
import { join } from "path";

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
    const description = organization.settings?.branding?.description;
    const brandImages = organization.settings?.branding?.brandImages || [];

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

      html = await geminiService.generateSiteHtml({
        brandName,
        colors: brandColors,
        logoUrl,
        tone,
          description,
          brandImages,
          context: brandSite.context,
          contextImages: brandSite.contextImages || [],
          products: productsForContext,
      });

      // Inject widget script if widgets are enabled
      const widgets = organization.settings?.widgets;
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
    const files: Record<string, string> = {
      "index.html": html,
    };

    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        html,
        files,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-flash",
          version: newVersion,
      },
        status: "deploying",
        versions: versionsToSave,
      },
    });

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
      // Prepare files for deployment
      const filesToDeploy = [{ path: "index.html", contents: html }];
      
      // If widgets are enabled, add widget-loader.js to deployment
      const widgets = organization.settings?.widgets;
      if (widgets?.enabled) {
        try {
          // Read widget-loader.js from the app/public directory
          const widgetLoaderPath = join(__dirname, "../../../app/public/widget-loader.js");
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
      
      deployedUrl = await hostingService.deploySite(
      siteId,
      filesToDeploy,
      `Deploy ${brandName} site`,
    );
    logger.info("Site deployed to Firebase Hosting", {
      duration: Date.now() - deployStartTime,
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

/**
 * Generate widget script tag for embedding widgets
 */
function generateWidgetScript(organizationId: string, projectId: string): string {
  const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  return `<script src="/widget-loader.js" data-org-id="${organizationId}" data-api-url="${apiUrl}"></script>`;
}

