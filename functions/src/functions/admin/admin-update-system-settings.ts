import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";
import { getDatabaseService } from "../../services/database-service";
import { getAuditLogRepository } from "../../repositories/audit-log-repository";
import { AuditLogService } from "../../services/audit-log-service";

interface SystemSettings {
  pricing: {
    starter: { monthly: number; yearly: number };
    professional: { monthly: number; yearly: number };
    enterprise: { monthly: number; yearly: number };
  };
  featureToggles: {
    allowSignups: boolean;
    maintenanceMode: boolean;
    apiAccess: boolean;
    customTemplates: boolean;
    emailSending: boolean;
    pdfGeneration: boolean;
  };
  globalLimits: {
    maxOrganizations: number;
    maxUsersPerOrg: number;
    maxInvoicesPerOrg: number;
    maxTemplatesPerOrg: number;
    maxStoragePerOrgMB: number;
  };
}

interface AdminUpdateSystemSettingsRequest {
  settings: Partial<SystemSettings>;
}

const SYSTEM_SETTINGS_DOC_ID = "global";

/**
 * Admin function to update system settings
 * Requires superadmin role
 */
export const adminUpdateSystemSettings = onCall<
  AdminUpdateSystemSettingsRequest,
  Promise<{ success: boolean }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const adminAuth = await verifyAdminAuth(request, {
        requireSuperAdmin: true,
      });

      const { settings } = request.data;

      if (!settings || Object.keys(settings).length === 0) {
        throw new HttpsError("invalid-argument", "At least one setting field is required");
      }

      const db = getFirestore();
      const settingsRef = db.collection("systemSettings").doc(SYSTEM_SETTINGS_DOC_ID);
      const settingsDoc = await settingsRef.get();

      const beforeData = settingsDoc.exists ? settingsDoc.data() : {};

      // Merge settings
      const updateData: Record<string, unknown> = {
        ...beforeData,
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy: adminAuth.userId,
      };

      // Set or update settings document
      await settingsRef.set(updateData, { merge: true });

      // Get updated data
      const afterDoc = await settingsRef.get();
      const afterData = afterDoc.data();

      // Create audit log (use a system organization ID or create a special one)
      const databaseService = getDatabaseService();
      const auditLogRepository = getAuditLogRepository(databaseService);
      const auditLogService = new AuditLogService(auditLogRepository);

      const changes = Object.keys(settings).map((key) => ({
        field: key,
        oldValue: beforeData?.[key],
        newValue: afterData?.[key],
      }));

      // Use a system org ID for global settings
      const systemOrgId = "system";
      await auditLogService.logSuccess(
        systemOrgId,
        "settings.general.updated",
        {
          userId: adminAuth.userId,
          clerkId: adminAuth.userId,
          email: request.auth?.token.email || "",
          name: request.auth?.token.name || "Admin",
          role: adminAuth.adminRole,
        },
        {
          resource: {
            type: "systemSettings",
            id: SYSTEM_SETTINGS_DOC_ID,
            name: "System Settings",
          },
          changes,
          beforeSnapshot: beforeData as Record<string, unknown>,
          afterSnapshot: afterData as Record<string, unknown>,
          metadata: {
            source: "system",
            customFields: {
              adminRole: adminAuth.adminRole,
            },
          },
        }
      );

      loggerService.info("System settings updated by admin", {
        adminUserId: adminAuth.userId,
        updatedFields: Object.keys(settings),
      });

      return {
        success: true,
      };
    } catch (error) {
      loggerService.error("Error updating system settings", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to update system settings");
    }
  }
);

/**
 * Admin function to get system settings
 * Requires admin role
 */
export const adminGetSystemSettings = onCall<
  {},
  Promise<SystemSettings | null>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      await verifyAdminAuth(request);

      const db = getFirestore();
      const settingsRef = db.collection("systemSettings").doc(SYSTEM_SETTINGS_DOC_ID);
      const settingsDoc = await settingsRef.get();

      if (!settingsDoc.exists) {
        return null;
      }

      return settingsDoc.data() as SystemSettings;
    } catch (error) {
      loggerService.error("Error getting system settings", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to get system settings");
    }
  }
);

