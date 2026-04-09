import { onCall, HttpsError } from "firebase-functions/v2/https";
import { verifyAdminAuth } from "../utils/admin-auth-utils";
import { getDatabaseService } from "../services/database-service";
import { getMarketplaceTemplateRepository } from "../repositories/marketplace-template-repository";
import { generateInvoiceHTML } from "../app/handle-render-invoice-pdf";
import type { Invoice, InvoiceDataValue } from "../core/entities/invoice";
import { templateDataSchema } from "../core/entities/template";

interface GetTemplatePreviewHtmlInput {
  templateId: string;
}

interface GetTemplatePreviewHtmlResponse {
  html: string;
  type: "invoice" | "email";
}

// Flat sample data covering the most common invoice template bindings.
// Nested objects allow dot-path resolution (e.g. "seller.name").
const SAMPLE_DATA: Record<string, InvoiceDataValue> = {
  seller: {
    name: "Financely Studio",
    email: "billing@financely.app",
    phone: "+1 (555) 010-1000",
    taxId: "EU998877665",
    vatNumber: "EU998877665",
    website: "https://financely.app",
    address: "120 Market Street, San Francisco, CA 94105, USA",
    addressLine1: "120 Market Street",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    country: "USA",
  } as Record<string, InvoiceDataValue>,
  buyer: {
    name: "Petar Petrov",
    email: "petar@example.com",
    phone: "+1 (555) 010-9933",
    taxId: "BG123456789",
    address: "25 Business Park Blvd, Sofia, Bulgaria",
    addressLine1: "25 Business Park Blvd",
    city: "Sofia",
    country: "Bulgaria",
    company: "Petrov Events",
  } as Record<string, InvoiceDataValue>,
  invoiceNumber: "INV-2026-001",
  issueDate: "2026-03-05",
  dueDate: "2026-03-19",
  reference: "PO-7781",
  notes: "Thank you for your business.",
  subtotal: "1,624.80",
  tax: "324.96",
  taxRate: "20%",
  discount: "0.00",
  total: "1,949.76",
  paid: "0.00",
  due: "1,949.76",
  currency: "USD",
  items: [
    {
      description: "Event Floral Arrangement",
      name: "Event Floral Arrangement",
      quantity: "2",
      unit: "pcs",
      unitPrice: "722.40",
      taxRate: "20%",
      taxAmount: "288.96",
      discount: "0.00",
      total: "1,444.80",
    },
    {
      description: "On-site Setup",
      name: "On-site Setup",
      quantity: "1",
      unit: "service",
      unitPrice: "180.00",
      taxRate: "20%",
      taxAmount: "36.00",
      discount: "0.00",
      total: "180.00",
    },
  ] as Array<Record<string, InvoiceDataValue>>,
};

export const getTemplatePreviewHtml = onCall<
  GetTemplatePreviewHtmlInput,
  Promise<GetTemplatePreviewHtmlResponse>
>(async (request) => {
  verifyAdminAuth(request);

  const { templateId } = request.data;
  if (!templateId || typeof templateId !== "string") {
    throw new HttpsError("invalid-argument", "templateId is required");
  }

  const db = getDatabaseService();
  const repo = getMarketplaceTemplateRepository(db);
  const template = await repo.get({ id: templateId });

  if (!template) {
    throw new HttpsError("not-found", `Template ${templateId} not found`);
  }

  if (template.type === "email") {
    const htmlContent = (template.templateContent as Record<string, unknown>)
      ?.htmlContent;
    return {
      html: typeof htmlContent === "string" ? htmlContent : "",
      type: "email",
    };
  }

  // Invoice: parse templateContent as TemplateData and render with sample data.
  const parsed = templateDataSchema.safeParse(template.templateContent);
  if (!parsed.success) {
    throw new HttpsError(
      "internal",
      `Template content is invalid: ${parsed.error.message}`,
    );
  }

  const sampleInvoice: Invoice = {
    id: "preview_sample",
    orgId: "official_preview",
    commercialCaseId: "preview_case",
    templateId: template.id,
    data: SAMPLE_DATA,
    status: "sent",
  };

  const html = generateInvoiceHTML(parsed.data, sampleInvoice, null);
  return { html, type: "invoice" };
});
