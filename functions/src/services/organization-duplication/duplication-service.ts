import { DatabaseService } from "../../core";
import { Template } from "../../core/entities/template";
import { Workflow } from "../../core/entities/workflow";
import { EmailTemplate } from "../../core/entities/email-template";
import { EmailTemplateMapping } from "../../core/entities/email-template-mapping";
import { Product } from "../../core/entities/product";
import { DuplicationOptions } from "../../core/entities/duplication-mode";
import { removeUndefinedValues } from "../../utils/remove-undefined-values";
import { TemplateDuplicator } from "./entity-duplicators/template-duplicator";
import { WorkflowDuplicator } from "./entity-duplicators/workflow-duplicator";
import { EmailTemplateDuplicator } from "./entity-duplicators/email-template-duplicator";
import { EmailTemplateMappingDuplicator } from "./entity-duplicators/email-template-mapping-duplicator";
import { ProductDuplicator } from "./entity-duplicators/product-duplicator";
import { OrganizationDuplicator } from "./entity-duplicators/organization-duplicator";
import { IdMappingTable } from "./entity-duplicators/base-duplicator";
import { DependencyGraphBuilder } from "./dependency-graph-builder";
import { getOrganizationRepository } from "../../repositories/organization-repository";
import { getTemplateRepository } from "../../repositories/template-repository";
import { getWorkflowRepository } from "../../repositories/workflow-repository";
import { getEmailTemplateRepository } from "../../repositories/email-template-repository";
import { getEmailTemplateMappingRepository } from "../../repositories/email-template-mapping-repository";
import { getProductRepository } from "../../repositories/product-repository";
import { getUserRepository } from "../../repositories/user-repository";
import { ORGANIZATION_ROLES } from "../../core/roles";

export interface DuplicationResult {
  targetOrgId: string;
  entitiesCreated: Record<string, number>;
  entitiesSkipped: number;
  entitiesFailed: number;
  conflictsResolved: number;
  errors: Array<{ entityType: string; entityId?: string; error: string }>;
}

export class OrganizationDuplicationService {
  private dependencyGraphBuilder: DependencyGraphBuilder;
  private templateDuplicator: TemplateDuplicator;
  private workflowDuplicator: WorkflowDuplicator;
  private emailTemplateDuplicator: EmailTemplateDuplicator;
  private emailTemplateMappingDuplicator: EmailTemplateMappingDuplicator;
  private productDuplicator: ProductDuplicator;
  private organizationDuplicator: OrganizationDuplicator;

  constructor(private databaseService: DatabaseService) {
    this.dependencyGraphBuilder = new DependencyGraphBuilder();
    this.templateDuplicator = new TemplateDuplicator();
    this.workflowDuplicator = new WorkflowDuplicator();
    this.emailTemplateDuplicator = new EmailTemplateDuplicator();
    this.emailTemplateMappingDuplicator = new EmailTemplateMappingDuplicator();
    this.productDuplicator = new ProductDuplicator();
    this.organizationDuplicator = new OrganizationDuplicator();
  }

