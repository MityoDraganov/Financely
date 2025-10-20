import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { Invite } from "../core/entities/invite";

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
      const userRole = userData.organizationRoles?.[inviteData.organizationId];
      if (userRole !== "owner" && userRole !== "admin") {
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

      return {
        success: true,
        invite,
        message: "Invite revoked successfully",
      };
    } catch (error) {
      loggerService.error("Error revoking invite", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to revoke invite: ${error}`);
    }
  }
);
