import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { serviceHost } from "../../services";

const loggerService = serviceHost.getLoggerService();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

interface CreateCheckoutSessionRequest {
  orgId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Creates a Stripe Checkout session for subscription purchase
 * 
 * The session includes organizationId in metadata so the webhook
 * can link the subscription to the correct organization.
 */
export const createCheckoutSession = onCall<
  CreateCheckoutSessionRequest,
  Promise<CreateCheckoutSessionResponse>
>(
  {
    secrets: [stripeSecretKey],
    region: "us-central1",
  },
  async (request) => {
    const { orgId, priceId, successUrl, cancelUrl } = request.data;

    if (!orgId || !priceId || !successUrl || !cancelUrl) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: orgId, priceId, successUrl, cancelUrl"
      );
    }

    // Verify user is authenticated and has permission (owner/admin)
    // Skip billing check since this is the function to initiate billing
    await verifyAuthAndOrgMembership(request, orgId, {
      requireOwnerOrAdmin: true,
      skipBillingCheck: true,
    });

    const stripe = new Stripe(stripeSecretKey.value());

    const db = getFirestore();
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgData = orgDoc.data();

    if (!orgData) {
      throw new HttpsError("not-found", "Organization not found");
    }

    // Check if org already has a Stripe customer
    let customerId = orgData.billing?.stripeCustomerId;

    if (!customerId) {
      // Create a new Stripe customer for this organization
      const customer = await stripe.customers.create({
        metadata: {
          organizationId: orgId,
          organizationName: orgData.name,
        },
      });
      customerId = customer.id;

      // Save the customer ID to Firestore
      await db.collection("organizations").doc(orgId).update({
        "billing.stripeCustomerId": customerId,
      });

      loggerService.info("Created Stripe customer for organization", {
        orgId,
        customerId,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          organizationId: orgId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organizationId: orgId,
      },
    });

    loggerService.info("Created Stripe checkout session", {
      orgId,
      sessionId: session.id,
      priceId,
    });

    if (!session.url) {
      throw new HttpsError("internal", "Failed to create checkout session URL");
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }
);
