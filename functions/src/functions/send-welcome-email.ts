import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { emailService, WelcomeEmailData } from "../services/email-service";
import { loggerService } from "../services/logger-service";
import { defineSecret } from "firebase-functions/params";

// Define secrets
const mailgunApiKey = defineSecret("MAILGUN_API_KEY");
const mailgunDomain = defineSecret("MAILGUN_DOMAIN");
const mailgunFromEmail = defineSecret("MAILGUN_FROM_EMAIL");
const mailgunFromName = defineSecret("MAILGUN_FROM_NAME");

interface SendWelcomeEmailPayload {
  userId: string;
  organizationId: string;
}

export const sendWelcomeEmail = onCall<SendWelcomeEmailPayload>(
  { 
    region: "us-central1",
    secrets: [mailgunApiKey, mailgunDomain, mailgunFromEmail, mailgunFromName]
  },
  async (request) => {
    try {
      const { userId, organizationId } = request.data;

      if (!userId || !organizationId) {
        throw new HttpsError("invalid-argument", "userId and organizationId are required");
      }

      // Get user data from Firestore
      const db = getFirestore();
      const userDoc = await db.collection("users").doc(userId).get();
      
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      if (!userData) {
        throw new HttpsError("not-found", "User data not found");
      }

      // Get organization data
      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const orgData = orgDoc.data();
      if (!orgData) {
        throw new HttpsError("not-found", "Organization data not found");
      }

      // Prepare email data
      const emailData: WelcomeEmailData = {
        userEmail: userData.email,
        userName: userData.name || userData.displayName || "there",
        organizationName: orgData.name,
        dashboardUrl: `https://financely.app/dashboard`,
      };

      // Send the welcome email
      await emailService.sendWelcomeEmail(emailData);

      loggerService.info("Welcome email sent successfully", {
        userId,
        email: userData.email,
        organizationName: orgData.name,
      });

      return {
        success: true,
        message: "Welcome email sent successfully",
      };
    } catch (error) {
      loggerService.error("Error sending welcome email", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to send welcome email: ${error}`);
    }
  }
);