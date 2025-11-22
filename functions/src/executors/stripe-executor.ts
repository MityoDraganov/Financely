import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";

export interface CreateStripeInvoiceConfig {
  invoiceId: string;
  customerId: string;
}

export class StripeExecutor implements ActionExecutor {
  type = "create_stripe_invoice";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing Stripe invoice action", { 
        runId, 
        actionId: action.id
      });

      const config = action.config as CreateStripeInvoiceConfig;
      
      // Resolve template variables
      const resolvedInvoiceId = this.resolveTemplate(config.invoiceId, context);
      const resolvedCustomerId = this.resolveTemplate(config.customerId, context);

      // Get Stripe API key from environment
      const stripeApiKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeApiKey) {
        throw new Error("STRIPE_SECRET_KEY environment variable is required");
      }

      // Note: This is a placeholder implementation
      // In a full implementation, you would:
      // 1. Fetch the invoice from your database
      // 2. Create a Stripe invoice using the Stripe API
      // 3. Link the Stripe invoice ID back to your invoice record
      
      logger.info("Stripe invoice creation requested", { 
        runId, 
        actionId: action.id,
        invoiceId: resolvedInvoiceId,
        customerId: resolvedCustomerId
      });

      return {
        success: true,
        invoiceId: resolvedInvoiceId,
        customerId: resolvedCustomerId,
        message: "Stripe invoice creation requested (implementation pending)",
      };
    } catch (error) {
      logger.error("Error executing Stripe invoice action", { 
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

