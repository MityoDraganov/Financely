import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { isOwner, isValidRole } from "../core/roles";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

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
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditMemberId: string | undefined;
    let auditMemberName: string | undefined;
    let auditMemberRole: string | undefined;
    try {
      const { organizationId, memberId } = request.data;
      auditOrganizationId = organizationId;
      auditMemberId = memberId;
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
      const result = await db.runTransaction(async (transaction) => {
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
        const requestingUserRoleValue = requestingUserData.organizationRoles?.[organizationId];
        if (!requestingUserRoleValue || !isValidRole(requestingUserRoleValue)) {
          throw new HttpsError(
            "permission-denied",
            "User does not have a valid role in this organization"
          );
        }
        if (!isOwner(requestingUserRoleValue)) {
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
        auditMemberName = memberUserData.name || memberUserData.email || memberId;

        // Check if trying to revoke another owner (prevent this)
        const memberRoleValue = memberUserData.organizationRoles?.[organizationId];
        auditMemberRole = memberRoleValue;
        if (memberRoleValue && isValidRole(memberRoleValue) && isOwner(memberRoleValue)) {
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
          memberRole: memberRoleValue,
        });

        return {
          success: true,
          message: "Member access revoked successfully",
        };
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "revokeMember",
        organizationId,
        action: "member.removed",
        resource: {
          type: "member",
          id: memberId,
          name: auditMemberName || memberId,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "revokeMember",
          customFields: {
            removedMemberRole: auditMemberRole,
          },
        },
      });

      return result;
    } catch (error) {
      loggerService.error("Error revoking member", error);

      await logAuditFailureForRequest({
        request,
        operationName: "revokeMember",
        organizationId: auditOrganizationId,
        action: "member.removed",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditMemberId
          ? {
              type: "member",
              id: auditMemberId,
              name: auditMemberName || auditMemberId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "revokeMember",
        },
      });

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
