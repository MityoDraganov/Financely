import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { serviceHost } from "../../services";
import { BillingStatus } from "../../core/entities/organization";
import { INVOICE_STATUSES, normalizeInvoiceStatus } from "../../core/entities/invoice";
import { INVOICE_PAYMENT_SYNC_STATUSES } from "../../core";

const loggerService = serviceHost.getLoggerService();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Maps Stripe subscription status to our BillingStatus type
 */
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
  return statusMap[status] || "incomplete";
}

/**
 * Updates organization billing state in Firestore
 */
async function updateOrgBilling(
  orgId: string,
  billingData: Partial<{
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    status: BillingStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    entitlements: Record<string, boolean>;
  }>
): Promise<void> {
  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  
  const updateData: Record<string, unknown> = {};
  
  if (billingData.stripeCustomerId !== undefined) {
    updateData["billing.stripeCustomerId"] = billingData.stripeCustomerId;
  }
  if (billingData.stripeSubscriptionId !== undefined) {
    updateData["billing.stripeSubscriptionId"] = billingData.stripeSubscriptionId;
  }
  if (billingData.status !== undefined) {
    updateData["billing.status"] = billingData.status;
  }
  if (billingData.currentPeriodEnd !== undefined) {
    updateData["billing.currentPeriodEnd"] = billingData.currentPeriodEnd;
  }
  if (billingData.cancelAtPeriodEnd !== undefined) {
    updateData["billing.cancelAtPeriodEnd"] = billingData.cancelAtPeriodEnd;
  }
  if (billingData.entitlements !== undefined) {
    updateData["billing.entitlements"] = billingData.entitlements;
  }

  await orgRef.update(updateData);
  
  loggerService.info("Updated organization billing", { orgId, billingData });
}

/**
 * Extracts entitlements from Stripe product metadata
 */
function extractEntitlements(product: Stripe.Product): Record<string, boolean> {
  const entitlements: Record<string, boolean> = {};
  
  if (product.metadata) {
    for (const [key, value] of Object.entries(product.metadata)) {
      if (key.startsWith("entitlement_")) {
        const entitlementName = key.replace("entitlement_", "");
        entitlements[entitlementName] = value === "true";
      }
    }
  }
  
  return entitlements;
}

/**
 * Gets the current period end from a subscription
 * Handles different SDK versions where property might be named differently
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | undefined {
  const sub = subscription as unknown as Record<string, unknown>;
  // Try different property names that Stripe SDK might use
  return (sub.current_period_end ?? sub.currentPeriodEnd) as number | undefined;
}

/**
 * Handles checkout.session.completed event
 * Links Stripe customer to organization and activates subscription
 */
async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  const orgId = session.metadata?.organizationId;
  
  if (!orgId) {
    loggerService.warn("checkout.session.completed missing organizationId in metadata", {
      sessionId: session.id,
    });
    return;
  }
  
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  
  if (!subscriptionId) {
    loggerService.info("checkout.session.completed for one-time payment (no subscription)", {
      sessionId: session.id,
      orgId,
    });
    
    await updateOrgBilling(orgId, {
      stripeCustomerId: customerId,
      status: "active",
    });
    return;
  }
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  });
  
  const firstItem = subscription.items.data[0];
  const product = firstItem?.price?.product as Stripe.Product | undefined;
  const entitlements = product ? extractEntitlements(product) : {};
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  
  await updateOrgBilling(orgId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: mapStripeStatus(subscription.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    entitlements,
  });
  
  loggerService.info("Processed checkout.session.completed", {
    orgId,
    customerId,
    subscriptionId,
    status: subscription.status,
  });
}

/**
 * Handles subscription lifecycle events
 */
