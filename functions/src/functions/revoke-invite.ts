import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { Invite } from "../core/entities/invite";
import { isAdminOrOwner, isValidRole } from "../core/roles";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

interface RevokeInvitePayload {
  inviteId: string;
}

interface RevokeInviteResponse {
  success: boolean;
  invite: Invite;
  message: string;
}

export const revokeInvite = onCall<RevokeInvitePayload, Promise<RevokeInviteResponse>>(
  { 
    region: "us-central1"
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditInviteId: string | undefined;
    let auditInviteCode: string | undefined;
    try {
      const { inviteId } = request.data;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!inviteId) {
        throw new HttpsError("invalid-argument", "inviteId is required");
      }

      const db = getFirestore();

      // Get invite data
      const inviteDoc = await db.collection("invites").doc(inviteId).get();
      if (!inviteDoc.exists) {
        throw new HttpsError("not-found", "Invite not found");
      }

      const inviteData = inviteDoc.data();
      if (!inviteData) {
        throw new HttpsError("not-found", "Invite data not found");
      }
      auditOrganizationId = inviteData.organizationId;
      auditInviteId = inviteId;
      auditInviteCode = inviteData.code;

      // Get user data
      const userDoc = await db.collection("users").doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new HttpsError("not-found", "User data not found");
      }

      // Check if user has permission to revoke this invite
      const userRoleValue = userData.organizationRoles?.[inviteData.organizationId];
      if (!userRoleValue || !isValidRole(userRoleValue)) {
        throw new HttpsError("permission-denied", "User does not have a valid role in this organization");
      }
      if (!isAdminOrOwner(userRoleValue)) {
        throw new HttpsError("permission-denied", "User does not have permission to revoke invites");
      }

      // Check if invite is already revoked or used
      if (inviteData.status === "revoked") {
        throw new HttpsError("failed-precondition", "Invite is already revoked");
      }

      if (inviteData.status === "used") {
        throw new HttpsError("failed-precondition", "Cannot revoke an invite that has already been used");
      }

      // Update invite status
      const now = new Date().toISOString();
      await db.collection("invites").doc(inviteId).update({
        status: "revoked",
        revokedAt: now,
        revokedBy: auth.uid,
        updatedAt: now,
      });

      // Get updated invite
      const updatedInviteDoc = await db.collection("invites").doc(inviteId).get();
      const updatedInviteData = updatedInviteDoc.data();

      const invite: Invite = {
        id: updatedInviteDoc.id,
        ...updatedInviteData,
      } as Invite;

      loggerService.info("Invite revoked successfully", {
        inviteId: invite.id,
        code: invite.code,
        organizationId: invite.organizationId,
        revokedBy: auth.uid,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "revokeInvite",
        organizationId: invite.organizationId,
        action: "invite.revoked",
        resource: {
          type: "invite",
          id: invite.id,
          name: invite.code,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "revokeInvite",
        },
      });

      return {
        success: true,
        invite,
        message: "Invite revoked successfully",
      };
    } catch (error) {
      loggerService.error("Error revoking invite", error);

      await logAuditFailureForRequest({
        request,
        operationName: "revokeInvite",
        organizationId: auditOrganizationId,
        action: "invite.revoked",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditInviteId
          ? {
              type: "invite",
              id: auditInviteId,
              name: auditInviteCode,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "revokeInvite",
        },
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to revoke invite: ${error}`);
    }
  }
);
