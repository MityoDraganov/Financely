import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Audit log action types - comprehensive list of all trackable actions
 */
export const auditLogActionTypeSchema = z.enum([
  // Authentication & User Management
  "user.login",
  "user.logout",
  "user.created",
  "user.updated",
  "user.deleted",
  "user.suspended",
  "user.reactivated",
  "user.password_changed",
  "user.email_changed",
  
  // Organization Management
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "organization.settings.updated",
  "organization.branding.updated",
  "organization.billing.updated",
  "organization.subscription.changed",
  
  // Member & Invite Management
  "member.added",
  "member.removed",
  "member.role_changed",
  "invite.created",
  "invite.sent",
  "invite.accepted",
  "invite.revoked",
  "invite.expired",
  
  // Invoice Operations
  "invoice.created",
  "invoice.updated",
  "invoice.deleted",
  "invoice.sent",
  "invoice.paid",
  "invoice.overdue",
  "invoice.cancelled",
  "invoice.refunded",
  "invoice.pdf.generated",
  "invoice.pdf.downloaded",
  
  // Proposal Operations
  "proposal.created",
  "proposal.updated",
  "proposal.deleted",
  "proposal.sent",
  "proposal.accepted",
  "proposal.rejected",
  "proposal.expired",
  "proposal.converted_to_invoice",
  
  // Product Operations
  "product.created",
  "product.updated",
  "product.deleted",
  "product.archived",
  "product.activated",
  
  // Contact Operations
  "contact.created",
  "contact.updated",
  "contact.deleted",
  "contact.merged",
  "contact.imported",
  
  // Lead Operations
  "lead.created",
  "lead.updated",
  "lead.deleted",
  "lead.converted",
  "lead.qualified",
  "lead.disqualified",
  
  // Template Operations
  "template.created",
  "template.updated",
  "template.deleted",
  "template.published",
  "template.archived",
  "template.version.created",
  "template.version.restored",
  
  // Workflow Operations
  "workflow.created",
  "workflow.updated",
  "workflow.deleted",
  "workflow.activated",
  "workflow.paused",
  "workflow.archived",
  "workflow.executed",
  "workflow.step.completed",
  "workflow.step.failed",
  
  // Site Builder Operations
  "site.created",
  "site.updated",
  "site.deleted",
  "site.published",
  "site.deployed",
  "site.version.created",
  "site.version.restored",
  "site.domain.added",
  "site.domain.removed",
  "site.pages.updated",
  
  // Analytics & Configuration
  "analytics.config.updated",
  "analytics.script.updated",
  "analytics.event.tracked",
  
  // Security & Access
  "access.granted",
  "access.revoked",
  "permission.changed",
  "api_key.created",
  "api_key.revoked",
  "api_key.rotated",
  "session.created",
  "session.terminated",
  
  // Settings & Configuration
  "settings.general.updated",
  "settings.ai.updated",
  "settings.security.updated",
  "settings.integration.added",
  "settings.integration.removed",
  "settings.integration.updated",
  
  // Data Operations
  "data.exported",
  "data.imported",
  "data.backed_up",
  "data.restored",
  "data.deleted",
  
  // System Operations
  "system.maintenance.started",
  "system.maintenance.completed",
  "system.error.occurred",
  "system.warning.issued",
]);

export type AuditLogActionType = z.infer<typeof auditLogActionTypeSchema>;

/**
 * Grouped audit log action types for UI filtering and display
 */
export const AUDIT_LOG_ACTION_GROUPS = {
  authentication: {
    label: "Authentication",
    actions: [
      "user.login",
      "user.logout",
      "user.created",
      "user.updated",
      "user.deleted",
      "user.suspended",
      "user.reactivated",
      "user.password_changed",
      "user.email_changed",
    ] as AuditLogActionType[],
  },
  organization: {
    label: "Organization",
    actions: [
      "organization.created",
      "organization.updated",
      "organization.deleted",
      "organization.settings.updated",
      "organization.branding.updated",
      "organization.billing.updated",
      "organization.subscription.changed",
    ] as AuditLogActionType[],
  },
  members: {
    label: "Members & Invites",
    actions: [
      "member.added",
      "member.removed",
      "member.role_changed",
      "invite.created",
      "invite.sent",
      "invite.accepted",
      "invite.revoked",
      "invite.expired",
    ] as AuditLogActionType[],
  },
  invoices: {
    label: "Invoices",
    actions: [
      "invoice.created",
      "invoice.updated",
      "invoice.deleted",
      "invoice.sent",
      "invoice.paid",
      "invoice.overdue",
      "invoice.cancelled",
      "invoice.refunded",
      "invoice.pdf.generated",
      "invoice.pdf.downloaded",
    ] as AuditLogActionType[],
  },
  proposals: {
    label: "Proposals",
    actions: [
      "proposal.created",
      "proposal.updated",
      "proposal.deleted",
      "proposal.sent",
      "proposal.accepted",
      "proposal.rejected",
      "proposal.expired",
      "proposal.converted_to_invoice",
    ] as AuditLogActionType[],
  },
  products: {
    label: "Products",
    actions: [
      "product.created",
      "product.updated",
      "product.deleted",
      "product.archived",
      "product.activated",
    ] as AuditLogActionType[],
  },
  contacts: {
    label: "Contacts",
    actions: [
      "contact.created",
      "contact.updated",
      "contact.deleted",
      "contact.merged",
      "contact.imported",
    ] as AuditLogActionType[],
  },
  leads: {
    label: "Leads",
    actions: [
      "lead.created",
      "lead.updated",
      "lead.deleted",
      "lead.converted",
      "lead.qualified",
      "lead.disqualified",
    ] as AuditLogActionType[],
  },
  templates: {
    label: "Templates",
    actions: [
      "template.created",
      "template.updated",
      "template.deleted",
      "template.published",
      "template.archived",
      "template.version.created",
      "template.version.restored",
    ] as AuditLogActionType[],
  },
  workflows: {
    label: "Workflows",
    actions: [
      "workflow.created",
      "workflow.updated",
      "workflow.deleted",
      "workflow.activated",
      "workflow.paused",
      "workflow.archived",
      "workflow.executed",
      "workflow.step.completed",
      "workflow.step.failed",
    ] as AuditLogActionType[],
  },
  sites: {
    label: "Site Builder",
    actions: [
      "site.created",
      "site.updated",
      "site.deleted",
      "site.published",
      "site.deployed",
      "site.version.created",
      "site.version.restored",
      "site.domain.added",
      "site.domain.removed",
      "site.pages.updated",
    ] as AuditLogActionType[],
  },
  analytics: {
    label: "Analytics",
    actions: [
      "analytics.config.updated",
      "analytics.script.updated",
      "analytics.event.tracked",
    ] as AuditLogActionType[],
  },
  security: {
    label: "Security & Access",
    actions: [
      "access.granted",
      "access.revoked",
      "permission.changed",
      "api_key.created",
      "api_key.revoked",
      "api_key.rotated",
      "session.created",
      "session.terminated",
    ] as AuditLogActionType[],
  },
  settings: {
    label: "Settings",
    actions: [
      "settings.general.updated",
      "settings.ai.updated",
      "settings.security.updated",
      "settings.integration.added",
      "settings.integration.removed",
      "settings.integration.updated",
    ] as AuditLogActionType[],
  },
  data: {
    label: "Data Operations",
    actions: [
      "data.exported",
      "data.imported",
      "data.backed_up",
      "data.restored",
      "data.deleted",
    ] as AuditLogActionType[],
  },
  system: {
    label: "System",
    actions: [
      "system.maintenance.started",
      "system.maintenance.completed",
      "system.error.occurred",
      "system.warning.issued",
    ] as AuditLogActionType[],
  },
} as const;

