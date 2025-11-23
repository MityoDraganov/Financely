import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";

interface RevokeMemberPayload {
  organizationId: string;
  memberId: string;
}

interface RevokeMemberResponse {
  success: boolean;
  message: string;
}

/**
 * Revoke a member's access to an organization.
 * Only owners can revoke members.
 * When revoked, the member is removed from:
 * - organization.memberIds array
 * - user.organizationRoles[organizationId]
 */
export const revokeMember = onCall<RevokeMemberPayload, Promise<RevokeMemberResponse>>(
  {
    region: "us-central1",
  },
  async (request) => {
    try {
      const { organizationId, memberId } = request.data;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      if (!memberId) {
        throw new HttpsError("invalid-argument", "memberId is required");
      }

      // Prevent self-revocation
      if (auth.uid === memberId) {
        throw new HttpsError("invalid-argument", "Cannot revoke your own access");
      }

      const db = getFirestore();

      // Use a transaction to ensure atomicity
      return await db.runTransaction(async (transaction) => {
        // Get the requesting user's data
        const requestingUserRef = db.collection("users").doc(auth.uid);
        const requestingUserDoc = await transaction.get(requestingUserRef);

        if (!requestingUserDoc.exists) {
          throw new HttpsError("not-found", "Requesting user not found");
        }

        const requestingUserData = requestingUserDoc.data();
        if (!requestingUserData) {
          throw new HttpsError("not-found", "Requesting user data not found");
        }

        // Check if requesting user is the owner
        const requestingUserRole = requestingUserData.organizationRoles?.[organizationId];
        if (requestingUserRole !== "owner") {
          throw new HttpsError(
            "permission-denied",
            "Only organization owners can revoke members"
          );
        }

        // Get organization data
        const orgRef = db.collection("organizations").doc(organizationId);
        const orgDoc = await transaction.get(orgRef);

        if (!orgDoc.exists) {
          throw new HttpsError("not-found", "Organization not found");
        }

        const orgData = orgDoc.data();
        if (!orgData) {
          throw new HttpsError("not-found", "Organization data not found");
        }

        // Check if member is in the organization
        const memberIds = orgData.memberIds || [];
        if (!memberIds.includes(memberId)) {
          throw new HttpsError("failed-precondition", "User is not a member of this organization");
        }

        // Get the member's user data
        const memberUserRef = db.collection("users").doc(memberId);
        const memberUserDoc = await transaction.get(memberUserRef);

        if (!memberUserDoc.exists) {
          throw new HttpsError("not-found", "Member user not found");
        }

        const memberUserData = memberUserDoc.data();
        if (!memberUserData) {
          throw new HttpsError("not-found", "Member user data not found");
        }

        // Check if trying to revoke another owner (prevent this)
        const memberRole = memberUserData.organizationRoles?.[organizationId];
        if (memberRole === "owner") {
          throw new HttpsError(
            "failed-precondition",
            "Cannot revoke another owner. Transfer ownership first."
          );
        }

        // Remove member from organization's memberIds array
        const updatedMemberIds = memberIds.filter((id: string) => id !== memberId);
        transaction.update(orgRef, {
          memberIds: updatedMemberIds,
          updatedAt: new Date().toISOString(),
        });

        // Remove organization role from user's organizationRoles
        const updatedRoles = { ...memberUserData.organizationRoles };
        delete updatedRoles[organizationId];
        transaction.update(memberUserRef, {
          organizationRoles: updatedRoles,
          updatedAt: new Date().toISOString(),
        });

        loggerService.info("Member revoked successfully", {
          organizationId,
          memberId,
          revokedBy: auth.uid,
          memberRole,
        });

        return {
          success: true,
          message: "Member access revoked successfully",
        };
      });
    } catch (error) {
      loggerService.error("Error revoking member", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to revoke member: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

