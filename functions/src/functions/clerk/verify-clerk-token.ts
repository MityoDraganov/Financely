import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";

export const verifyClerkToken = onCall(async (request) => {
  try {
    const { clerkToken } = request.data;

    if (!clerkToken) {
      throw new HttpsError("invalid-argument", "Clerk token is required");
    }

    // For now, we'll create a simple Firebase token without Clerk verification
    // This is a temporary solution until we implement proper JWT verification
    const firebaseToken = await getAuth().createCustomToken("clerk-user", {
      clerkId: "clerk-user",
      email: "user@example.com",
      email_verified: true,
      name: "Clerk User",
      picture: "",
    });

    return {
      firebaseToken,
      clerkUser: {
        id: "clerk-user",
        email: "user@example.com",
        name: "Clerk User",
        picture: "",
      },
    };
  } catch (error) {
    console.error("Error verifying Clerk token:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "Failed to verify Clerk token");
  }
});
