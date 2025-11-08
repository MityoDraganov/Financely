

export interface DeleteResponse {
  deleted: boolean;
  error?: string;
}

export interface FunctionsService {
  createProposal(payload: {
    orgId: string;
    customerId: string;
    title: string;
    description?: string;
    items: Array<{
      description: string;
      qty: number;
      unitPrice: number;
      taxPct?: number;
    }>;
    currency: string;
    terms?: string;
    notes?: string;
    vatRatePct?: number;
  }): Promise<{ id: string }>;

  /**
   * Create an invoice with dynamic data based on a template.
   * 
   * @param payload - The invoice creation payload
   * @param payload.orgId - Organization ID
   * @param payload.templateId - Template ID this invoice is based on
   * @param payload.templateVersionId - Optional specific version of the template
   * @param payload.data - Dynamic data matching the template's bindings
   * @param payload.status - Invoice status (draft, sent, paid, cancelled)
   * @param payload.notes - Optional notes
   * @returns Promise with the created invoice ID
   * 
   * @example
   * // Example with a standard invoice template
   * createInvoice({
   *   orgId: "org123",
   *   templateId: "template456",
   *   data: {
   *     seller: { name: "Acme Inc", address: "123 Main St", taxIdVat: "US123456" },
   *     buyer: { name: "Customer Ltd", address: "456 Oak Ave", taxIdVat: "US789012" },
   *     invoiceNumber: "INV-001",
   *     issueDate: "2025-01-01",
   *     dueDate: "2025-01-31",
   *     items: [
   *       { description: "Consulting", qty: 10, unitPrice: 150, total: 1500 }
   *     ],
   *     subtotal: 1500,
   *     vatTotal: 300,
   *     total: 1800
   *   }
   * })
   */
  createInvoice(payload: {
    orgId: string;
    templateId: string;
    templateVersionId?: string;
    data: Record<string, unknown>;
    status?: "draft" | "sent" | "paid" | "cancelled";
    notes?: string;
  }): Promise<{ id: string }>;

