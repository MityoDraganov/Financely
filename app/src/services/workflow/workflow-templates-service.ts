import { WorkflowTemplate } from "@/core";

/**
 * Service for managing workflow templates
 */
export class WorkflowTemplatesService {
  private static instance: WorkflowTemplatesService;
  private templates: WorkflowTemplate[] = [];

  private constructor() {
    this.initializeBuiltInTemplates();
  }

  public static getInstance(): WorkflowTemplatesService {
    if (!WorkflowTemplatesService.instance) {
      WorkflowTemplatesService.instance = new WorkflowTemplatesService();
    }
    return WorkflowTemplatesService.instance;
  }

  private initializeBuiltInTemplates() {
    this.templates = [
      {
        id: "invoice-follow-up",
        name: "Invoice Follow-up",
        description: "Automatically send follow-up emails for unpaid invoices",
        category: "Invoicing",
        trigger: {
          type: "invoice.sent",
          config: {},
        },
        steps: [
          {
            id: "step-1",
            name: "Wait 3 days",
            type: "action",
            actions: [
              {
                type: "wait.delay",
                config: {},
                delaySeconds: 259200, // 3 days
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Send reminder",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "invoice-reminder",
                  recipient: "{{invoice.buyer.email}}",
                  subject: "Reminder: Invoice {{invoice.invoiceNumber}} is due",
                },
                recipient: "{{invoice.buyer.email}}",
                subject: "Reminder: Invoice {{invoice.invoiceNumber}} is due",
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Wait 7 more days",
            type: "action",
            actions: [
              {
                type: "wait.delay",
                config: {},
                delaySeconds: 604800, // 7 days
              },
            ],
            order: 2,
          },
          {
            id: "step-4",
            name: "Send final notice",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "invoice-final-notice",
                  recipient: "{{invoice.buyer.email}}",
                  subject: "Final Notice: Invoice {{invoice.invoiceNumber}}",
                },
                recipient: "{{invoice.buyer.email}}",
                subject: "Final Notice: Invoice {{invoice.invoiceNumber}}",
              },
            ],
            order: 3,
          },
        ],
        tags: ["invoicing", "automation", "follow-up"],
        isBuiltIn: true,
      },
      {
        id: "proposal-approval",
        name: "Proposal Approval Workflow",
        description: "Automate the proposal review and approval process",
        category: "Sales",
        trigger: {
          type: "proposal.created",
          config: {},
        },
        steps: [
          {
            id: "step-1",
            name: "Notify manager",
            type: "action",
            actions: [
              {
                type: "send.slack",
                config: {
                  channel: "#sales",
                  message: "New proposal created: {{proposal.title}}",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Create review task",
            type: "action",
            actions: [
              {
                type: "create.task",
                config: {
                  title: "Review proposal: {{proposal.title}}",
                  assignee: "{{proposal.managerId}}",
                  dueDate: "{{proposal.createdAt + 2 days}}",
                },
                assigneeId: "{{proposal.managerId}}",
                title: "Review proposal: {{proposal.title}}",
                description: "Please review and approve this proposal",
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Wait for approval",
            type: "action",
            actions: [
              {
                type: "wait.delay",
                config: {},
                delaySeconds: 172800, // 2 days
              },
            ],
            order: 2,
          },
          {
            id: "step-4",
            name: "Send reminder if not approved",
            type: "action",
            actions: [
              {
                type: "send.slack",
                config: {
                  channel: "#sales",
                  message: "Reminder: Proposal {{proposal.title}} still pending approval",
                },
              },
            ],
            order: 3,
          },
        ],
        tags: ["sales", "approval", "automation"],
        isBuiltIn: true,
      },
      {
        id: "contract-renewal",
        name: "Contract Renewal Reminder",
        description: "Send reminders for expiring contracts",
        category: "Contracts",
        trigger: {
          type: "schedule.cron",
          config: {},
          cronExpression: "0 9 * * *", // Daily at 9 AM
        },
        steps: [
          {
            id: "step-1",
            name: "Check expiring contracts",
            type: "action",
            actions: [
              {
                type: "call.webhook",
                config: {
                  url: "{{api.baseUrl}}/contracts/expiring",
                  method: "GET",
                },
                url: "{{api.baseUrl}}/contracts/expiring",
                method: "GET",
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Send renewal reminders",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "contract-renewal",
                  recipient: "{{contract.clientEmail}}",
                  subject: "Contract Renewal: {{contract.name}}",
                },
                recipient: "{{contract.clientEmail}}",
                subject: "Contract Renewal: {{contract.name}}",
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Notify team",
            type: "action",
            actions: [
              {
                type: "send.slack",
                config: {
                  channel: "#contracts",
                  message: "Renewal reminder sent for contract: {{contract.name}}",
                },
              },
            ],
            order: 2,
          },
        ],
        tags: ["contracts", "renewal", "scheduled"],
        isBuiltIn: true,
      },
      {
        id: "payment-received",
        name: "Payment Received Notification",
        description: "Notify team when payments are received",
        category: "Payments",
        trigger: {
          type: "invoice.paid",
          config: {},
        },
        steps: [
          {
            id: "step-1",
            name: "Update invoice status",
            type: "action",
            actions: [
              {
                type: "update.invoice.status",
                config: {
                  status: "paid",
                  paidAt: "{{now}}",
                },
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Notify team",
            type: "action",
            actions: [
              {
                type: "send.slack",
                config: {
                  channel: "#finance",
                  message: "💰 Payment received for invoice {{invoice.invoiceNumber}} - ${{invoice.total}}",
                },
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Send receipt",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "payment-receipt",
                  recipient: "{{invoice.buyer.email}}",
                  subject: "Payment Received - Invoice {{invoice.invoiceNumber}}",
                },
                recipient: "{{invoice.buyer.email}}",
                subject: "Payment Received - Invoice {{invoice.invoiceNumber}}",
              },
            ],
            order: 2,
          },
        ],
        tags: ["payments", "notifications", "automation"],
        isBuiltIn: true,
      },
      {
        id: "new-customer-onboarding",
        name: "New Customer Onboarding",
        description: "Automate the onboarding process for new customers",
        category: "Customer Success",
        trigger: {
          type: "user.joined",
          config: {},
        },
        steps: [
          {
            id: "step-1",
            name: "Send welcome email",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "welcome-email",
                  recipient: "{{user.email}}",
                  subject: "Welcome to Financely!",
                },
                recipient: "{{user.email}}",
                subject: "Welcome to Financely!",
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Create onboarding task",
            type: "action",
            actions: [
              {
                type: "create.task",
                config: {
                  title: "Onboard new customer: {{user.name}}",
                  assignee: "{{user.assignedAccountManager}}",
                  dueDate: "{{now + 1 day}}",
                },
                assigneeId: "{{user.assignedAccountManager}}",
                title: "Onboard new customer: {{user.name}}",
                description: "Follow up with new customer and ensure they're set up properly",
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Notify team",
            type: "action",
            actions: [
              {
                type: "send.slack",
                config: {
                  channel: "#customer-success",
                  message: "🎉 New customer joined: {{user.name}} ({{user.email}})",
                },
              },
            ],
            order: 2,
          },
        ],
        tags: ["onboarding", "customer-success", "automation"],
        isBuiltIn: true,
      },
      {
        id: "monthly-reporting",
        name: "Monthly Reporting",
        description: "Generate and send monthly reports",
        category: "Reporting",
        trigger: {
          type: "schedule.cron",
          config: {},
          cronExpression: "0 9 1 * *", // First day of month at 9 AM
        },
        steps: [
          {
            id: "step-1",
            name: "Generate report",
            type: "action",
            actions: [
              {
                type: "call.webhook",
                config: {
                  url: "{{api.baseUrl}}/reports/monthly",
                  method: "POST",
                },
                url: "{{api.baseUrl}}/reports/monthly",
                method: "POST",
              },
            ],
            order: 0,
          },
          {
            id: "step-2",
            name: "Send to stakeholders",
            type: "action",
            actions: [
              {
                type: "send.email",
                config: {
                  template: "monthly-report",
                  recipient: "{{report.recipients}}",
                  subject: "Monthly Report - {{report.month}} {{report.year}}",
                },
                recipient: "{{report.recipients}}",
                subject: "Monthly Report - {{report.month}} {{report.year}}",
              },
            ],
            order: 1,
          },
          {
            id: "step-3",
            name: "Archive report",
            type: "action",
            actions: [
              {
                type: "call.webhook",
                config: {
                  url: "{{api.baseUrl}}/reports/archive",
                  method: "POST",
                },
                url: "{{api.baseUrl}}/reports/archive",
                method: "POST",
              },
            ],
            order: 2,
          },
        ],
        tags: ["reporting", "scheduled", "automation"],
        isBuiltIn: true,
      },
    ];
  }

  /**
   * Get all templates
   */
  public getAllTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(category: string): WorkflowTemplate[] {
    if (category === "all") {
      return this.templates;
    }
    return this.templates.filter(template => template.category === category);
  }

  /**
   * Get template by ID
   */
  public getTemplateById(id: string): WorkflowTemplate | null {
    return this.templates.find(template => template.id === id) || null;
  }

  /**
   * Get templates by tags
   */
  public getTemplatesByTags(tags: string[]): WorkflowTemplate[] {
    return this.templates.filter(template =>
      tags.some(tag => template.tags.includes(tag))
    );
  }

  /**
   * Search templates
   */
  public searchTemplates(query: string): WorkflowTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return this.templates.filter(template =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Get available categories
   */
  public getCategories(): string[] {
    return Array.from(new Set(this.templates.map(template => template.category)));
  }

  /**
   * Get available tags
   */
  public getTags(): string[] {
    const allTags = this.templates.flatMap(template => template.tags);
    return Array.from(new Set(allTags));
  }
}

// Export singleton instance
export const workflowTemplatesService = WorkflowTemplatesService.getInstance();
