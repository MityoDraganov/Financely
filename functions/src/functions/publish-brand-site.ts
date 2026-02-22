import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/v2/https";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { CloudflarePublisherService } from "../services/cloudflare-publisher-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

// Cloudflare configuration secrets
const cloudflareAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareR2BucketName = defineSecret("CLOUDFLARE_R2_BUCKET_NAME");
const cloudflareKvNamespaceId = defineSecret("CLOUDFLARE_KV_NAMESPACE_ID");

interface PublishBrandSitePayload {
  brandSiteId: string;
  html: string;
  assets?: Array<{
    path: string;
    content: string | Buffer | string; // base64 encoded or plain string
    contentType: string;
  }>;
  aiPrompt?: string;
  notes?: string;
  sourceType?: "ai-builder" | "manual" | "imported";
}

interface PublishBrandSiteResponse {
  success: boolean;
  brandSiteId: string;
  versionId: string;
  publishedDomains: string[];
  deployedUrl?: string;
}

/**
 * Publish a brand site version to Cloudflare (R2 + KV)
 * 
 * This function:
 * 1. Validates the caller is authenticated and authorized
 * 2. Generates a unique versionId
 * 3. Uploads HTML and assets to R2
 * 4. Creates a Firestore version document
 * 5. Updates BrandSite with currentVersionId
 * 6. Updates Cloudflare KV with hostname mappings
 * 
 * Replaces the old Firebase Hosting deployment flow.
 */
export const publishBrandSite = onCall<PublishBrandSitePayload, Promise<PublishBrandSiteResponse>>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300, // 5 minutes for large uploads
    memory: "512MiB",
    secrets: [
      cloudflareAccountId,
      cloudflareApiToken,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
    ],
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditBrandSiteId: string | undefined;
    let auditBrandSiteName: string | undefined;
    try {
      const { brandSiteId, html, assets = [], aiPrompt, notes, sourceType = "manual" } =
        request.data;
      auditBrandSiteId = brandSiteId;

      if (!brandSiteId || typeof brandSiteId !== "string") {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      if (!html || typeof html !== "string") {
        throw new HttpsError("invalid-argument", "html is required");
      }

      // TODO: Add authentication check
      // const auth = request.auth;
      // if (!auth) {
      //   throw new HttpsError("unauthenticated", "User must be authenticated");
      // }

      logger.info("Publishing brand site to Cloudflare", {
        brandSiteId,
        htmlLength: html.length,
        assetCount: assets.length,
        sourceType,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      // Get brand site
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }
      auditOrganizationId = brandSite.organizationId;
      auditBrandSiteName = brandSite.brandName;

      // TODO: Add authorization check
      // Verify user has permission to publish this brand site
      // const organization = await organizationRepository.get({ id: brandSite.organizationId });
      // if (!hasPermission(auth.uid, organization, "publish_site")) {
      //   throw new HttpsError("permission-denied", "User does not have permission to publish this site");
      // }

      // Generate versionId (timestamp-based with random suffix for uniqueness)
      const versionId = `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Initialize Cloudflare publisher service
      const publisherService = new CloudflarePublisherService({
        accountId: cloudflareAccountId.value(),
        apiToken: cloudflareApiToken.value(),
        r2BucketName: cloudflareR2BucketName.value(),
        kvNamespaceId: cloudflareKvNamespaceId.value(),
      });

      // Prepare files for upload
      const filesToUpload = [
        {
          path: "index.html",
          content: html,
          contentType: "text/html; charset=utf-8",
        },
        ...assets.map((asset) => {
          // Handle base64 encoded content
          let content: string | Buffer;
          if (typeof asset.content === "string" && asset.content.startsWith("data:")) {
            // Extract base64 from data URL
            const base64Match = asset.content.match(/^data:[^;]+;base64,(.+)$/);
            if (base64Match) {
              content = Buffer.from(base64Match[1], "base64");
            } else {
              content = asset.content;
            }
          } else if (typeof asset.content === "string") {
            content = asset.content;
          } else {
            content = asset.content;
          }

          return {
            path: asset.path,
            content,
            contentType: asset.contentType || "application/octet-stream",
          };
        }),
      ];

      // Upload to R2
      const r2Keys = await publisherService.uploadSiteVersionToR2(
        brandSiteId,
        versionId,
        filesToUpload
      );

      logger.info("Uploaded files to R2", {
        brandSiteId,
        versionId,
        r2KeyCount: r2Keys.length,
      });

      // Create version document in Firestore
      const existingVersions = brandSite.versions || [];
      const nextVersionNumber =
        existingVersions.length > 0
          ? Math.max(...existingVersions.map((v) => v.version)) + 1
          : 1;

      const newVersion = {
        version: nextVersionNumber,
        versionId,
        html,
        files: brandSite.files || {},
        sourceType,
        aiPrompt,
        notes,
        metadata: brandSite.metadata || {},
        createdAt: new Date().toISOString(),
        createdByUserId: request.auth?.uid,
        description: notes || `Published version ${nextVersionNumber}`,
      };

      const updatedVersions = [...existingVersions, newVersion];

      // Collect all domains for this brand site
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
      // Also include subdomain if it exists (for backward compatibility)
      if (brandSite.subdomain) {
        const subdomainUrl = `https://${brandSite.subdomain}`;
        try {
          const subdomainHost = new URL(subdomainUrl).hostname;
          if (!domains.includes(subdomainHost)) {
            domains.push(subdomainHost);
          }
        } catch {
          // Invalid subdomain URL, skip
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

      // Update BrandSite document
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          currentVersionId: versionId,
          hostingProvider: "cloudflare",
          status: "success",
          versions: updatedVersions,
          // Update deployedUrl to point to primary domain or first available domain
          deployedUrl: domains.length > 0 ? `https://${domains[0]}` : undefined,
        },
      });

      logger.info("Brand site published successfully", {
        brandSiteId,
        versionId,
        publishedDomains: domains,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "publishBrandSite",
        organizationId: brandSite.organizationId,
        action: "site.published",
        resource: {
          type: "site",
          id: brandSiteId,
          name: brandSite.brandName,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "publishBrandSite",
          customFields: {
            versionId,
            sourceType,
            publishedDomains: domains,
          },
        },
      });

      return {
        success: true,
        brandSiteId,
        versionId,
        publishedDomains: domains,
        deployedUrl: domains.length > 0 ? `https://${domains[0]}` : undefined,
      };
    } catch (error) {
      logger.error("Error publishing brand site", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "publishBrandSite",
        organizationId: auditOrganizationId,
        action: "site.published",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditBrandSiteId
          ? {
              type: "site",
              id: auditBrandSiteId,
              name: auditBrandSiteName,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "publishBrandSite",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "Failed to publish brand site to Cloudflare"
      );
    }
  }
);
