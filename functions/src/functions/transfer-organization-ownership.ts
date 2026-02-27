import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { ORGANIZATION_ROLES, isOwner, isValidRole } from "../core/roles";
import { loggerService } from "../services/logger-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

interface TransferOrganizationOwnershipPayload {
  organizationId: string;
  newOwnerId: string;
}

interface TransferOrganizationOwnershipResponse {
  success: boolean;
  message: string;
}

/**
 * Transfer organization ownership to another existing member.
 * Only the current owner can perform this action.
 */
export const transferOrganizationOwnership = onCall<
  TransferOrganizationOwnershipPayload,
  Promise<TransferOrganizationOwnershipResponse>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditNewOwnerId: string | undefined;
    let auditNewOwnerName: string | undefined;
    let auditNewOwnerPreviousRole: string | undefined;

    try {
      const { organizationId, newOwnerId } = request.data;
      auditOrganizationId = organizationId;
      auditNewOwnerId = newOwnerId;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }

      if (!newOwnerId) {
        throw new HttpsError("invalid-argument", "newOwnerId is required");
      }

      if (auth.uid === newOwnerId) {
        throw new HttpsError(
          "invalid-argument",
          "Cannot transfer ownership to yourself"
        );
      }

      const db = getFirestore();

      const result = await db.runTransaction(async (transaction) => {
        const requestingUserRef = db.collection("users").doc(auth.uid);
        const newOwnerRef = db.collection("users").doc(newOwnerId);
        const orgRef = db.collection("organizations").doc(organizationId);

        const [requestingUserDoc, newOwnerDoc, orgDoc] = await Promise.all([
          transaction.get(requestingUserRef),
          transaction.get(newOwnerRef),
          transaction.get(orgRef),
        ]);

        if (!requestingUserDoc.exists) {
          throw new HttpsError("not-found", "Requesting user not found");
        }
        if (!newOwnerDoc.exists) {
          throw new HttpsError("not-found", "Target member not found");
        }
        if (!orgDoc.exists) {
          throw new HttpsError("not-found", "Organization not found");
        }

        const requestingUserData = requestingUserDoc.data();
        const newOwnerData = newOwnerDoc.data();
        const orgData = orgDoc.data();

        if (!requestingUserData) {
          throw new HttpsError("not-found", "Requesting user data not found");
        }
        if (!newOwnerData) {
          throw new HttpsError("not-found", "Target member data not found");
        }
        if (!orgData) {
          throw new HttpsError("not-found", "Organization data not found");
        }

        const memberIds = orgData.memberIds || [];
        if (!memberIds.includes(auth.uid)) {
          throw new HttpsError(
            "permission-denied",
            "You are not a member of this organization"
          );
        }
        if (!memberIds.includes(newOwnerId)) {
          throw new HttpsError(
            "failed-precondition",
            "Target user is not a member of this organization"
          );
        }

        const requestingRoleValue =
          requestingUserData.organizationRoles?.[organizationId];
        if (!requestingRoleValue || !isValidRole(requestingRoleValue)) {
          throw new HttpsError(
            "permission-denied",
            "User does not have a valid role in this organization"
          );
        }
        if (!isOwner(requestingRoleValue)) {
          throw new HttpsError(
            "permission-denied",
            "Only organization owners can transfer ownership"
          );
        }

        const newOwnerRoleValue = newOwnerData.organizationRoles?.[organizationId];
        auditNewOwnerPreviousRole = newOwnerRoleValue;
        if (!newOwnerRoleValue || !isValidRole(newOwnerRoleValue)) {
          throw new HttpsError(
            "failed-precondition",
            "Target user does not have a valid role in this organization"
          );
        }
        if (isOwner(newOwnerRoleValue)) {
          throw new HttpsError(
            "failed-precondition",
            "Selected member is already an owner"
          );
        }

        if (newOwnerData.status !== "active") {
          throw new HttpsError(
            "failed-precondition",
            "Only active members can become owners"
          );
        }

        const now = new Date().toISOString();
        auditNewOwnerName = newOwnerData.name || newOwnerData.email || newOwnerId;

        transaction.update(requestingUserRef, {
          organizationRoles: {
            ...requestingUserData.organizationRoles,
            [organizationId]: ORGANIZATION_ROLES.ADMIN,
          },
          updatedAt: now,
        });

        transaction.update(newOwnerRef, {
          organizationRoles: {
            ...newOwnerData.organizationRoles,
            [organizationId]: ORGANIZATION_ROLES.OWNER,
          },
          updatedAt: now,
        });

        transaction.update(orgRef, {
          updatedAt: now,
        });

        loggerService.info("Organization ownership transferred successfully", {
          organizationId,
          previousOwnerId: auth.uid,
          newOwnerId,
          previousOwnerRole: requestingRoleValue,
          newOwnerPreviousRole: newOwnerRoleValue,
        });

        return {
          success: true,
          message: "Organization ownership transferred successfully",
        };
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "transferOrganizationOwnership",
        organizationId,
        action: "member.role_changed",
        resource: {
          type: "member",
          id: newOwnerId,
          name: auditNewOwnerName || newOwnerId,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "transferOrganizationOwnership",
          customFields: {
            previousOwnerId: auth.uid,
            newOwnerId,
            previousOwnerNewRole: ORGANIZATION_ROLES.ADMIN,
            newOwnerNewRole: ORGANIZATION_ROLES.OWNER,
            newOwnerPreviousRole: auditNewOwnerPreviousRole,
          },
        },
      });

      return result;
    } catch (error) {
      loggerService.error("Error transferring organization ownership", error);

      await logAuditFailureForRequest({
        request,
        operationName: "transferOrganizationOwnership",
        organizationId: auditOrganizationId,
        action: "member.role_changed",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditNewOwnerId
          ? {
              type: "member",
              id: auditNewOwnerId,
              name: auditNewOwnerName || auditNewOwnerId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "transferOrganizationOwnership",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to transfer organization ownership: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
