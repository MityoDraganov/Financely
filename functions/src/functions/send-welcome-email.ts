import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { ResendEmailService } from "../services/resend-email-service";
import { defineSecret } from "firebase-functions/params";
import { buildAppUrl } from "../config/app-url";

// Define secrets
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendWelcomeEmailPayload {
  userId: string;
  organizationId: string;
}

export const sendWelcomeEmail = onCall<SendWelcomeEmailPayload>(
  { 
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName]
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

      // Initialize email service
      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      // Prepare email content
      const userName = userData.name || userData.displayName || "there";
      const dashboardUrl = buildAppUrl("/dashboard");
      const subject = `Welcome to ${orgData.name}, ${userName}!`;
      const html = `
        <h1>Welcome ${userName}!</h1>
        <p>Thank you for joining <strong>${orgData.name}</strong>.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Complete your profile setup</li>
          <li>Explore our features</li>
          <li>Connect with our support team if you need help</li>
        </ul>
        <p><a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started</a></p>
      `;

      // Send the welcome email
      await emailService.sendEmail({
        to: { email: userData.email, name: userName },
        from: { email: resendFromEmail.value(), name: resendFromName.value() },
        subject,
        html,
      });

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
