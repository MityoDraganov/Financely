import z from "zod";
import { baseEntitySchema } from "./base";

export const organizationOwnershipTransferStatusSchema = z.enum([
  "pending",
  "accepted",
  "cancelled",
  "expired",
]);

export type OrganizationOwnershipTransferStatus = z.infer<
  typeof organizationOwnershipTransferStatusSchema
>;

export const organizationOwnershipTransferDataSchema = z.object({
  organizationId: z.string().min(1),
  requestedBy: z.string().min(1),
  targetEmail: z.string().email(),
  status: organizationOwnershipTransferStatusSchema.default("pending"),
  tokenHash: z.string().min(1),
  expiresAt: z.string(),
  acceptedBy: z.string().optional(),
});

export type OrganizationOwnershipTransferData = z.infer<
  typeof organizationOwnershipTransferDataSchema
>;

export const organizationOwnershipTransferSchema = baseEntitySchema.merge(
  organizationOwnershipTransferDataSchema,
);

export type OrganizationOwnershipTransfer = z.infer<
  typeof organizationOwnershipTransferSchema
>;
