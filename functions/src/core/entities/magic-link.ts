export interface MagicLinkToken {
  id: string;
  token: string; // Secure random token
  progressId: string; // Reference to onboarding progress
  email: string;
  expiresAt: string; // 7 days from creation
  usedAt?: string; // Mark as used when clicked
  createdAt: string;
  updatedAt: string;
}
