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
export { generateProductTableConfig } from "./functions/generate-product-table-config";
export { sendInvoiceEmail } from "./functions/send-invoice-email";
export { previewInvoiceEmail } from "./functions/preview-invoice-email";
export { sendProposalEmail } from "./functions/send-proposal-email";
export { generateInvoiceShareLink } from "./functions/generate-invoice-share-link";

// Invoice extraction (single callable with action: upload | extract | generateTemplate)
export { invoiceExtraction } from "./functions/invoice-extraction";

// Workflow functions
export { createWorkflow } from "./functions/create-workflow";

// Workflow execution functions
export { 
  onInvoiceCreated, 
  onInvoicePaid,
  onInvoiceSent,
  onLeadConverted,
  onLeadQualified,
  onContactCreated,
  onContactUpdated,
  onProposalCreated,
  onProposalStatusChanged,
  onCommercialCaseCreated,
  onCommercialCaseStageChanged,
  onProductCreated,
  onProductLowStock,
  checkCronWorkflows,
  checkOverdueInvoices,
  checkContractExpiry,
  triggerWorkflow, 
  executeStep, 
  webhookHandler 
} from "./functions/workflow-triggers";

// Note: onLeadCreated (lead.created trigger) is exported from ./functions/on-lead-created
// Note: onClerkWebhookEvent (user.joined trigger) is exported from ./functions/clerk/on-clerk-event-webhook

export { 
  createWorkflow as createWorkflowV2, 
  updateWorkflow, 
  getWorkflow, 
  listWorkflows, 
  deleteWorkflow 
} from "./functions/workflow-management";

// Organization functions
export { createOrganization } from "./functions/create-organization";

// Invite functions
export { createInvite } from "./functions/create-invite";
export { acceptInvite } from "./functions/accept-invite";
export { generateResumeLink } from "./functions/generate-resume-link";
export { revokeInvite } from "./functions/revoke-invite";
export { revokeMember } from "./functions/revoke-member";
export { transferOrganizationOwnership } from "./functions/transfer-organization-ownership";

// Email functions
export { sendInviteEmail } from "./functions/send-invite-email";
export { sendWelcomeEmail } from "./functions/send-welcome-email";
export { sendAbandonmentEmails } from "./functions/send-abandonment-emails";

// Clerk webhook functions
export { onClerkWebhookEvent } from "./functions/clerk/on-clerk-event-webhook";

// Stripe webhook functions
export { onStripeWebhook } from "./functions/stripe/on-stripe-webhook";

// Stripe billing functions
export { createCheckoutSession } from "./functions/stripe/create-checkout-session";
export { createPortalSession } from "./functions/stripe/create-portal-session";
export { getStripeBilling } from "./functions/stripe/get-stripe-billing";

// Clerk authentication functions
export { verifyClerkToken } from "./functions/clerk/verify-clerk-token";
export { verifyAdminClerkToken } from "./functions/clerk/verify-admin-clerk-token";

// Email service functions
export { 
  sendEmail, 
  sendTemplateEmail, 
  sendWorkflowEmail 
} from "./functions/send-email";

// Brand site functions
export { generateSite } from "./functions/generate-site";
export { regenerateSite } from "./functions/regenerate-site";
export { chatGenerateSite } from "./functions/chat-generate-site";
export { addCustomDomain } from "./functions/add-custom-domain";
export { removeCustomDomain } from "./functions/remove-custom-domain";
export { restoreBrandSiteVersion } from "./functions/restore-brand-site-version";
export { previewBrandSiteVersion } from "./functions/preview-brand-site-version";
export { updateBrandSitePages } from "./functions/update-brand-site-pages";
export { getBlogArticles } from "./functions/get-blog-articles";
export { improveText } from "./functions/improve-text";
export { deleteBrandSite } from "./functions/delete-brand-site";
export { cleanupPreviewSites } from "./functions/cleanup-preview-sites";
export { onBrandSiteCreated, onBrandSiteUpdated } from "./functions/brand-site-processor";
export { onBrandSitePublicDomainUpdated } from "./functions/on-brand-site-public-domain-updated";
export { publishBrandSite } from "./functions/publish-brand-site";

// Widget functions
export { getWidgetConfig } from "./functions/get-widget-config";
export {
  getPublicProductPage,
  getPublicProductPage as getPublicOrgProductsPage,
  getPublicProductPage as getPublicCollectionProductsPage,
  getPublicProductPage as getPublicProductDetailPage,
} from "./functions/get-public-product-page";
export { servePublicCatalog } from "./functions/serve-public-catalog";
export { submitWidgetForm } from "./functions/submit-widget-form";
export { submitModularWidget } from "./functions/submit-modular-widget";
export { deployManualSite } from "./functions/deploy-manual-site";
export { restoreWidgetVersion } from "./functions/restore-widget-version";
export { createWidgetDefinition } from "./functions/create-widget-definition";
export { updateWidgetDefinition } from "./functions/update-widget-definition";
export { deleteWidgetDefinition } from "./functions/delete-widget-definition";
export { saveModularWidgetVersion } from "./functions/save-modular-widget-version";
export { getModularWidgetDraft } from "./functions/get-modular-widget-draft";
export { listWidgetDefinitions } from "./functions/list-widget-definitions";
export { getModularWidgetConfig } from "./functions/get-modular-widget-config";
export { publishModularWidget } from "./functions/publish-modular-widget";
export { unpublishModularWidget } from "./functions/unpublish-modular-widget";
export { listModularWidgetVersions } from "./functions/list-modular-widget-versions";

