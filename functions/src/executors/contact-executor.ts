import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getContactRepository } from "../repositories/contact-repository";

export interface CreateContactConfig {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
}

export interface UpdateContactConfig {
  contactId: string;
  updates: Record<string, unknown>;
}

export class ContactExecutor implements ActionExecutor {
  type = "contact_action";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing contact action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "create.contact") {
        return await this.createContact(action, context, runId);
      } else if (action.type === "update.contact") {
        return await this.updateContact(action, context, runId);
      } else {
        throw new Error(`Unsupported contact action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing contact action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async createContact(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as CreateContactConfig;
    
    // Resolve template variables
    const resolvedName = this.resolveTemplate(config.name, context);
    const resolvedEmail = config.email ? this.resolveTemplate(config.email, context) : undefined;
    const resolvedPhone = config.phone ? this.resolveTemplate(config.phone, context) : undefined;
    const resolvedCompany = config.company ? this.resolveTemplate(config.company, context) : undefined;
    
    // Get orgId from context
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    // Build contact data
    const contactData = {
      organizationId: orgId,
      data: {
        name: resolvedName,
        ...(resolvedEmail && { email: resolvedEmail }),
        ...(resolvedPhone && { phone: resolvedPhone }),
        ...(resolvedCompany && { company: resolvedCompany }),
      },
    };

    const databaseService = getDatabaseService();
    const contactRepository = getContactRepository(databaseService);
    const contactId = await contactRepository.create({ data: contactData });

    logger.info("Contact created successfully", { 
      runId, 
      actionId: action.id,
      contactId 
    });

    return {
      success: true,
      contactId,
      name: resolvedName,
    };
  }

  private async updateContact(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as UpdateContactConfig;
    
    // Resolve template variables
    const resolvedContactId = this.resolveTemplate(config.contactId, context);
    
    // Resolve updates with template variables
    const resolvedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config.updates)) {
      if (typeof value === 'string') {
        resolvedUpdates[key] = this.resolveTemplate(value, context);
      } else {
        resolvedUpdates[key] = value;
      }
    }
    
    const databaseService = getDatabaseService();
    const contactRepository = getContactRepository(databaseService);
    
    // Get contact to update
    const contact = await contactRepository.get({ id: resolvedContactId });
    if (!contact) {
      throw new Error(`Contact not found: ${resolvedContactId}`);
    }

    // Update contact data
    const contactData = (contact as any).data || {};
    Object.assign(contactData, resolvedUpdates);

    await contactRepository.update({
      id: resolvedContactId,
      data: { data: contactData }
    });

    logger.info("Contact updated successfully", { 
      runId, 
      actionId: action.id,
      contactId: resolvedContactId
    });

    return {
      success: true,
      contactId: resolvedContactId,
      updates: resolvedUpdates,
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

