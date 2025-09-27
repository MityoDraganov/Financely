import z from "zod";
import { baseEntitySchema } from "./base";

export const sellerDataSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  taxIdVat: z.string().min(1),
});

export type SellerData = z.infer<typeof sellerDataSchema>;

export const sellerSchema = baseEntitySchema.merge(sellerDataSchema);
export type Seller = z.infer<typeof sellerSchema>;
