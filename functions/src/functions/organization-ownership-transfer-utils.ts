import { createHash, randomBytes } from "crypto";
import { getFirestore } from "firebase-admin/firestore";

export const OWNERSHIP_TRANSFER_COLLECTION = "organizationOwnershipTransfers";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createOwnershipTransferToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashOwnershipTransferToken(token);
  return { token, tokenHash };
}

export function hashOwnershipTransferToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isOwnershipTransferExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function cancelPendingOwnershipTransfers(
  organizationId: string,
  nowIso: string,
  options?: {
    excludeId?: string;
    status?: "cancelled" | "expired";
    acceptedBy?: string;
  },
): Promise<number> {
  const db = getFirestore();
  const pendingSnapshot = await db
    .collection(OWNERSHIP_TRANSFER_COLLECTION)
    .where("organizationId", "==", organizationId)
    .where("status", "==", "pending")
    .get();

  if (pendingSnapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  let updatedCount = 0;
  const nextStatus = options?.status ?? "cancelled";

  for (const doc of pendingSnapshot.docs) {
    if (options?.excludeId && doc.id === options.excludeId) {
      continue;
    }

    const payload: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: nowIso,
    };
    if (options?.acceptedBy) {
      payload.acceptedBy = options.acceptedBy;
    }

    batch.update(doc.ref, payload);
    updatedCount += 1;
  }

  if (updatedCount > 0) {
    await batch.commit();
  }

  return updatedCount;
}
