import { LoggerService, InvoiceData, InvoiceRepository } from "../core";

interface Dependencies {
  loggerService: LoggerService;
  invoiceRepository: InvoiceRepository;
}

export interface CreateInvoiceParams {
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
  vatRatePct?: number; // defaults to 21 if not provided
}

export const handleCreateInvoice = async (
  params: CreateInvoiceParams,
  dependencies: Dependencies,
): Promise<string> => {
  const { loggerService, invoiceRepository } = dependencies;

  const vatRatePct = params.vatRatePct ?? 21;

  loggerService.info("createInvoice:received", {
    sellerName: params.seller.name,
    buyerName: params.buyer.name,
    itemCount: params.items.length,
    vatRatePct,
    invoiceNumber: params.invoiceNumber,
  });

  const subtotal = params.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0);
  const vatTotal = subtotal * (vatRatePct / 100);
  const total = subtotal + vatTotal;

  const invoiceData: InvoiceData = {
    seller: params.seller,
    buyer: params.buyer,
    invoiceNumber: params.invoiceNumber,
    issueDate: params.issueDate,
    dueDate: params.dueDate,
    items: params.items,
    subtotal,
    vatTotal,
    total,
    paymentTerms: params.paymentTerms,
    iban: params.iban,
  };

  try {
    const id = await invoiceRepository.create({ data: invoiceData });
    loggerService.info("createInvoice:success", {
      id,
      invoiceNumber: invoiceData.invoiceNumber,
      subtotal,
      vatTotal,
      total,
    });
    return id;
  } catch (error) {
    loggerService.error("createInvoice:firestoreError", error, {
      invoiceNumber: invoiceData.invoiceNumber,
      total,
    });
    throw error;
  }
};
