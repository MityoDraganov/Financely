import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getAnalyticsConfigRepository } from "../repositories/analytics-config-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { CloudflarePublisherService } from "../services/cloudflare-publisher-service";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");
// Cloudflare publisher secrets
const cloudflareAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareR2BucketName = defineSecret("CLOUDFLARE_R2_BUCKET_NAME");
const cloudflareKvNamespaceId = defineSecret("CLOUDFLARE_KV_NAMESPACE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");

/**
 * Update analytics script in existing site HTML without full regeneration
 */
export const updateAnalyticsScript = onCall(
  {
    region: "us-central1",
    cors: true,
    secrets: [
      firebaseProjectId,
      cloudflareAccountId,
      cloudflareApiToken,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
      cloudflareBaseDomain,
    ],
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      const { brandSiteId } = request.data;

      if (!brandSiteId) {
        throw new Error("brandSiteId is required");
      }

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);
      const analyticsConfigRepository = getAnalyticsConfigRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);

      // Get brand site
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new Error("Brand site not found");
      }

      // Get organization
      const organization = await organizationRepository.get({ id: brandSite.organizationId });
      if (!organization) {
        throw new Error("Organization not found");
      }

      // Get analytics config
      const analyticsConfig = await analyticsConfigRepository.get(brandSite.organizationId);

      // Generate analytics script
      const projectId = firebaseProjectId.value();
      const brandName = organization.settings?.branding?.companyName || organization.name || "";
      const siteId = `brand-${brandSiteId}`;
      
      const analyticsScript = generateAnalyticsScript(
        analyticsConfig,
        brandSite.organizationId,
        siteId,
        brandName,
        projectId || "",
      );

      // Get current HTML (from files or html field)
      let html = brandSite.files?.["index.html"] || brandSite.html || "";
      
      if (!html) {
        throw new Error("No HTML found for brand site");
      }

      // Remove existing analytics script if present
      // Match script tag with analytics-loader.js (relative or absolute) or data-analytics-org-id
      html = html.replace(
        /<script[^>]*src=["'][^"']*analytics-loader\.js["'][^>]*>.*?<\/script>/gi,
        "",
      );
      html = html.replace(
        /<script[^>]*data-analytics-org-id[^>]*>.*?<\/script>/gi,
        "",
      );

      // Inject new analytics script in <head> if analytics is enabled
      if (analyticsConfig?.enabled && analyticsScript) {
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${analyticsScript}\n</head>`);
        } else if (html.includes("</body>")) {
          // Fallback to body if no head tag
          html = html.replace("</body>", `${analyticsScript}\n</body>`);
        } else {
          html += `\n${analyticsScript}`;
        }
      }

      // Update files record
      const updatedFiles = {
        ...brandSite.files,
        "index.html": html,
      };

      // Update brand site
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          html,
          files: updatedFiles,
        },
      });

      // Redeploy based on hosting provider
      const hostingProvider = brandSite.hostingProvider || "firebase";
      const projectIdForDeployment = firebaseProjectId.value();
      
      if (projectIdForDeployment && brandSite.status === "success") {
        try {
          // Helper function to read analytics-loader.js
          const readAnalyticsLoader = (): string | null => {
            try {
              const possibleAnalyticsPaths = [
                join(__dirname, "../../public/analytics-loader.js"), // Production: functions/lib/functions -> functions/public
                join(__dirname, "../../../app/public/analytics-loader.js"), // Dev: functions/lib/functions -> app/public
                join(process.cwd(), "functions/public/analytics-loader.js"), // Fallback
              ];
              
              for (const path of possibleAnalyticsPaths) {
                if (existsSync(path)) {
                  return readFileSync(path, "utf-8");
                }
              }
              return null;
            } catch (error) {
              logger.warn("Failed to read analytics-loader.js", {
                error: error instanceof Error ? error.message : "Unknown error",
              });
              return null;
            }
          };

          // Helper function to read widget-loader.js
          const readWidgetLoader = (): string | null => {
            try {
              const possiblePaths = [
                join(__dirname, "../../public/widget-loader.js"), // Production: functions/lib/functions -> functions/public
                join(__dirname, "../../../app/public/widget-loader.js"), // Dev: functions/lib/functions -> app/public
                join(process.cwd(), "functions/public/widget-loader.js"), // Fallback
              ];
              
              for (const path of possiblePaths) {
                if (existsSync(path)) {
                  return readFileSync(path, "utf-8");
                }
              }
              return null;
            } catch (error) {
              logger.warn("Failed to read widget-loader.js", {
                error: error instanceof Error ? error.message : "Unknown error",
              });
              return null;
            }
          };

          if (hostingProvider === "cloudflare") {
            // Deploy to Cloudflare (R2 + KV)
            const publisherService = new CloudflarePublisherService({
              accountId: cloudflareAccountId.value(),
              apiToken: cloudflareApiToken.value(),
              r2BucketName: cloudflareR2BucketName.value(),
              kvNamespaceId: cloudflareKvNamespaceId.value(),
            });

            // Generate new versionId
            const versionId = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            // Prepare files for R2 upload
            const filesToUpload: Array<{ path: string; content: string; contentType: string }> = [
              {
                path: "index.html",
                content: html,
                contentType: "text/html; charset=utf-8",
              },
            ];

            // Always add analytics-loader.js if analytics is enabled (required for script to work)
            if (analyticsConfig?.enabled) {
              const analyticsLoaderContent = readAnalyticsLoader();
              if (analyticsLoaderContent) {
                filesToUpload.push({
                  path: "analytics-loader.js",
                  content: analyticsLoaderContent,
                  contentType: "application/javascript; charset=utf-8",
                });
                logger.info("Added analytics-loader.js to Cloudflare deployment", { brandSiteId });
              } else {
                logger.warn("analytics-loader.js not found, analytics may not work", { brandSiteId });
              }
            }

            // If widgets are enabled, add widget-loader.js to deployment
            if (organization.settings?.widgets?.enabled) {
              const widgetLoaderContent = readWidgetLoader();
              if (widgetLoaderContent) {
                filesToUpload.push({
                  path: "widget-loader.js",
                  content: widgetLoaderContent,
                  contentType: "application/javascript; charset=utf-8",
                });
                logger.info("Added widget-loader.js to Cloudflare deployment", { brandSiteId });
              } else {
                logger.warn("widget-loader.js not found, widgets may not work", { brandSiteId });
              }
            }

            // Upload to R2
            await publisherService.uploadSiteVersionToR2(
              brandSiteId,
              versionId,
              filesToUpload
            );

            // Collect domains for KV mapping
            const domains: string[] = [];
            if (brandSite.primaryDomain) {
              domains.push(brandSite.primaryDomain);
            }
            if (brandSite.customDomain) {
              domains.push(brandSite.customDomain);
            }
            if (brandSite.altDomains && brandSite.altDomains.length > 0) {
              domains.push(...brandSite.altDomains);
            }
            if (brandSite.subdomain) {
              const fullSubdomain = `${brandSite.subdomain}.${cloudflareBaseDomain.value()}`;
              if (!domains.includes(fullSubdomain)) {
                domains.push(fullSubdomain);
              }
            }

            // Update KV mappings for all domains
            if (domains.length > 0) {
              await publisherService.updateSiteHostMappings(
                domains.map((domain) => ({
                  hostname: domain,
                  brandSiteId,
                  versionId,
                }))
              );
            }

            // Update brand site with new version
            const existingVersions = brandSite.versions || [];
            const nextVersionNumber = existingVersions.length > 0 
              ? Math.max(...existingVersions.map((v: any) => v.version || 0)) + 1
              : 1;

            const newVersion = {
              version: nextVersionNumber,
              versionId,
              html,
              files: updatedFiles,
              createdAt: new Date().toISOString(),
              description: "Update analytics script",
            };

            const updatedVersions = [...existingVersions, newVersion];

            await brandSiteRepository.update({
              id: brandSiteId,
              data: {
                currentVersionId: versionId,
                versions: updatedVersions,
              },
            });

            logger.info("Analytics script updated and redeployed to Cloudflare", {
              brandSiteId,
              versionId,
              domains,
            });
          } else {
            // Deploy to Firebase Hosting (legacy)
            const hostingService = new FirebaseHostingService({ projectId: projectIdForDeployment });
            const siteIdForHosting = `brand-${brandSiteId}`;

            // Ensure site exists
            await hostingService.createSite(siteIdForHosting);

            // Prepare files to deploy
            const filesToDeploy: Array<{ path: string; contents: string }> = [
              { path: "index.html", contents: html },
            ];

            // Always add analytics-loader.js if analytics is enabled (required for script to work)
            if (analyticsConfig?.enabled) {
              const analyticsLoaderContent = readAnalyticsLoader();
              if (analyticsLoaderContent) {
                filesToDeploy.push({
                  path: "analytics-loader.js",
                  contents: analyticsLoaderContent,
                });
                logger.info("Added analytics-loader.js to Firebase deployment", { brandSiteId });
              } else {
                logger.warn("analytics-loader.js not found, analytics may not work", { brandSiteId });
              }
            }

            // If widgets are enabled, add widget-loader.js to deployment
            if (organization.settings?.widgets?.enabled) {
              const widgetLoaderContent = readWidgetLoader();
              if (widgetLoaderContent) {
                filesToDeploy.push({
                  path: "widget-loader.js",
                  contents: widgetLoaderContent,
                });
                logger.info("Added widget-loader.js to Firebase deployment", { brandSiteId });
              } else {
                logger.warn("widget-loader.js not found, widgets may not work", { brandSiteId });
              }
            }

            // Deploy updated HTML, analytics-loader.js, and widget-loader.js (if enabled)
            await hostingService.deploySite(
              siteIdForHosting,
              filesToDeploy,
              "Update analytics script",
            );

            logger.info("Analytics script updated and redeployed to Firebase", {
              brandSiteId,
              siteId: siteIdForHosting,
            });
          }
        } catch (deployError) {
          logger.error("Failed to redeploy after analytics update", {
            brandSiteId,
            hostingProvider,
            error: deployError instanceof Error ? deployError.message : "Unknown error",
          });
          // Don't throw - HTML is updated in Firestore even if deployment fails
        }
      }

      return { success: true, brandSiteId };
    } catch (error) {
      logger.error("Error updating analytics script", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });
      throw error;
    }
  },
);

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
  
  // Add function URL
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