// Admin functions
export { getAdminDashboardStats } from "./functions/admin/get-admin-dashboard-stats";
export { adminGetOrganizations } from "./functions/admin/admin-get-organizations";
export { adminUpdateOrganization } from "./functions/admin/admin-update-organization";
export { adminUpdateUser } from "./functions/admin/admin-update-user";
export { adminUpdateSystemSettings, adminGetSystemSettings } from "./functions/admin/admin-update-system-settings";
export { adminOverrideUsage } from "./functions/admin/admin-override-usage";
export { saveWidgetVersion } from "./functions/save-widget-version";
export { translateWidgetText } from "./functions/translate-widget-text";

// Analytics functions
export { getAnalyticsConfig } from "./functions/get-analytics-config";

// Lead functions
export { onLeadCreated } from "./functions/on-lead-created";
export { generateProposalSuggestion } from "./functions/generate-proposal-suggestion";
export { generateInvoiceTemplate } from "./functions/generate-invoice-template";
export { generateEmailTemplate } from "./functions/generate-email-template";
export { listAiModels } from "./functions/list-ai-models";
export { convertProposalToInvoice } from "./functions/convert-proposal-to-invoice";
export { generateInvoiceFromProposal } from "./functions/generate-invoice-from-proposal";
export { createCommercialCase } from "./functions/create-commercial-case";
export { advanceCommercialCaseStage } from "./functions/advance-commercial-case-stage";
export { overrideCommercialCaseStage } from "./functions/override-commercial-case-stage";
export { createProposalForCase } from "./functions/create-proposal-for-case";
export { createInvoiceForCase } from "./functions/create-invoice-for-case";
export { convertProposalToInvoiceForCase } from "./functions/convert-proposal-to-invoice-for-case";
export { generateWidget } from "./functions/generate-widget";
export { generateConsentBanner } from "./functions/generate-consent-banner";

// Product functions
export { createProduct } from "./functions/create-product";

// Content functions - Metaobjects and Files
export { createMetaobjectDefinition } from "./functions/create-metaobject-definition";
export { createMetaobject } from "./functions/create-metaobject";
export { createContentFile } from "./functions/create-content-file";
export { createProductMetafieldDefinition } from "./functions/create-product-metafield-definition";
export { createContactMetafieldDefinition } from "./functions/create-contact-metafield-definition";

// File upload functions
export { uploadFile } from "./functions/upload-file";

// Storage proxy functions (for CORS)
export { proxyStorageImage } from "./functions/proxy-storage-image";

// Analytics functions
export { getAnalyticsMetrics } from "./functions/get-analytics-metrics";
export { storeAnalyticsEvent } from "./functions/store-analytics-event";
export { updateAnalyticsScript } from "./functions/update-analytics-script";

// Audit log functions
export { createAuditLog } from "./functions/create-audit-log";
export { queryAuditLogs } from "./functions/query-audit-logs";

// Firestore audit triggers (automatic document change logging)
export { auditDocumentChanges } from "./functions/firestore-audit-triggers";

// Brand context cache invalidation triggers
export { onOrganizationUpdated } from "./functions/on-organization-updated";
export { onProductWritten } from "./functions/on-product-updated";
export { onProductMetafieldWritten, onProductMetafieldDefinitionWritten } from "./functions/on-product-metafields-updated";
export { backfillProductPublicPages } from "./functions/backfill-product-public-pages";
export { backfillOrganizationPublicSlugs } from "./functions/backfill-organization-public-slugs";

// Billing and usage functions
export { getUsageHistory } from "./functions/get-usage-history";

// Data export/import functions
export { exportData } from "./functions/export-data";
export { getExportJob } from "./functions/get-export-job";
export { importData } from "./functions/import-data";
export { getImportJob } from "./functions/get-import-job";

// Organization duplication functions
export { duplicateOrganization } from "./functions/duplicate-organization";

// Onboarding functions
export { interpretBusinessDescription } from "./functions/interpret-business-description";

// Marketplace functions
export { listMarketplaceTemplates } from "./functions/list-marketplace-templates";
export { getMarketplaceTemplate } from "./functions/get-marketplace-template";
export { addMarketplaceTemplate } from "./functions/add-marketplace-template";
export { submitMarketplaceTemplate } from "./functions/submit-marketplace-template";
export { publishMarketplaceTemplateVersion } from "./functions/publish-marketplace-template-version";
export { featureMarketplaceTemplate, unfeatureMarketplaceTemplate } from "./functions/moderate-marketplace-template";
export { submitMarketplaceReview, getMarketplaceReviews } from "./functions/marketplace-reviews";
export { registerAsContributor, getContributorStatus } from "./functions/manage-contributor";
export { onMarketplaceTemplateCreated } from "./functions/on-marketplace-template-created";
export { generateOfficialTemplatePack } from "./functions/generate-official-template-pack";
export { publishOfficialTemplatePack } from "./functions/publish-official-template-pack";
export { getTemplatePreviewHtml } from "./functions/get-template-preview-html";
