import { Workflow, WorkflowData } from "../../../core/entities/workflow";
import { DuplicationOptions } from "../../../core/entities/duplication-mode";
import { BaseDuplicator, IdMappingTable } from "./base-duplicator";

export class WorkflowDuplicator extends BaseDuplicator<Workflow, WorkflowData> {
  async duplicate(
    entity: Workflow,
    targetOrgId: string,
    createdBy: string,
    idMapping: IdMappingTable,
    options: DuplicationOptions,
  ): Promise<{ entity: WorkflowData; newId: string }> {
    const entityData: WorkflowData = {
      orgId: entity.orgId,
      name: entity.name,
      description: entity.description,
      trigger: entity.trigger,
      steps: entity.steps,
      status: entity.status,
      version: entity.version,
      settings: entity.settings,
      tags: entity.tags,
      category: entity.category,
      n8nWorkflowId: entity.n8nWorkflowId,
      n8nEnabled: entity.n8nEnabled,
    };

    let data = this.resetIdentityFields(entityData, targetOrgId, createdBy);
    
    if (options.resetWebhooks) {
      data.trigger = {
        ...data.trigger,
        webhookUrl: undefined,
      };
    }

    data = this.resolveReferences(data, idMapping);

    return { entity: data, newId: "" };
  }

  resetIdentityFields(
    data: WorkflowData,
    targetOrgId: string,
    createdBy: string,
  ): WorkflowData {
    return {
      ...data,
      orgId: targetOrgId,
      status: "draft",
      version: 1,
      n8nWorkflowId: undefined,
      n8nEnabled: false,
      trigger: {
        ...data.trigger,
        webhookUrl: undefined,
      },
    };
  }

  resolveReferences(
    data: WorkflowData,
    idMapping: IdMappingTable,
  ): WorkflowData {
    const resolvedSteps = data.steps.map((step) => {
      const resolvedActions = step.actions.map((action: { type: string; config?: unknown }) => {
        if (!action.config || typeof action.config !== "object" || Array.isArray(action.config)) {
          return action;
        }

        const resolvedConfig = { ...action.config };

        // Resolve email template references
        if (action.type === "send.email") {
          const emailConfig = resolvedConfig as { emailTemplateId?: string; [key: string]: unknown };
          if (emailConfig.emailTemplateId) {
            const newEmailTemplateId = idMapping.getNewId(emailConfig.emailTemplateId);
            if (newEmailTemplateId) {
              emailConfig.emailTemplateId = newEmailTemplateId;
            }
          }
        }

        // Resolve product references
        if (action.type === "add.product_to_proposal") {
          const productConfig = resolvedConfig as { productId?: string; [key: string]: unknown };
          if (productConfig.productId) {
            const newProductId = idMapping.getNewId(productConfig.productId);
            if (newProductId) {
              productConfig.productId = newProductId;
            }
          }
        }

        // Resolve template references
        if (action.type === "generate.pdf") {
          const pdfConfig = resolvedConfig as { templateId?: string; [key: string]: unknown };
          if (pdfConfig.templateId) {
            const newTemplateId = idMapping.getNewId(pdfConfig.templateId);
            if (newTemplateId) {
              pdfConfig.templateId = newTemplateId;
            }
          }
        }

        return {
          ...action,
          config: resolvedConfig,
        };
      });

      return {
        ...step,
        actions: resolvedActions,
      };
    });

    return {
      ...data,
      steps: resolvedSteps,
    };
  }

  handleConflict(
    data: WorkflowData,
    conflictType: "name" | "slug" | "sku" | "other",
    existingValue: string,
    options: DuplicationOptions,
  ): WorkflowData {
    if (conflictType === "name") {
      return {
        ...data,
        name: this.generateConflictSuffix(data.name, options),
      };
    }
    return data;
  }
}
