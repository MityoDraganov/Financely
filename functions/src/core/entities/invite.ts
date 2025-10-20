export interface Invite {
  id: string;
  code: string;
  organizationId: string;
  invitedBy: string;
  status: "active" | "used" | "expired" | "revoked";
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  createdAt: string;
  updatedAt: string;
}