export type AuditLogActionGroup = keyof typeof AUDIT_LOG_ACTION_GROUPS;

/**
 * Audit log severity levels
 */
export const auditLogSeveritySchema = z.enum([
  "info",
  "warning",
  "error",
  "critical",
]);

export type AuditLogSeverity = z.infer<typeof auditLogSeveritySchema>;

/**
 * User context information captured in audit logs
 */
export const auditLogUserContextSchema = z.object({
  userId: z.string().min(1),
  clerkId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  deviceInfo: z
    .object({
      type: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional(),
      os: z.string().optional(),
      browser: z.string().optional(),
    })
    .optional(),
});

export type AuditLogUserContext = z.infer<typeof auditLogUserContextSchema>;

/**
 * Resource information that the action was performed on
 */
export const auditLogResourceSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  name: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditLogResource = z.infer<typeof auditLogResourceSchema>;

/**
 * Change tracking for update operations
 */
export const auditLogChangeSchema = z.object({
  field: z.string().min(1),
  oldValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  dataType: z.enum(["string", "number", "boolean", "object", "array", "date"]).optional(),
});

export type AuditLogChange = z.infer<typeof auditLogChangeSchema>;

/**
 * Outcome of the action
 */
export const auditLogOutcomeSchema = z.object({
  status: z.enum(["success", "failure", "partial"]),
  message: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorStack: z.string().optional(),
  durationMs: z.number().optional(),
});

export type AuditLogOutcome = z.infer<typeof auditLogOutcomeSchema>;

/**
 * Main audit log data schema
 */
export const auditLogDataSchema = z.object({
  organizationId: z.string().min(1),
  action: auditLogActionTypeSchema,
  severity: auditLogSeveritySchema.default("info"),
  user: auditLogUserContextSchema,
  resource: auditLogResourceSchema.optional(),
  changes: z.array(auditLogChangeSchema).optional(),
  beforeSnapshot: z.record(z.string(), z.unknown()).optional(),
  afterSnapshot: z.record(z.string(), z.unknown()).optional(),
  outcome: auditLogOutcomeSchema,
  metadata: z
    .object({
      requestId: z.string().optional(),
      correlationId: z.string().optional(),
      source: z.enum(["web", "api", "system", "webhook", "scheduled"]).default("web"),
      sourceDetails: z.string().optional(),
      tags: z.array(z.string()).optional(),
      customFields: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  timestamp: z.string().optional(),
});

export type AuditLogData = z.infer<typeof auditLogDataSchema>;

/**
 * Complete audit log entity
 */
export const auditLogSchema = baseEntitySchema.merge(auditLogDataSchema);

export type AuditLog = z.infer<typeof auditLogSchema>;

/**
 * Input for creating an audit log entry
 */
export type CreateAuditLogInput = Omit<
  AuditLogData,
  "timestamp" | "outcome" | "severity"
> & {
  outcome?: Partial<AuditLogOutcome>;
  timestamp?: string;
  severity?: AuditLogSeverity;
};

/**
 * Query filters for audit logs
 */
export const auditLogQueryFiltersSchema = z.object({
  organizationId: z.string().min(1).optional(),
  userId: z.string().optional(),
  action: auditLogActionTypeSchema.optional(),
  severity: auditLogSeveritySchema.optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  status: z.enum(["success", "failure", "partial"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type AuditLogQueryFilters = z.infer<typeof auditLogQueryFiltersSchema>;
