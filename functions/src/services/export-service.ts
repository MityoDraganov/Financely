import { createHash } from "crypto";
import { logger } from "firebase-functions";
import type {
  ExportDataInput,
} from "../core/entities/export-import";
import type { DatabaseService } from "../core";
import { getProductRepository } from "../repositories/product-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getTemplateRepository } from "../repositories/template-repository";
import { fileGeneratorService, type SheetData } from "./file-generator-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";

export interface ExportService {
  /**
   * Export entities to file and upload to storage
   */
  exportEntities(
    input: ExportDataInput,
    databaseService: DatabaseService,
    userId: string,
  ): Promise<{ fileUrl: string; sizeBytes: number; stats: { totalRecords: number; exportedRecords: number } }>;
}

/**
 * Generate external_id for an entity
 * Uses hash of orgId + entityType + entityId for stability across re-exports
 */
function generateExternalId(orgId: string, entityType: string, entityId: string): string {
  const hash = createHash("sha256")
    .update(`${orgId}:${entityType}:${entityId}`)
    .digest("hex");
  return hash.substring(0, 16); // Use first 16 chars for readability
}

/**
 * Flatten nested object for CSV export
 */
function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value === null || value === undefined) {
      flattened[newKey] = null;
    } else if (Array.isArray(value)) {
      // For arrays, stringify as JSON
      flattened[newKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      flattened[newKey] = value;
    }
  });

  return flattened;
}

/**
 * Transform product to export format
 */
function transformProduct(product: Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId: string): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "products", product.id);
  // Remove id, createdAt, updatedAt before flattening
  const { id, createdAt, updatedAt, ...productData } = product;
  const flattened = flattenObject(productData);

  return {
    schema_version: "1.0",
    external_id: externalId,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    ...flattened,
  };
}

/**
 * Transform contact to export format
 */
function transformContact(contact: Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId: string): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "contacts", contact.id);
  const { id, createdAt, updatedAt, ...contactData } = contact;
  const flattened = flattenObject(contactData);

  return {
    schema_version: "1.0",
    external_id: externalId,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
    ...flattened,
  };
}

/**
 * Transform lead to export format
 */
function transformLead(lead: Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId: string): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "leads", lead.id);
  const { id, createdAt, updatedAt, ...leadData } = lead;
  const flattened = flattenObject(leadData);

  return {
    schema_version: "1.0",
    external_id: externalId,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
    ...flattened,
  };
}

/**
 * Transform proposal to export format
 */
function transformProposal(proposal: Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId: string): { main: Record<string, unknown>; items: Array<Record<string, unknown>> } {
  const externalId = generateExternalId(orgId, "proposals", proposal.id);
  const { id, createdAt, updatedAt, ...proposalData } = proposal;
  
  // Extract items for separate sheet
  const items = (proposalData.items as Array<Record<string, unknown>>) || [];
  const itemsForSheet = items.map((item) => ({
    proposal_external_id: externalId,
    description: item.description,
    qty: item.qty,
    unitPrice: item.unitPrice,
    taxPct: item.taxPct,
  }));

  // Remove items from main data for CSV (will be JSON stringified)
  const proposalDataWithoutItems = { ...proposalData };
  delete proposalDataWithoutItems.items;

  const flattened = flattenObject(proposalDataWithoutItems);

  return {
    main: {
      schema_version: "1.0",
      external_id: externalId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...flattened,
      // For CSV, include items as JSON string
      items: JSON.stringify(items),
    },
    items: itemsForSheet,
  };
}

/**
 * Transform invoice to export format
 */
function transformInvoice(invoice: Record<string, unknown> & { id: string; data?: Record<string, unknown>; createdAt?: string; updatedAt?: string }, orgId: string): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "invoices", invoice.id);
  const invoicePayload = (invoice.data || {}) as Record<string, unknown>;

  // Invoices have core fields at top-level, with dynamic template bindings in `data`.
  const flattened: Record<string, unknown> = {
    schema_version: "1.0",
    external_id: externalId,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
    orgId: invoice.orgId,
    templateId: invoice.templateId,
    templateVersionId: invoice.templateVersionId,
    status: invoice.status,
    notes: invoice.notes,
    pdfUrl: invoice.pdfUrl,
    data: JSON.stringify(invoicePayload),
  };

  return flattened;
}

