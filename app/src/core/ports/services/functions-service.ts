

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
    productIds?: string[]; // Product IDs for quantity deduction (one per item)
  }): Promise<{ id: string }>;

  /**
   * Map product data to invoice fields using AI.
   * Analyzes the template bindings and intelligently maps product data to appropriate invoice fields.
   * 
   * @param payload - The mapping payload
   * @param payload.productId - Product ID to map
   * @param payload.templateId - Template ID to understand field structure
   * @param payload.organizationId - Organization ID
   * @param payload.currentFormData - Current form data to preserve existing values
   * @returns Promise with mapped fields
   */
  mapProductToInvoiceFields(payload: {
    productId: string;
    templateId: string;
    organizationId: string;
    currentFormData: Record<string, unknown>;
  }): Promise<{ mappedFields: Record<string, unknown> }>;

  renderInvoicePdf(payload: {
    invoiceId: string;
  }): Promise<{ url: string }>;

  sendInvoiceEmail(payload: {
    invoiceId: string;
    toEmail: string;
    emailTemplateId?: string;
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

  acceptInvite(payload: {
    code: string;
  }): Promise<{ success: boolean; organizationId: string; message: string }>;

  revokeMember(payload: {
    organizationId: string;
    memberId: string;
  }): Promise<{ success: boolean; message: string }>;

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
    pages?: Array<{
      id: string;
      title: string;
      slug: string;
      description?: string;
      context?: string;
      type?: "standard" | "blog" | "contact";
      order?: number;
    }>;
  }): Promise<{ id: string; status: string }>;

  regenerateSite(payload: {
    brandSiteId: string;
    sectionType?: "hero" | "about" | "features" | "contact";
    context?: string;
    contextImages?: string[];
  }): Promise<{ success: boolean; brandSiteId: string; status: string }>;

  chatGenerateSite(payload: {
    brandSiteId: string;
    message: string;
    attachments?: string[];
    conversationHistory?: Array<{
      role: "user" | "assistant";
      content: string;
      attachments?: string[];
    }>;
    conversationId?: string;
    pageSlug?: string;
  }): Promise<{ response: string; updated: boolean; requiresClarification: boolean; brandSiteId: string; chatRequestId?: string }>;
  updateAnalyticsScript(payload: {
    brandSiteId: string;
  }): Promise<{ success: boolean; brandSiteId: string }>;

  addCustomDomain(payload: {
    brandSiteId: string;
    customDomain: string;
  }): Promise<{
    success: boolean;
    customDomain: string;
    domainStatus?: string;
    dnsConfigured?: boolean;
    dnsInstructions?: {
      type: "A" | "CNAME";
      name: string;
      value: string;
      ttl?: number;
    };
    message?: string;
  }>;

  restoreBrandSiteVersion(payload: {
    brandSiteId: string;
    version: number;
  }): Promise<{ success: boolean; brandSiteId: string; restoredVersion: number }>;

  previewBrandSiteVersion(payload: {
    brandSiteId: string;
    version: number;
  }): Promise<{ success: boolean; brandSiteId: string; version: number; previewUrl: string }>;

  updateBrandSitePages(payload: {
    brandSiteId: string;
    pages: Array<{
      id: string;
      title: string;
      slug: string;
      description?: string;
      context?: string;
      type?: "standard" | "blog" | "contact";
      order?: number;
      contentEntries?: Array<{
        id: string;
        title: string;
        summary?: string;
        link?: string;
        image?: string;
      }>;
    }>;
  }): Promise<{ success: boolean; brandSiteId: string }>;

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
   * Publish a brand site version to Cloudflare (R2 + KV)
   * Replaces the old Firebase Hosting deployment flow
   */
  publishBrandSite(payload: {
    brandSiteId: string;
    html: string;
    assets?: Array<{
      path: string;
      content: string | Buffer | string; // base64 encoded or plain string
      contentType: string;
    }>;
    aiPrompt?: string;
    notes?: string;
    sourceType?: "ai-builder" | "manual" | "imported";
  }): Promise<{ success: boolean; brandSiteId: string; versionId: string; publishedDomains: string[]; deployedUrl?: string }>;

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
   * Generate an invoice template using AI
   * Creates a beautiful, functional, and fully compliant invoice template
   * based on organization context and compliance region
   */
  generateInvoiceTemplate(payload: {
    organizationId: string;
    region?: "US" | "EU" | "CA" | "AU" | "UK";
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      includeLogo?: boolean;
      customPrompt?: string;
    };
  }): Promise<{
    orgId: string;
    name: string;
    description?: string;
    pageSize: "A4" | "Letter";
    brand: {
      fonts: string[];
      colors: { primary: string; secondary: string; accent: string };
      margins: { top: number; right: number; bottom: number; left: number };
    };
    elements: Array<any>;
    status: "draft" | "published";
    compliance?: {
      region?: "US" | "EU" | "CA" | "AU" | "UK";
      requiredFields?: string[];
      autoFooter?: boolean;
      customFooter?: string;
      complianceValidated?: boolean;
      complianceValidatedAt?: string;
    };
  }>;

  /**
   * Generate an invoice template from extracted invoice data
   * Analyzes the extracted data structure and creates a matching template
   */
  generateTemplateFromExtraction(payload: {
    jobId: string;
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      templateName?: string;
    };
  }): Promise<{
    template: {
      orgId: string;
      name: string;
      description?: string;
      pageSize: "A4" | "Letter";
      brand: {
        fonts: string[];
        colors: { primary: string; secondary: string; accent: string };
        margins: { top: number; right: number; bottom: number; left: number };
      };
      elements: Array<any>;
      status: "draft" | "published";
      compliance?: {
        region?: "US" | "EU" | "CA" | "AU" | "UK";
        requiredFields?: string[];
        autoFooter?: boolean;
        customFooter?: string;
        complianceValidated?: boolean;
        complianceValidatedAt?: string;
      };
    };
  }>;

  /**
   * Generate an email template using AI
   * Creates a beautiful, functional email template with progressive block rendering
   * Supports images (reference or use-in-template), organization context, and custom HTML blocks
   */
  generateEmailTemplate(payload: {
    organizationId: string;
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
      customPrompt?: string;
      images?: Array<{
        url: string;
        purpose: "reference" | "use-in-template";
        description?: string;
      }>;
      context?: {
        products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
        organizationName?: string;
        organizationSettings?: Record<string, unknown>;
        galleryImages?: string[];
      };
      generateCustomHtml?: boolean;
      targetSection?: "header" | "body" | "footer" | "full";
    };
  }): Promise<{
    orgId: string;
    name: string;
    description?: string;
    subject: string;
    preheader?: string;
    htmlContent: string;
    blocks: Array<any>;
    designTokens: {
      background: string;
      surface: string;
      text: string;
      primary: string;
      fontFamily: string;
      borderRadius: number;
    };
    status: "draft" | "published";
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

  /**
   * Get analytics metrics for an organization
   */
  getAnalyticsMetrics(payload: {
    orgId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    pageViews: number;
    visitors: number;
    bounceRate: number;
    avgSessionDuration: number;
    topPages: Array<{ path: string; views: number }>;
    trafficSources: Array<{ source: string; visitors: number }>;
    devices: Array<{ device: string; visitors: number }>;
    browsers: Array<{ browser: string; visitors: number }>;
    referrers: Array<{ referrer: string; visitors: number }>;
    pageViewsOverTime: Array<{ date: string; views: number }>;
    dateRange: { start: string; end: string };
    warning?: string;
    indexError?: {
      message: string;
      indexUrl?: string;
    };
    dataSources?: Array<"firestore" | "ga4" | "plausible" | "umami" | "clarity">;
  }>;

  /**
   * Convert a proposal to an invoice using AI
   * 
   * @param payload - The conversion payload
   * @param payload.proposalId - Proposal ID to convert
   * @param payload.templateId - Invoice template ID to use
   * @param payload.organizationId - Organization ID
   * @returns Promise with the created invoice ID and invoice number
   */
  convertProposalToInvoice(payload: {
    proposalId: string;
    templateId: string;
    organizationId: string;
  }): Promise<{ invoiceId: string; invoiceNumber?: string }>;

  generateInvoiceFromProposal(payload: {
    proposalId: string;
    templateId: string;
    organizationId: string;
  }): Promise<{
    invoiceData: Record<string, unknown>;
    invoiceNumber?: string;
    templateId: string;
  }>;

  /**
   * Generate widget styling and configuration using AI
   * 
   * @param payload - The generation payload
   * @param payload.organizationId - Organization ID
   * @param payload.widgetType - Widget type (contactForm, invoiceRequest, quoteRequest)
   * @param payload.options - Optional generation options (style, context)
   * @returns Promise with generated styling and configuration
   */
  generateWidget(payload: {
    organizationId: string;
    widgetType: "contactForm" | "invoiceRequest" | "quoteRequest";
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
    };
  }): Promise<{
    styling: {
      primaryColor: string;
      secondaryColor: string;
      backgroundColor: string;
      textColor: string;
      borderColor: string;
      errorColor: string;
      successColor: string;
      fontFamily: string;
      fontSize: string;
      fontWeight: string;
      padding: string;
      gap: string;
      borderRadius: string;
      buttonPadding: string;
      buttonBorderRadius: string;
      buttonFontWeight: string;
      modalBackdropOpacity: string;
      modalBorderRadius: string;
      modalMaxWidth: string;
      shadow: string;
    };
    configuration: {
      title: string;
      description?: string;
      submitButtonText: string;
      successMessage: string;
      builtInFields?: {
        name?: { enabled: boolean; required: boolean; label: string };
        email?: { enabled: boolean; required: boolean; label: string };
        phone?: { enabled: boolean; required: boolean; label: string };
        company?: { enabled: boolean; required: boolean; label: string };
        message?: { enabled: boolean; required: boolean; label: string };
      };
      customFields?: Array<{
        id: string;
        name: string;
        label: string;
        type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
        required: boolean;
        placeholder?: string;
        options?: string[];
        validation?: { min?: number; max?: number; pattern?: string };
        order: number;
      }>;
    };
  }>;

  /**
   * Restore a previous version of widget configuration
   * 
   * @param payload - The restore payload
   * @param payload.organizationId - Organization ID
   * @param payload.version - Version number to restore
   * @param payload.widgetType - Optional widget type filter
   * @returns Promise with restore result
   */
  restoreWidgetVersion(payload: {
    organizationId: string;
    version: number;
    widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
  }): Promise<{ success: boolean; organizationId: string; restoredVersion: number }>;

  /**
   * Save current widget configuration as a new version
   * 
   * @param payload - The save payload
   * @param payload.organizationId - Organization ID
   * @param payload.widgetType - Optional widget type filter
   * @param payload.description - Optional description for the version
   * @returns Promise with save result
   */
  saveWidgetVersion(payload: {
    organizationId: string;
    widgetType?: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
    description?: string;
  }): Promise<{ success: boolean; organizationId: string; version: number }>;

  /**
   * Translate widget text using AI
   * 
   * @param payload - The translation payload
   * @param payload.organizationId - Organization ID
   * @param payload.languageCode - Target language code (ISO 639-1)
   * @param payload.languageName - Target language name
   * @param payload.translations - Array of translation keys and English text
   * @returns Promise with translated text
   */
  translateWidgetText(payload: {
    organizationId: string;
    languageCode: string;
    languageName: string;
    translations: Array<{
      key: string;
      english: string;
    }>;
  }): Promise<{
    translations: Record<string, string>;
    translatedCount: number;
  }>;

  /**
   * Generate consent banner styling using AI
   * 
   * @param payload - The generation payload
   * @param payload.organizationId - Organization ID
   * @param payload.options - Optional generation options (style, context, existingStyling)
   * @returns Promise with generated styling
   */
  generateConsentBanner(payload: {
    organizationId: string;
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
      existingStyling?: Partial<{
        backgroundColor: string;
        textColor: string;
        buttonBackgroundColor: string;
        buttonTextColor: string;
        linkColor: string;
        borderColor: string;
        borderRadius: string;
        padding: string;
        fontSize: string;
        fontFamily: string;
        fontWeight: string;
        shadow: string;
        position: "bottom" | "top" | "center";
        maxWidth: string;
        acceptButtonText: string;
        rejectButtonText: string;
        message: string;
        showRejectButton: boolean;
      }>;
    };
  }): Promise<{
    styling: {
      backgroundColor: string;
      textColor: string;
      buttonBackgroundColor: string;
      buttonTextColor: string;
      linkColor: string;
      borderColor: string;
      borderRadius: string;
      padding: string;
      fontSize: string;
      fontFamily: string;
      fontWeight: string;
      shadow: string;
      position: "bottom" | "top" | "center";
      maxWidth: string;
      acceptButtonText: string;
      rejectButtonText: string;
      message: string;
      showRejectButton: boolean;
    };
  }>;

  /**
   * Upload a file to Firebase Storage.
   * All file uploads (create operations) must go through this backend function.
   * 
   * @param payload - The upload payload
   * @param payload.organizationId - Organization ID
   * @param payload.fileName - Original file name
   * @param payload.fileData - Base64 encoded file data
   * @param payload.contentType - MIME type of the file
   * @param payload.path - Optional custom storage path
   * @returns Promise with the public URL of the uploaded file
   */
  uploadFile(payload: {
    organizationId: string;
    fileName: string;
    fileData: string; // Base64 encoded
    contentType: string;
    path?: string;
  }): Promise<{ url: string }>;

  improveText(payload: {
    text: string;
    title?: string;
    language?: string;
  }): Promise<{ improvedText: string }>;

  deleteBrandSite(payload: {
    brandSiteId: string;
  }): Promise<{ success: boolean; brandSiteId: string }>;

  /**
   * Remove a custom domain from a brand site
   * 
   * @param payload - The removal payload
   * @param payload.brandSiteId - Brand site ID
   * @param payload.customDomain - Custom domain to remove
   * @returns Promise with removal result
   */
  removeCustomDomain(payload: {
    brandSiteId: string;
    customDomain: string;
  }): Promise<{ success: boolean; message?: string }>;

  /**
   * Upload an invoice file and create an extraction job
   * 
   * @param payload - The upload payload
   * @param payload.orgId - Organization ID
   * @param payload.fileUrl - Firebase Storage URL of the uploaded file
   * @param payload.fileName - Original file name
   * @param payload.fileType - File type (pdf, image/jpeg, image/png, etc.)
   * @param payload.fileSizeBytes - File size in bytes
   * @returns Promise with the extraction job ID
   */
  uploadInvoiceFile(payload: {
    orgId: string;
    fileUrl: string;
    fileName: string;
    fileType: "pdf" | "image/jpeg" | "image/png" | "image/jpg" | "image/webp";
    fileSizeBytes: number;
  }): Promise<{ jobId: string }>;

  /**
   * Extract invoice data from an uploaded file using OCR and AI
   * 
   * @param payload - The extraction payload
   * @param payload.jobId - Extraction job ID
   * @returns Promise with the updated extraction job
   */
  extractInvoiceData(payload: {
    jobId: string;
  }): Promise<{
    job: {
      id: string;
      orgId: string;
      fileUrl: string;
      fileName: string;
      fileType: string;
      status: "pending" | "processing" | "extracted" | "validated" | "completed" | "failed" | "cancelled";
      extractedData?: Record<string, unknown>;
      confidenceScores?: Record<string, number>;
      matchedTemplateId?: string;
      matchConfidence?: number;
      fieldMappings?: Array<{
        extractedField: string;
        templateBinding: string;
        confidence: number;
        userVerified: boolean;
      }>;
      correctedData?: Record<string, unknown>;
      createdInvoiceId?: string;
      createdTemplateId?: string;
      errorMessage?: string;
      processingDurationMs?: number;
      vendorName?: string;
      documentType?: "invoice" | "receipt" | "utility_bill" | "unknown";
    };
  }>;
}