  renderInvoicePdf(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInvoiceEmail(payload: {
    invoiceId: string;
    toEmail: string;
  }): Promise<{ sent: boolean }>;

  generateInvoiceShareLink(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInviteEmail(payload: {
    inviteId: string;
    organizationId: string;
  }): Promise<{ sent: boolean }>;

  sendWelcomeEmail(payload: {
    userId: string;
    organizationId: string;
  }): Promise<{ sent: boolean }>;

  /**
   * Create a workflow with the specified configuration.
   * 
   * @param payload - The workflow creation payload
   * @param payload.orgId - Organization ID
   * @param payload.name - Workflow name
   * @param payload.description - Optional workflow description
   * @param payload.trigger - Workflow trigger configuration
   * @param payload.steps - Array of workflow steps
   * @param payload.status - Workflow status (draft, active, paused, archived)
   * @param payload.version - Workflow version number
   * @param payload.settings - Workflow execution settings
   * @param payload.tags - Array of workflow tags
   * @param payload.category - Workflow category
   * @param payload.n8nEnabled - Whether n8n integration is enabled
   * @returns Promise with the created workflow ID
   * 
   * @example
   * // Example with a simple invoice follow-up workflow
   * createWorkflow({
   *   orgId: "org123",
   *   name: "Invoice Follow-up",
   *   description: "Automatically send follow-up emails for overdue invoices",
   *   trigger: {
   *     type: "invoice.overdue"
   *   },
   *   steps: [
   *     {
   *       id: "step1",
   *       name: "Send Reminder Email",
   *       type: "action",
   *       actions: [
   *         {
   *           type: "send.email",
   *           config: {
   *             templateId: "overdue-reminder",
   *             recipient: "{{invoice.customer.email}}",
   *             subject: "Payment Reminder - Invoice {{invoice.number}}"
   *           }
   *         }
   *       ],
   *       order: 0
   *     }
   *   ],
   *   tags: ["invoice", "automation"],
   *   category: "finance"
   * })
   */
  createWorkflow(payload: {
    orgId: string;
    name: string;
    description?: string;
    trigger: {
      type: "invoice.created" | "invoice.sent" | "invoice.paid" | "invoice.overdue" | "proposal.created" | "proposal.approved" | "proposal.rejected" | "contract.expiring" | "contract.expired" | "user.joined" | "schedule.cron" | "webhook.external" | "manual.trigger";
      config?: Record<string, any>;
      cronExpression?: string;
      webhookUrl?: string;
      eventFilters?: Record<string, any>;
    };
    steps: Array<{
      id: string;
      name: string;
      type: "action" | "condition" | "delay" | "parallel";
      actions: Array<{
        type: "send.email" | "send.slack" | "create.invoice" | "update.invoice.status" | "create.task" | "assign.task" | "generate.pdf" | "call.webhook" | "create.stripe.invoice" | "wait.delay" | "notify.user" | "archive.record" | "update.field";
        config: Record<string, any>;
        conditions?: Array<{
          field: string;
          operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
          value: string | number | boolean;
        }>;
        delaySeconds?: number;
        templateId?: string;
        recipient?: string;
        subject?: string;
        url?: string;
        method?: "GET" | "POST" | "PUT" | "DELETE";
        headers?: Record<string, string>;
        assigneeId?: string;
        title?: string;
        description?: string;
      }>;
      conditions?: Array<{
        field: string;
        operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
        value: string | number | boolean;
      }>;
      parallelSteps?: string[];
      delaySeconds?: number;
      order: number;
    }>;
    status?: "draft" | "active" | "paused" | "archived";
    version?: number;
    settings?: {
      maxRetries?: number;
      timeoutSeconds?: number;
      notifyOnFailure?: boolean;
      notifyOnSuccess?: boolean;
      maxConcurrentExecutions?: number;
    };
    tags?: string[];
    category?: string;
    n8nEnabled?: boolean;
  }): Promise<{ id: string }>;

  generateSite(payload: {
    organizationId: string;
    brandName?: string;
    tone?: string;
    context?: string;
    contextImages?: string[];
  }): Promise<{ id: string; status: string }>;

  regenerateSite(payload: {
    brandSiteId: string;
    sectionType?: "hero" | "about" | "features" | "contact";
    context?: string;
    contextImages?: string[];
  }): Promise<{ success: boolean; brandSiteId: string; status: string }>;

  addCustomDomain(payload: {
    brandSiteId: string;
    customDomain: string;
  }): Promise<{ success: boolean; customDomain: string }>;

  restoreBrandSiteVersion(payload: {
    brandSiteId: string;
    version: number;
  }): Promise<{ success: boolean; brandSiteId: string; restoredVersion: number }>;

  previewBrandSiteVersion(payload: {
    brandSiteId: string;
    version: number;
  }): Promise<{ success: boolean; brandSiteId: string; version: number; previewUrl: string }>;

  /**
   * Manually deploy custom files to a brand site
   */
  deployManualSite(payload: {
    brandSiteId: string;
    files: Array<{
      path: string;
      content: string;
    }>;
    versionMessage?: string;
    includeWidgets?: boolean;
  }): Promise<{ success: boolean; brandSiteId: string; deployedUrl: string; status: string }>;

  /**
   * Generate a proposal suggestion from a lead using AI
   */
  generateProposalSuggestion(payload: {
    leadId: string;
    organizationId: string;
  }): Promise<{
    title: string;
    description?: string;
    items: Array<{
      description: string;
      qty: number;
      unitPrice: number;
      taxPct?: number;
    }>;
    currency: string;
    terms?: string;
    notes?: string;
    organizationId: string;
    leadId: string;
    status: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    aiGenerated: boolean;
  }>;

  /**
   * Create a product
   */
  createProduct(payload: {
    organizationId: string;
    name: string;
    description?: string;
    price: number;
    currency?: string;
    sku?: string;
    barcode?: string;
    stockQuantity?: number;
    trackInventory?: boolean;
    lowStockThreshold?: number;
    images?: string[];
    category?: string;
    tags?: string[];
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
      unit?: "cm" | "in" | "m";
    };
    status?: "active" | "inactive" | "archived";
    taxRate?: number;
    cost?: number;
  }): Promise<{ id: string }>;
}