/**
 * Transform template to export format
 */
function transformTemplate(template: Record<string, unknown> & { id: string; data?: Record<string, unknown>; createdAt?: string; updatedAt?: string }, orgId: string): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "templates", template.id);
  // Templates are stored flat, not nested
  const { id, createdAt, updatedAt, ...templateData } = template;
  
  // Template has complex nested structures, export as JSON strings
  const flattened: Record<string, unknown> = {
    schema_version: "1.0",
    external_id: externalId,
    created_at: createdAt,
    updated_at: updatedAt,
    name: templateData.name,
    description: templateData.description,
    pageSize: templateData.pageSize,
    status: templateData.status,
    elements: JSON.stringify(templateData.elements || []),
    brand: JSON.stringify(templateData.brand || {}),
    compliance: templateData.compliance ? JSON.stringify(templateData.compliance) : undefined,
    productTableConfig: templateData.productTableConfig ? JSON.stringify(templateData.productTableConfig) : undefined,
  };

  return flattened;
}

/**
 * Transform email template (Realtime DB) to export format
 */
function transformEmailTemplate(
  template: Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string },
  orgId: string,
): Record<string, unknown> {
  const externalId = generateExternalId(orgId, "emailTemplates", template.id);

  return {
    schema_version: "1.0",
    external_id: externalId,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
    orgId: template.orgId,
    templateType: "email",
    name: template.name,
    description: template.description,
    key: template.key,
    subject: template.subject,
    preheader: template.preheader,
    status: template.status,
    version: template.version,
    isSystemDefault: template.isSystemDefault,
    isLocked: template.isLocked,
    marketplaceTemplateId: template.marketplaceTemplateId,
    allowedContexts: JSON.stringify(template.allowedContexts || []),
    htmlContent: template.htmlContent || "",
    blocks: JSON.stringify(template.blocks || []),
    designTokens: JSON.stringify(template.designTokens || {}),
    placeholders: JSON.stringify(template.placeholders || []),
    sections: JSON.stringify(template.sections || {}),
  };
}

/**
 * Build query constraints from export options
 */
