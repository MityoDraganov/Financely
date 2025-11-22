import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getContactRepository } from "../repositories/contact-repository";

export interface WaitDelayConfig {
  delaySeconds: number;
}

export interface ArchiveRecordConfig {
  recordId: string;
  recordType: "invoice" | "proposal" | "lead" | "contact";
}

export interface UpdateFieldConfig {
  recordId: string;
  recordType: "invoice" | "proposal" | "lead" | "contact";
  field: string;
  value: string | number | boolean;
}

export class SystemExecutor implements ActionExecutor {
  type = "system_action";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing system action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "wait.delay") {
        return await this.waitDelay(action, context, runId);
      } else if (action.type === "archive.record") {
        return await this.archiveRecord(action, context, runId);
      } else if (action.type === "update.field") {
        return await this.updateField(action, context, runId);
      } else {
        throw new Error(`Unsupported system action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing system action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async waitDelay(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as WaitDelayConfig;
    const delayMs = config.delaySeconds * 1000;

    logger.info("Waiting delay", { 
      runId, 
      actionId: action.id,
      delaySeconds: config.delaySeconds
    });

    await new Promise(resolve => setTimeout(resolve, delayMs));

    logger.info("Delay completed", { 
      runId, 
      actionId: action.id
    });

    return {
      success: true,
      delaySeconds: config.delaySeconds,
    };
  }

  private async archiveRecord(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as ArchiveRecordConfig;
    
    // Resolve template variables
    const resolvedRecordId = this.resolveTemplate(config.recordId, context);
    
    const databaseService = getDatabaseService();
    
    // Get appropriate repository
    let repository: any;
    switch (config.recordType) {
      case "invoice":
        repository = getInvoiceRepository(databaseService);
        break;
      case "proposal":
        repository = getProposalRepository(databaseService);
        break;
      case "lead":
        repository = getLeadRepository(databaseService);
        break;
      case "contact":
        repository = getContactRepository(databaseService);
        break;
      default:
        throw new Error(`Unsupported record type: ${config.recordType}`);
    }

    // Update record to archived status
    const record = await repository.get({ id: resolvedRecordId });
    if (!record) {
      throw new Error(`${config.recordType} not found: ${resolvedRecordId}`);
    }

    // Archive by setting status or archived flag
    if (config.recordType === "lead" || config.recordType === "contact") {
      const recordData = (record as any).data || {};
      recordData.status = "archived";
      await repository.update({
        id: resolvedRecordId,
        data: { data: recordData }
      });
    } else {
      await repository.update({
        id: resolvedRecordId,
        data: { status: "archived" }
      });
    }

    logger.info("Record archived successfully", { 
      runId, 
      actionId: action.id,
      recordId: resolvedRecordId,
      recordType: config.recordType
    });

    return {
      success: true,
      recordId: resolvedRecordId,
      recordType: config.recordType,
    };
  }

  private async updateField(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as UpdateFieldConfig;
    
    // Resolve template variables
    const resolvedRecordId = this.resolveTemplate(config.recordId, context);
    const resolvedValue = typeof config.value === 'string' 
      ? this.resolveTemplate(config.value, context)
      : config.value;
    
    const databaseService = getDatabaseService();
    
    // Get appropriate repository
    let repository: any;
    switch (config.recordType) {
      case "invoice":
        repository = getInvoiceRepository(databaseService);
        break;
      case "proposal":
        repository = getProposalRepository(databaseService);
        break;
      case "lead":
        repository = getLeadRepository(databaseService);
        break;
      case "contact":
        repository = getContactRepository(databaseService);
        break;
      default:
        throw new Error(`Unsupported record type: ${config.recordType}`);
    }

    // Get record
    const record = await repository.get({ id: resolvedRecordId });
    if (!record) {
      throw new Error(`${config.recordType} not found: ${resolvedRecordId}`);
    }

    // Update field
    if (config.recordType === "lead" || config.recordType === "contact") {
      const recordData = (record as any).data || {};
      recordData[config.field] = resolvedValue;
      await repository.update({
        id: resolvedRecordId,
        data: { data: recordData }
      });
    } else {
      await repository.update({
        id: resolvedRecordId,
        data: { [config.field]: resolvedValue }
      });
    }

    logger.info("Field updated successfully", { 
      runId, 
      actionId: action.id,
      recordId: resolvedRecordId,
      recordType: config.recordType,
      field: config.field
    });

    return {
      success: true,
      recordId: resolvedRecordId,
      recordType: config.recordType,
      field: config.field,
      value: resolvedValue,
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

