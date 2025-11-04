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

// Workflow execution functions
export { 
  onInvoiceCreated, 
  onInvoicePaid, 
  triggerWorkflow, 
  executeStep, 
  webhookHandler 
} from "./functions/workflow-triggers";

export { 
  createWorkflow as createWorkflowV2, 
  updateWorkflow, 
  getWorkflow, 
  listWorkflows, 
  deleteWorkflow 
} from "./functions/workflow-management";

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

// Email service functions
export { 
  sendEmail, 
  sendTemplateEmail, 
  sendWorkflowEmail 
} from "./functions/send-email";

// Brand site functions
export { generateSite } from "./functions/generate-site";
export { regenerateSite } from "./functions/regenerate-site";
export { addCustomDomain } from "./functions/add-custom-domain";
export { onBrandSiteCreated, onBrandSiteUpdated } from "./functions/brand-site-processor";
