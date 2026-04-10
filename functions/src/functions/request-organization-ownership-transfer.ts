import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { ORGANIZATION_ROLES, isOwner, isValidRole } from "../core/roles";
import { loggerService } from "../services/logger-service";
import { ResendEmailService } from "../services/resend-email-service";
import { buildAppUrl } from "../config/app-url";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import {
  cancelPendingOwnershipTransfers,
  createOwnershipTransferToken,
  normalizeEmail,
  OWNERSHIP_TRANSFER_COLLECTION,
} from "./organization-ownership-transfer-utils";

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface RequestOrganizationOwnershipTransferPayload {
  organizationId: string;
  targetEmail: string;
}

interface RequestOrganizationOwnershipTransferResponse {
  success: boolean;
  mode: "email" | "direct";
  message: string;
  transferRequestId?: string;
  newOwnerId?: string;
}

async function findExistingMemberByEmail(
  memberIds: string[],
  targetEmail: string,
): Promise<{ id: string; name?: string; email?: string } | null> {
  if (memberIds.length === 0) {
    return null;
  }

  const db = getFirestore();
  const snapshots = await Promise.all(
    memberIds.map((memberId) => db.collection("users").doc(memberId).get()),
  );

  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const data = snapshot.data();
    if (!data) continue;
    const email = normalizeEmail(String(data.email || ""));
    if (email === targetEmail) {
      return {
        id: snapshot.id,
        name: data.name,
        email: data.email,
      };
    }
  }

  return null;
}

