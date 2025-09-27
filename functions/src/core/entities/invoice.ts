import z from "zod";
import { baseEntitySchema } from "./base";
import { proposalItemSchema } from "./proposal";
import { sellerDataSchema } from "./seller";
import { buyerDataSchema } from "./buyer";

export const invoiceItemSchema = proposalItemSchema.pick({
  description: true,
  qty: true,
  unitPrice: true,
});

export const invoiceDataSchema = z.object({
  seller: sellerDataSchema,
  buyer: buyerDataSchema,
  invoiceNumber: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  items: z.array(invoiceItemSchema),
  subtotal: z.number().min(0),
  vatTotal: z.number().min(0),
  total: z.number().min(0),
  paymentTerms: z.string().min(1),
  iban: z.string().min(1),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;
export type InvoiceData = z.infer<typeof invoiceDataSchema>;
export const invoiceSchema = baseEntitySchema.merge(invoiceDataSchema);
export type Invoice = z.infer<typeof invoiceSchema>;

