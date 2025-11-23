import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { CloudflarePublisherService } from "../services/cloudflare-publisher-service";
import { CloudflareService } from "../services/cloudflare-service";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");
// Cloudflare publisher secrets
const cloudflareAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareR2BucketName = defineSecret("CLOUDFLARE_R2_BUCKET_NAME");
const cloudflareKvNamespaceId = defineSecret("CLOUDFLARE_KV_NAMESPACE_ID");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");

interface DeployManualSitePayload {
  brandSiteId: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  versionMessage?: string;
  includeWidgets?: boolean;
}

/**
 * Manually deploy custom files to a brand site.
 * This allows users to edit files directly and deploy them without AI generation.
 */
export const deployManualSite = onCall(
  {
    region: "us-central1",
    secrets: [
      firebaseProjectId,
      cloudflareAccountId,
      cloudflareApiToken,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
      cloudflareZoneId,
      cloudflareBaseDomain,
    ],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    const { brandSiteId, files, versionMessage, includeWidgets = true } = request.data as DeployManualSitePayload;

    if (!brandSiteId || typeof brandSiteId !== "string") {
      throw new Error("brandSiteId is required");
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error("files array is required and must not be empty");
    }

    logger.info("Deploying manual site", {
      brandSiteId,
      fileCount: files.length,
      includeWidgets,
    });

    const databaseService = getDatabaseService();
    const brandSiteRepository = getBrandSiteRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);

    // Get brand site
    const brandSite = await brandSiteRepository.get({ id: brandSiteId });
    if (!brandSite) {
      throw new Error("Brand site not found");
    }

    // Get organization to check widget configuration
    const organization = await organizationRepository.get({ id: brandSite.organizationId });
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Prepare files for deployment
    const filesToDeploy = files.map((file) => ({
      path: file.path.startsWith("/") ? file.path.substring(1) : file.path, // Ensure no leading slash
      contents: file.content,
    }));

    const projectId = firebaseProjectId.value();
    
    // Process HTML files: inject widgets, favicon, and rewrite image URLs
    if (projectId) {
      const proxyUrl = `https://us-central1-${projectId}.cloudfunctions.net/proxyStorageImage`;
      
      for (const file of filesToDeploy) {
        if (file.path.endsWith(".html") || file.path === "index.html") {
          let html = file.contents;
          
          // Inject widget script if enabled
          if (includeWidgets && organization.settings?.widgets?.enabled) {
            const widgetScript = generateWidgetScript(organization.id, projectId);
            if (html.includes("</body>")) {
              html = html.replace("</body>", `${widgetScript}\n</body>`);
            } else {
              html += `\n${widgetScript}`;
            }
          }
          
          // Inject favicon link tag (use organization's custom favicon if available)
          const customFavicon = organization.settings?.branding?.customFavicon;
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
          
          // Rewrite Firebase Storage image URLs to use proxy (fixes CORS issues)
          html = html.replace(
            /https:\/\/storage\.googleapis\.com\/([^"'\s>]+)/g,
            (match, path) => {
              const storagePath = path.split('/').slice(1).join('/');
              return `${proxyUrl}?path=${encodeURIComponent(storagePath)}`;
            }
          );
          html = html.replace(
            /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^"'\s>]+)/g,
            (match, fullPath) => {
              const pathMatch = fullPath.match(/o\/([^?]+)/);
              if (pathMatch) {
                const storagePath = decodeURIComponent(pathMatch[1]);
                return `${proxyUrl}?path=${encodeURIComponent(storagePath)}`;
              }
              return match;
            }
          );
          
          file.contents = html;
        }
      }
    }

    // Convert files to record format for storage
    const filesRecord: Record<string, string> = {};
    for (const file of filesToDeploy) {
      filesRecord[file.path] = file.contents;
    }

    // Update brand site with files
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        files: filesRecord,
        // If there's an index.html, also update the html field for backward compatibility
        html: filesRecord["index.html"] || filesRecord["/index.html"] || brandSite.html,
        status: "deploying",
      },
    });

    // Deploy to Cloudflare (R2 + KV)
    // Initialize Cloudflare publisher service
    const publisherService = new CloudflarePublisherService({
      accountId: cloudflareAccountId.value(),
      apiToken: cloudflareApiToken.value(),
      r2BucketName: cloudflareR2BucketName.value(),
      kvNamespaceId: cloudflareKvNamespaceId.value(),
    });

    // Generate versionId
    const versionId = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Prepare files for R2 upload
    const filesToUpload = filesToDeploy.map((file) => {
      let contentType = "text/html; charset=utf-8";
      if (file.path.endsWith(".css")) {
        contentType = "text/css; charset=utf-8";
      } else if (file.path.endsWith(".js")) {
        contentType = "application/javascript; charset=utf-8";
      } else if (file.path.endsWith(".png")) {
        contentType = "image/png";
      } else if (file.path.endsWith(".jpg") || file.path.endsWith(".jpeg")) {
        contentType = "image/jpeg";
      } else if (file.path.endsWith(".svg")) {
        contentType = "image/svg+xml";
      }

      return {
        path: file.path,
        content: file.contents,
        contentType,
      };
    });

    // Add widget-loader.js if widgets are enabled
    if (includeWidgets && organization.settings?.widgets?.enabled) {
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

    // Upload to R2
    await publisherService.uploadSiteVersionToR2(
      brandSiteId,
      versionId,
      filesToUpload
    );

    logger.info("Files uploaded to R2", {
      brandSiteId,
      versionId,
      fileCount: filesToUpload.length,
    });

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

    // If no domains exist, create subdomain from brand name
    if (domains.length === 0 && brandSite.brandName) {
      const subdomain = brandSite.brandName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const fullSubdomain = `${subdomain}.${cloudflareBaseDomain.value()}`;
      domains.push(fullSubdomain);

      // Create DNS record for subdomain
      const cloudflareService = new CloudflareService({
        apiToken: cloudflareApiToken.value(),
        zoneId: cloudflareZoneId.value(),
        baseDomain: cloudflareBaseDomain.value(),
      });

      try {
        const workerSubdomain = "financely-sites-worker.mityodraganow.workers.dev";
        await cloudflareService.createSubdomain(subdomain, workerSubdomain);
        logger.info("Created Cloudflare subdomain DNS", { subdomain, fullSubdomain });
      } catch (dnsError) {
        logger.warn("Failed to create DNS record (may already exist)", {
          error: dnsError instanceof Error ? dnsError.message : "Unknown error",
        });
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

    // Create version document
    const existingVersions = brandSite.versions || [];
    const nextVersionNumber =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.version)) + 1
        : 1;

    const newVersion = {
      version: nextVersionNumber,
      versionId,
      html: filesRecord["index.html"] || filesRecord["/index.html"] || brandSite.html || "",
      files: filesRecord,
      sourceType: "manual" as const,
      metadata: brandSite.metadata || {},
      createdAt: new Date().toISOString(),
      description: versionMessage || `Manual deployment version ${nextVersionNumber}`,
    };

    const updatedVersions = [...existingVersions, newVersion];
    const deployedUrl = domains.length > 0 ? `https://${domains[0]}` : undefined;

    // Update brand site
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "success",
        currentVersionId: versionId,
        hostingProvider: "cloudflare",
        primaryDomain: domains[0] || brandSite.primaryDomain,
        deployedUrl,
        versions: updatedVersions,
      },
    });

    logger.info("Manual site deployed successfully", {
      brandSiteId,
      deployedUrl,
      fileCount: filesToDeploy.length,
    });

    return {
      success: true,
      brandSiteId,
      deployedUrl,
      status: "success",
    };
  },
);

/**
 * Generate widget script tag for embedding widgets
 */
function generateWidgetScript(organizationId: string, projectId: string): string {
  const apiUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
  return `<script src="/widget-loader.js" data-org-id="${organizationId}" data-api-url="${apiUrl}"></script>`;
}

