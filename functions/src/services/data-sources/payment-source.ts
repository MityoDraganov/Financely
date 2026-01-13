import { PaymentContext } from "../../core/entities/data-context";
import { ResolverContext } from "../data-source-registry";
import { getInvoiceRepository } from "../../repositories/invoice-repository";

export async function resolvePaymentSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ payment?: PaymentContext }> {
  const invoiceId = params.invoiceId;
  if (!invoiceId) {
    return {};
  }

  const invoiceRepository = getInvoiceRepository(ctx.databaseService);
  const invoice = await invoiceRepository.get({ id: invoiceId });

  if (!invoice) {
    return {};
  }

  if (invoice.orgId !== ctx.organizationId) {
    throw new Error(`Invoice ${invoiceId} does not belong to organization ${ctx.organizationId}`);
  }

  const payment = extractPaymentFromInvoice(invoice);

  return {
    payment,
  };
}

function extractPaymentFromInvoice(invoice: {
  id: string;
  status: string;
  data: Record<string, unknown>;
}): PaymentContext | undefined {
  if (invoice.status !== "paid") {
    return undefined;
  }

  const amount = extractAmount(invoice.data);
  const currency = extractCurrency(invoice.data);
  const paidAt = extractDate(invoice.data, "paidAt") || extractDate(invoice.data, "paid_at");

  return {
    id: invoice.id,
    amount,
    currency,
    status: invoice.status,
    method: extractString(invoice.data, "paymentMethod") || extractString(invoice.data, "payment_method"),
    transactionId: extractString(invoice.data, "transactionId") || extractString(invoice.data, "transaction_id"),
    paidAt,
    invoiceId: invoice.id,
  };
}

function extractAmount(data: Record<string, unknown>): number | undefined {
  const total = data.total || data.grossTotal || data.amount;
  if (typeof total === "number") {
    return total;
  }
  if (typeof total === "string") {
    const parsed = parseFloat(total);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function extractCurrency(data: Record<string, unknown>): string | undefined {
  const currency = data.currency;
  return typeof currency === "string" ? currency : undefined;
}

function extractDate(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function extractString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

