import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { buildOrganizationPaymentsFromStripeAccount } from "../../services/stripe-connect-payments";
import { loggerService } from "../../services/logger-service";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface GetConnectAccountStatusRequest {
  orgId: string;
}

interface GetConnectAccountStatusResponse {
  payments: ReturnType<typeof buildOrganizationPaymentsFromStripeAccount> | null;
}

export const getConnectAccountStatus = onCall<
  GetConnectAccountStatusRequest,
  Promise<GetConnectAccountStatusResponse>
>(
  {
    secrets: [stripeSecretKey],
    region: "us-central1",
  },
  async (request) => {
    const { orgId } = request.data;
    if (!orgId) {
      throw new HttpsError("invalid-argument", "Missing orgId");
    }

    await verifyAuthAndOrgMembership(request, orgId, {
      requireOwnerOrAdmin: true,
      skipBillingCheck: true,
    });

    const db = getFirestore();
    const orgRef = db.collection("organizations").doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw new HttpsError("not-found", "Organization not found");
    }

    const orgData = orgSnap.data() as Record<string, any>;
    const connectAccountId = orgData?.payments?.connectAccountId as string | undefined;
    if (!connectAccountId) {
      return { payments: null };
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const account = await stripe.accounts.retrieve(connectAccountId);
    const payments = buildOrganizationPaymentsFromStripeAccount({
      account,
      existing: orgData?.payments,
    });

    await orgRef.update({
      payments,
    });

    loggerService.info("Refreshed Stripe Connect account status", {
      orgId,
      connectAccountId,
      status: payments.status,
      chargesEnabled: payments.chargesEnabled,
      payoutsEnabled: payments.payoutsEnabled,
    });

    return { payments };
  }
);
