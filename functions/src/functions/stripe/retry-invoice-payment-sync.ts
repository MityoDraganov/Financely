import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { syncStripeInvoiceForInternalInvoice } from "../../services/stripe-invoice-payment-sync";
import { isOrganizationConnectReady } from "../../services/stripe-connect-payments";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface RetryInvoicePaymentSyncRequest {
  orgId: string;
  invoiceId: string;
}

interface RetryInvoicePaymentSyncResponse {
  status: "already_synced" | "synced" | "sync_failed";
  payment?: Record<string, unknown>;
  error?: string;
}

export const retryInvoicePaymentSync = onCall<
  RetryInvoicePaymentSyncRequest,
  Promise<RetryInvoicePaymentSyncResponse>
>(
  {
    secrets: [stripeSecretKey],
    region: "us-central1",
  },
  async (request) => {
    const { orgId, invoiceId } = request.data;
    if (!orgId || !invoiceId) {
      throw new HttpsError("invalid-argument", "Missing orgId or invoiceId");
    }

    await verifyAuthAndOrgMembership(request, orgId, {
      requireOwnerOrAdmin: true,
      skipBillingCheck: true,
    });

    const db = getFirestore();
    const [orgSnap, invoiceSnap] = await Promise.all([
      db.collection("organizations").doc(orgId).get(),
      db.collection("invoices").doc(invoiceId).get(),
    ]);

    if (!orgSnap.exists) {
      throw new HttpsError("not-found", "Organization not found");
    }
    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found");
    }

    const orgData = orgSnap.data() as Record<string, any>;
    const invoiceData = invoiceSnap.data() as Record<string, any>;

    if (invoiceData.orgId !== orgId) {
      throw new HttpsError("permission-denied", "Invoice does not belong to this organization");
    }

    if (!isOrganizationConnectReady(orgData?.payments)) {
      throw new HttpsError(
        "failed-precondition",
        "Stripe Connect onboarding is not complete. Complete onboarding before syncing invoice payments."
      );
    }

    const result = await syncStripeInvoiceForInternalInvoice({
      stripeSecretKey: stripeSecretKey.value(),
      invoiceId,
      force: true,
    });

    if (result.status === "sync_failed") {
      throw new HttpsError(
        "failed-precondition",
        result.error || "Failed to sync invoice payment with Stripe"
      );
    }

    if (result.status === "skipped_not_ready") {
      throw new HttpsError(
        "failed-precondition",
        result.reason || "Stripe Connect onboarding is not complete"
      );
    }

    return {
      status: result.status,
      payment: result.payment as unknown as Record<string, unknown>,
    };
  }
);
