import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";
import { AuditLogService } from "../../services/audit-log-service";
import { logAuditSuccessForRequest } from "../../utils/audit-log-helper";

interface AdminUpdateOrganizationRequest {
  organizationId: string;
  updates: {
    name?: string;
    description?: string;
    status?: "active" | "suspended" | "deleted";
    settings?: Record<string, unknown>;
  };
}

/**
 * Admin function to update an organization
 * Requires admin role with organizations.write permission
 */
export const adminUpdateOrganization = onCall<
  AdminUpdateOrganizationRequest,
  Promise<{ success: boolean; organizationId: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "organizations.write",
        requireWrite: true,
      });

      const { organizationId, updates } = request.data;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new HttpsError("invalid-argument", "At least one update field is required");
      }

      const db = getFirestore();
      const orgRef = db.collection("organizations").doc(organizationId);
      const orgDoc = await orgRef.get();

      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const beforeData = orgDoc.data();

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.settings !== undefined) {
        updateData.settings = {
          ...beforeData?.settings,
          ...updates.settings,
        };
      }

      // Update organization
      await orgRef.update(updateData);

      // Get updated data
      const afterDoc = await orgRef.get();
      const afterData = afterDoc.data();

      const changes = Object.keys(updates).map((key) => ({
        field: key,
        oldValue: beforeData?.[key],
        newValue: afterData?.[key],
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
        operationName: "adminUpdateOrganization",
        organizationId,
        action: "organization.updated",
        resource: {
          type: "organization",
          id: organizationId,
          name: afterData?.name || organizationId,
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
        fallbackUserContext: fallbackAuditUserContext,
      });

      loggerService.info("Organization updated by admin", {
        organizationId,
        adminUserId: adminAuth.userId,
        updates: Object.keys(updates),
      });

      return {
        success: true,
        organizationId,
      };
    } catch (error) {
      loggerService.error("Error updating organization", {
        error: error instanceof Error ? error.message : String(error),
        organizationId: request.data?.organizationId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to update organization");
    }
  }
);
