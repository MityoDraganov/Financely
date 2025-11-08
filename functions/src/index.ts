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
export { restoreBrandSiteVersion } from "./functions/restore-brand-site-version";
export { previewBrandSiteVersion } from "./functions/preview-brand-site-version";
export { onBrandSiteCreated, onBrandSiteUpdated } from "./functions/brand-site-processor";

// Widget functions
export { getWidgetConfig } from "./functions/get-widget-config";
export { submitWidgetForm } from "./functions/submit-widget-form";
export { deployManualSite } from "./functions/deploy-manual-site";

// Lead functions
export { onLeadCreated } from "./functions/on-lead-created";
export { generateProposalSuggestion } from "./functions/generate-proposal-suggestion";

// Product functions
export { createProduct } from "./functions/create-product";
