import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";

/**
 * Public API endpoint to fetch widget configuration for an organization.
 * This endpoint is used by the embeddable widget script to load configuration dynamically.
 * 
 * GET /getWidgetConfig?organizationId=xxx
 * 
 * Response:
 * {
 *   organizationId: string,
 *   branding: {
 *     logo: string | null,
 *     companyName: string,
 *     colors: { primary: string, secondary: string, accent: string }
 *   },
 *   widgets: {
 *     enabled: boolean,
 *     contactForm: {...} | null,
 *     invoiceRequest: {...} | null,
 *     quoteRequest: {...} | null
 *   }
 * }
 */
export const getWidgetConfig = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request, response) => {
    try {
      const organizationId = request.query.organizationId as string;

      if (!organizationId || typeof organizationId !== "string") {
        response.status(400).json({
          error: "organizationId query parameter is required",
        });
        return;
      }

      logger.info("Fetching widget config", { organizationId });

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      const organization = await organizationRepository.get({ id: organizationId });

      if (!organization) {
        response.status(404).json({
          error: "Organization not found",
        });
        return;
      }

      if (organization.status !== "active") {
        response.status(403).json({
          error: "Organization is not active",
        });
        return;
      }

      // Extract widget configuration
      const widgets = organization.settings?.widgets;
      const branding = organization.settings?.branding;
      const brandColors = organization.settings?.brandColors || {
        primary: "#2563eb",
        secondary: "#6b7280",
        accent: "#10b981",
      };

      // Build response with only enabled widgets
      const config = {
        organizationId: organization.id,
        branding: {
          logo: branding?.customLogo || organization.logoUrl || null,
          companyName: branding?.companyName || organization.name,
          colors: brandColors,
        },
        widgets: widgets?.enabled
          ? {
              enabled: true,
              contactForm: widgets.contactForm?.enabled ? widgets.contactForm : null,
              invoiceRequest: widgets.invoiceRequest?.enabled ? widgets.invoiceRequest : null,
              quoteRequest: widgets.quoteRequest?.enabled ? widgets.quoteRequest : null,
            }
          : {
              enabled: false,
              contactForm: null,
              invoiceRequest: null,
              quoteRequest: null,
            },
      };

      logger.info("Widget config fetched successfully", { organizationId });

      response.status(200).json(config);
    } catch (error) {
      logger.error("Error fetching widget config", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: request.query,
      });

      response.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

