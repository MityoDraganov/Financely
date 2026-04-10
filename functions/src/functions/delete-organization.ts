import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { isOwner, isValidRole } from "../core/roles";
import { loggerService } from "../services/logger-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { cancelPendingOwnershipTransfers } from "./organization-ownership-transfer-utils";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface DeleteOrganizationPayload {
  organizationId: string;
  confirmName: string;
}

interface DeleteOrganizationResponse {
  success: boolean;
  message: string;
}

export const deleteOrganization = onCall<
  DeleteOrganizationPayload,
  Promise<DeleteOrganizationResponse>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;

    try {
      const organizationId = String(request.data.organizationId || "").trim();
      const confirmName = String(request.data.confirmName || "").trim();
      auditOrganizationId = organizationId;

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "organizationId is required");
      }
      if (!confirmName) {
        throw new HttpsError("invalid-argument", "confirmName is required");
      }

      const authResult = await verifyAuthAndOrgMembership(request, organizationId, {
        requireOwner: true,
        skipBillingCheck: true,
      });

      const db = getFirestore();
      const orgRef = db.collection("organizations").doc(organizationId);
      const orgDoc = await orgRef.get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }
      const orgData = orgDoc.data();
      if (!orgData) {
        throw new HttpsError("not-found", "Organization data not found");
      }
      if (orgData.status !== "active") {
        throw new HttpsError("failed-precondition", "Organization is not active");
      }
      if (confirmName !== String(orgData.name || "")) {
        throw new HttpsError(
          "invalid-argument",
          "Organization name confirmation does not match",
        );
      }

      const stripeSubscriptionId = String(
        orgData.billing?.stripeSubscriptionId || "",
      ).trim();
      if (stripeSubscriptionId) {
        const stripe = new Stripe(stripeSecretKey.value());
        try {
          const subscription =
            await stripe.subscriptions.retrieve(stripeSubscriptionId);
          if (subscription.status !== "canceled") {
            await stripe.subscriptions.cancel(stripeSubscriptionId);
          }
        } catch (stripeError) {
          loggerService.error(
            "Failed to cancel Stripe subscription before organization delete",
            stripeError,
          );
          throw new HttpsError(
            "failed-precondition",
            "Could not cancel organization subscription. Delete aborted.",
          );
        }
      }

      const now = new Date().toISOString();
      const memberIds = (orgData.memberIds || []) as string[];

      if (memberIds.length > 400) {
        throw new HttpsError(
          "failed-precondition",
          "Organization is too large for one-step delete; contact support.",
        );
      }

      await db.runTransaction(async (transaction) => {
        const orgTxDoc = await transaction.get(orgRef);
        if (!orgTxDoc.exists) {
          throw new HttpsError("not-found", "Organization not found");
        }
        const orgTxData = orgTxDoc.data();
        if (!orgTxData) {
          throw new HttpsError("not-found", "Organization data not found");
        }
        if (orgTxData.status !== "active") {
          throw new HttpsError(
            "failed-precondition",
            "Organization is no longer active",
          );
        }

        const requesterRef = db.collection("users").doc(authResult.userId);
        const requesterDoc = await transaction.get(requesterRef);
        if (!requesterDoc.exists) {
          throw new HttpsError("not-found", "Requesting user not found");
        }
        const requesterData = requesterDoc.data();
        if (!requesterData) {
          throw new HttpsError("not-found", "Requesting user data not found");
        }
        const requesterRole = requesterData.organizationRoles?.[organizationId];
        if (
          !requesterRole ||
          !isValidRole(String(requesterRole)) ||
          !isOwner(requesterRole)
        ) {
          throw new HttpsError(
            "permission-denied",
            "Only organization owners can delete organization",
          );
        }

        const txMemberIds = (orgTxData.memberIds || []) as string[];
        const memberRefs = txMemberIds.map((memberId) =>
          db.collection("users").doc(memberId),
        );
        const memberDocs = await Promise.all(
          memberRefs.map((memberRef) => transaction.get(memberRef)),
        );

        memberDocs.forEach((memberDoc) => {
          if (!memberDoc.exists) return;
          const memberData = memberDoc.data();
          if (!memberData) return;

          const nextRoles = { ...(memberData.organizationRoles || {}) };
          delete nextRoles[organizationId];

          const updatePayload: Record<string, unknown> = {
            organizationRoles: nextRoles,
            updatedAt: now,
          };

          if (memberData.defaultOrganizationId === organizationId) {
            updatePayload.defaultOrganizationId = FieldValue.delete();
          }

          transaction.update(memberDoc.ref, updatePayload);
        });

        transaction.update(orgRef, {
          status: "deleted",
          memberIds: [],
          "billing.status": "canceled",
          "billing.cancelAtPeriodEnd": false,
          updatedAt: now,
        });
      });

      const cancelledTransfers = await cancelPendingOwnershipTransfers(
        organizationId,
        now,
        { status: "cancelled", acceptedBy: authResult.userId },
      );

      if (cancelledTransfers > 0) {
        await logAuditSuccessForRequest({
          request,
          operationName: "deleteOrganization.cancelPendingTransfers",
          organizationId,
          action: "organization.transfer.cancelled",
          resource: {
            type: "organization",
            id: organizationId,
            name: String(orgData.name || organizationId),
          },
          metadata: {
            source: "api",
            sourceDetails: "deleteOrganization",
            customFields: {
              cancelledPendingTransfers: cancelledTransfers,
            },
          },
        });
      }

      await logAuditSuccessForRequest({
        request,
        operationName: "deleteOrganization",
        organizationId,
        action: "organization.deleted",
        resource: {
          type: "organization",
          id: organizationId,
          name: String(orgData.name || organizationId),
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "deleteOrganization",
          customFields: {
            removedMemberCount: memberIds.length,
            subscriptionCancelled: Boolean(stripeSubscriptionId),
          },
        },
      });

      return {
        success: true,
        message: "Organization deleted successfully",
      };
    } catch (error) {
      loggerService.error("Error deleting organization", error);

      await logAuditFailureForRequest({
        request,
        operationName: "deleteOrganization",
        organizationId: auditOrganizationId,
        action: "organization.deleted",
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          source: "api",
          sourceDetails: "deleteOrganization",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to delete organization: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
);
