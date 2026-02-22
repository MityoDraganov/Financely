import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { ResendEmailService } from "../services/resend-email-service";
import { defineSecret } from "firebase-functions/params";
import { ORGANIZATION_ROLES } from "../core/roles";
import { AuditLogService } from "../services/audit-log-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

// Define secrets
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendInviteEmailPayload {
  inviteId: string;
  organizationId: string;
}

export const sendInviteEmail = onCall<SendInviteEmailPayload>(
  { 
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName]
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditInviteId: string | undefined;
    let auditInviteCode: string | undefined;
    let auditInviterId: string | undefined;
    let auditInviterName: string | undefined;
    let auditInviterEmail: string | undefined;
    try {
      const { inviteId, organizationId } = request.data;
      auditOrganizationId = organizationId;
      auditInviteId = inviteId;

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
      auditInviteCode = inviteData.code;
      auditInviterId = inviteData.invitedBy;

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
      auditInviterName = inviterData?.name;
      auditInviterEmail = inviterData?.email;

      // Initialize email service
      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      // Prepare email content
      // Use code instead of token - invites have a code field, not token
      if (!inviteData.code) {
        throw new HttpsError("internal", "Invite code is missing");
      }
      const inviteUrl = `https://financely.app/accept-invite?code=${inviteData.code}`;
      const subject = `You're invited to join ${orgData.name}`;
      const html = `
        <h1>You're Invited!</h1>
        <p><strong>${inviterData?.name || "A team member"}</strong> has invited you to join <strong>${orgData.name}</strong>.</p>
        <p>As a ${inviteData.role || ORGANIZATION_ROLES.MEMBER}, you'll have access to:</p>
        <ul>
          <li>Organization dashboard and tools</li>
          <li>Collaborative features</li>
          <li>Team communication channels</li>
        </ul>
        <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a></p>
      `;

      // Send the email
      const emailResult = await emailService.sendEmail({
        to: { email: inviteData.email, name: inviteData.name },
        from: { email: resendFromEmail.value(), name: resendFromName.value() },
        subject,
        html,
      });

      // Check if email was actually sent
      if (!emailResult.success) {
        loggerService.error("Failed to send invite email", {
          inviteId,
          email: inviteData.email,
          error: emailResult.error,
          organizationName: orgData.name,
        });
        throw new HttpsError("internal", `Failed to send invite email: ${emailResult.error || 'Unknown error'}`);
      }

      // Update invite status to "sent"
      await db.collection("invites").doc(inviteId).update({
        status: "sent",
        sentAt: new Date().toISOString(),
      });

      loggerService.info("Invite email sent successfully", {
        inviteId,
        email: inviteData.email,
        messageId: emailResult.messageId,
        organizationName: orgData.name,
      });

      const fallbackAuditUserContext = auditInviterId
        ? AuditLogService.buildUserContext(
            auditInviterId,
            auditInviterId,
            auditInviterEmail || `unknown-${auditInviterId}@financely.local`,
            auditInviterName || "Unknown User",
          )
        : undefined;

      await logAuditSuccessForRequest({
        request,
        operationName: "sendInviteEmail",
        organizationId,
        action: "invite.sent",
        resource: {
          type: "invite",
          id: inviteId,
          name: inviteData.code,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "sendInviteEmail",
          customFields: {
            toEmail: inviteData.email,
          },
        },
        fallbackUserContext: fallbackAuditUserContext,
      });

      return {
        success: true,
        message: "Invite email sent successfully",
      };
    } catch (error) {
      loggerService.error("Error sending invite email", error);

      const fallbackAuditUserContext = auditInviterId
        ? AuditLogService.buildUserContext(
            auditInviterId,
            auditInviterId,
            auditInviterEmail || `unknown-${auditInviterId}@financely.local`,
            auditInviterName || "Unknown User",
          )
        : undefined;

      await logAuditFailureForRequest({
        request,
        operationName: "sendInviteEmail",
        organizationId: auditOrganizationId,
        action: "invite.sent",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditInviteId
          ? {
              type: "invite",
              id: auditInviteId,
              name: auditInviteCode,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "sendInviteEmail",
        },
        fallbackUserContext: fallbackAuditUserContext,
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to send invite email: ${error}`);
    }
  }
);
