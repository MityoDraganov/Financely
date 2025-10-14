

export interface DeleteResponse {
  deleted: boolean;
  error?: string;
}

export interface FunctionsService {
  createProposal(payload: {
    orgId: string;
    customerId: string;
    title: string;
    description?: string;
    items: Array<{
      description: string;
      qty: number;
      unitPrice: number;
      taxPct?: number;
    }>;
    currency: string;
    terms?: string;
    notes?: string;
    vatRatePct?: number;
  }): Promise<{ id: string }>;

  /**
   * Create an invoice with dynamic data based on a template.
   * 
   * @param payload - The invoice creation payload
   * @param payload.orgId - Organization ID
   * @param payload.templateId - Template ID this invoice is based on
   * @param payload.templateVersionId - Optional specific version of the template
   * @param payload.data - Dynamic data matching the template's bindings
   * @param payload.status - Invoice status (draft, sent, paid, cancelled)
   * @param payload.notes - Optional notes
   * @returns Promise with the created invoice ID
   * 
   * @example
   * // Example with a standard invoice template
   * createInvoice({
   *   orgId: "org123",
   *   templateId: "template456",
   *   data: {
   *     seller: { name: "Acme Inc", address: "123 Main St", taxIdVat: "US123456" },
   *     buyer: { name: "Customer Ltd", address: "456 Oak Ave", taxIdVat: "US789012" },
   *     invoiceNumber: "INV-001",
   *     issueDate: "2025-01-01",
   *     dueDate: "2025-01-31",
   *     items: [
   *       { description: "Consulting", qty: 10, unitPrice: 150, total: 1500 }
   *     ],
   *     subtotal: 1500,
   *     vatTotal: 300,
   *     total: 1800
   *   }
   * })
   */
  createInvoice(payload: {
    orgId: string;
    templateId: string;
    templateVersionId?: string;
    data: Record<string, unknown>;
    status?: "draft" | "sent" | "paid" | "cancelled";
    notes?: string;
  }): Promise<{ id: string }>;

  renderInvoicePdf(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInvoiceEmail(payload: {
    invoiceId: string;
    toEmail: string;
  }): Promise<{ sent: boolean }>;

  generateInvoiceShareLink(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInviteEmail(payload: {
    inviteId: string;
    organizationId: string;
  }): Promise<{ sent: boolean }>;

  sendWelcomeEmail(payload: {
    userId: string;
    organizationId: string;
  }): Promise<{ sent: boolean }>;
}