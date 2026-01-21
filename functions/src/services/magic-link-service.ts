import { randomUUID } from "crypto";
import { MagicLinkToken } from "../core/entities/magic-link";
import { getMagicLinkRepository } from "../repositories/magic-link-repository";
import { getDatabaseService } from "./database-service";

const databaseService = getDatabaseService();
const magicLinkRepo = getMagicLinkRepository(databaseService);

/**
 * Generate a secure magic link token for onboarding resume
 */
export async function generateMagicLink(
  progressId: string,
  email: string,
): Promise<string> {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const magicLink: MagicLinkToken = {
    id: token,
    token,
    progressId,
    email,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await magicLinkRepo.create(magicLink);
  return token;
}

/**
 * Validate a magic link token
 */
export async function validateMagicLink(
  token: string,
): Promise<{ valid: boolean; progressId?: string; email?: string; error?: string }> {
  const magicLink = await magicLinkRepo.getByToken(token);

  if (!magicLink) {
    return { valid: false, error: "Invalid token" };
  }

  if (magicLink.usedAt) {
    return { valid: false, error: "Token already used" };
  }

  const now = new Date();
  const expiresAt = new Date(magicLink.expiresAt);
  if (now > expiresAt) {
    return { valid: false, error: "Token expired" };
  }

  // Mark token as used
  await magicLinkRepo.update(magicLink.id, {
    usedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return {
    valid: true,
    progressId: magicLink.progressId,
    email: magicLink.email,
  };
}
