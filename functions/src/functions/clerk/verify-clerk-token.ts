import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";
import { verifyToken } from "@clerk/backend";
import { loggerService } from "../../services/logger-service";

// Define the Clerk API secret
const clerkApiSecret = defineSecret("CLERK_API_SECRET");

export const verifyClerkToken = onCall(
  {
    secrets: [clerkApiSecret],
    cors: true,
  },
  async (request) => {
    try {
      const { clerkToken } = request.data;

      if (!clerkToken) {
        throw new HttpsError("invalid-argument", "Clerk token is required");
      }

      loggerService.info("Verifying Clerk token");

      // Verify the Clerk JWT token
      const payload = await verifyToken(clerkToken, {
        secretKey: clerkApiSecret.value(),
      });

      if (!payload) {
        throw new HttpsError("unauthenticated", "Invalid Clerk token");
      }

      loggerService.info("Clerk token verified successfully for user:", payload.sub);

      // Extract user information from the verified token
      const clerkUserId = payload.sub;
      const email = payload.email as string;
      const emailVerified = payload.email_verified as boolean;
      const name = payload.name as string;
      const picture = payload.picture as string;

      // Note: Admin role is NOT included here - this is for main app Clerk
      // Admin panel uses verifyAdminClerkToken which uses separate admin Clerk secret
      // Create Firebase custom token with verified Clerk user data
      const customClaims: Record<string, any> = {
        clerkId: clerkUserId,
        email: email,
        email_verified: emailVerified,
        name: name,
        picture: picture,
      };

      const firebaseToken = await getAuth().createCustomToken(clerkUserId, customClaims);

      loggerService.info("Firebase custom token created for user:", clerkUserId);

      return {
        firebaseToken,
        clerkUser: {
          id: clerkUserId,
          email: email,
          name: name,
          picture: picture,
        },
      };
    } catch (error) {
      loggerService.error("Error verifying Clerk token:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      // Handle specific Clerk verification errors
      if (error instanceof Error) {
        if (error.message.includes("Invalid token")) {
          throw new HttpsError("unauthenticated", "Invalid Clerk token");
        }
        if (error.message.includes("Token expired")) {
          throw new HttpsError("unauthenticated", "Clerk token has expired");
        }
      }
      
      throw new HttpsError("internal", "Failed to verify Clerk token");
    }
  }
);
