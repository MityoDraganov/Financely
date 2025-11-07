import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { readFileSync } from "fs";
import { join } from "path";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { FirebaseHostingService } from "../services/firebase-hosting-service";

const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

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
    secrets: [firebaseProjectId],
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

    // If widgets are enabled, inject widget script into HTML files
    if (includeWidgets && organization.settings?.widgets?.enabled) {
      const projectId = firebaseProjectId.value();
      if (projectId) {
        const widgetScript = generateWidgetScript(organization.id, projectId);
        
        for (const file of filesToDeploy) {
          if (file.path.endsWith(".html") || file.path === "index.html") {
            // Inject widget script before closing </body> tag
            if (file.contents.includes("</body>")) {
              file.contents = file.contents.replace(
                "</body>",
                `${widgetScript}\n</body>`
              );
            } else {
              // If no body tag, append to end
              file.contents += `\n${widgetScript}`;
            }
          }
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

    // Deploy to Firebase Hosting
    const projectIdForDeployment = firebaseProjectId.value();
    if (!projectIdForDeployment) {
      throw new Error("FIREBASE_PROJECT_ID secret is not set");
    }

    const hostingService = new FirebaseHostingService({ projectId: projectIdForDeployment });
    const siteId = `brand-${brandSiteId}`;

    // Ensure site exists
    await hostingService.createSite(siteId);

    // If widgets are enabled, add widget-loader.js to deployment
    if (includeWidgets && organization.settings?.widgets?.enabled) {
      try {
        // Read widget-loader.js from the app/public directory
        // Note: In Cloud Functions, we need to reference the file relative to the functions directory
        // The widget-loader.js is in app/public, but we can also embed it inline or serve it from a CDN
        // For now, we'll try to read it from a known location or use a fallback
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

    // Deploy files
    const deployedUrl = await hostingService.deploySite(
      siteId,
      filesToDeploy,
      versionMessage || "Manual deployment",
    );

    // Update brand site with deployed URL
    await brandSiteRepository.update({
      id: brandSiteId,
      data: {
        status: "success",
        deployedUrl,
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

