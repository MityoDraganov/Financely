import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { emailService, InviteEmailData } from "../services/email-service";
import { loggerService } from "../services/logger-service";
import { defineSecret } from "firebase-functions/params";

// Define secrets
const mailgunApiKey = defineSecret("MAILGUN_API_KEY");
const mailgunDomain = defineSecret("MAILGUN_DOMAIN");
const mailgunFromEmail = defineSecret("MAILGUN_FROM_EMAIL");
const mailgunFromName = defineSecret("MAILGUN_FROM_NAME");

interface SendInviteEmailPayload {
  inviteId: string;
  organizationId: string;
}

export const sendInviteEmail = onCall<SendInviteEmailPayload>(
  { 
    region: "us-central1",
    secrets: [mailgunApiKey, mailgunDomain, mailgunFromEmail, mailgunFromName]
  },
  async (request) => {
    try {
      const { inviteId, organizationId } = request.data;

      if (!inviteId || !organizationId) {
        throw new HttpsError("invalid-argument", "inviteId and organizationId are required");
      }

      // Get invite data from Firestore
      const db = getFirestore();
      const inviteDoc = await db.collection("invites").doc(inviteId).get();
      
      if (!inviteDoc.exists) {
        throw new HttpsError("not-found", "Invite not found");
      }

      const inviteData = inviteDoc.data();
      if (!inviteData) {
        throw new HttpsError("not-found", "Invite data not found");
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

      // Get inviter data
      const inviterDoc = await db.collection("users").doc(inviteData.invitedBy).get();
      const inviterData = inviterDoc.exists ? inviterDoc.data() : null;

      // Prepare email data
      const emailData: InviteEmailData = {
        inviteeEmail: inviteData.email,
        inviteeName: inviteData.name || undefined,
        inviterName: inviterData?.name || "A team member",
        organizationName: orgData.name,
        inviteUrl: `https://financely.app/accept-invite?token=${inviteData.token}`,
        role: inviteData.role,
      };

      // Send the email
      await emailService.sendInviteEmail(emailData);

      // Update invite status to "sent"
      await db.collection("invites").doc(inviteId).update({
        status: "sent",
        sentAt: new Date().toISOString(),
      });

      loggerService.info("Invite email sent successfully", {
        inviteId,
        email: inviteData.email,
        organizationName: orgData.name,
      });

      return {
        success: true,
        message: "Invite email sent successfully",
      };
    } catch (error) {
      loggerService.error("Error sending invite email", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to send invite email: ${error}`);
    }
  }
);