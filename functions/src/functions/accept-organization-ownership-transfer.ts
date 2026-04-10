import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { ORGANIZATION_ROLES, isOwner, isValidRole } from "../core/roles";
import { loggerService } from "../services/logger-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import {
  cancelPendingOwnershipTransfers,
  hashOwnershipTransferToken,
  isOwnershipTransferExpired,
  normalizeEmail,
  OWNERSHIP_TRANSFER_COLLECTION,
} from "./organization-ownership-transfer-utils";

interface AcceptOrganizationOwnershipTransferPayload {
  token: string;
}

interface AcceptOrganizationOwnershipTransferResponse {
  success: boolean;
  message: string;
  organizationId: string;
}

export const acceptOrganizationOwnershipTransfer = onCall<
  AcceptOrganizationOwnershipTransferPayload,
  Promise<AcceptOrganizationOwnershipTransferResponse>
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
    let auditTransferId: string | undefined;

    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const token = String(request.data.token || "").trim();
      if (!token) {
        throw new HttpsError("invalid-argument", "token is required");
      }

      const tokenHash = hashOwnershipTransferToken(token);
      const db = getFirestore();
      const transferSnapshot = await db
        .collection(OWNERSHIP_TRANSFER_COLLECTION)
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();

      if (transferSnapshot.empty) {
        throw new HttpsError("not-found", "Transfer request not found");
      }

      const transferDoc = transferSnapshot.docs[0];
      const transferData = transferDoc.data();
      const transferId = transferDoc.id;
      const organizationId = String(transferData.organizationId || "");
      auditOrganizationId = organizationId;
      auditTransferId = transferId;

      if (!organizationId) {
        throw new HttpsError(
          "failed-precondition",
          "Transfer request is missing organizationId",
        );
      }

      const currentStatus = String(transferData.status || "");
      if (currentStatus !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `Transfer request is no longer pending (status: ${currentStatus || "unknown"})`,
        );
      }

      const expiresAt = String(transferData.expiresAt || "");
      if (!expiresAt || isOwnershipTransferExpired(expiresAt)) {
        await transferDoc.ref.update({
          status: "expired",
          updatedAt: new Date().toISOString(),
        });

        await logAuditSuccessForRequest({
          request,
          operationName: "acceptOrganizationOwnershipTransfer",
          organizationId,
          action: "organization.transfer.expired",
          resource: {
            type: "organizationOwnershipTransfer",
            id: transferId,
            name: transferData.targetEmail,
          },
          durationMs: Date.now() - startTime,
          metadata: {
            source: "api",
            sourceDetails: "acceptOrganizationOwnershipTransfer",
          },
        });

        throw new HttpsError("failed-precondition", "Transfer request has expired");
      }

      const targetEmail = normalizeEmail(String(transferData.targetEmail || ""));
      const acceptingUserId = request.auth.uid;
      const now = new Date().toISOString();

      const result = await db.runTransaction(async (transaction) => {
        const transferTxDoc = await transaction.get(transferDoc.ref);
        if (!transferTxDoc.exists) {
          throw new HttpsError("not-found", "Transfer request not found");
        }
        const transferTxData = transferTxDoc.data();
        if (!transferTxData) {
          throw new HttpsError("failed-precondition", "Transfer request data missing");
        }

        const txStatus = String(transferTxData.status || "");
        if (txStatus !== "pending") {
          throw new HttpsError(
            "failed-precondition",
            `Transfer request is no longer pending (status: ${txStatus || "unknown"})`,
          );
        }
        const txExpiresAt = String(transferTxData.expiresAt || "");
        if (!txExpiresAt || isOwnershipTransferExpired(txExpiresAt)) {
          transaction.update(transferDoc.ref, {
            status: "expired",
            updatedAt: now,
          });
          throw new HttpsError("failed-precondition", "Transfer request has expired");
        }

        const orgRef = db.collection("organizations").doc(organizationId);
        const requesterRef = db
          .collection("users")
          .doc(String(transferTxData.requestedBy || ""));
        const acceptingUserRef = db.collection("users").doc(acceptingUserId);

        const [orgTxDoc, requesterTxDoc, acceptingUserTxDoc] = await Promise.all([
          transaction.get(orgRef),
          transaction.get(requesterRef),
          transaction.get(acceptingUserRef),
        ]);

        if (!orgTxDoc.exists) {
          throw new HttpsError("not-found", "Organization not found");
        }
        if (!requesterTxDoc.exists) {
          throw new HttpsError("not-found", "Requesting owner not found");
        }
        if (!acceptingUserTxDoc.exists) {
          throw new HttpsError("not-found", "Accepting user not found");
        }

        const orgTxData = orgTxDoc.data();
        const requesterTxData = requesterTxDoc.data();
        const acceptingUserTxData = acceptingUserTxDoc.data();
        if (!orgTxData || !requesterTxData || !acceptingUserTxData) {
          throw new HttpsError(
            "failed-precondition",
            "Could not verify transfer state",
          );
        }
        if (orgTxData.status !== "active") {
          throw new HttpsError(
            "failed-precondition",
            "Organization is not active",
          );
        }

        const acceptingUserEmail = normalizeEmail(
          String(acceptingUserTxData.email || ""),
        );
        if (acceptingUserEmail !== targetEmail) {
          throw new HttpsError(
            "permission-denied",
            "This transfer request belongs to a different email address",
          );
        }
        const acceptingUserStatus =
          acceptingUserTxData.status === "suspended" ||
          acceptingUserTxData.status === "deleted"
            ? acceptingUserTxData.status
            : "active";
        if (acceptingUserStatus !== "active") {
          throw new HttpsError("failed-precondition", "User account is not active");
        }

        const requesterId = String(transferTxData.requestedBy || "");
        if (requesterId === acceptingUserId) {
          throw new HttpsError(
            "invalid-argument",
            "Cannot accept an ownership transfer to yourself",
          );
        }

        const requesterRole = requesterTxData.organizationRoles?.[organizationId];
        if (
          !requesterRole ||
          !isValidRole(String(requesterRole)) ||
          !isOwner(requesterRole)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Requesting user is no longer organization owner",
          );
        }

        const memberIds = (orgTxData.memberIds || []) as string[];
        const nextMemberIds = memberIds.includes(acceptingUserId)
          ? memberIds
          : [...memberIds, acceptingUserId];

        transaction.update(requesterRef, {
          organizationRoles: {
            ...requesterTxData.organizationRoles,
            [organizationId]: ORGANIZATION_ROLES.MEMBER,
          },
          updatedAt: now,
        });

        transaction.update(acceptingUserRef, {
          organizationRoles: {
            ...acceptingUserTxData.organizationRoles,
            [organizationId]: ORGANIZATION_ROLES.OWNER,
          },
          updatedAt: now,
        });

        transaction.update(orgRef, {
          memberIds: nextMemberIds,
          updatedAt: now,
        });

        transaction.update(transferDoc.ref, {
          status: "accepted",
          acceptedBy: acceptingUserId,
          updatedAt: now,
        });

        return {
          organizationId,
          newOwnerId: acceptingUserId,
        };
      });

      const cancelledCount = await cancelPendingOwnershipTransfers(
        organizationId,
        now,
        { excludeId: transferId, status: "cancelled", acceptedBy: acceptingUserId },
      );

      if (cancelledCount > 0) {
        await logAuditSuccessForRequest({
          request,
          operationName: "acceptOrganizationOwnershipTransfer.cancelPending",
          organizationId,
          action: "organization.transfer.cancelled",
          resource: {
            type: "organizationOwnershipTransfer",
            id: transferId,
            name: transferData.targetEmail,
          },
          metadata: {
            source: "api",
            sourceDetails: "acceptOrganizationOwnershipTransfer",
            customFields: {
              cancelledPendingCount: cancelledCount,
            },
          },
        });
      }

      await logAuditSuccessForRequest({
        request,
        operationName: "acceptOrganizationOwnershipTransfer",
        organizationId: result.organizationId,
        action: "organization.transfer.accepted",
        resource: {
          type: "organizationOwnershipTransfer",
          id: transferId,
          name: transferData.targetEmail,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "acceptOrganizationOwnershipTransfer",
          customFields: {
            newOwnerId: result.newOwnerId,
            previousOwnerId: transferData.requestedBy,
          },
        },
      });

      return {
        success: true,
        message: "Ownership transfer accepted",
        organizationId: result.organizationId,
      };
    } catch (error) {
      loggerService.error("Error accepting organization ownership transfer", error);

      await logAuditFailureForRequest({
        request,
        operationName: "acceptOrganizationOwnershipTransfer",
        organizationId: auditOrganizationId,
        action: "organization.transfer.accepted",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditTransferId
          ? {
              type: "organizationOwnershipTransfer",
              id: auditTransferId,
              name: auditTransferId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "acceptOrganizationOwnershipTransfer",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to accept ownership transfer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
);
