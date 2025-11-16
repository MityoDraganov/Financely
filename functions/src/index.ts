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
export { mapProductToInvoiceFields } from "./functions/map-product-to-invoice-fields";
export { sendInvoiceEmail } from "./functions/send-invoice-email";
export { generateInvoiceShareLink } from "./functions/generate-invoice-share-link";

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
export { acceptInvite } from "./functions/accept-invite";
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
export { restoreWidgetVersion } from "./functions/restore-widget-version";
export { saveWidgetVersion } from "./functions/save-widget-version";
export { translateWidgetText } from "./functions/translate-widget-text";

// Lead functions
export { onLeadCreated } from "./functions/on-lead-created";
export { generateProposalSuggestion } from "./functions/generate-proposal-suggestion";
export { generateInvoiceTemplate } from "./functions/generate-invoice-template";
export { convertProposalToInvoice } from "./functions/convert-proposal-to-invoice";
export { generateInvoiceFromProposal } from "./functions/generate-invoice-from-proposal";
export { generateWidget } from "./functions/generate-widget";
export { generateConsentBanner } from "./functions/generate-consent-banner";

// Product functions
export { createProduct } from "./functions/create-product";

// Analytics functions
export { getAnalyticsMetrics } from "./functions/get-analytics-metrics";
export { storeAnalyticsEvent } from "./functions/store-analytics-event";
export { updateAnalyticsScript } from "./functions/update-analytics-script";

// Audit log functions
export { createAuditLog } from "./functions/create-audit-log";
export { queryAuditLogs } from "./functions/query-audit-logs";

// Firestore audit triggers (automatic document change logging)
export { auditDocumentChanges } from "./functions/firestore-audit-triggers";
