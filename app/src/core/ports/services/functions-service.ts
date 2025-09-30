

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

  createInvoice(payload: {
    seller: {
      name: string;
      address: string;
      taxIdVat: string;
    };
    buyer: {
      name: string;
      address: string;
      taxIdVat: string;
    };
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    items: Array<{
      description: string;
      qty: number;
      unitPrice: number;
    }>;
    paymentTerms: string;
    iban: string;
    vatRatePct?: number;
  }): Promise<{ id: string }>;

  renderInvoicePdf(payload: {
    templateVersionId: string;
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInvoiceEmail(payload: {
    invoiceId: string;
    toEmail: string;
  }): Promise<{ sent: boolean }>;

  generateInvoiceShareLink(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;
}