export const requestOrganizationOwnershipTransfer = onCall<
  RequestOrganizationOwnershipTransferPayload,
  Promise<RequestOrganizationOwnershipTransferResponse>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditTargetEmail: string | undefined;
    let auditAction:
      | "organization.transfer.requested"
      | "organization.transfer.accepted" = "organization.transfer.requested";

    try {
      const auth = request.auth;
      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      const organizationId = String(request.data.organizationId || "").trim();
      const targetEmailRaw = String(request.data.targetEmail || "").trim();
      const targetEmail = normalizeEmail(targetEmailRaw);
      auditOrganizationId = organizationId;
      auditTargetEmail = targetEmail;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }
      if (!targetEmail || !targetEmail.includes("@")) {
        throw new HttpsError("invalid-argument", "Valid targetEmail is required");
      }

      const db = getFirestore();
      const requestingUserDoc = await db.collection("users").doc(auth.uid).get();
      if (!requestingUserDoc.exists) {
        throw new HttpsError("not-found", "Requesting user not found");
      }
      const requestingUserData = requestingUserDoc.data();
      if (!requestingUserData) {
        throw new HttpsError("not-found", "Requesting user data not found");
      }

      const requestingUserEmail = normalizeEmail(
        String(requestingUserData.email || ""),
      );
      if (requestingUserEmail === targetEmail) {
        throw new HttpsError(
          "invalid-argument",
          "Cannot transfer organization ownership to yourself",
        );
      }

      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }
      const orgData = orgDoc.data();
      if (!orgData) {
        throw new HttpsError("not-found", "Organization data not found");
      }
      if (orgData.status !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "Organization is not active",
        );
      }

      const memberIds = (orgData.memberIds || []) as string[];
      if (!memberIds.includes(auth.uid)) {
        throw new HttpsError(
          "permission-denied",
          "You are not a member of this organization",
        );
      }

      const requestingUserRoleValue =
        requestingUserData.organizationRoles?.[organizationId];
      if (
        !requestingUserRoleValue ||
        !isValidRole(String(requestingUserRoleValue)) ||
        !isOwner(requestingUserRoleValue)
      ) {
        throw new HttpsError(
          "permission-denied",
          "Only organization owners can transfer ownership",
        );
      }

      const existingMember = await findExistingMemberByEmail(memberIds, targetEmail);

      if (existingMember) {
        auditAction = "organization.transfer.accepted";
        const now = new Date().toISOString();

        const result = await db.runTransaction(async (transaction) => {
          const requestingUserRef = db.collection("users").doc(auth.uid);
          const newOwnerRef = db.collection("users").doc(existingMember.id);
          const orgRef = db.collection("organizations").doc(organizationId);

          const [requestingUserTxDoc, newOwnerTxDoc, orgTxDoc] = await Promise.all(
            [
              transaction.get(requestingUserRef),
              transaction.get(newOwnerRef),
              transaction.get(orgRef),
            ],
          );

          if (!requestingUserTxDoc.exists || !newOwnerTxDoc.exists || !orgTxDoc.exists) {
            throw new HttpsError(
              "failed-precondition",
              "Could not verify current ownership transfer state",
            );
          }

          const requestingTxData = requestingUserTxDoc.data();
          const newOwnerTxData = newOwnerTxDoc.data();
          const orgTxData = orgTxDoc.data();

          if (!requestingTxData || !newOwnerTxData || !orgTxData) {
            throw new HttpsError(
              "failed-precondition",
              "Could not verify current ownership transfer state",
            );
          }

          const txMemberIds = (orgTxData.memberIds || []) as string[];
          if (!txMemberIds.includes(auth.uid) || !txMemberIds.includes(existingMember.id)) {
            throw new HttpsError(
              "failed-precondition",
              "Both users must be organization members",
            );
          }

          const requesterRole = requestingTxData.organizationRoles?.[organizationId];
          if (
            !requesterRole ||
            !isValidRole(String(requesterRole)) ||
            !isOwner(requesterRole)
          ) {
            throw new HttpsError(
              "permission-denied",
              "Only organization owners can transfer ownership",
            );
          }

          const newOwnerRole = newOwnerTxData.organizationRoles?.[organizationId];
          if (!newOwnerRole || !isValidRole(String(newOwnerRole))) {
            throw new HttpsError(
              "failed-precondition",
              "Target user does not have a valid role in this organization",
            );
          }
          if (isOwner(newOwnerRole)) {
            throw new HttpsError(
              "failed-precondition",
              "Selected member is already an owner",
            );
          }
          const newOwnerStatus =
            newOwnerTxData.status === "suspended" ||
            newOwnerTxData.status === "deleted"
              ? newOwnerTxData.status
              : "active";
          if (newOwnerStatus !== "active") {
            throw new HttpsError(
              "failed-precondition",
              "Only active members can become owners",
            );
          }

          transaction.update(requestingUserRef, {
            organizationRoles: {
              ...requestingTxData.organizationRoles,
              [organizationId]: ORGANIZATION_ROLES.MEMBER,
            },
            updatedAt: now,
          });

          transaction.update(newOwnerRef, {
            organizationRoles: {
              ...newOwnerTxData.organizationRoles,
              [organizationId]: ORGANIZATION_ROLES.OWNER,
            },
            updatedAt: now,
          });

          transaction.update(orgRef, { updatedAt: now });
          return {
            newOwnerId: existingMember.id,
            newOwnerName:
              existingMember.name || newOwnerTxData.email || existingMember.id,
          };
        });

        const cancelledCount = await cancelPendingOwnershipTransfers(
          organizationId,
          now,
        );

        if (cancelledCount > 0) {
          await logAuditSuccessForRequest({
            request,
            operationName: "requestOrganizationOwnershipTransfer.cancelPending",
            organizationId,
            action: "organization.transfer.cancelled",
            resource: {
              type: "organizationOwnershipTransfer",
              id: result.newOwnerId,
              name: result.newOwnerName,
            },
            metadata: {
              source: "api",
              sourceDetails: "requestOrganizationOwnershipTransfer.direct",
              customFields: {
                cancelledPendingCount: cancelledCount,
              },
            },
          });
        }

        await logAuditSuccessForRequest({
          request,
          operationName: "requestOrganizationOwnershipTransfer",
          organizationId,
          action: "organization.transfer.accepted",
          resource: {
            type: "organizationOwnershipTransfer",
            id: result.newOwnerId,
            name: result.newOwnerName,
          },
          durationMs: Date.now() - startTime,
          metadata: {
            source: "api",
            sourceDetails: "requestOrganizationOwnershipTransfer.direct",
            customFields: {
              previousOwnerId: auth.uid,
              newOwnerId: result.newOwnerId,
            },
          },
        });

        return {
          success: true,
          mode: "direct",
          message: "Ownership transferred to existing organization member",
          newOwnerId: result.newOwnerId,
        };
      }

      const now = new Date().toISOString();
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { token, tokenHash } = createOwnershipTransferToken();

      const cancelledCount = await cancelPendingOwnershipTransfers(
        organizationId,
        now,
      );

      const transferRef = await db.collection(OWNERSHIP_TRANSFER_COLLECTION).add({
        organizationId,
        requestedBy: auth.uid,
        targetEmail,
        status: "pending",
        tokenHash,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      const acceptUrl = `${buildAppUrl(
        "/accept-organization-transfer",
      )}?token=${encodeURIComponent(token)}`;
      const orgName = String(orgData.name || "your organization");
      const requesterName =
        String(requestingUserData.name || requestingUserData.email || "Owner");

      try {
        const emailService = new ResendEmailService({
          apiKey: resendApiKey.value(),
          defaultFromEmail: resendFromEmail.value(),
          defaultFromName: resendFromName.value(),
        });

        const subject = `${requesterName} invited you to become owner of ${orgName}`;
        const html = `
          <h2>Organization ownership transfer</h2>
          <p>${requesterName} requested to transfer ownership of <strong>${orgName}</strong> to this email address.</p>
          <p>If you accept, they will become a member and you will become the owner.</p>
          <p><a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#166534;color:#fff;text-decoration:none;border-radius:6px;">Review and Accept Transfer</a></p>
          <p>This link expires on ${new Date(expiresAt).toLocaleString("en-US")}.</p>
        `;

        const emailResult = await emailService.sendEmail({
          to: { email: targetEmail },
          from: { email: resendFromEmail.value(), name: resendFromName.value() },
          subject,
          html,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send transfer email");
        }
      } catch (emailError) {
        await transferRef.update({
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        });
        throw new HttpsError(
          "internal",
          `Failed to send transfer email: ${
            emailError instanceof Error ? emailError.message : "Unknown error"
          }`,
        );
      }

      await logAuditSuccessForRequest({
        request,
        operationName: "requestOrganizationOwnershipTransfer",
        organizationId,
        action: "organization.transfer.requested",
        resource: {
          type: "organizationOwnershipTransfer",
          id: transferRef.id,
          name: targetEmail,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "requestOrganizationOwnershipTransfer.email",
          customFields: {
            targetEmail,
            expiresAt,
            cancelledPendingCount: cancelledCount,
          },
        },
      });

      return {
        success: true,
        mode: "email",
        message: "Ownership transfer email sent",
        transferRequestId: transferRef.id,
      };
    } catch (error) {
      loggerService.error("Error requesting organization ownership transfer", error);

      await logAuditFailureForRequest({
        request,
        operationName: "requestOrganizationOwnershipTransfer",
        organizationId: auditOrganizationId,
        action: auditAction,
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditTargetEmail
          ? {
              type: "organizationOwnershipTransfer",
              id: auditTargetEmail,
              name: auditTargetEmail,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "requestOrganizationOwnershipTransfer",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to request ownership transfer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
);
