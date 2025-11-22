import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getProductRepository } from "../repositories/product-repository";

export interface AddProductToProposalConfig {
  proposalId: string;
  productId: string;
  quantity?: number;
}

export class ProductExecutor implements ActionExecutor {
  type = "product_action";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing product action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "add.product_to_proposal") {
        return await this.addProductToProposal(action, context, runId);
      } else {
        throw new Error(`Unsupported product action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing product action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async addProductToProposal(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as AddProductToProposalConfig;
    
    // Resolve template variables
    const resolvedProposalId = this.resolveTemplate(config.proposalId, context);
    const resolvedProductId = this.resolveTemplate(config.productId, context);
    
    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const productRepository = getProductRepository(databaseService);
    
    // Get proposal and product
    const proposal = await proposalRepository.get({ id: resolvedProposalId });
    if (!proposal) {
      throw new Error(`Proposal not found: ${resolvedProposalId}`);
    }

    const product = await productRepository.get({ id: resolvedProductId });
    if (!product) {
      throw new Error(`Product not found: ${resolvedProductId}`);
    }

    // Add product to proposal items
    const proposalData = proposal as any;
    const items = proposalData.items || [];
    const quantity = config.quantity || 1;

    items.push({
      description: product.name,
      qty: quantity,
      unitPrice: product.price,
      taxPct: 0,
    });

    // Update proposal
    await proposalRepository.update({
      id: resolvedProposalId,
      data: { items }
    });

    logger.info("Product added to proposal successfully", { 
      runId, 
      actionId: action.id,
      proposalId: resolvedProposalId,
      productId: resolvedProductId,
      quantity
    });

    return {
      success: true,
      proposalId: resolvedProposalId,
      productId: resolvedProductId,
      quantity,
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

