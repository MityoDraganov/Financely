import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { serviceHost } from "../../services";

const loggerService = serviceHost.getLoggerService();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface CreatePortalSessionRequest {
  orgId: string;
  returnUrl: string;
}

interface CreatePortalSessionResponse {
  url: string;
}

/**
 * Creates a Stripe Customer Portal session for subscription management
 * 
 * Allows org owners/admins to manage their subscription, update payment methods,
 * view invoices, and cancel their subscription.
 */
export const createPortalSession = onCall<
  CreatePortalSessionRequest,
  Promise<CreatePortalSessionResponse>
>(
  {
    secrets: [stripeSecretKey],
    region: "us-central1",
  },
  async (request) => {
    const { orgId, returnUrl } = request.data;

    if (!orgId || !returnUrl) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: orgId, returnUrl"
      );
    }

    // Verify user is authenticated and has permission (owner/admin)
    // Skip billing check since this is used to fix billing issues
    await verifyAuthAndOrgMembership(request, orgId, {
      requireOwnerOrAdmin: true,
      skipBillingCheck: true,
    });

    const db = getFirestore();
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgData = orgDoc.data();

    if (!orgData) {
      throw new HttpsError("not-found", "Organization not found");
    }

    const customerId = orgData.billing?.stripeCustomerId;

    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No billing account found. Please subscribe to a plan first."
      );
    }

    const stripe = new Stripe(stripeSecretKey.value());

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    loggerService.info("Created Stripe portal session", {
      orgId,
      customerId,
    });

    return {
      url: session.url,
    };
  }
);
