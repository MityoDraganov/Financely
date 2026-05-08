import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { DatabaseCollection } from "../repositories/config";
import { loggerService } from "../services/logger-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { normalizeCurrencyCode } from "../utils/organization-currency-policy";

interface SyncProductCurrenciesPayload {
  organizationId: string;
}

interface SyncProductCurrenciesResponse {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  currency: string;
}

const WRITE_BATCH_SIZE = 400;

/**
 * Sync every product in an organization to use the organization's default
 * currency. Numeric amounts are NOT converted; only the `currency` field is
 * updated. Intended to be called immediately after the organization's default
 * currency has been changed in settings, to keep products writable under the
 * `productCurrencyMatchesOrganization` Firestore rule.
 */
export const syncProductCurrencies = onCall<
  SyncProductCurrenciesPayload,
  Promise<SyncProductCurrenciesResponse>
>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;

    try {
      const payload = request.data;
      if (!payload || !payload.organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "organizationId is required",
        );
      }
      auditOrganizationId = payload.organizationId;

      await verifyAuthAndOrgMembership(request, payload.organizationId, {
        requireOwnerOrAdmin: true,
        requireWriteAccess: true,
      });

      const db = getFirestore();
      const orgDoc = await db
        .collection(DatabaseCollection.ORGANIZATIONS)
        .doc(payload.organizationId)
        .get();
      const orgData = orgDoc.data();
      const targetCurrency = normalizeCurrencyCode(
        orgData?.settings?.defaultCurrency,
      );
      if (!targetCurrency) {
        throw new HttpsError(
          "failed-precondition",
          "Organization does not have a valid default currency set",
        );
      }

      const productsSnapshot = await db
        .collection(DatabaseCollection.PRODUCTS)
        .where("organizationId", "==", payload.organizationId)
        .get();

      let scannedCount = 0;
      let skippedCount = 0;
      const mismatched: Array<{ id: string; previousCurrency: string | null }> = [];

      for (const doc of productsSnapshot.docs) {
        scannedCount += 1;
        const data = doc.data();
        const currentCurrency = normalizeCurrencyCode(data?.currency);
        if (currentCurrency === targetCurrency) {
          skippedCount += 1;
          continue;
        }
        mismatched.push({
          id: doc.id,
          previousCurrency: currentCurrency,
        });
      }

      let updatedCount = 0;
      let failedCount = 0;
      const now = new Date().toISOString();

      for (let i = 0; i < mismatched.length; i += WRITE_BATCH_SIZE) {
        const chunk = mismatched.slice(i, i + WRITE_BATCH_SIZE);
        const batch = db.batch();
        for (const entry of chunk) {
          const ref = db
            .collection(DatabaseCollection.PRODUCTS)
            .doc(entry.id);
          batch.update(ref, {
            currency: targetCurrency,
            updatedAt: now,
          });
        }
        try {
          await batch.commit();
          updatedCount += chunk.length;
        } catch (error) {
          failedCount += chunk.length;
          loggerService.error("Failed to commit product currency sync batch", {
            organizationId: payload.organizationId,
            chunkSize: chunk.length,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result: SyncProductCurrenciesResponse = {
        scannedCount,
        updatedCount,
        skippedCount,
        failedCount,
        currency: targetCurrency,
      };

      loggerService.info("Product currencies sync completed", {
        organizationId: payload.organizationId,
        ...result,
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "syncProductCurrencies",
        organizationId: payload.organizationId,
        action: "product.updated",
        resource: {
          type: "organization",
          id: payload.organizationId,
          name: orgData?.name || payload.organizationId,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "syncProductCurrencies",
          customFields: {
            currency: targetCurrency,
            scannedCount,
            updatedCount,
            skippedCount,
            failedCount,
          },
        },
      });

      return result;
    } catch (error) {
      loggerService.error("Failed to sync product currencies", error);

      await logAuditFailureForRequest({
        request,
        operationName: "syncProductCurrencies",
        organizationId: auditOrganizationId,
        action: "product.updated",
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: {
          source: "api",
          sourceDetails: "syncProductCurrencies",
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to sync product currencies: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
);
