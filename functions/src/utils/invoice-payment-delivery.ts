import {
  INVOICE_PAYMENT_SYNC_STATUSES,
  INVOICE_STATUSES,
  normalizeInvoiceStatus,
  type Invoice,
  type InvoiceDataValue,
} from "../core";
import { getStripeInvoicePaymentMetadata } from "./invoice-payment";

type UnknownRecord = Record<string, unknown>;

export type InvoicePaymentDeliveryStatus =
  | "payable_online"
  | "payable_fallback"
  | "paid"
  | "cancelled";

export interface InvoicePaymentDeliveryMetadata {
  status: InvoicePaymentDeliveryStatus;
  hasOnlineLink: boolean;
  usedFallback: boolean;
  payUrl: string | null;
  viewUrl: string | null;
  pdfUrl: string | null;
  reference: string;
  warnings: string[];
  warningText: string;
  fallbackInstructions: string;
  fallback: {
    bankInstructions: string;
    bankAccountName: string;
    bankAccountNumber: string;
    iban: string;
    swift: string;
    beneficiaryName: string;
    beneficiaryAddress: string;
  };
}

const toRecord = (value: unknown): UnknownRecord | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as UnknownRecord;
};

const toString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const getInvoiceData = (invoice: Invoice): Record<string, InvoiceDataValue> =>
  (invoice.data ?? {}) as Record<string, InvoiceDataValue>;

const resolveInvoiceNumber = (invoice: Invoice): string => {
  const data = getInvoiceData(invoice);
  const invoiceNumber = toString(data.invoiceNumber) || toString(data.number);
  return invoiceNumber || invoice.id;
};

const buildFallbackInstructions = (fallback: InvoicePaymentDeliveryMetadata["fallback"]): string => {
  const lines: string[] = [];
  if (fallback.bankInstructions) {
    lines.push(fallback.bankInstructions);
  }
  if (fallback.bankAccountName) {
    lines.push(`Account name: ${fallback.bankAccountName}`);
  }
  if (fallback.bankAccountNumber) {
    lines.push(`Account number: ${fallback.bankAccountNumber}`);
  }
  if (fallback.iban) {
    lines.push(`IBAN: ${fallback.iban}`);
  }
  if (fallback.swift) {
    lines.push(`SWIFT/BIC: ${fallback.swift}`);
  }
  if (fallback.beneficiaryName) {
    lines.push(`Beneficiary: ${fallback.beneficiaryName}`);
  }
  if (fallback.beneficiaryAddress) {
    lines.push(`Beneficiary address: ${fallback.beneficiaryAddress}`);
  }
  return lines.join("\n").trim();
};

const resolveReference = (invoice: Invoice, referenceFormat: string): string => {
  const invoiceNumber = resolveInvoiceNumber(invoice);
  const template = referenceFormat.trim() || "{{invoiceNumber}}";
  const resolved = template
    .replace(/\{\{\s*invoiceNumber\s*\}\}/gi, invoiceNumber)
    .replace(/\{\{\s*invoiceId\s*\}\}/gi, invoice.id)
    .trim();
  return resolved || invoiceNumber || invoice.id;
};

export const resolveInvoicePaymentDelivery = ({
  invoice,
  organization,
  pdfUrl,
}: {
  invoice: Invoice;
  organization?: unknown;
  pdfUrl?: string | null;
}): InvoicePaymentDeliveryMetadata => {
  const orgRecord = toRecord(organization);
  const orgSettings = toRecord(orgRecord?.settings);
  const fallbackSettings = toRecord(orgSettings?.paymentFallback);
  const stripePayment = getStripeInvoicePaymentMetadata(invoice as unknown as { payment?: unknown });
  const normalizedStatus = normalizeInvoiceStatus(invoice.status);
  const hostedInvoiceUrl = toString(stripePayment?.hostedInvoiceUrl);
  const resolvedPdfUrl = toString(pdfUrl) || toString(invoice.pdfUrl);
  const viewUrl = hostedInvoiceUrl || resolvedPdfUrl || null;
  const warnings: string[] = [];

  if (
    stripePayment?.syncStatus === INVOICE_PAYMENT_SYNC_STATUSES.SYNC_FAILED &&
    normalizedStatus !== INVOICE_STATUSES.PAID &&
    normalizedStatus !== INVOICE_STATUSES.CANCELLED
  ) {
    warnings.push("stripe_sync_failed");
  }
  if (
    !hostedInvoiceUrl &&
    normalizedStatus !== INVOICE_STATUSES.PAID &&
    normalizedStatus !== INVOICE_STATUSES.CANCELLED
  ) {
    warnings.push("online_payment_link_unavailable");
  }

  const fallback = {
    bankInstructions:
      toString(fallbackSettings?.bankInstructions) ||
      "Online payment is unavailable. Use bank transfer and include the payment reference.",
    bankAccountName: toString(fallbackSettings?.bankAccountName),
    bankAccountNumber: toString(fallbackSettings?.bankAccountNumber),
    iban: toString(fallbackSettings?.iban),
    swift: toString(fallbackSettings?.swift),
    beneficiaryName: toString(fallbackSettings?.beneficiaryName),
    beneficiaryAddress: toString(fallbackSettings?.beneficiaryAddress),
  };
  const referenceFormat = toString(fallbackSettings?.referenceFormat) || "{{invoiceNumber}}";
  const reference = resolveReference(invoice, referenceFormat);

  if (normalizedStatus === INVOICE_STATUSES.PAID) {
    return {
      status: "paid",
      hasOnlineLink: false,
      usedFallback: false,
      payUrl: null,
      viewUrl,
      pdfUrl: resolvedPdfUrl || null,
      reference,
      warnings,
      warningText: "",
      fallbackInstructions: buildFallbackInstructions(fallback),
      fallback,
    };
  }

  if (normalizedStatus === INVOICE_STATUSES.CANCELLED) {
    return {
      status: "cancelled",
      hasOnlineLink: false,
      usedFallback: false,
      payUrl: null,
      viewUrl,
      pdfUrl: resolvedPdfUrl || null,
      reference,
      warnings,
      warningText: "",
      fallbackInstructions: buildFallbackInstructions(fallback),
      fallback,
    };
  }

  const status: InvoicePaymentDeliveryStatus = hostedInvoiceUrl ? "payable_online" : "payable_fallback";
  const usedFallback = status === "payable_fallback";
  const warningText = usedFallback
    ? "Online payment link is not available. The email includes fallback payment instructions."
    : "";

  return {
    status,
    hasOnlineLink: status === "payable_online",
    usedFallback,
    payUrl: status === "payable_online" ? hostedInvoiceUrl : null,
    viewUrl,
    pdfUrl: resolvedPdfUrl || null,
    reference,
    warnings,
    warningText,
    fallbackInstructions: buildFallbackInstructions(fallback),
    fallback,
  };
};

