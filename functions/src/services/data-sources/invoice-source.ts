import { InvoiceContext } from "../../core/entities/data-context";
import { ResolverContext } from "../data-source-registry";
import { getInvoiceRepository } from "../../repositories/invoice-repository";
import { Invoice } from "../../core/entities/invoice";

export async function resolveInvoiceSource(
  params: Record<string, string>,
  ctx: ResolverContext
): Promise<{ invoice?: InvoiceContext }> {
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

  return {
    invoice: mapInvoiceToContext(invoice),
  };
}

function mapInvoiceToContext(invoice: Invoice): InvoiceContext {
  return {
    id: invoice.id,
    number: extractInvoiceNumber(invoice.data),
    status: invoice.status,
    issueDate: extractDate(invoice.data, "issueDate"),
    dueDate: extractDate(invoice.data, "dueDate"),
    data: invoice.data,
    orgId: invoice.orgId,
    templateId: invoice.templateId,
    templateVersionId: invoice.templateVersionId,
  };
}

function extractInvoiceNumber(data: Record<string, unknown>): string | undefined {
  const number = data.invoiceNumber || data.number || data.invoice_number;
  return typeof number === "string" ? number : undefined;
}

function extractDate(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

