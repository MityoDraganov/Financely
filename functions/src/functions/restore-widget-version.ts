/**
 * Firebase Cloud Function for restoring a previous version of widget configuration
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";

interface RestoreWidgetVersionPayload {
  organizationId: string;
  version: number;
  widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
}

/**
 * Firebase Cloud Function for restoring a previous version of widget configuration.
 *
 * Request payload:
 * {
 *   organizationId: string,
 *   version: number,
 *   widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all"
 * }
 *
 * Response: { success: boolean; organizationId: string; restoredVersion: number }
 */
export const restoreWidgetVersion = onCall<RestoreWidgetVersionPayload>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public", // Allow CORS preflight (OPTIONS) requests without auth
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { organizationId, version, widgetType = "all" } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      if (!version || typeof version !== "number") {
        throw new HttpsError("invalid-argument", "version is required and must be a number");
      }

      logger.info("Restoring widget version", {
        organizationId,
        version,
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

      // Find the version to restore
      const existingVersions = widgets.versions || [];
      const versionToRestore = existingVersions.find(
        (v) => v.version === version && (widgetType === "all" || v.widgetType === widgetType || v.widgetType === "all")
      );

      if (!versionToRestore) {
        throw new HttpsError(
          "not-found",
          `Version ${version} not found in version history for widget type ${widgetType}`
        );
      }

      // Save current version to history before restoring
      const currentVersions = [...existingVersions];
      const currentVersion = widgets.metadata?.version || 1;
      
      if (widgets.enabled) {
        currentVersions.push({
          version: currentVersion,
          widgetType: widgetType === "all" ? "all" : widgetType,
          widgets: {
            enabled: widgets.enabled,
            contactForm: widgets.contactForm,
            invoiceRequest: widgets.invoiceRequest,
            quoteRequest: widgets.quoteRequest,
          },
          createdAt: new Date().toISOString(),
          description: "Version before restore",
        });
      }

      // Restore the widget configuration
      const restoredWidgets = versionToRestore.widgets as typeof widgets;
      
      await organizationRepository.update({
        id: organizationId,
        data: {
          settings: {
            ...organization.settings,
            widgets: {
              ...restoredWidgets,
              metadata: {
                version: versionToRestore.version,
                lastSavedAt: new Date().toISOString(),
              },
              versions: currentVersions,
            },
          },
        },
      });

      logger.info("Widget version restored successfully", {
        organizationId,
        version: versionToRestore.version,
        widgetType,
      });

      return {
        success: true,
        organizationId,
        restoredVersion: versionToRestore.version,
      };
    } catch (error) {
      logger.error("Error restoring widget version", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: request.data?.organizationId,
        version: request.data?.version,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to restore widget version: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);


