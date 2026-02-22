import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";
import { AuditLogService } from "../../services/audit-log-service";
import { logAuditSuccessForRequest } from "../../utils/audit-log-helper";

interface AdminOverrideUsageRequest {
  organizationId: string;
  usageOverrides: {
    templateCount?: number;
    invoiceCount?: number;
    memberCount?: number;
    storageBytes?: number;
  };
}

/**
 * Admin function to override organization usage
 * Requires superadmin role
 */
export const adminOverrideUsage = onCall<
  AdminOverrideUsageRequest,
  Promise<{ success: boolean; organizationId: string }>
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

      const { organizationId, usageOverrides } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      if (!usageOverrides || Object.keys(usageOverrides).length === 0) {
        throw new HttpsError("invalid-argument", "At least one usage override is required");
      }

      const db = getFirestore();
      const orgRef = db.collection("organizations").doc(organizationId);
      const orgDoc = await orgRef.get();

      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const beforeData = orgDoc.data();
      const currentUsage = beforeData?.usage || {};

      // Build usage update
      const updatedUsage = {
        ...currentUsage,
        ...usageOverrides,
      };

      // Update organization usage
      await orgRef.update({
        usage: updatedUsage,
        updatedAt: new Date().toISOString(),
      });

      // Get updated data
      const afterDoc = await orgRef.get();
      const afterData = afterDoc.data();

      const changes = Object.keys(usageOverrides).map((key) => ({
        field: `usage.${key}`,
        oldValue: currentUsage[key],
        newValue: updatedUsage[key],
      }));

      const fallbackAuditUserContext = AuditLogService.buildUserContext(
        adminAuth.userId,
        adminAuth.userId,
        request.auth?.token.email || `admin-${adminAuth.userId}@financely.local`,
        request.auth?.token.name || "Admin",
        {
          role: adminAuth.adminRole,
        },
      );

      await logAuditSuccessForRequest({
        request,
        operationName: "adminOverrideUsage",
        organizationId,
        action: "organization.updated",
        resource: {
          type: "organization",
          id: organizationId,
          name: afterData?.name || organizationId,
        },
        changes,
        beforeSnapshot: { usage: currentUsage },
        afterSnapshot: { usage: updatedUsage },
        metadata: {
          source: "system",
          customFields: {
            adminRole: adminAuth.adminRole,
            action: "usage_override",
          },
        },
        fallbackUserContext: fallbackAuditUserContext,
      });

      loggerService.info("Usage overridden by admin", {
        organizationId,
        adminUserId: adminAuth.userId,
        overrides: Object.keys(usageOverrides),
      });

      return {
        success: true,
        organizationId,
      };
    } catch (error) {
      loggerService.error("Error overriding usage", {
        error: error instanceof Error ? error.message : String(error),
        organizationId: request.data?.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to override usage");
    }
  }
);
