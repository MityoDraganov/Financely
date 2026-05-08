import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";
import { verifyToken } from "@clerk/backend";
import { loggerService } from "../../services/logger-service";
import { getAdminRoleFromClerk, syncAdminRoleToFirebaseAuth } from "../../utils/admin-clerk-utils";

// Define the Admin Clerk API secret (separate from main app Clerk)
const adminClerkApiSecret = defineSecret("ADMIN_CLERK_API_SECRET");

/**
 * Verify Clerk token for admin panel
 * Uses separate admin Clerk instance and includes admin role in Firebase Auth custom claims
 */
export const verifyAdminClerkToken = onCall(
  {
    secrets: [adminClerkApiSecret],
    cors: true,
    memory: "512MiB",
    minInstances: 1,
  },
  async (request) => {
    try {
      const { clerkToken } = request.data;

      if (!clerkToken) {
        throw new HttpsError("invalid-argument", "Clerk token is required");
      }

      loggerService.info("Verifying admin Clerk token");

      // Verify the Clerk JWT token using admin Clerk secret
      const payload = await verifyToken(clerkToken, {
        secretKey: adminClerkApiSecret.value(),
      });

      if (!payload) {
        throw new HttpsError("unauthenticated", "Invalid Clerk token");
      }

      loggerService.info("Admin Clerk token verified successfully for user:", payload.sub);

      // Extract user information from the verified token
      const clerkUserId = payload.sub;
      const email = payload.email as string;
      const emailVerified = payload.email_verified as boolean;
      const name = payload.name as string;
      const picture = payload.picture as string;

      // Get admin role from Clerk user's publicMetadata
      // Fetch from Clerk API to get full user data including metadata
      const adminRole = await getAdminRoleFromClerk(
        clerkUserId,
        adminClerkApiSecret.value()
      );

      // Create Firebase custom token with verified Clerk user data
      // Include adminRole in custom claims for Firestore rules
      const customClaims: Record<string, any> = {
        clerkId: clerkUserId,
        email: email,
        email_verified: emailVerified,
        name: name,
        picture: picture,
      };

      // Add adminRole to custom claims if present
      // The custom claims will be included in the token and set when user signs in
      if (adminRole) {
        customClaims.adminRole = adminRole;
      }

      const firebaseToken = await getAuth().createCustomToken(clerkUserId, customClaims);
      
      // After creating the token, try to sync admin role to Firebase Auth custom claims
      // This will only work if the user already exists, but it's not critical
      // The custom claims in the token will work regardless
      if (adminRole) {
        try {
          await syncAdminRoleToFirebaseAuth(clerkUserId, adminRole);
        } catch (error) {
          // User might not exist yet - that's okay, the token has the claims
          loggerService.info("Could not sync admin role to custom claims (user may not exist yet):", {
            userId: clerkUserId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      loggerService.info("Firebase custom token created for admin user:", clerkUserId);

      return {
        firebaseToken,
        clerkUser: {
          id: clerkUserId,
          email: email,
          name: name,
          picture: picture,
        },
        adminRole: adminRole || null,
      };
    } catch (error) {
      loggerService.error("Error verifying admin Clerk token:", error);
      
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
      
      throw new HttpsError("internal", "Failed to verify admin Clerk token");
    }
  }
);