async function handleSubscriptionEvent(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  eventType: string
): Promise<void> {
  const orgId = subscription.metadata?.organizationId;
  
  if (!orgId) {
    loggerService.warn(`${eventType} missing organizationId in subscription metadata`, {
      subscriptionId: subscription.id,
    });
    return;
  }
  
  const firstItem = subscription.items.data[0];
  let entitlements: Record<string, boolean> = {};
  
  if (firstItem?.price?.product) {
    const productId = typeof firstItem.price.product === "string" 
      ? firstItem.price.product 
      : firstItem.price.product.id;
    
    const product = await stripe.products.retrieve(productId);
    entitlements = extractEntitlements(product);
  }
  
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  
  await updateOrgBilling(orgId, {
    stripeSubscriptionId: subscription.id,
    status: mapStripeStatus(subscription.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    entitlements,
  });
  
  loggerService.info(`Processed ${eventType}`, {
    orgId,
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

/**
 * Gets organization ID from invoice metadata
 * Handles different SDK versions where properties might be nested differently
 * Note: In newer API versions, subscription metadata might not be copied to invoice
 */
function getInvoiceOrgIdFromMetadata(invoice: Stripe.Invoice): string | undefined {
  const inv = invoice as unknown as Record<string, unknown>;
  
  // Try to get from subscription_details.metadata (direct)
  const directSubDetails = inv.subscription_details as Record<string, unknown> | undefined;
  if (directSubDetails?.metadata) {
    const orgId = (directSubDetails.metadata as Record<string, string>).organizationId;
    if (orgId) return orgId;
  }
  
  // Try parent.subscription_details.metadata (newer API)
  const parent = inv.parent as Record<string, unknown> | undefined;
  if (parent?.subscription_details) {
    const subDetails = parent.subscription_details as Record<string, unknown>;
    if (subDetails.metadata) {
      const orgId = (subDetails.metadata as Record<string, string>).organizationId;
      if (orgId) return orgId;
    }
  }
  
  return undefined;
}

/**
 * Looks up organization ID by Stripe subscription ID in Firestore
 */
async function getOrgIdBySubscriptionId(subscriptionId: string): Promise<string | undefined> {
  const db = getFirestore();
  const orgsSnapshot = await db
    .collection("organizations")
    .where("billing.stripeSubscriptionId", "==", subscriptionId)
    .limit(1)
    .get();
  
  if (orgsSnapshot.empty) {
    return undefined;
  }
  
  return orgsSnapshot.docs[0].id;
}

/**
 * Gets subscription ID from invoice
 * Handles different SDK/API versions where subscription might be:
 * - invoice.subscription (older)
 * - invoice.parent.subscription_details.subscription (newer, 2025+ API)
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as Record<string, unknown>;
  
  // Try direct subscription field first (older API versions)
  const directSub = inv.subscription;
  if (typeof directSub === "string") return directSub;
  if (directSub && typeof directSub === "object" && "id" in directSub) {
    return (directSub as { id: string }).id;
  }
  
  // Try parent.subscription_details.subscription (newer API versions like 2025-11-17.clover)
  const parent = inv.parent as Record<string, unknown> | undefined;
  if (parent?.subscription_details) {
    const subDetails = parent.subscription_details as Record<string, unknown>;
    const subFromParent = subDetails.subscription;
    if (typeof subFromParent === "string") return subFromParent;
    if (subFromParent && typeof subFromParent === "object" && "id" in subFromParent) {
      return (subFromParent as { id: string }).id;
    }
  }
  
  return null;
}

/**
 * Finds a local invoice for a Stripe invoice from a connected account.
 * Primary lookup is metadata.internalInvoiceId, fallback is payment.stripeInvoiceId.
 */
async function getInternalInvoiceDocForConnectedInvoice(
  invoice: Stripe.Invoice
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const db = getFirestore();
  const internalInvoiceId = invoice.metadata?.internalInvoiceId;

  if (internalInvoiceId) {
    const directDoc = await db.collection("invoices").doc(internalInvoiceId).get();
    if (directDoc.exists) {
      return directDoc;
    }
  }

  const byStripeInvoice = await db
    .collection("invoices")
    .where("payment.stripeInvoiceId", "==", invoice.id)
    .limit(1)
    .get();

  if (!byStripeInvoice.empty) {
    return byStripeInvoice.docs[0];
  }

  return null;
}

/**
 * Handles invoice lifecycle events from Stripe connected accounts.
 * Returns true when an internal invoice was matched and processed.
 */
async function handleConnectedAccountInvoiceEvent(
  event: Stripe.Event,
  invoice: Stripe.Invoice
): Promise<boolean> {
  if (!event.account) {
    return false;
  }

  const internalInvoiceDoc = await getInternalInvoiceDocForConnectedInvoice(invoice);
  if (!internalInvoiceDoc) {
    loggerService.info("Connected account invoice event has no internal invoice mapping", {
      stripeInvoiceId: invoice.id,
      eventId: event.id,
      eventType: event.type,
      account: event.account,
    });
    return false;
  }

  const db = getFirestore();
  const invoiceRef = internalInvoiceDoc.ref;
  await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(invoiceRef);
    if (!currentSnap.exists) {
      return;
    }

    const currentData = currentSnap.data() as Record<string, unknown>;
    const currentPayment = (currentData.payment || {}) as Record<string, unknown>;
    if (shouldSkipConnectedInvoiceEvent(currentPayment, event.id)) {
      return;
    }
    const updateData = buildConnectedInvoiceUpdateData({
      currentData,
      invoice,
      eventType: event.type,
      eventId: event.id,
      eventAccount: event.account!,
      eventCreated: event.created,
    });
    transaction.update(invoiceRef, updateData);
  });

  loggerService.info("Processed connected account invoice event", {
    invoiceId: internalInvoiceDoc.id,
    stripeInvoiceId: invoice.id,
    eventType: event.type,
    eventId: event.id,
    account: event.account,
  });
  return true;
}

export function shouldSkipConnectedInvoiceEvent(
  currentPayment: Record<string, unknown>,
  eventId: string
): boolean {
  return currentPayment.lastStripeEventId === eventId;
}

export function buildConnectedInvoiceUpdateData(params: {
  currentData: Record<string, unknown>;
  invoice: Stripe.Invoice;
  eventType: string;
  eventId: string;
  eventAccount: string;
  eventCreated: number;
}): Record<string, unknown> {
  const {
    currentData,
    invoice,
    eventType,
    eventId,
    eventAccount,
    eventCreated,
  } = params;

  const currentPayment = (currentData.payment || {}) as Record<string, unknown>;
  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  const nextPayment: Record<string, unknown> = {
    ...currentPayment,
    provider: "stripe",
    connectAccountId: eventAccount,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: stripeCustomerId || currentPayment.stripeCustomerId,
    hostedInvoiceUrl: invoice.hosted_invoice_url || currentPayment.hostedInvoiceUrl,
    syncStatus: INVOICE_PAYMENT_SYNC_STATUSES.SYNCED,
    lastSyncedAt: new Date().toISOString(),
    stripeInvoiceStatus: invoice.status || currentPayment.stripeInvoiceStatus,
    lastStripeEventId: eventId,
    lastStripeEventType: eventType,
    lastStripeEventAt: new Date(eventCreated * 1000).toISOString(),
  };

  if (eventType === "invoice.payment_failed") {
    nextPayment.lastSyncError = "payment_failed";
  }

  const updateData: Record<string, unknown> = {
    payment: nextPayment,
  };

  const currentStatus = normalizeInvoiceStatus(currentData.status as string | undefined);
  if (eventType === "invoice.paid") {
    const paidAtUnix = invoice.status_transitions?.paid_at;
    updateData.status = INVOICE_STATUSES.PAID;
    updateData.paidAt = paidAtUnix
      ? new Date(paidAtUnix * 1000).toISOString()
      : new Date().toISOString();
  } else if (eventType === "invoice.payment_failed") {
    if (currentStatus !== INVOICE_STATUSES.PAID && currentStatus !== INVOICE_STATUSES.CANCELLED) {
      updateData.status = INVOICE_STATUSES.SENT;
    }
    if (currentStatus !== INVOICE_STATUSES.PAID) {
      updateData.paidAt = "";
    }
  }

  return updateData;
}

/**
 * Handles invoice.paid event - confirms active access
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  
  if (!subscriptionId) {
    loggerService.info("invoice.paid for non-subscription invoice", {
      invoiceId: invoice.id,
    });
    return;
  }
  
  // Try to get orgId from invoice metadata first
  let orgId = getInvoiceOrgIdFromMetadata(invoice);
  
  // If not found in metadata, look up by subscription ID in Firestore
  if (!orgId) {
    orgId = await getOrgIdBySubscriptionId(subscriptionId);
  }
  
  if (!orgId) {
    loggerService.warn("invoice.paid - could not find organization for subscription", {
      invoiceId: invoice.id,
      subscriptionId,
    });
    return;
  }
  
  await updateOrgBilling(orgId, {
    status: "active",
  });
  
  loggerService.info("Processed invoice.paid - confirmed active access", {
    orgId,
    invoiceId: invoice.id,
    subscriptionId,
  });
}

/**
 * Handles invoice.payment_failed event - triggers past_due state
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  
  if (!subscriptionId) {
    return;
  }
  
  // Try to get orgId from invoice metadata first
  let orgId = getInvoiceOrgIdFromMetadata(invoice);
  
  // If not found in metadata, look up by subscription ID in Firestore
  if (!orgId) {
    orgId = await getOrgIdBySubscriptionId(subscriptionId);
  }
  
  if (!orgId) {
    loggerService.warn("invoice.payment_failed - could not find organization for subscription", {
      invoiceId: invoice.id,
      subscriptionId,
    });
    return;
  }
  
  await updateOrgBilling(orgId, {
    status: "past_due",
  });
  
  loggerService.info("Processed invoice.payment_failed - set past_due status", {
    orgId,
    invoiceId: invoice.id,
    subscriptionId,
  });
}

/**
 * HTTP Cloud Function triggered by Stripe webhook events
 * 
 * Receives webhooks from Stripe for subscription lifecycle events
 * and syncs billing state to Firestore.
 * 
 * Setup in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/onStripeWebhook
 * 3. Subscribe to events:
 *    - checkout.session.completed
 *    - customer.subscription.created
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - invoice.paid
 *    - invoice.payment_failed
 * 4. Copy the signing secret and add to Firebase:
 *    firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 */
export const onStripeWebhook = onRequest(
  {
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
    secrets: [stripeSecretKey, stripeWebhookSecret],
    cors: true,
    region: "us-central1",
  },
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value());
    
    const signature = request.headers["stripe-signature"] as string;
    
    if (!signature) {
      loggerService.error("Missing Stripe signature header");
      response.status(400).send("Missing Stripe signature");
      return;
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      loggerService.error("Webhook signature verification failed", { error: message });
      response.status(400).send(`Webhook Error: ${message}`);
      return;
    }
    
    loggerService.info("Received Stripe webhook", {
      type: event.type,
      id: event.id,
    });
    
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          if (event.account) {
            loggerService.info("Ignoring connected-account checkout.session.completed for platform billing sync", {
              eventId: event.id,
              account: event.account,
            });
            break;
          }
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutCompleted(stripe, session);
          break;
        }
        
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          if (event.account) {
            loggerService.info("Ignoring connected-account subscription event for platform billing sync", {
              type: event.type,
              eventId: event.id,
              account: event.account,
            });
            break;
          }
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionEvent(stripe, subscription, event.type);
          break;
        }
        
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const handledConnected = await handleConnectedAccountInvoiceEvent(event, invoice);
          if (handledConnected) {
            break;
          }
          await handleInvoicePaid(invoice);
          break;
        }
        
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const handledConnected = await handleConnectedAccountInvoiceEvent(event, invoice);
          if (handledConnected) {
            break;
          }
          await handleInvoicePaymentFailed(invoice);
          break;
        }

        case "invoice.updated":
        case "invoice.finalized": {
          const invoice = event.data.object as Stripe.Invoice;
          if (event.account) {
            await handleConnectedAccountInvoiceEvent(event, invoice);
          }
          break;
        }
        
        default:
          loggerService.info("Unhandled Stripe event type", { type: event.type });
      }
      
      response.status(200).json({ received: true });
    } catch (error) {
      loggerService.error("Error processing Stripe webhook", {
        type: event.type,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      response.status(500).json({ error: "Webhook handler failed" });
    }
  }
);
