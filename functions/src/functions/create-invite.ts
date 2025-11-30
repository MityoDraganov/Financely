import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { Invite } from "../core/entities/invite";
import { isAdminOrOwner, isValidRole } from "../core/roles";

interface CreateInvitePayload {
  organizationId: string;
  expiresAt?: string; // Optional, defaults to 7 days from now
}

interface CreateInviteResponse {
  success: boolean;
  invite: Invite;
  message: string;
}

export const createInvite = onCall<CreateInvitePayload, Promise<CreateInviteResponse>>(
  { 
    region: "us-central1"
  },
  async (request) => {
    try {
      const { organizationId, expiresAt } = request.data;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      const db = getFirestore();

      // Get user data
      loggerService.info("Getting user data", { userId: auth.uid });
      const userDoc = await db.collection("users").doc(auth.uid).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new HttpsError("not-found", "User data not found");
      }

      // Get organization data
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const orgData = orgDoc.data();
      if (!orgData) {
        throw new HttpsError("not-found", "Organization data not found");
      }

      // Check if user is a member of the organization
      if (!orgData.memberIds?.includes(auth.uid)) {
        throw new HttpsError("permission-denied", "User is not a member of this organization");
      }

      // Check if user has owner or admin role
      const userRoleValue = userData.organizationRoles?.[organizationId];
      if (!userRoleValue || !isValidRole(userRoleValue)) {
        throw new HttpsError("permission-denied", "User does not have a valid role in this organization");
      }
      if (!isAdminOrOwner(userRoleValue)) {
        throw new HttpsError("permission-denied", "User does not have permission to create invites");
      }

      // Generate unique code
      const generateCode = (): string => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Check if code is unique
      let code: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        code = generateCode();
        const existingInvite = await db.collection("invites")
          .where("code", "==", code)
          .limit(1)
          .get();
        isUnique = existingInvite.empty;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new HttpsError("internal", "Failed to generate unique invite code");
      }

      // Set expiration date (default to 7 days from now)
      const expirationDate = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Create invite
      const now = new Date().toISOString();
      const inviteData = {
        code,
        organizationId,
        invitedBy: auth.uid,
        status: "active" as const,
        expiresAt: expirationDate,
        createdAt: now,
        updatedAt: now,
      };

      const inviteRef = await db.collection("invites").add(inviteData);

      const invite: Invite = {
        id: inviteRef.id,
        ...inviteData,
      };

      loggerService.info("Invite created successfully", {
        inviteId: invite.id,
        code: invite.code,
        organizationId: invite.organizationId,
        invitedBy: invite.invitedBy,
      });

      return {
        success: true,
        invite,
        message: "Invite created successfully",
      };
    } catch (error) {
      loggerService.error("Error creating invite", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to create invite: ${error}`);
    }
  }
);
