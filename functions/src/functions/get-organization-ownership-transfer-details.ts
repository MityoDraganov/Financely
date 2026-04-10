import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import {
  hashOwnershipTransferToken,
  isOwnershipTransferExpired,
  OWNERSHIP_TRANSFER_COLLECTION,
} from "./organization-ownership-transfer-utils";

interface GetOrganizationOwnershipTransferDetailsPayload {
  token: string;
}

interface GetOrganizationOwnershipTransferDetailsResponse {
  success: boolean;
  transfer: {
    id: string;
    organizationId: string;
    organizationName: string;
    targetEmail: string;
    requestedByName: string;
    status: "pending" | "accepted" | "cancelled" | "expired";
    expiresAt: string;
    isExpired: boolean;
  };
}

export const getOrganizationOwnershipTransferDetails = onCall<
  GetOrganizationOwnershipTransferDetailsPayload,
  Promise<GetOrganizationOwnershipTransferDetailsResponse>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request) => {
    try {
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

      const organizationId = String(transferData.organizationId || "");
      if (!organizationId) {
        throw new HttpsError(
          "failed-precondition",
          "Transfer request is missing organizationId",
        );
      }

      let status = String(transferData.status || "pending") as
        | "pending"
        | "accepted"
        | "cancelled"
        | "expired";
      const expiresAt = String(transferData.expiresAt || "");
      const isExpired = !expiresAt || isOwnershipTransferExpired(expiresAt);

      if (status === "pending" && isExpired) {
        status = "expired";
        await transferDoc.ref.update({
          status: "expired",
          updatedAt: new Date().toISOString(),
        });
      }

      const [organizationDoc, requesterDoc] = await Promise.all([
        db.collection("organizations").doc(organizationId).get(),
        db.collection("users").doc(String(transferData.requestedBy || "")).get(),
      ]);

      const organizationName = organizationDoc.exists
        ? String(organizationDoc.data()?.name || "Organization")
        : "Organization";

      const requestedByName = requesterDoc.exists
        ? String(
            requesterDoc.data()?.name ||
              requesterDoc.data()?.email ||
              transferData.requestedBy ||
              "Organization owner",
          )
        : "Organization owner";

      return {
        success: true,
        transfer: {
          id: transferDoc.id,
          organizationId,
          organizationName,
          targetEmail: String(transferData.targetEmail || ""),
          requestedByName,
          status,
          expiresAt,
          isExpired,
        },
      };
    } catch (error) {
      loggerService.error(
        "Error getting organization ownership transfer details",
        error,
      );
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to get transfer details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
);
