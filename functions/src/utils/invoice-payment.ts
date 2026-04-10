import {
  INVOICE_PAYMENT_SYNC_STATUSES,
  InvoicePayment,
} from "../core";

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

export function getStripeInvoicePaymentMetadata(invoice: {
  payment?: unknown;
}): InvoicePayment | undefined {
  const payment = asRecord(invoice.payment);
  if (!payment || payment.provider !== "stripe") {
    return undefined;
  }
  return payment as unknown as InvoicePayment;
}

export function isStripeInvoiceSyncFailed(invoice: { payment?: unknown }): boolean {
  const payment = getStripeInvoicePaymentMetadata(invoice);
  return payment?.syncStatus === INVOICE_PAYMENT_SYNC_STATUSES.SYNC_FAILED;
}

export function isStripeInvoiceLinked(invoice: { payment?: unknown }): boolean {
  const payment = getStripeInvoicePaymentMetadata(invoice);
  return !!payment?.stripeInvoiceId;
}
