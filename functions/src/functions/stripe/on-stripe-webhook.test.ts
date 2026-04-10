import assert from "node:assert";
import { test } from "node:test";
import Stripe from "stripe";
import {
  buildConnectedInvoiceUpdateData,
  shouldSkipConnectedInvoiceEvent,
} from "./on-stripe-webhook";

const makeStripeInvoice = (
  overrides?: Partial<Stripe.Invoice>
): Stripe.Invoice =>
  ({
    id: "in_123",
    object: "invoice",
    metadata: {
      internalInvoiceId: "inv_local_123",
    },
    status: "open",
    customer: "cus_123",
    hosted_invoice_url: "https://pay.stripe.com/invoice/test",
    status_transitions: {},
    ...overrides,
  } as Stripe.Invoice);

test("shouldSkipConnectedInvoiceEvent is true when event was already processed", () => {
  assert.equal(
    shouldSkipConnectedInvoiceEvent({ lastStripeEventId: "evt_1" }, "evt_1"),
    true
  );
  assert.equal(
    shouldSkipConnectedInvoiceEvent({ lastStripeEventId: "evt_1" }, "evt_2"),
    false
  );
});

test("invoice.paid marks invoice paid and sets paidAt", () => {
  const update = buildConnectedInvoiceUpdateData({
    currentData: { status: "sent", payment: {} },
    invoice: makeStripeInvoice({
      status: "paid",
      status_transitions: { paid_at: 1712000000 } as Stripe.Invoice.StatusTransitions,
    }),
    eventType: "invoice.paid",
    eventId: "evt_paid_1",
    eventAccount: "acct_123",
    eventCreated: 1712000000,
  });

  assert.equal(update.status, "paid");
  assert.equal(typeof update.paidAt, "string");
  const payment = update.payment as Record<string, unknown>;
  assert.equal(payment.lastStripeEventId, "evt_paid_1");
  assert.equal(payment.syncStatus, "synced");
});

test("invoice.payment_failed keeps invoice unpaid and records failure", () => {
  const update = buildConnectedInvoiceUpdateData({
    currentData: { status: "unsent", payment: {} },
    invoice: makeStripeInvoice({ status: "open" }),
    eventType: "invoice.payment_failed",
    eventId: "evt_fail_1",
    eventAccount: "acct_123",
    eventCreated: 1712000000,
  });

  assert.equal(update.status, "sent");
  assert.equal(update.paidAt, "");
  const payment = update.payment as Record<string, unknown>;
  assert.equal(payment.lastSyncError, "payment_failed");
});

test("bank-transfer pending lifecycle event does not mark invoice paid", () => {
  const update = buildConnectedInvoiceUpdateData({
    currentData: { status: "sent", payment: {} },
    invoice: makeStripeInvoice({ status: "open" }),
    eventType: "invoice.updated",
    eventId: "evt_updated_1",
    eventAccount: "acct_123",
    eventCreated: 1712000000,
  });

  assert.equal(update.status, undefined);
  assert.equal(update.paidAt, undefined);
});
