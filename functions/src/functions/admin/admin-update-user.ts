import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAdminAuth } from "../../utils/admin-auth-utils";
import { loggerService } from "../../services/logger-service";
import { AuditLogService } from "../../services/audit-log-service";
import { logAuditSuccessForRequest } from "../../utils/audit-log-helper";

interface AdminUpdateUserRequest {
  userId: string;
  updates: {
    name?: string;
    email?: string;
    status?: "active" | "suspended" | "deleted";
    organizationRoles?: Record<string, string>;
  };
}

/**
 * Admin function to update a user
 * Requires admin role with users.write permission
 */
export const adminUpdateUser = onCall<
  AdminUpdateUserRequest,
  Promise<{ success: boolean; userId: string }>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const adminAuth = await verifyAdminAuth(request, {
        requiredPermission: "users.write",
        requireWrite: true,
      });

      const { userId, updates } = request.data;

      if (!userId) {
        throw new HttpsError("invalid-argument", "User ID is required");
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new HttpsError("invalid-argument", "At least one update field is required");
      }

      const db = getFirestore();
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const beforeData = userDoc.data();
      const userOrgId = beforeData?.defaultOrganizationId || Object.keys(beforeData?.organizationRoles || {})[0] || "";

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.organizationRoles !== undefined) {
        updateData.organizationRoles = {
          ...beforeData?.organizationRoles,
          ...updates.organizationRoles,
        };
      }

      // Update user
      await userRef.update(updateData);

      // Get updated data
      const afterDoc = await userRef.get();
      const afterData = afterDoc.data();

      // Create audit log (use first org or system org)
      if (userOrgId) {
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
          operationName: "adminUpdateUser",
          organizationId: userOrgId,
          action: "user.updated",
          resource: {
            type: "user",
            id: userId,
            name: afterData?.name || userId,
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
      }

      loggerService.info("User updated by admin", {
        userId,
        adminUserId: adminAuth.userId,
        updates: Object.keys(updates),
      });

      return {
        success: true,
        userId,
      };
    } catch (error) {
      loggerService.error("Error updating user", {
        error: error instanceof Error ? error.message : String(error),
        userId: request.data?.userId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Failed to update user");
    }
  }
);