  async duplicateOrganization(params: {
    sourceOrgId: string;
    targetOrgName: string;
    createdBy: string;
    options: DuplicationOptions;
  }): Promise<DuplicationResult> {
    const { sourceOrgId, targetOrgName, createdBy, options } = params;

    // Get repositories
    const orgRepo = getOrganizationRepository(this.databaseService);
    const templateRepo = getTemplateRepository(this.databaseService);
    const workflowRepo = getWorkflowRepository(this.databaseService);
    const emailTemplateRepo = getEmailTemplateRepository(this.databaseService);
    const emailTemplateMappingRepo = getEmailTemplateMappingRepository(this.databaseService);
    const productRepo = getProductRepository(this.databaseService);

    // Get source organization
    const sourceOrg = await orgRepo.get({ id: sourceOrgId });
    if (!sourceOrg) {
      throw new Error(`Source organization not found: ${sourceOrgId}`);
    }

    // Create target organization
    const orgDuplicationResult = await this.organizationDuplicator.duplicate(
      sourceOrg,
      "",
      createdBy,
      new IdMappingTable(),
      options,
    );
    
    orgDuplicationResult.entity.name = targetOrgName;
    const cleanedOrgData = removeUndefinedValues(orgDuplicationResult.entity);
    const targetOrgId = await orgRepo.create({ data: cleanedOrgData });

    // Add creator as owner
    await orgRepo.addToSet({
      id: targetOrgId,
      fieldName: "memberIds",
      value: createdBy,
    });

    // Update user's organizationRoles
    const userRepo = getUserRepository(this.databaseService);
    const user = await userRepo.get({ id: createdBy });
    if (user) {
      const currentRoles = user.organizationRoles || {};
      await userRepo.update({
        id: createdBy,
        data: {
          organizationRoles: {
            ...currentRoles,
            [targetOrgId]: ORGANIZATION_ROLES.OWNER,
          },
        },
      });
    }

    // Initialize ID mapping
    const idMapping = new IdMappingTable();
    idMapping.addMapping(sourceOrgId, targetOrgId, "organization");

    // ALWAYS fetch ALL entities (no selection logic)
    const [templates, workflows, emailTemplates, emailTemplateMappings, products] = await Promise.all([
      templateRepo.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: sourceOrgId }],
      }),
      workflowRepo.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: sourceOrgId }],
      }),
      emailTemplateRepo.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: sourceOrgId }],
      }),
      emailTemplateMappingRepo.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: sourceOrgId }],
      }),
      productRepo.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: sourceOrgId }],
      }),
    ]);

    console.log("Fetched entities for duplication:", {
      templates: templates.length,
      workflows: workflows.length,
      emailTemplates: emailTemplates.length,
      emailTemplateMappings: emailTemplateMappings.length,
      products: products.length,
    });

    // Build dependency graph
    const graph = this.dependencyGraphBuilder.buildGraph({
      templates,
      workflows,
      emailTemplates,
      emailTemplateMappings,
      products,
    });

    // Get topological order
    let order = this.dependencyGraphBuilder.getTopologicalOrder(graph);

    console.log("Dependency graph and order:", {
      graphNodeCount: graph.nodes.length,
      orderLength: order.length,
    });

    // Fallback: if order is empty but we have entities, process them in default order
    if (order.length === 0) {
      console.warn("Topological order is empty, using default order");
      order = [
        ...templates.map(t => t.id),
        ...products.map(p => p.id),
        ...emailTemplates.map(et => et.id),
        ...emailTemplateMappings.map(m => m.id),
        ...workflows.map((w: Workflow) => w.id),
      ];
      console.log("Using fallback order, length:", order.length);
    }

    // Track results
    const result: DuplicationResult = {
      targetOrgId,
      entitiesCreated: {},
      entitiesSkipped: 0,
      entitiesFailed: 0,
      conflictsResolved: 0,
      errors: [],
    };

    // Build entity map
    const entityMap = new Map<string, { type: string; entity: Template | Workflow | EmailTemplate | EmailTemplateMapping | Product }>();
    templates.forEach((t) => entityMap.set(t.id, { type: "template", entity: t }));
    workflows.forEach((w: Workflow) => entityMap.set(w.id, { type: "workflow", entity: w }));
    emailTemplates.forEach((et) => entityMap.set(et.id, { type: "emailTemplate", entity: et }));
    emailTemplateMappings.forEach((m) => entityMap.set(m.id, { type: "emailTemplateMapping", entity: m }));
    products.forEach((p) => entityMap.set(p.id, { type: "product", entity: p }));

    // Process entities in order
    console.log("Starting entity duplication, order length:", order.length);
    for (const entityId of order) {
      const entityInfo = entityMap.get(entityId);
      if (!entityInfo) {
        console.warn("Entity not found in map:", entityId);
        continue;
      }

      console.log("Duplicating entity:", { entityId, type: entityInfo.type });
      try {
        let newId: string;

        switch (entityInfo.type) {
          case "template": {
            const template = entityInfo.entity as Template;
            const templateResult = await this.templateDuplicator.duplicate(
              template,
              targetOrgId,
              createdBy,
              idMapping,
              options,
            );
            newId = await templateRepo.create({ data: removeUndefinedValues(templateResult.entity) });
            idMapping.addMapping(entityId, newId, "template");
            break;
          }

          case "workflow": {
            const workflow = entityInfo.entity as Workflow;
            const workflowResult = await this.workflowDuplicator.duplicate(
              workflow,
              targetOrgId,
              createdBy,
              idMapping,
              options,
            );
            newId = await workflowRepo.create(workflowResult.entity);
            idMapping.addMapping(entityId, newId, "workflow");
            break;
          }

          case "emailTemplate": {
            const emailTemplate = entityInfo.entity as EmailTemplate;
            const emailTemplateResult = await this.emailTemplateDuplicator.duplicate(
              emailTemplate,
              targetOrgId,
              createdBy,
              idMapping,
              options,
            );
            newId = await emailTemplateRepo.create({ data: removeUndefinedValues(emailTemplateResult.entity) });
            idMapping.addMapping(entityId, newId, "emailTemplate");
            break;
          }

          case "emailTemplateMapping": {
            const mapping = entityInfo.entity as EmailTemplateMapping;
            const mappingResult = await this.emailTemplateMappingDuplicator.duplicate(
              mapping,
              targetOrgId,
              createdBy,
              idMapping,
              options,
            );
            newId = await emailTemplateMappingRepo.create({ data: removeUndefinedValues(mappingResult.entity) });
            idMapping.addMapping(entityId, newId, "emailTemplateMapping");
            break;
          }

          case "product": {
            const product = entityInfo.entity as Product;
            const productResult = await this.productDuplicator.duplicate(
              product,
              targetOrgId,
              createdBy,
              idMapping,
              options,
            );
            newId = await productRepo.create({ data: removeUndefinedValues(productResult.entity) });
            idMapping.addMapping(entityId, newId, "product");
            break;
          }

          default:
            result.entitiesSkipped++;
            continue;
        }

        result.entitiesCreated[entityInfo.type] = (result.entitiesCreated[entityInfo.type] || 0) + 1;
        console.log("Entity duplicated successfully:", { entityId, newId, type: entityInfo.type });
      } catch (error) {
        result.entitiesFailed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to duplicate entity:", { entityId, type: entityInfo.type, error: errorMessage });
        result.errors.push({
          entityType: entityInfo.type,
          entityId,
          error: errorMessage,
        });
      }
    }

    console.log("Duplication complete:", {
      targetOrgId,
      entitiesCreated: result.entitiesCreated,
      entitiesFailed: result.entitiesFailed,
      errors: result.errors.length,
    });

    return result;
  }
}
