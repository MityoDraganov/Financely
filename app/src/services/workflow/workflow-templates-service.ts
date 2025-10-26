import { WorkflowTemplate, WorkflowTriggerType } from "@/core";

export interface WorkflowTemplatesService {
  getTemplates(): WorkflowTemplate[];
  getTemplate(id: string): WorkflowTemplate | null;
  getTemplatesByCategory(category: string): WorkflowTemplate[];
  createWorkflowFromTemplate(templateId: string, orgId: string, customizations?: Record<string, unknown>): any;
}

export const workflowTemplatesService: WorkflowTemplatesService = {
  getTemplates(): WorkflowTemplate[] {
    return [
      {
        id: "invoice-reminder",
        name: "Invoice Reminder",
        description: "Automatically send reminder emails for overdue invoices",
        category: "finance",
        trigger: {
          type: "invoice.overdue" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Send Reminder Email",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  recipient: "{{invoice.customer.email}}",
                  subject: "Payment Reminder - Invoice {{invoice.number}}",
                  templateId: "invoice-reminder",
                },
              },
            ],
            order: 0,
          },
        ],
        tags: ["invoice", "reminder", "automation"],
        isBuiltIn: true,
      },
      {
        id: "welcome-new-user",
        name: "Welcome New User",
        description: "Send welcome email to new users",
        category: "onboarding",
        trigger: {
          type: "user.joined" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Send Welcome Email",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  recipient: "{{user.email}}",
                  subject: "Welcome to {{organization.name}}!",
                  templateId: "welcome-email",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step2",
            name: "Create Onboarding Task",
            type: "action",
            actions: [
              {
                type: "create.task",
                config: {
                  title: "Complete your profile setup",
                  description: "Please complete your profile information to get started",
                  assigneeId: "{{user.id}}",
                },
              },
            ],
            order: 1,
          },
        ],
        tags: ["onboarding", "welcome", "automation"],
        isBuiltIn: true,
      },
      {
        id: "proposal-approval",
        name: "Proposal Approval Workflow",
        description: "Automated proposal approval process with notifications",
        category: "approval",
        trigger: {
          type: "proposal.created" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Notify Manager",
            type: "action",
            actions: [
              {
                type: "notify.user",
                config: {
                  userId: "{{proposal.managerId}}",
                  message: "New proposal requires your approval: {{proposal.title}}",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step2",
            name: "Create Approval Task",
            type: "action",
            actions: [
              {
                type: "create.task",
                config: {
                  title: "Review Proposal: {{proposal.title}}",
                  description: "Please review and approve the proposal",
                  assigneeId: "{{proposal.managerId}}",
                },
              },
            ],
            order: 1,
          },
        ],
        tags: ["proposal", "approval", "automation"],
        isBuiltIn: true,
      },
      {
        id: "contract-renewal",
        name: "Contract Renewal Reminder",
        description: "Automated contract renewal reminders and notifications",
        category: "contracts",
        trigger: {
          type: "contract.expiring" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Notify Account Manager",
            type: "action",
            actions: [
              {
                type: "notify.user",
                config: {
                  userId: "{{contract.accountManagerId}}",
                  message: "Contract {{contract.name}} expires in {{contract.daysUntilExpiry}} days",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step2",
            name: "Create Renewal Task",
            type: "action",
            actions: [
              {
                type: "create.task",
                config: {
                  title: "Renew Contract: {{contract.name}}",
                  description: "Contract expires on {{contract.expiryDate}}. Please initiate renewal process.",
                  assigneeId: "{{contract.accountManagerId}}",
                },
              },
            ],
            order: 1,
          },
        ],
        tags: ["contract", "renewal", "automation"],
        isBuiltIn: true,
      },
      {
        id: "invoice-auto-approval",
        name: "Auto-approve Small Invoices",
        description: "Automatically approve invoices under a certain amount",
        category: "finance",
        trigger: {
          type: "invoice.created" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Check Amount",
            type: "condition",
            conditions: [
              {
                field: "invoice.amount",
                operator: "less_than",
                value: 500,
              },
            ],
            actions: [
              {
                type: "update.invoice.status",
                config: {
                  invoiceId: "{{invoice.id}}",
                  status: "approved",
                },
              },
              {
                type: "notify.user",
                config: {
                  userId: "{{invoice.creatorId}}",
                  message: "Invoice {{invoice.number}} has been auto-approved",
                },
              },
            ],
            order: 0,
          },
        ],
        tags: ["invoice", "approval", "automation"],
        isBuiltIn: true,
      },
      {
        id: "payment-received",
        name: "Payment Received Notification",
        description: "Send notifications when payment is received",
        category: "finance",
        trigger: {
          type: "invoice.paid" as WorkflowTriggerType,
        },
        steps: [
          {
            id: "step1",
            name: "Notify Finance Team",
            type: "action",
            actions: [
              {
                type: "notify.user",
                config: {
                  userId: "{{invoice.financeManagerId}}",
                  message: "Payment received for invoice {{invoice.number}} - Amount: ${{invoice.amount}}",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step2",
            name: "Update Customer Status",
            type: "action",
            actions: [
              {
                type: "update.field",
                config: {
                  recordType: "customer",
                  recordId: "{{invoice.customerId}}",
                  field: "lastPaymentDate",
                  value: "{{payment.date}}",
                },
              },
            ],
            order: 1,
          },
        ],
        tags: ["payment", "notification", "automation"],
        isBuiltIn: true,
      },
    ];
  },

  getTemplate(id: string): WorkflowTemplate | null {
    const templates = this.getTemplates();
    return templates.find(template => template.id === id) || null;
  },

  getTemplatesByCategory(category: string): WorkflowTemplate[] {
    const templates = this.getTemplates();
    return templates.filter(template => template.category === category);
  },

  createWorkflowFromTemplate(templateId: string, orgId: string, customizations: Record<string, unknown> = {}): any {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Create workflow data from template
    const workflowData = {
      orgId,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      steps: template.steps,
      tags: template.tags,
      category: template.category,
      status: "draft" as const,
      version: 1,
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
      ...customizations,
    };

    return workflowData;
  },
};