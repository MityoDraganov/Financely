import assert from "node:assert";
import { test } from "node:test";
import {
  INVOICE_PAYMENT_SYNC_STATUSES,
  Invoice,
  Organization,
} from "../core";
import {
  buildStripeDraftInvoiceCreateParams,
  buildStripeInvoiceSyncInput,
  syncStripeInvoiceForInternalInvoice,
} from "./stripe-invoice-payment-sync";

const makeInvoice = (): Invoice =>
  ({
    id: "inv_local_123",
    orgId: "org_123",
    templateId: "tpl_1",
    data: {
      invoiceNumber: "INV-2026-01",
      total: 125.5,
      currency: "USD",
      dueDate: "2026-05-01",
      buyer: {
        name: "Acme Buyer",
        email: "billing@acme.com",
      },
    },
    status: "unsent",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Invoice);

const makeOrganization = (): Organization =>
  ({
    id: "org_123",
    name: "Acme Org",
    memberIds: [],
    status: "active",
    billing: {
      status: "active",
      cancelAtPeriodEnd: false,
      entitlements: {},
    },
    payments: {
      provider: "stripe",
      connectAccountId: "acct_123",
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      onboardingComplete: true,
      status: "ready",
    },
    settings: {
      defaultCurrency: "USD",
      defaultLanguage: "en",
      defaultTimezone: "UTC",
      invoicePrefix: "INV",
      invoiceNumberStart: 1,
      brandColors: {
        primary: "#2563eb",
        secondary: "#6b7280",
        accent: "#10b981",
      },
      publicPages: {
        orgSlugAliases: [],
        domainPreference: "custom-first",
      },
      features: {
        customTemplates: true,
        pdfGeneration: true,
        emailSending: true,
        apiAccess: false,
      },
      ai: {
        autoProposalSuggestions: false,
        routing: {
          default: {
            provider: "auto",
            model: "auto",
          },
          tasks: {},
        },
        providers: {
          gemini: { enabled: true, model: "auto" },
          openai: { enabled: true, model: "auto" },
        },
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Organization);

test("buildStripeInvoiceSyncInput maps invoice data and amount", () => {
  const input = buildStripeInvoiceSyncInput({
    invoice: makeInvoice(),
    organization: makeOrganization(),
  });

  assert.equal(input.invoiceNumber, "INV-2026-01");
  assert.equal(input.amountMinor, 12550);
  assert.equal(input.currency, "usd");
  assert.equal(input.customerEmail, "billing@acme.com");
  assert.equal(input.metadata.internalInvoiceId, "inv_local_123");
});

test("buildStripeDraftInvoiceCreateParams requires card and customer_balance", () => {
  const syncInput = buildStripeInvoiceSyncInput({
    invoice: makeInvoice(),
    organization: makeOrganization(),
  });

  const draftParams = buildStripeDraftInvoiceCreateParams({
    customerId: "cus_123",
    syncInput,
  });

  assert.deepEqual(
    draftParams.payment_settings?.payment_method_types,
    ["card", "customer_balance"]
  );
  assert.equal(draftParams.collection_method, "send_invoice");
});

test("syncStripeInvoiceForInternalInvoice marks sync_failed when Stripe call fails", async () => {
  const updates: Array<{ invoiceId: string; payment: unknown }> = [];

  const result = await syncStripeInvoiceForInternalInvoice({
    stripeSecretKey: "sk_test_123",
    invoiceId: "inv_local_123",
    deps: {
      loadInvoiceAndOrganization: async () => ({
        invoice: makeInvoice(),
        organization: makeOrganization(),
      }),
      updateInvoicePayment: async (invoiceId, payment) => {
        updates.push({ invoiceId, payment });
      },
      createStripeClient: () =>
        ({
          customers: {
            create: async () => {
              throw new Error("stripe customers.create failed");
            },
          },
          invoices: {
            create: async () => {
              throw new Error("not-called");
            },
            finalizeInvoice: async () => {
              throw new Error("not-called");
            },
          },
          invoiceItems: {
            create: async () => {
              throw new Error("not-called");
            },
          },
        } as any),
    },
  });

  assert.equal(result.status, "sync_failed");
  assert.equal(updates.length, 1);
  const failedPayment = updates[0].payment as { syncStatus?: string };
  assert.equal(
    failedPayment.syncStatus,
    INVOICE_PAYMENT_SYNC_STATUSES.SYNC_FAILED
  );
});
