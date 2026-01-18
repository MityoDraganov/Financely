import { Template } from "../../core/entities/template";
import { Workflow } from "../../core/entities/workflow";
import { EmailTemplate } from "../../core/entities/email-template";
import { EmailTemplateMapping } from "../../core/entities/email-template-mapping";
import { Product } from "../../core/entities/product";

export interface DependencyNode {
  entityType: string;
  entityId: string;
  dependencies: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  relationship: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export class DependencyGraphBuilder {
  buildGraph(params: {
    templates: Template[];
    workflows: Workflow[];
    emailTemplates: EmailTemplate[];
    emailTemplateMappings: EmailTemplateMapping[];
    products: Product[];
  }): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Add nodes for all entities
    params.templates.forEach((template) => {
      nodes.push({
        entityType: "template",
        entityId: template.id,
        dependencies: [],
      });
    });

    params.workflows.forEach((workflow) => {
      nodes.push({
        entityType: "workflow",
        entityId: workflow.id,
        dependencies: [],
      });
    });

    params.emailTemplates.forEach((emailTemplate) => {
      nodes.push({
        entityType: "emailTemplate",
        entityId: emailTemplate.id,
        dependencies: [],
      });
    });

    params.emailTemplateMappings.forEach((mapping) => {
      nodes.push({
        entityType: "emailTemplateMapping",
        entityId: mapping.id,
        dependencies: [],
      });
    });

    params.products.forEach((product) => {
      nodes.push({
        entityType: "product",
        entityId: product.id,
        dependencies: [],
      });
    });

    // Build dependencies
    params.workflows.forEach((workflow) => {
      this.extractWorkflowDependencies(workflow, edges);
    });

    params.emailTemplateMappings.forEach((mapping) => {
      if (mapping.emailTemplateId) {
        edges.push({
          from: mapping.id,
          to: mapping.emailTemplateId,
          relationship: "references",
        });
      }
      if (mapping.entityTemplateId) {
        edges.push({
          from: mapping.id,
          to: mapping.entityTemplateId,
          relationship: "references",
        });
      }
    });

    // Update node dependencies based on edges
    edges.forEach((edge) => {
      const node = nodes.find((n) => n.entityId === edge.from);
      if (node && !node.dependencies.includes(edge.to)) {
        node.dependencies.push(edge.to);
      }
    });

    return { nodes, edges };
  }

  private extractWorkflowDependencies(workflow: Workflow, edges: DependencyEdge[]): void {
    workflow.steps.forEach((step) => {
      step.actions.forEach((action: { type: string; config?: unknown }) => {
        if (action.type === "send.email" && action.config && typeof action.config === "object") {
          const emailConfig = action.config as { emailTemplateId?: string; [key: string]: unknown };
          if (emailConfig.emailTemplateId) {
            edges.push({
              from: workflow.id,
              to: emailConfig.emailTemplateId,
              relationship: "uses",
            });
          }
        }

        if (action.type === "add.product_to_proposal" && action.config && typeof action.config === "object") {
          const productConfig = action.config as { productId?: string; [key: string]: unknown };
          if (productConfig.productId) {
            edges.push({
              from: workflow.id,
              to: productConfig.productId,
              relationship: "references",
            });
          }
        }

        if (action.type === "generate.pdf" && action.config && typeof action.config === "object") {
          const pdfConfig = action.config as { templateId?: string; [key: string]: unknown };
          if (pdfConfig.templateId) {
            edges.push({
              from: workflow.id,
              to: pdfConfig.templateId,
              relationship: "uses",
            });
          }
        }
      });
    });
  }

  getTopologicalOrder(graph: DependencyGraph): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    graph.nodes.forEach((node) => {
      nodeMap.set(node.entityId, node);
    });

    const visit = (entityId: string): boolean => {
      if (visiting.has(entityId)) {
        return false;
      }
      if (visited.has(entityId)) {
        return true;
      }

      visiting.add(entityId);
      const node = nodeMap.get(entityId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visit(depId)) {
            return false;
          }
        }
      }
      visiting.delete(entityId);
      visited.add(entityId);
      order.push(entityId);
      return true;
    };

    graph.nodes.forEach((node) => {
      if (!visited.has(node.entityId)) {
        if (!visit(node.entityId)) {
          throw new Error(`Circular dependency detected involving entity ${node.entityId}`);
        }
      }
    });

    return order;
  }
}