function buildQueryConstraints(
  orgId: string,
  options?: ExportDataInput["options"],
): Array<{ field: string; operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not-in" | "array-contains" | "array-contains-any"; value: unknown }> {
  const constraints: Array<{ field: string; operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not-in" | "array-contains" | "array-contains-any"; value: unknown }> = [];

  // Always filter by orgId (or organizationId)
  // This will be handled per entity type

  if (options?.dateRange?.start) {
    constraints.push({
      field: "createdAt",
      operator: ">=",
      value: options.dateRange.start,
    });
  }

  if (options?.dateRange?.end) {
    constraints.push({
      field: "createdAt",
      operator: "<=",
      value: options.dateRange.end,
    });
  }

  if (options?.status && options.status.length > 0) {
    if (options.status.length === 1) {
      constraints.push({
        field: "data.status",
        operator: "==",
        value: options.status[0],
      });
    } else {
      constraints.push({
        field: "data.status",
        operator: "in",
        value: options.status,
      });
    }
  }

  return constraints;
}

/**
 * Export products
 */
async function exportProducts(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<Array<Record<string, unknown>>> {
  const productRepository = getProductRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);
  
  // Add orgId constraint - products store organizationId at top level
  constraints.push({
    field: "organizationId",
    operator: "==",
    value: orgId,
  });

  const products = await productRepository.getAll({
    queryConstraints: constraints,
  });

  return products.map((p) => transformProduct(p as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId));
}

/**
 * Export contacts
 */
async function exportContacts(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<Array<Record<string, unknown>>> {
  const contactRepository = getContactRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);
  
  // Add orgId constraint - contacts store organizationId at top level (based on frontend queries)
  constraints.push({
    field: "organizationId",
    operator: "==",
    value: orgId,
  });

  const contacts = await contactRepository.getAll({
    queryConstraints: constraints,
  });

  return contacts.map((c) => transformContact(c as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId));
}

/**
 * Export leads
 */
async function exportLeads(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<Array<Record<string, unknown>>> {
  const leadRepository = getLeadRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);
  
  // Add orgId constraint - leads store organizationId at top level (based on frontend queries)
  constraints.push({
    field: "organizationId",
    operator: "==",
    value: orgId,
  });

  const leads = await leadRepository.getAll({
    queryConstraints: constraints,
  });

  return leads.map((l) => transformLead(l as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId));
}

/**
 * Export proposals
 */
async function exportProposals(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<{ main: Array<Record<string, unknown>>; items: Array<Record<string, unknown>> }> {
  const proposalRepository = getProposalRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);
  
  // Add orgId constraint - proposals store organizationId at top level (merged schema)
  constraints.push({
    field: "organizationId",
    operator: "==",
    value: orgId,
  });

  const proposals = await proposalRepository.getAll({
    queryConstraints: constraints,
  });

  const main: Array<Record<string, unknown>> = [];
  const items: Array<Record<string, unknown>> = [];

  proposals.forEach((p) => {
    const transformed = transformProposal(p as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId);
    main.push(transformed.main);
    items.push(...transformed.items);
  });

  return { main, items };
}

/**
 * Export invoices
 */
async function exportInvoices(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<Array<Record<string, unknown>>> {
  const invoiceRepository = getInvoiceRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);
  
  // Add orgId constraint
  constraints.push({
    field: "orgId",
    operator: "==",
    value: orgId,
  });

  const invoices = await invoiceRepository.getAll({
    queryConstraints: constraints,
  });

  return invoices.map((i) => transformInvoice(i as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId));
}

/**
 * Export templates
 */
async function exportTemplates(
  orgId: string,
  options: ExportDataInput["options"],
  databaseService: DatabaseService,
): Promise<{
  invoiceTemplates: Array<Record<string, unknown>>;
  emailTemplates: Array<Record<string, unknown>>;
}> {
  const templateRepository = getTemplateRepository(databaseService);
  const constraints = buildQueryConstraints(orgId, options);

  // Firestore invoice/document templates
  constraints.push({
    field: "orgId",
    operator: "==",
    value: orgId,
  });

  const invoiceTemplates = await templateRepository.getAll({
    queryConstraints: constraints,
  });

  const realtimeInvoiceTemplates = await realtimeDatabaseService.getAll<Record<string, unknown> & { id: string }>(
    "templates",
    {
      orderBy: "orgId",
      equalTo: orgId,
    },
  );

  // Realtime email templates
  const realtimeEmailTemplates = await realtimeDatabaseService.getAll<Record<string, unknown> & { id: string }>(
    "emailTemplates",
    {
      orderBy: "orgId",
      equalTo: orgId,
    },
  );

  // Merge invoice templates from Firestore + Realtime by id (Realtime wins as source of truth for editor data).
  const mergedInvoiceTemplatesById = new Map<string, Record<string, unknown> & { id: string }>();
  invoiceTemplates.forEach((t) => {
    const template = t as Record<string, unknown> & { id: string };
    mergedInvoiceTemplatesById.set(template.id, template);
  });
  realtimeInvoiceTemplates.forEach((t) => {
    mergedInvoiceTemplatesById.set(t.id, t);
  });

  return {
    invoiceTemplates: Array.from(mergedInvoiceTemplatesById.values()).map((t) =>
      transformTemplate(t as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId),
    ),
    emailTemplates: realtimeEmailTemplates.map((t) =>
      transformEmailTemplate(t as Record<string, unknown> & { id: string; createdAt?: string; updatedAt?: string }, orgId),
    ),
  };
}

export const exportService: ExportService = {
  async exportEntities(
    input: ExportDataInput,
    databaseService: DatabaseService,
    userId: string,
  ): Promise<{ fileUrl: string; sizeBytes: number; stats: { totalRecords: number; exportedRecords: number } }> {
    const { orgId, entityTypes, format, options } = input;

    logger.info("Starting export", { orgId, entityTypes, format, userId });

    const sheets: SheetData[] = [];
    let totalRecords = 0;

    // Export each entity type
    for (const entityType of entityTypes) {
      try {
        switch (entityType) {
          case "products": {
            const products = await exportProducts(orgId, options, databaseService);
            if (products.length > 0) {
              const headers = Object.keys(products[0]);
              sheets.push({
                name: "Products",
                data: products as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += products.length;
            }
            break;
          }

          case "contacts": {
            const contacts = await exportContacts(orgId, options, databaseService);
            if (contacts.length > 0) {
              const headers = Object.keys(contacts[0]);
              sheets.push({
                name: "Contacts",
                data: contacts as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += contacts.length;
            }
            break;
          }

          case "leads": {
            const leads = await exportLeads(orgId, options, databaseService);
            if (leads.length > 0) {
              const headers = Object.keys(leads[0]);
              sheets.push({
                name: "Leads",
                data: leads as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += leads.length;
            }
            break;
          }

          case "proposals": {
            const { main, items } = await exportProposals(orgId, options, databaseService);
            if (main.length > 0) {
              const headers = Object.keys(main[0]);
              sheets.push({
                name: "Proposals",
                data: main as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += main.length;
            }
            if (items.length > 0 && format !== "csv") {
              // CSV doesn't support multiple sheets, so items are in JSON string
              const itemHeaders = Object.keys(items[0]);
              sheets.push({
                name: "ProposalItems",
                data: items as Array<Record<string, string | number | boolean | null | undefined>>,
                headers: itemHeaders,
              });
            }
            break;
          }

          case "invoices": {
            const invoices = await exportInvoices(orgId, options, databaseService);
            if (invoices.length > 0) {
              const headers = Object.keys(invoices[0]);
              sheets.push({
                name: "Invoices",
                data: invoices as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += invoices.length;
            }
            break;
          }

          case "templates": {
            const { invoiceTemplates, emailTemplates } = await exportTemplates(
              orgId,
              options,
              databaseService,
            );

            if (invoiceTemplates.length > 0) {
              const headers = Object.keys(invoiceTemplates[0]);
              sheets.push({
                name: "InvoiceTemplates",
                data: invoiceTemplates as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += invoiceTemplates.length;
            }

            if (emailTemplates.length > 0) {
              const headers = Object.keys(emailTemplates[0]);
              sheets.push({
                name: "EmailTemplates",
                data: emailTemplates as Array<Record<string, string | number | boolean | null | undefined>>,
                headers,
              });
              totalRecords += emailTemplates.length;
            }
            break;
          }
        }
      } catch (error) {
        logger.error(`Failed to export ${entityType}`, {
          error: error instanceof Error ? error.message : "Unknown error",
          orgId,
          entityType,
        });
        // Continue with other entity types
      }
    }

    if (sheets.length === 0) {
      throw new Error("No data to export");
    }

    // Add metadata sheet for XLSX
    if (format === "xlsx" && sheets.length > 1) {
      const metaSheet: SheetData = {
        name: "__meta",
        data: [
          {
            schema_version: "1.0",
            export_date: new Date().toISOString(),
            organization_id: orgId,
            exported_by: userId,
            entity_types: entityTypes.join(", "),
            total_records: totalRecords,
          },
        ],
      };
      sheets.unshift(metaSheet); // Add at beginning
    }

    // Generate storage path
    const timestamp = Date.now();
    const isCsvArchive = format === "csv" && sheets.length > 1;
    const extension = isCsvArchive ? "zip" : format === "csv" ? "csv" : format === "xls" ? "xls" : "xlsx";
    const storagePath = `organizations/${orgId}/exports/export-${timestamp}.${extension}`;

    // Generate and upload file
    const result = await fileGeneratorService.generateAndUpload(sheets, format, storagePath);

    logger.info("Export completed", {
      orgId,
      entityTypes,
      format,
      totalRecords,
      fileUrl: result.url,
      sizeBytes: result.sizeBytes,
    });

    return {
      fileUrl: result.url,
      sizeBytes: result.sizeBytes,
      stats: {
        totalRecords,
        exportedRecords: totalRecords,
      },
    };
  },
};
