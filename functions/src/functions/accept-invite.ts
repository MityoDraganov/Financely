import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { loggerService } from "../services/logger-service";
import { defineSecret } from "firebase-functions/params";
import { ResendEmailService } from "../services/resend-email-service";
import { ORGANIZATION_ROLES } from "../core/roles";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface AcceptInvitePayload {
  code: string;
}

interface AcceptInviteResponse {
  success: boolean;
  organizationId: string;
  message: string;
}

export const acceptInvite = onCall<AcceptInvitePayload, Promise<AcceptInviteResponse>>(
  { 
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName]
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditInviteId: string | undefined;
    let auditInviteCode: string | undefined;
    try {
      const { code } = request.data;
      const auth = request.auth;

      if (!auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      if (!code) {
        throw new HttpsError("invalid-argument", "Invite code is required");
      }

      const db = getFirestore();

      loggerService.info("Accepting invite", {
        code,
        userId: auth.uid,
      });

      // Use a transaction to prevent race conditions
      const result = await db.runTransaction(async (transaction) => {
        // Get invite by code
        const inviteQuery = await db.collection("invites")
          .where("code", "==", code)
          .limit(1)
          .get();

        if (inviteQuery.empty) {
          throw new HttpsError("not-found", "Invalid invite code");
        }

        const inviteDoc = inviteQuery.docs[0];
        const inviteData = inviteDoc.data();
        const inviteId = inviteDoc.id;
        auditOrganizationId = inviteData.organizationId;
        auditInviteId = inviteId;
        auditInviteCode = inviteData.code || code;

        // Check if invite is still valid
        // Accept invites with status "active" (created but email not sent) or "sent" (email sent)
        const validStatuses = ["active", "sent"];
        if (!validStatuses.includes(inviteData.status)) {
          // If invite was used by the current user, check if they're in the org
          if (inviteData.status === "used" && inviteData.usedBy === auth.uid) {
            const orgDoc = await transaction.get(
              db.collection("organizations").doc(inviteData.organizationId)
            );
            
            if (orgDoc.exists) {
              const orgData = orgDoc.data();
              if (orgData?.memberIds?.includes(auth.uid)) {
                loggerService.info("User already accepted invite and is in organization", {
                  inviteId,
                  userId: auth.uid,
                  organizationId: inviteData.organizationId,
                });
                return {
                  success: true,
                  organizationId: inviteData.organizationId,
                  message: "Invite already accepted",
                  inviteId,
                  inviteCode: inviteData.code || code,
                };
              }
            }
          }
          
          loggerService.warn("Invite is not in a valid status for acceptance", {
            inviteId,
            status: inviteData.status,
            usedBy: inviteData.usedBy,
            currentUser: auth.uid,
          });
          throw new HttpsError("failed-precondition", `Invite has already been used or revoked. Status: ${inviteData.status}`);
        }

        // Check if invite has expired
        if (new Date(inviteData.expiresAt) < new Date()) {
          loggerService.warn("Invite has expired", {
            inviteId,
            expiresAt: inviteData.expiresAt,
          });
          throw new HttpsError("failed-precondition", "Invite has expired");
        }

        // Get organization
        const orgRef = db.collection("organizations").doc(inviteData.organizationId);
        const orgDoc = await transaction.get(orgRef);

        if (!orgDoc.exists) {
          throw new HttpsError("not-found", "Organization not found");
        }

        const orgData = orgDoc.data();
        if (!orgData) {
          throw new HttpsError("not-found", "Organization data not found");
        }

        // Check if user is already in the organization
        if (orgData.memberIds?.includes(auth.uid)) {
          loggerService.info("User already in organization, marking invite as used", {
            inviteId,
            userId: auth.uid,
            organizationId: inviteData.organizationId,
          });
          
          // Mark invite as used
          transaction.update(inviteDoc.ref, {
            status: "used",
            usedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usedBy: auth.uid,
          });

          return {
            success: true,
            organizationId: inviteData.organizationId,
            message: "User already in organization",
            inviteId,
            inviteCode: inviteData.code || code,
          };
        }

        // Get user data
        const userRef = db.collection("users").doc(auth.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new HttpsError("not-found", "User not found");
        }

        const userData = userDoc.data();
        if (!userData) {
          throw new HttpsError("not-found", "User data not found");
        }

        // Update invite status FIRST to prevent race conditions
        transaction.update(inviteDoc.ref, {
          status: "used",
          usedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usedBy: auth.uid,
        });

        // Add user to organization's memberIds array
        const currentMemberIds = orgData.memberIds || [];
        if (!currentMemberIds.includes(auth.uid)) {
          transaction.update(orgRef, {
            memberIds: [...currentMemberIds, auth.uid],
            updatedAt: new Date().toISOString(),
          });
        }

        // Update user's organization roles
        const currentRoles = userData.organizationRoles || {};
        const role = inviteData.role || ORGANIZATION_ROLES.MEMBER;
        transaction.update(userRef, {
          organizationRoles: {
            ...currentRoles,
            [inviteData.organizationId]: role,
          },
          updatedAt: new Date().toISOString(),
        });

        loggerService.info("Invite accepted successfully", {
          inviteId,
          userId: auth.uid,
          organizationId: inviteData.organizationId,
          role,
        });

        // Send welcome email (outside transaction to avoid blocking)
        // This is done after the transaction commits
        setImmediate(async () => {
          try {
            const emailService = new ResendEmailService({
              apiKey: resendApiKey.value(),
              defaultFromEmail: resendFromEmail.value(),
              defaultFromName: resendFromName.value(),
            });

            const userName = userData.name || userData.displayName || "there";
            const dashboardUrl = "https://financely.app/dashboard";
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

            const emailResult = await emailService.sendEmail({
              to: { email: userData.email, name: userName },
              from: { email: resendFromEmail.value(), name: resendFromName.value() },
              subject,
              html,
            });

            if (!emailResult.success) {
              loggerService.error("Failed to send welcome email", {
                userId: auth.uid,
                email: userData.email,
                error: emailResult.error,
                organizationName: orgData.name,
              });
            } else {
              loggerService.info("Welcome email sent successfully", {
                userId: auth.uid,
                email: userData.email,
                messageId: emailResult.messageId,
                organizationName: orgData.name,
              });
            }
          } catch (error) {
            loggerService.error("Error sending welcome email", error);
            // Don't throw - email failure shouldn't block invite acceptance
          }
        });

        return {
          success: true,
          organizationId: inviteData.organizationId,
          message: "Invite accepted successfully",
          inviteId,
          inviteCode: inviteData.code || code,
        };
      });

      await logAuditSuccessForRequest({
        request,
        operationName: "acceptInvite",
        organizationId: result.organizationId,
        action: "invite.accepted",
        resource: {
          type: "invite",
          id: result.inviteId,
          name: result.inviteCode,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "acceptInvite",
        },
      });

      return {
        success: result.success,
        organizationId: result.organizationId,
        message: result.message,
      };
    } catch (error) {
      loggerService.error("Error accepting invite", error);

      await logAuditFailureForRequest({
        request,
        operationName: "acceptInvite",
        organizationId: auditOrganizationId,
        action: "invite.accepted",
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
          sourceDetails: "acceptInvite",
        },
      });
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", `Failed to accept invite: ${error}`);
    }
  }
);
