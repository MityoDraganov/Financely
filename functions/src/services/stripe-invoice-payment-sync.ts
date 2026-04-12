import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  INVOICE_PAYMENT_SYNC_STATUSES,
  Invoice,
  InvoicePayment,
  Organization,
  OrganizationData,
} from "../core";
import { removeUndefinedValues } from "../utils/remove-undefined-values";
import { loggerService } from "./logger-service";
import { isOrganizationConnectReady } from "./stripe-connect-payments";
import { getOrganizationBaseCurrency } from "../utils/organization-currency-policy";

export interface StripeInvoiceSyncInput {
  amountMinor: number;
  currency: string;
  dueDate?: Date;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  invoiceNumber: string;
  metadata: Record<string, string>;
}

export interface StripeInvoiceSyncResult {
  status: "skipped_not_ready" | "already_synced" | "synced" | "sync_failed";
  payment?: InvoicePayment;
  reason?: string;
  error?: string;
}

type StripeClientLike = {
  customers: {
    create: typeof Stripe.prototype.customers.create;
  };
  invoices: {
    create: typeof Stripe.prototype.invoices.create;
    finalizeInvoice: typeof Stripe.prototype.invoices.finalizeInvoice;
  };
  invoiceItems: {
    create: typeof Stripe.prototype.invoiceItems.create;
  };
};

