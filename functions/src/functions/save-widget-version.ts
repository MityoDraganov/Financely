/**
 * Firebase Cloud Function for saving current widget configuration as a new version
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";

interface SaveWidgetVersionPayload {
  organizationId: string;
  widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
  description?: string;
}

/**
 * Firebase Cloud Function for saving current widget configuration as a new version.
 *
 * Request payload:
 * {
 *   organizationId: string,
 *   widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all",
 *   description?: string
 * }
 *
 * Response: { success: boolean; organizationId: string; version: number }
 */
export const saveWidgetVersion = onCall<SaveWidgetVersionPayload>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public", // Allow CORS preflight (OPTIONS) requests without auth
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, widgetType = "all", description } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      logger.info("Saving widget version", {
        organizationId,
        widgetType,
      });

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const widgets = organization.settings?.widgets;
      if (!widgets) {
        throw new HttpsError("not-found", "Widget configuration not found");
      }

      // Get current version
      const currentVersion = widgets.metadata?.version || 1;
      const newVersion = currentVersion + 1;

      // Save current configuration to version history
      const existingVersions = widgets.versions || [];
      const widgetTypeValue: "contactForm" | "invoiceRequest" | "quoteRequest" | "all" = widgetType === "all" ? "all" : widgetType;
      const newVersionEntry = {
        version: newVersion,
        widgetType: widgetTypeValue,
        widgets: {
          enabled: widgets.enabled,
          contactForm: widgets.contactForm,
          invoiceRequest: widgets.invoiceRequest,
          quoteRequest: widgets.quoteRequest,
        },
        createdAt: new Date().toISOString(),
        description: description || `Version ${newVersion} - ${widgetType === "all" ? "All widgets" : widgetType}`,
      };

      await organizationRepository.update({
        id: organizationId,
        data: {
          settings: {
            ...organization.settings,
            widgets: {
              ...widgets,
              metadata: {
                version: newVersion,
                lastSavedAt: new Date().toISOString(),
              },
              versions: [...existingVersions, newVersionEntry],
            },
          },
        },
      });

      // Invalidate brand context cache (widgets changed)
      const { getBrandContextCache } = await import("../services/brand-context-cache");
      const cache = getBrandContextCache();
      cache.invalidate(organizationId);

      logger.info("Widget version saved successfully", {
        organizationId,
        version: newVersion,
        widgetType,
      });

      return {
        success: true,
        organizationId,
        version: newVersion,
      };
    } catch (error) {
      logger.error("Error saving widget version", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to save widget version: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

