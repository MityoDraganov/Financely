import { z } from "zod";

export const inviteDataSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
  organizationId: z.string().min(1),
  invitedBy: z.string().min(1), // User ID who sent the invite
  status: z.enum(["pending", "accepted", "expired", "revoked"]).default("pending"),
  token: z.string().min(1), // Unique token for the invite
  expiresAt: z.string(), // ISO date string
  acceptedAt: z.string().optional(), // ISO date string when accepted
  acceptedBy: z.string().optional(), // User ID who accepted the invite
  revokedAt: z.string().optional(), // ISO date string when revoked
  revokedBy: z.string().optional(), // User ID who revoked the invite
});

export type InviteData = z.infer<typeof inviteDataSchema>;

export interface Invite extends InviteData {
  id: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}
