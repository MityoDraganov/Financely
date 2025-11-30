import { firestore } from "firebase-admin";
import { logger } from "firebase-functions";
import { hashIpAddress } from "./ip-extractor";

/**
 * Honeypot field name used in form submissions.
 * This field should be hidden from users and left empty.
 * If filled, the submission is considered spam.
 */
export const HONEYPOT_FIELD_NAME = "_hp"; // Common honeypot field name

/**
 * Check if a form submission is spam based on honeypot field.
 * 
 * @param formData - The form data object
 * @returns true if honeypot field is filled (spam detected)
 */
export function checkHoneypot(formData: Record<string, unknown>): boolean {
  const honeypotValue = formData[HONEYPOT_FIELD_NAME];
  
  // If honeypot field exists and has a value, it's spam
  if (honeypotValue !== undefined && honeypotValue !== null && honeypotValue !== "") {
    logger.warn("Honeypot field filled - spam detected", {
      honeypotValue: String(honeypotValue).substring(0, 50), // Log first 50 chars only
    });
    return true;
  }

  return false;
}

/**
 * Check for duplicate submissions within a time window.
 * 
 * Uses Firestore to track recent submissions by:
 * - IP address + organization ID + normalized payload hash
 * 
 * @param orgId - Organization ID
 * @param ipAddress - IP address of requester
 * @param payloadHash - Hash of normalized payload
 * @param windowSeconds - Time window in seconds (default: 60)
 * @returns true if duplicate detected
 */
export async function checkDuplicateSubmission(
  orgId: string,
  ipAddress: string | undefined,
  payloadHash: string,
  windowSeconds = 60
): Promise<boolean> {
  if (!ipAddress) {
    // Can't check duplicates without IP
    return false;
  }

  const collection = firestore().collection("duplicateSubmissions");
  const key = `${orgId}:${hashIpAddress(ipAddress)}:${payloadHash}`;
  const docRef = collection.doc(key);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data();
    const timestamp = data?.timestamp || 0;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Check if within time window
    if (now - timestamp < windowMs) {
      logger.info("Duplicate submission detected", {
        orgId,
        ipHash: hashIpAddress(ipAddress),
        payloadHash: payloadHash.substring(0, 16), // Log first 16 chars
      });
      return true;
    }
  }

  // Record this submission
  const windowMs = windowSeconds * 1000;
  await docRef.set({
    timestamp: Date.now(),
    orgId,
    ipHash: hashIpAddress(ipAddress),
    payloadHash: payloadHash.substring(0, 64), // Store first 64 chars
    expiresAt: new Date(Date.now() + windowMs * 2), // Keep for 2x window
  });

  return false;
}

/**
 * Create a hash of a normalized payload for duplicate detection.
 * 
 * @param payload - The payload object
 * @returns Hash string
 */
export function hashPayload(payload: Record<string, unknown>): string {
  // Normalize payload: sort keys, stringify, remove whitespace
  const normalized = JSON.stringify(
    Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        const value = payload[key];
        // Normalize values: trim strings, ignore null/undefined
        if (value === null || value === undefined) {
          return acc;
        }
        if (typeof value === "string") {
          acc[key] = value.trim().toLowerCase();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, unknown>)
  );

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Check if analytics event should be sampled/dropped due to org-level rate limits.
 * 
 * When org-level limits are exceeded, we sample events instead of hard-failing
 * to protect Firestore from excessive writes.
 * 
 * @param orgId - Organization ID
 * @param sampleRate - Sample rate (0.0 to 1.0). 0.1 means keep 10% of events.
 * @returns true if event should be dropped
 */
export function shouldSampleEvent(orgId: string, sampleRate: number): boolean {
  if (sampleRate >= 1.0) {
    return false; // Keep all events
  }

  if (sampleRate <= 0.0) {
    return true; // Drop all events
  }

  // Use orgId as seed for consistent sampling per org
  const hash = orgId.split("").reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  // Simple deterministic sampling
  const random = (hash % 1000) / 1000;
  return random > sampleRate;
}

