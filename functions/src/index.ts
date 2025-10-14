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

// Email functions
export { sendInviteEmail } from "./functions/send-invite-email";
export { sendWelcomeEmail } from "./functions/send-welcome-email";

// Clerk webhook functions
export { onClerkWebhookEvent } from "./functions/clerk/on-clerk-event-webhook";

// Clerk authentication functions
export { verifyClerkToken } from "./functions/clerk/verify-clerk-token";

// Email service
export { emailService } from "./services/email-service";
