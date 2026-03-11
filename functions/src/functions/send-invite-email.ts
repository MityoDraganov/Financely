import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { loggerService } from "../services/logger-service";
import { ResendEmailService } from "../services/resend-email-service";
import { defineSecret } from "firebase-functions/params";
import { ORGANIZATION_ROLES } from "../core/roles";
import { AuditLogService } from "../services/audit-log-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";
import {
  getEmailBrandingConfig,
  generateInviteEmailHTML,
} from "../utils/branding-email";

// Define secrets
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

interface SendInviteEmailPayload {
  inviteId: string;
  organizationId: string;
}

interface ParsedDataImage {
  contentType: string;
  extension: string;
  buffer: Buffer;
}

const MAX_DATA_IMAGE_BYTES = 2 * 1024 * 1024;

function parseDataImageUrl(dataUrl: string): ParsedDataImage | null {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.+)$/i);
  if (!match) return null;

  const rawType = (match[1] || "").trim().toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";

  if (!rawType.startsWith("image/")) return null;

  const contentType = rawType === "image/jpg" ? "image/jpeg" : rawType;

  let buffer: Buffer;
  try {
    buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
  } catch {
    return null;
  }

  const extensionByType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "image/x-icon": "ico",
  };

  return {
    contentType,
    extension: extensionByType[contentType] || "img",
    buffer,
  };
}

function getHostedImageOrigin(fromEmail: string): string {
  const domain = fromEmail.split("@")[1]?.trim().toLowerCase();
  if (!domain) return "https://financely.app";

  // Use sending domain only when it is a Financely-managed domain.
  if (domain.endsWith("financely.app")) {
    return `https://${domain}`;
  }

  return "https://financely.app";
}

function buildHostedEmailImageUrl(origin: string, storagePath: string): string {
  return `${origin}/email-image?path=${encodeURIComponent(storagePath)}`;
}

export const sendInviteEmail = onCall<SendInviteEmailPayload>(
  {
    region: "us-central1",
    secrets: [resendApiKey, resendFromEmail, resendFromName],
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

      const orgDoc = await db.collection("organizations").doc(organizationId).get();
      if (!orgDoc.exists) {
        throw new HttpsError("not-found", "Organization not found");
      }

      const orgData = orgDoc.data();
      if (!orgData) {
        throw new HttpsError("not-found", "Organization data not found");
      }

      const inviterDoc = await db.collection("users").doc(inviteData.invitedBy).get();
      const inviterData = inviterDoc.exists ? inviterDoc.data() : null;
      auditInviterName = inviterData?.name;
      auditInviterEmail = inviterData?.email;

      const emailService = new ResendEmailService({
        apiKey: resendApiKey.value(),
        defaultFromEmail: resendFromEmail.value(),
        defaultFromName: resendFromName.value(),
      });

      if (!inviteData.code) {
        throw new HttpsError("internal", "Invite code is missing");
      }

      const inviteUrl = `https://financely.app/accept-invite?code=${inviteData.code}`;
      const subject = `You're invited to join ${orgData.name} on Financely`;
      const hostedImageOrigin = getHostedImageOrigin(resendFromEmail.value());

      const branding = getEmailBrandingConfig({
        ...orgData,
        id: organizationId,
        createdAt: orgData.createdAt || new Date().toISOString(),
        updatedAt: orgData.updatedAt || new Date().toISOString(),
      } as Parameters<typeof getEmailBrandingConfig>[0]);

      const expirationDate = inviteData.expiresAt
        ? new Date(inviteData.expiresAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : undefined;

      const rawLogoUrl: string | undefined =
        orgData.settings?.branding?.customLogo || orgData.logoUrl;
      let organizationLogoUrl: string | null = null;

      if (rawLogoUrl) {
        if (rawLogoUrl.startsWith("data:image/")) {
          const parsedDataImage = parseDataImageUrl(rawLogoUrl);
          if (!parsedDataImage) {
            loggerService.warn("Invalid data-image URL for invite logo", {
              inviteId,
              organizationId,
            });
          } else if (parsedDataImage.buffer.length > MAX_DATA_IMAGE_BYTES) {
            loggerService.warn("Invite data-image logo exceeds max size", {
              inviteId,
              organizationId,
              sizeBytes: parsedDataImage.buffer.length,
              maxBytes: MAX_DATA_IMAGE_BYTES,
            });
          } else {
            const storagePath =
              `organizations/${organizationId}/email-assets/invites/` +
              `${inviteId}-${Date.now()}.${parsedDataImage.extension}`;

            const bucket = getStorage().bucket();
            const file = bucket.file(storagePath);
            await file.save(parsedDataImage.buffer, {
              metadata: {
                contentType: parsedDataImage.contentType,
                metadata: {
                  organizationId,
                  inviteId,
                  source: "invite-data-url-logo",
                  uploadedAt: new Date().toISOString(),
                },
              },
            });

            organizationLogoUrl = buildHostedEmailImageUrl(hostedImageOrigin, storagePath);
          }
        }

        if (!organizationLogoUrl) {
          try {
            const logoCheck = await fetch(rawLogoUrl, {
              method: "HEAD",
              signal: AbortSignal.timeout(3000),
            });
            if (logoCheck.ok) {
              organizationLogoUrl = rawLogoUrl;
            }
          } catch {
            // Not reachable — leave null so the initial avatar is shown.
          }
        }
      }

      const html = generateInviteEmailHTML(
        {
          inviterName: inviterData?.name || "A team member",
          inviterEmail: inviterData?.email,
          organizationName: orgData.name,
          organizationLogoUrl,
          role: inviteData.role || ORGANIZATION_ROLES.MEMBER,
          inviteLink: inviteUrl,
          expirationDate,
        },
        branding
      );

      const emailResult = await emailService.sendEmail({
        to: { email: inviteData.email, name: inviteData.name },
        from: { email: resendFromEmail.value(), name: resendFromName.value() },
        subject,
        html,
      });

      if (!emailResult.success) {
        loggerService.error("Failed to send invite email", {
          inviteId,
          email: inviteData.email,
          error: emailResult.error,
          organizationName: orgData.name,
        });
        throw new HttpsError("internal", `Failed to send invite email: ${emailResult.error || "Unknown error"}`);
      }

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
            auditInviterName || "Unknown User"
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
            auditInviterName || "Unknown User"
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
