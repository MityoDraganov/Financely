import { getApps, initializeApp } from "firebase-admin/app";

/**
 * Initialize Firebase app
 */
if (!getApps().length) {
  initializeApp();
}

// Invoice functions
export { createInvoice } from "./functions/create-invoice";
export { renderInvoicePdf } from "./functions/render-invoice-pdf";

// Workflow functions
export { createWorkflow } from "./functions/create-workflow";

// Invite functions
export { createInvite } from "./functions/create-invite";
export { revokeInvite } from "./functions/revoke-invite";

// Email functions
export { sendInviteEmail } from "./functions/send-invite-email";
export { sendWelcomeEmail } from "./functions/send-welcome-email";

// Clerk webhook functions
export { onClerkWebhookEvent } from "./functions/clerk/on-clerk-event-webhook";

// Clerk authentication functions
export { verifyClerkToken } from "./functions/clerk/verify-clerk-token";

// Email service
export { emailService } from "./services/email-service";
