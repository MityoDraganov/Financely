import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { CloudflareService } from "../services/cloudflare-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";

const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");
const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

interface AddCustomDomainPayload {
  brandSiteId: string;
  customDomain: string;
}

/**
 * Validate domain format
 */
function validateDomain(domain: string): { valid: boolean; error?: string } {
  // Remove protocol if present
  let cleanDomain = domain.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
  cleanDomain = cleanDomain.replace(/\/$/, "");

  // Basic domain validation regex
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  
  if (!domainRegex.test(cleanDomain)) {
    return {
      valid: false,
      error: "Invalid domain format. Please enter a valid domain (e.g., example.com or www.example.com)",
    };
  }

  // Check for localhost or reserved domains
  if (cleanDomain.includes("localhost") || cleanDomain.includes("127.0.0.1")) {
    return {
      valid: false,
      error: "Localhost domains are not allowed",
    };
  }

  return { valid: true };
}

/**
 * Check if domain is an apex domain (no subdomain)
 */
function isApexDomain(domain: string): boolean {
  const parts = domain.split(".");
  return parts.length === 2;
}

/**
 * Add a custom domain to a brand site.
 * Supports both Cloudflare-managed domains (automatic DNS) and external domains (manual DNS instructions).
 */
export const addCustomDomain = onCall<AddCustomDomainPayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300, // 5 minutes for DNS propagation
    memory: "512MiB",
    secrets: [
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
  },
  async (request) => {
    try {
      const { brandSiteId, customDomain } = request.data;

      if (!brandSiteId || !customDomain) {
        throw new HttpsError(
          "invalid-argument",
          "brandSiteId and customDomain are required",
        );
      }

      // Validate domain format
      const validation = validateDomain(customDomain);
      if (!validation.valid) {
        throw new HttpsError(
          "invalid-argument",
          validation.error || "Invalid domain format",
        );
      }

      // Clean domain
      let cleanDomain = customDomain.trim().toLowerCase();
      cleanDomain = cleanDomain.replace(/^https?:\/\//, "");
      cleanDomain = cleanDomain.replace(/\/$/, "");

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      if (!brandSite.deployedUrl) {
        throw new HttpsError(
          "failed-precondition",
          "Site must be deployed before adding custom domain",
        );
      }

      const hostingService = new FirebaseHostingService({
        projectId: firebaseProjectId.value(),
      });

      const siteId = `brand-${brandSiteId}`;
      const targetHost = new URL(brandSite.deployedUrl).hostname;
      const isApex = isApexDomain(cleanDomain);

      // Try to add domain to Firebase Hosting first
      let domainStatus: { domain: string; status: string };
      try {
        domainStatus = await hostingService.addCustomDomain(siteId, cleanDomain);
      } catch (hostingError) {
        const errorMessage = hostingError instanceof Error ? hostingError.message : "Unknown error";
        logger.error("Failed to add domain to Firebase Hosting", {
          brandSiteId,
          domain: cleanDomain,
          error: errorMessage,
        });
        throw new HttpsError(
          "internal",
          `Failed to add domain to Firebase Hosting: ${errorMessage}`,
        );
      }

      // Try to automatically configure DNS if domain is in Cloudflare
      let dnsConfigured = false;
      let dnsInstructions: {
        type: "A" | "CNAME";
        name: string;
        value: string;
        ttl?: number;
      } | null = null;

      const cloudflareService = new CloudflareService({
        apiToken: cloudflareApiToken.value(),
        zoneId: cloudflareZoneId.value(),
        baseDomain: cloudflareBaseDomain.value(),
      });

      try {
        // Try to create DNS record in Cloudflare
        // This will only work if the domain is managed by the same Cloudflare account
        await cloudflareService.createCustomDomainRecord(cleanDomain, targetHost);
        dnsConfigured = true;
        logger.info("DNS record created automatically in Cloudflare", {
          domain: cleanDomain,
        });
      } catch (cloudflareError) {
        // Domain is not in Cloudflare or DNS creation failed
        // Provide DNS instructions for manual configuration
        logger.info("Domain not in Cloudflare, providing DNS instructions", {
          domain: cleanDomain,
          error: cloudflareError instanceof Error ? cloudflareError.message : "Unknown error",
        });

        // Generate DNS instructions
        // For Firebase Hosting:
        // - Subdomains: Use CNAME pointing to Firebase Hosting site URL
        // - Apex domains: Firebase Hosting recommends using CNAME flattening (ALIAS/ANAME records)
        //   or A records. However, Firebase Hosting doesn't provide static IPs.
        //   The recommended approach is to use the Firebase Hosting site URL with CNAME flattening
        //   if the DNS provider supports it, otherwise use A records with Firebase's IPs.
        //   For simplicity, we'll provide CNAME instructions and note about apex domain limitations.
        if (isApex) {
          // Apex domain: Firebase Hosting doesn't provide static IPs
          // Most DNS providers support CNAME flattening (ALIAS/ANAME) for apex domains
          // If not supported, user needs to check Firebase Hosting console for specific IPs
          // For now, provide CNAME with note about apex domain requirements
          dnsInstructions = {
            type: "CNAME",
            name: "@",
            value: targetHost, // Firebase Hosting site hostname
            ttl: 3600,
          };
          // Note: Some DNS providers may require ALIAS/ANAME instead of CNAME for apex domains
        } else {
          // Subdomain: Use CNAME
          dnsInstructions = {
            type: "CNAME",
            name: cleanDomain.split(".")[0], // e.g., "www" from "www.example.com"
            value: targetHost, // Firebase Hosting site hostname
            ttl: 3600,
          };
        }
      }

      // Update brand site with custom domain
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          customDomain: cleanDomain,
        },
      });

      logger.info("Custom domain added successfully", {
        brandSiteId,
        customDomain: cleanDomain,
        dnsConfigured,
        domainStatus: domainStatus.status,
      });

      return {
        success: true,
        customDomain: cleanDomain,
        domainStatus: domainStatus.status,
        dnsConfigured,
        dnsInstructions: dnsInstructions ? {
          type: dnsInstructions.type,
          name: dnsInstructions.name,
          value: dnsInstructions.value,
          ttl: dnsInstructions.ttl,
        } : undefined,
        message: dnsConfigured
          ? "Domain added successfully. DNS configured automatically."
          : "Domain added to Firebase Hosting. Please configure DNS records as shown below.",
      };
    } catch (error) {
      logger.error("Error adding custom domain", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "Failed to add custom domain",
      );
    }
  },
);

