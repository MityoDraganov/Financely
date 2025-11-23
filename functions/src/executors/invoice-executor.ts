import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { handleCreateInvoice } from "../app/handle-create-invoice";
import { invoiceDataSchema } from "../core/entities/invoice";

export interface CreateInvoiceConfig {
  fromProposalId?: string;
  clientId: string;
  amount: number;
  currency: string;
  dueDate?: string;
  items?: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
}

export interface UpdateInvoiceStatusConfig {
  invoiceId: string;
  status: "draft" | "sent" | "paid" | "cancelled";
}

export class InvoiceExecutor implements ActionExecutor {
  type = "invoice_action";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing invoice action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "create.invoice") {
        return await this.createInvoice(action, context, runId);
      } else if (action.type === "update.invoice.status") {
        return await this.updateInvoiceStatus(action, context, runId);
      } else {
        throw new Error(`Unsupported invoice action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing invoice action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async createInvoice(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as CreateInvoiceConfig;
    
    // Resolve template variables
    const resolvedClientId = this.resolveTemplate(config.clientId, context);
    const resolvedCurrency = this.resolveTemplate(config.currency || "USD", context);
    const resolvedDueDate = config.dueDate ? this.resolveTemplate(config.dueDate, context) : undefined;
    
    // Get orgId from context (should be set by workflow trigger)
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    // Build invoice data structure
    const items = config.items || [{
      description: "Service",
      quantity: 1,
      price: config.amount
    }];

    const invoiceData: Record<string, unknown> = {
      orgId,
      templateId: "", // Will need to be set if using templates
      data: {
        items: items.map(item => ({
          description: this.resolveTemplate(item.description, context),
          qty: item.quantity,
          unitPrice: item.price,
          total: item.quantity * item.price
        })),
        subtotal: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
        total: config.amount,
        currency: resolvedCurrency,
        ...(resolvedDueDate && { dueDate: resolvedDueDate }),
      },
      status: "draft",
    };

    // Validate and create invoice
    const validatedData = invoiceDataSchema.parse(invoiceData);
    const invoiceId = await handleCreateInvoice(validatedData);

    logger.info("Invoice created successfully", { 
      runId, 
      actionId: action.id,
      invoiceId 
    });

    return {
      success: true,
      invoiceId,
      clientId: resolvedClientId,
      amount: config.amount,
      currency: resolvedCurrency,
    };
  }

  private async updateInvoiceStatus(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as UpdateInvoiceStatusConfig;
    
    // Resolve template variables
    const resolvedInvoiceId = this.resolveTemplate(config.invoiceId, context);
    
    const databaseService = getDatabaseService();
    const invoiceRepository = getInvoiceRepository(databaseService);
    
    // Update invoice status
    await invoiceRepository.update({
      id: resolvedInvoiceId,
      data: { status: config.status }
    });

    logger.info("Invoice status updated successfully", { 
      runId, 
      actionId: action.id,
      invoiceId: resolvedInvoiceId,
      status: config.status
    });

    return {
      success: true,
      invoiceId: resolvedInvoiceId,
      status: config.status,
    };
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

