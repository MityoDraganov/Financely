import z from "zod";
import { baseEntitySchema } from "./base";

export const buyerDataSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  taxIdVat: z.string().min(1),
});

export type BuyerData = z.infer<typeof buyerDataSchema>;

export const buyerSchema = baseEntitySchema.merge(buyerDataSchema);
export type Buyer = z.infer<typeof buyerSchema>;