export interface StripeInvoiceSyncDependencies {
  loadInvoiceAndOrganization?: (invoiceId: string) => Promise<{
    invoice: Invoice;
    organization: Organization;
  }>;
  updateInvoicePayment?: (invoiceId: string, payment: InvoicePayment) => Promise<void>;
  createStripeClient?: (stripeSecretKey: string) => StripeClientLike;
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
const STRIPE_CURRENCY_CODE_PATTERN = /^[a-z]{3}$/;

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const getPath = (obj: Record<string, unknown>, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const pickString = (obj: Record<string, unknown>, paths: string[]): string | undefined => {
  for (const path of paths) {
    const raw = getPath(obj, path);
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return undefined;
};

const pickNumber = (obj: Record<string, unknown>, paths: string[]): number | undefined => {
  for (const path of paths) {
    const raw = getPath(obj, path);
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const toMinorUnits = (amount: number, currency: string): number => {
  const normalizedCurrency = currency.toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
};

const parseDueDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp);
};

export function buildStripeInvoiceSyncInput(params: {
  invoice: Invoice;
  organization?: Pick<OrganizationData, "name" | "settings"> | null;
}): StripeInvoiceSyncInput {
  const { invoice, organization } = params;
  const data = asRecord(invoice.data) ?? {};
  const buyer =
    asRecord(getPath(data, "buyer")) ??
    asRecord(getPath(data, "customer")) ??
    {};

  const invoiceNumber =
    pickString(data, ["invoiceNumber", "number", "invoice.number"]) ??
    invoice.id;
  const amount =
    pickNumber(data, ["total", "totals.grandTotal", "amountDue", "invoice.total"]) ??
    0;
  const resolvedCurrency =
    pickString(data, ["currency", "totals.currency", "invoice.currency"]) ??
    getOrganizationBaseCurrency(
      organization
        ? ({ settings: organization.settings } as { settings?: { defaultCurrency?: string; currency?: string } })
        : undefined,
    );
  const currency = resolvedCurrency.trim().toLowerCase();
  if (!STRIPE_CURRENCY_CODE_PATTERN.test(currency)) {
    throw new Error(
      `Invoice currency is missing or invalid: ${resolvedCurrency || "unknown"}`
    );
  }

  const amountMinor = toMinorUnits(amount, currency);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error("Invoice total must be a positive number to create Stripe invoice");
  }

  const dueDateString = pickString(data, ["dueDate", "invoice.dueDate", "paymentDueDate"]);
  const customerName =
    pickString(buyer, ["name", "company"]) ??
    "Customer";
  const customerEmail = pickString(buyer, ["email"]);
  const customerPhone = pickString(buyer, ["phone"]);
  const description =
    pickString(data, ["description", "notes"]) ??
    `Invoice ${invoiceNumber}`;

  return {
    amountMinor,
    currency: currency.toLowerCase(),
    dueDate: parseDueDate(dueDateString),
    customerName,
    customerEmail,
    customerPhone,
    description,
    invoiceNumber,
    metadata: {
      internalInvoiceId: invoice.id,
      organizationId: invoice.orgId,
      invoiceNumber,
    },
  };
}

export function buildStripeDraftInvoiceCreateParams(params: {
  customerId: string;
  syncInput: StripeInvoiceSyncInput;
}): Stripe.InvoiceCreateParams {
  const { customerId, syncInput } = params;
  return {
    customer: customerId,
    currency: syncInput.currency,
    // Never let Stripe send invoices directly; app handles delivery.
    collection_method: "charge_automatically",
    payment_settings: {
      // customer_balance is not allowed with charge_automatically on invoices.
      payment_method_types: ["card"],
    },
    auto_advance: false,
    metadata: syncInput.metadata,
  };
}

export function buildStripeInvoiceItemCreateParams(params: {
  customerId: string;
  stripeInvoiceId: string;
  syncInput: StripeInvoiceSyncInput;
}): Stripe.InvoiceItemCreateParams {
  const { customerId, stripeInvoiceId, syncInput } = params;
  return {
    customer: customerId,
    invoice: stripeInvoiceId,
    currency: syncInput.currency,
    amount: syncInput.amountMinor,
    description: syncInput.description,
    metadata: syncInput.metadata,
  };
}

const loadInvoiceAndOrganizationFromFirestore = async (invoiceId: string): Promise<{
  invoice: Invoice;
  organization: Organization;
}> => {
  const db = getFirestore();
  const invoiceSnap = await db.collection("invoices").doc(invoiceId).get();
  if (!invoiceSnap.exists) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }
  const invoice = {
    id: invoiceSnap.id,
    ...(invoiceSnap.data() || {}),
  } as Invoice;

  const orgSnap = await db.collection("organizations").doc(invoice.orgId).get();
  if (!orgSnap.exists) {
    throw new Error(`Organization not found for invoice: ${invoice.orgId}`);
  }
  const organization = {
    id: orgSnap.id,
    ...(orgSnap.data() || {}),
  } as Organization;

  return { invoice, organization };
};

const updateInvoicePaymentInFirestore = async (
  invoiceId: string,
  payment: InvoicePayment
): Promise<void> => {
  const sanitizedPayment = removeUndefinedValues(payment);
  await getFirestore().collection("invoices").doc(invoiceId).update({
    payment: sanitizedPayment,
  });
};

const createDefaultStripeClient = (stripeSecretKey: string): StripeClientLike =>
  new Stripe(stripeSecretKey);

export async function syncStripeInvoiceForInternalInvoice(params: {
  stripeSecretKey: string;
  invoiceId: string;
  force?: boolean;
  deps?: StripeInvoiceSyncDependencies;
}): Promise<StripeInvoiceSyncResult> {
  const { stripeSecretKey, invoiceId, force = false, deps } = params;
  const loadInvoiceAndOrganization =
    deps?.loadInvoiceAndOrganization ?? loadInvoiceAndOrganizationFromFirestore;
  const updateInvoicePayment =
    deps?.updateInvoicePayment ?? updateInvoicePaymentInFirestore;
  const createStripeClient =
    deps?.createStripeClient ?? createDefaultStripeClient;

  const { invoice, organization } = await loadInvoiceAndOrganization(invoiceId);

  const connectAccountId = organization.payments?.connectAccountId;
  if (!isOrganizationConnectReady(organization.payments)) {
    return {
      status: "skipped_not_ready",
      reason: "Organization Connect onboarding is not complete",
    };
  }

  const existingPayment = invoice.payment;
  if (
    !force &&
    existingPayment?.provider === "stripe" &&
    existingPayment.syncStatus === INVOICE_PAYMENT_SYNC_STATUSES.SYNCED &&
    !!existingPayment.stripeInvoiceId &&
    !!existingPayment.hostedInvoiceUrl
  ) {
    return {
      status: "already_synced",
      payment: existingPayment,
    };
  }

  if (!connectAccountId) {
    return {
      status: "sync_failed",
      error: "Connected account is missing",
    };
  }

  const stripe = createStripeClient(stripeSecretKey);
  const nowIso = new Date().toISOString();

  try {
    const syncInput = buildStripeInvoiceSyncInput({
      invoice,
      organization,
    });

    const customer = await stripe.customers.create(
      {
        name: syncInput.customerName,
        email: syncInput.customerEmail,
        phone: syncInput.customerPhone,
        metadata: {
          organizationId: invoice.orgId,
          internalInvoiceId: invoice.id,
        },
      },
      {
        stripeAccount: connectAccountId,
      }
    );

    const draftInvoice = await stripe.invoices.create(
      buildStripeDraftInvoiceCreateParams({
        customerId: customer.id,
        syncInput,
      }),
      {
        stripeAccount: connectAccountId,
      }
    );

    await stripe.invoiceItems.create(
      buildStripeInvoiceItemCreateParams({
        customerId: customer.id,
        stripeInvoiceId: draftInvoice.id,
        syncInput,
      }),
      {
        stripeAccount: connectAccountId,
      }
    );

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
      draftInvoice.id,
      {
        auto_advance: false,
      },
      {
        stripeAccount: connectAccountId,
      }
    );

    const paymentUpdate: InvoicePayment = {
      ...(existingPayment || {}),
      provider: "stripe",
      connectAccountId,
      stripeInvoiceId: finalizedInvoice.id,
      stripeCustomerId: customer.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url || undefined,
      syncStatus: INVOICE_PAYMENT_SYNC_STATUSES.SYNCED,
      lastSyncError: undefined,
      lastSyncedAt: nowIso,
      stripeInvoiceStatus: finalizedInvoice.status || undefined,
    };

    await updateInvoicePayment(invoice.id, paymentUpdate);

    return {
      status: "synced",
      payment: paymentUpdate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    loggerService.error("Failed to sync invoice payment with Stripe", {
      invoiceId: invoice.id,
      orgId: invoice.orgId,
      connectAccountId,
      error: message,
    });

    const failedPaymentUpdate: InvoicePayment = {
      ...(existingPayment || {}),
      provider: "stripe",
      connectAccountId,
      syncStatus: INVOICE_PAYMENT_SYNC_STATUSES.SYNC_FAILED,
      lastSyncError: message,
      lastSyncedAt: nowIso,
    };

    await updateInvoicePayment(invoice.id, failedPaymentUpdate);

    return {
      status: "sync_failed",
      payment: failedPaymentUpdate,
      error: message,
    };
  }
}
