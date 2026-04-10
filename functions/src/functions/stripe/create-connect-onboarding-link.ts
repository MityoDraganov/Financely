import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { buildOrganizationPaymentsFromStripeAccount } from "../../services/stripe-connect-payments";
import { loggerService } from "../../services/logger-service";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface CreateConnectOnboardingLinkRequest {
  orgId: string;
  returnUrl: string;
  refreshUrl: string;
}

interface CreateConnectOnboardingLinkResponse {
  url: string;
  accountId: string;
  payments: ReturnType<typeof buildOrganizationPaymentsFromStripeAccount>;
}

export const createConnectOnboardingLink = onCall<
  CreateConnectOnboardingLinkRequest,
  Promise<CreateConnectOnboardingLinkResponse>
>(
  {
    secrets: [stripeSecretKey],
    region: "us-central1",
  },
  async (request) => {
    const { orgId, returnUrl, refreshUrl } = request.data;

    if (!orgId || !returnUrl || !refreshUrl) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: orgId, returnUrl, refreshUrl"
      );
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
    const stripe = new Stripe(stripeSecretKey.value());
    const countrySetting =
      typeof orgData?.settings?.country === "string" ? orgData.settings.country.trim() : "";
    const normalizedCountry =
      /^[A-Za-z]{2}$/.test(countrySetting) ? countrySetting.toUpperCase() : undefined;

    let connectAccountId = orgData?.payments?.connectAccountId as string | undefined;
    if (!connectAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: normalizedCountry,
        email: typeof orgData?.settings?.email === "string" ? orgData.settings.email : undefined,
        business_profile: {
          name: typeof orgData?.name === "string" ? orgData.name : undefined,
          url: typeof orgData?.website === "string" ? orgData.website : undefined,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          organizationId: orgId,
          organizationName: typeof orgData?.name === "string" ? orgData.name : "",
        },
      });
      connectAccountId = account.id;
    }

    const link = await stripe.accountLinks.create({
      account: connectAccountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    const account = await stripe.accounts.retrieve(connectAccountId);
    const payments = buildOrganizationPaymentsFromStripeAccount({
      account,
      existing: orgData?.payments,
      onboardingLinkCreatedAt: new Date().toISOString(),
    });

    await orgRef.update({
      payments,
    });

    loggerService.info("Created Stripe Connect onboarding link", {
      orgId,
      connectAccountId,
    });

    return {
      url: link.url,
      accountId: connectAccountId,
      payments,
    };
  }
);
