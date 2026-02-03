import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { verifyAuthAndOrgMembership } from "../../utils/auth-utils";
import { BillingStatus } from "../../core/entities/organization";

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

export interface GetStripeBillingResponse {
  status: BillingStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  entitlements: Record<string, boolean>;
  planName?: string;
  planAmount?: number;
  planCurrency?: string;
  planInterval?: string;
}

function mapStripeStatus(status: Stripe.Subscription.Status): BillingStatus {
  const statusMap: Record<Stripe.Subscription.Status, BillingStatus> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    unpaid: "unpaid",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "incomplete",
    paused: "paused",
  };
  return statusMap[status] ?? "incomplete";
}

function extractEntitlements(product: Stripe.Product | Stripe.DeletedProduct): Record<string, boolean> {
  const entitlements: Record<string, boolean> = {};
  if (product.deleted || !("metadata" in product) || !product.metadata) {
    return entitlements;
  }
  for (const [key, value] of Object.entries(product.metadata)) {
    if (key.startsWith("entitlement_")) {
      entitlements[key.replace("entitlement_", "")] = value === "true";
    }
  }
  return entitlements;
}

/**
 * Returns current subscription billing info from Stripe (period end, renewal, status).
 * Used so the billing UI shows live Stripe data instead of Firestore cache.
 */
export const getStripeBilling = onCall<
  { orgId: string },
  Promise<GetStripeBillingResponse | null>
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
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgData = orgDoc.data();
    const subscriptionId = orgData?.billing?.stripeSubscriptionId;

    if (!subscriptionId) {
      return null;
    }

    const stripe = new Stripe(stripeSecretKey.value());
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price.product"],
    });

    const firstItem = subscription.items.data[0];
    let entitlements: Record<string, boolean> = {};
    let planName: string | undefined;
    let planAmount: number | undefined;
    let planCurrency: string | undefined;
    let planInterval: string | undefined;

    if (firstItem?.price?.product) {
      const product =
        typeof firstItem.price.product === "string"
          ? await stripe.products.retrieve(firstItem.price.product)
          : firstItem.price.product;
      entitlements = extractEntitlements(product);
      if (!product.deleted && "name" in product) {
        planName = product.name ?? undefined;
      }
    }
    if (firstItem?.price) {
      const price = firstItem.price;
      planAmount = price.unit_amount ?? undefined;
      planCurrency = price.currency ?? undefined;
      planInterval = price.recurring?.interval ?? undefined;
    }

    const periodEnd = firstItem?.current_period_end;
    const currentPeriodEnd = periodEnd != null ? new Date(periodEnd * 1000).toISOString() : "";

    const cancelAt = (subscription as { cancel_at?: number | null }).cancel_at;
    const now = Math.floor(Date.now() / 1000);
    const willCancelAtPeriodEnd =
      subscription.cancel_at_period_end === true || (cancelAt != null && cancelAt > now);

    return {
      status: mapStripeStatus(subscription.status),
      currentPeriodEnd,
      cancelAtPeriodEnd: willCancelAtPeriodEnd,
      entitlements,
      planName,
      planAmount,
      planCurrency,
      planInterval,
    };
  }
);
