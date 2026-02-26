import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getLeadRepository } from "../repositories/lead-repository";
import { getContactRepository } from "../repositories/contact-repository";

export interface CreateLeadConfig {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: "new" | "viewed" | "contacted" | "converted" | "archived";
}

export interface UpdateLeadStatusConfig {
  leadId: string;
  status: "new" | "viewed" | "contacted" | "converted" | "archived";
}

export interface ConvertLeadToContactConfig {
  leadId: string;
}

export class LeadExecutor implements ActionExecutor {
  type = "lead_action";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing lead action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "create.lead") {
        return await this.createLead(action, context, runId);
      } else if (action.type === "update.lead.status") {
        return await this.updateLeadStatus(action, context, runId);
      } else if (action.type === "convert.lead_to_contact") {
        return await this.convertLeadToContact(action, context, runId);
      } else {
        throw new Error(`Unsupported lead action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing lead action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async createLead(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as CreateLeadConfig;
    
    // Resolve template variables
    const resolvedName = this.resolveTemplate(config.name, context);
    const resolvedEmail = config.email ? this.resolveTemplate(config.email, context) : undefined;
    const resolvedPhone = config.phone ? this.resolveTemplate(config.phone, context) : undefined;
    const resolvedSource = config.source ? this.resolveTemplate(config.source, context) : undefined;
    
    // Get orgId from context
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    // Split name into firstName and lastName
    const nameParts = resolvedName.trim().split(/\s+/);
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(" ") || undefined;

    // Build lead data according to LeadData schema
    const leadData = {
      organizationId: orgId,
      widgetType: "contactForm" as const,
      source: (resolvedSource as "widget" | "manual" | "import") || "manual",
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(resolvedEmail && { email: resolvedEmail }),
      ...(resolvedPhone && { phone: resolvedPhone }),
      formData: {},
      status: config.status || "new",
      tags: [],
    };

    const databaseService = getDatabaseService();
    const leadRepository = getLeadRepository(databaseService);
    const leadId = await leadRepository.create({ data: leadData });

    logger.info("Lead created successfully", { 
      runId, 
      actionId: action.id,
      leadId 
    });

    return {
      success: true,
      leadId,
      name: resolvedName,
    };
  }

  private async updateLeadStatus(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as UpdateLeadStatusConfig;
    
    // Resolve template variables
    const resolvedLeadId = this.resolveTemplate(config.leadId, context);
    
    const databaseService = getDatabaseService();
    const leadRepository = getLeadRepository(databaseService);
    
    // Get lead to update
    const lead = await leadRepository.get({ id: resolvedLeadId });
    if (!lead) {
      throw new Error(`Lead not found: ${resolvedLeadId}`);
    }

    // Update status
    await leadRepository.update({
      id: resolvedLeadId,
      data: { status: config.status } as any
    });

    logger.info("Lead status updated successfully", { 
      runId, 
      actionId: action.id,
      leadId: resolvedLeadId,
      status: config.status
    });

    return {
      success: true,
      leadId: resolvedLeadId,
      status: config.status,
    };
  }

  private async convertLeadToContact(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as ConvertLeadToContactConfig;
    
    // Resolve template variables
    const resolvedLeadId = this.resolveTemplate(config.leadId, context);
    
    // Get orgId from context
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    const databaseService = getDatabaseService();
    const leadRepository = getLeadRepository(databaseService);
    const contactRepository = getContactRepository(databaseService);
    
    // Get lead
    const lead = await leadRepository.get({ id: resolvedLeadId });
    if (!lead) {
      throw new Error(`Lead not found: ${resolvedLeadId}`);
    }

    const leadData = (lead as any).data || {};
    
    // Create contact from lead data
    const contactData = {
      organizationId: orgId,
      firstName: leadData.firstName || "Unknown",
      lastName: leadData.lastName || "Contact",
      email: leadData.email || "",
      phone: leadData.phone ? (Array.isArray(leadData.phone) ? leadData.phone : [leadData.phone]) : [],
      ...(leadData.company && { company: leadData.company }),
      ...(leadData.budget ? { budget: leadData.budget } : {}),
      ...(typeof leadData.budgetMin === "number" ? { budgetMin: leadData.budgetMin } : {}),
      ...(typeof leadData.budgetMax === "number" ? { budgetMax: leadData.budgetMax } : {}),
      ...(leadData.budgetCurrency ? { budgetCurrency: leadData.budgetCurrency } : {}),
      tags: [],
      status: "lead" as const,
      preferences: {
        preferredContactMethod: "email" as const,
        marketingOptIn: false,
        newsletterOptIn: false,
      },
    };

    const contactId = await contactRepository.create({ data: contactData });

    // Update lead status to converted
    await leadRepository.update({
      id: resolvedLeadId,
      data: { status: "converted" } as any
    });

    logger.info("Lead converted to contact successfully", { 
      runId, 
      actionId: action.id,
      leadId: resolvedLeadId,
      contactId
    });

    return {
      success: true,
      leadId: resolvedLeadId,
      contactId,
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
