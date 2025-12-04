/**
 * Usage Feature Constants
 * 
 * Centralized list of canonical featureId values used across the codebase.
 * All feature IDs should be imported from here to avoid magic strings.
 * 
 * Naming convention: <domain>.<action> or <domain>.<subdomain>.<action>
 * 
 * To add a new tracked feature:
 * 1. Add a new constant below following the naming convention
 * 2. Use it in the relevant domain function
 * 3. Optional: Add limits/billing logic later
 */

/**
 * Invoice-related features
 */
export const USAGE_FEATURES = {
  // Invoice operations
  INVOICE_CREATE: "invoice.create",
  INVOICE_SEND_EMAIL: "invoice.send_email",
  INVOICE_DOWNLOAD_PDF: "invoice.download_pdf",
  INVOICE_PUBLIC_VIEW: "invoice.public_view",
  INVOICE_PAYMENT_ATTEMPT: "invoice.payment_attempt",
  INVOICE_PAID: "invoice.paid",
  INVOICE_RENDER_PDF: "invoice.render_pdf",
  
  // Proposal operations
  PROPOSAL_CREATE: "proposal.create",
  PROPOSAL_SEND: "proposal.send",
  PROPOSAL_CONVERT_TO_INVOICE: "proposal.convert_to_invoice",
  PROPOSAL_APPROVE: "proposal.approve",
  PROPOSAL_REJECT: "proposal.reject",
  
  // Workflow operations
  WORKFLOW_TRIGGER: "workflow.trigger",
  WORKFLOW_RUN: "workflow.run",
  WORKFLOW_FAIL: "workflow.fail",
  WORKFLOW_ACTION_HTTP_REQUEST: "workflow.action.http_request",
  WORKFLOW_ACTION_EMAIL: "workflow.action.email",
  WORKFLOW_ACTION_SLACK: "workflow.action.slack",
  WORKFLOW_ACTION_CREATE_INVOICE: "workflow.action.create_invoice",
  WORKFLOW_ACTION_CREATE_PROPOSAL: "workflow.action.create_proposal",
  
  // AI features
  AI_SITE_BUILDER_GENERATE: "ai.site_builder.generate",
  AI_SITE_BUILDER_CHAT: "ai.site_builder.chat",
  AI_INVOICE_AUTOFILL: "ai.invoice.autofill",
  AI_PROPOSAL_GENERATE: "ai.proposal.generate",
  AI_EMAIL_TEMPLATE_GENERATE: "ai.email_template.generate",
  AI_INVOICE_TEMPLATE_GENERATE: "ai.invoice_template.generate",
  
  // Widget features
  WIDGET_FORM_SUBMIT: "widget.form.submit",
  WIDGET_ANALYTICS_EVENT: "widget.analytics.event",
  
  // Authentication and organization
  AUTH_LOGIN: "auth.login",
  ORG_MEMBER_INVITE: "org.member.invite",
  ORG_MEMBER_REMOVE: "org.member.remove",
  
  // Invoice extraction features
  INVOICE_EXTRACTION_UPLOAD: "invoice.extraction.upload",
  INVOICE_EXTRACTION_PROCESS: "invoice.extraction.process",
  INVOICE_EXTRACTION_CREATE_INVOICE: "invoice.extraction.create_invoice",
  INVOICE_EXTRACTION_CREATE_PATTERN: "invoice.extraction.create_pattern",
  INVOICE_EXTRACTION_BULK_PROCESS: "invoice.extraction.bulk_process",
  TEMPLATE_GENERATE_FROM_EXTRACTION: "template.generate_from_extraction",
} as const;

/**
 * Type for feature IDs
 */
export type UsageFeatureId = typeof USAGE_FEATURES[keyof typeof USAGE_FEATURES];





