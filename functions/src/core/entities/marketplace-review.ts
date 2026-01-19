import z from "zod";
import { baseEntitySchema } from "./base";

export const marketplaceReviewDataSchema = z.object({
  templateId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export type MarketplaceReviewData = z.infer<typeof marketplaceReviewDataSchema>;

export const marketplaceReviewSchema = baseEntitySchema.merge(marketplaceReviewDataSchema);
export type MarketplaceReview = z.infer<typeof marketplaceReviewSchema>;
