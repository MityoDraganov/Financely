import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getProposalRepository } from "../repositories/proposal-repository";

export interface GeneratePdfConfig {
  documentId: string;
  documentType: "invoice" | "proposal" | "contract";
  templateId?: string;
}

export class PdfExecutor implements ActionExecutor {
  type = "generate_pdf";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing PDF generation action", { 
        runId, 
        actionId: action.id
      });

      const config = action.config as GeneratePdfConfig;
      
      // Resolve template variables
      const resolvedDocumentId = this.resolveTemplate(config.documentId, context);
      const resolvedTemplateId = config.templateId 
        ? this.resolveTemplate(config.templateId, context)
        : undefined;

      // Get orgId from context
      const orgId = context.orgId as string || context.tenantId as string;
      if (!orgId) {
        throw new Error("orgId or tenantId is required in context");
      }

      const databaseService = getDatabaseService();
      
      // Get document based on type
      let document: any;
      if (config.documentType === "invoice") {
        const invoiceRepository = getInvoiceRepository(databaseService);
        document = await invoiceRepository.get({ id: resolvedDocumentId });
        if (!document) {
          throw new Error(`Invoice not found: ${resolvedDocumentId}`);
        }
      } else if (config.documentType === "proposal") {
        const proposalRepository = getProposalRepository(databaseService);
        document = await proposalRepository.get({ id: resolvedDocumentId });
        if (!document) {
          throw new Error(`Proposal not found: ${resolvedDocumentId}`);
        }
      } else {
        throw new Error(`Unsupported document type for PDF generation: ${config.documentType}`);
      }

      // Note: Actual PDF generation would call the render PDF function
      // For now, we'll just mark it as requested
      // In a full implementation, you'd call the renderInvoicePdf or similar function
      
      logger.info("PDF generation requested", { 
        runId, 
        actionId: action.id,
        documentId: resolvedDocumentId,
        documentType: config.documentType
      });

      return {
        success: true,
        documentId: resolvedDocumentId,
        documentType: config.documentType,
        templateId: resolvedTemplateId,
        message: "PDF generation requested (implementation pending)",
      };
    } catch (error) {
      logger.error("Error executing PDF generation action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}

