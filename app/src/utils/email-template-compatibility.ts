import type { EmailTemplate, EmailTemplatePlaceholder, WorkflowTriggerType } from "@/core";

export type EmailTemplateEntity = "product" | "contact" | "invoice" | "proposal";

export type EmailTemplateCompatibilityContext =
  | "invoice_send"
  | "proposal_send"
  | "workflow_invoice"
  | "workflow_proposal"
  | "workflow_contact"
  | "workflow_product"
  | "workflow_generic";

export type EmailTemplateTypeId =
  | "all"
  | "invoice"
  | "proposal"
  | "workflow_invoice"
  | "workflow_proposal"
  | "workflow_contact"
  | "workflow_product";

export type EmailTemplateTypeDefinition = {
  id: EmailTemplateTypeId;
  label: string;
  description: string;
  entities: EmailTemplateEntity[];
  allowedContexts: string[];
};

type CompatibilityEvaluation = {
  compatible: boolean;
  referencedEntities: EmailTemplateEntity[];
  supportedEntities: EmailTemplateEntity[];
  requiredAllowedContextKeys: string[];
};

const CONTEXT_SUPPORTED_ENTITIES: Record<EmailTemplateCompatibilityContext, EmailTemplateEntity[]> = {
  invoice_send: ["invoice", "contact"],
  proposal_send: ["proposal", "contact"],
  workflow_invoice: ["invoice", "contact"],
  workflow_proposal: ["proposal", "contact"],
  workflow_contact: ["contact"],
  workflow_product: ["product", "contact"],
  workflow_generic: [],
};

const CONTEXT_ALLOWED_CONTEXT_KEYS: Record<EmailTemplateCompatibilityContext, string[]> = {
  invoice_send: ["invoice_send", "invoice_email", "invoice"],
  proposal_send: ["proposal_send", "proposal_email", "proposal"],
  workflow_invoice: [
    "workflow_invoice",
    "workflow",
    "workflow_email",
    "automation",
    "invoice",
    "invoice_send",
  ],
  workflow_proposal: [
    "workflow_proposal",
    "workflow",
    "workflow_email",
    "automation",
    "proposal",
    "proposal_send",
  ],
  workflow_contact: ["workflow_contact", "workflow", "workflow_email", "automation", "contact"],
  workflow_product: ["workflow_product", "workflow", "workflow_email", "automation", "product"],
  workflow_generic: ["workflow_generic", "workflow", "workflow_email", "automation"],
};

export const EMAIL_TEMPLATE_TYPE_DEFINITIONS: EmailTemplateTypeDefinition[] = [
  {
    id: "all",
    label: "All Compatible",
    description: "Use across multiple flows. Only combinations that stay valid are allowed.",
    entities: ["product", "contact", "invoice", "proposal"],
    allowedContexts: [],
  },
  {
    id: "invoice",
    label: "Invoice Email",
    description: "For sending invoice emails.",
    entities: ["invoice", "contact"],
    allowedContexts: ["invoice_send"],
  },
  {
    id: "proposal",
    label: "Proposal Email",
    description: "For sending proposal emails.",
    entities: ["proposal", "contact"],
    allowedContexts: ["proposal_send"],
  },
  {
    id: "workflow_invoice",
    label: "Workflow Invoice",
    description: "For workflows triggered by invoice events.",
    entities: ["invoice", "contact"],
    allowedContexts: ["workflow_invoice"],
  },
  {
    id: "workflow_proposal",
    label: "Workflow Proposal",
    description: "For workflows triggered by proposal events.",
    entities: ["proposal", "contact"],
    allowedContexts: ["workflow_proposal"],
  },
  {
    id: "workflow_contact",
    label: "Workflow Contact",
    description: "For workflows triggered by contact events.",
    entities: ["contact"],
    allowedContexts: ["workflow_contact"],
  },
  {
    id: "workflow_product",
    label: "Workflow Product",
    description: "For workflows triggered by product events.",
    entities: ["product", "contact"],
    allowedContexts: ["workflow_product"],
  },
];

const normalizeContextKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const extractReferencedEntities = (
  placeholders: EmailTemplatePlaceholder[] | undefined,
): EmailTemplateEntity[] => {
  const entities = new Set<EmailTemplateEntity>();

  (placeholders ?? []).forEach((placeholder) => {
    const source = placeholder.source;
    if (!source || source.type !== "entity_field") return;

    if (
      source.entity === "product" ||
      source.entity === "contact" ||
      source.entity === "invoice" ||
      source.entity === "proposal"
    ) {
      entities.add(source.entity);
    }
  });

  return Array.from(entities);
};

const isAllowedInContext = (
  template: Pick<EmailTemplate, "allowedContexts">,
  context: EmailTemplateCompatibilityContext,
): boolean => {
  const allowedContexts = template.allowedContexts ?? [];
  if (allowedContexts.length === 0) return true;

  const normalized = new Set(
    allowedContexts
      .map((key) => normalizeContextKey(key))
      .filter((key) => key.length > 0),
  );

  if (normalized.has("organization") || normalized.has("all")) {
    return true;
  }

  return CONTEXT_ALLOWED_CONTEXT_KEYS[context].some((key) => normalized.has(key));
};

export const evaluateTemplateCompatibility = (
  template: Pick<EmailTemplate, "allowedContexts" | "placeholders">,
  context: EmailTemplateCompatibilityContext,
): CompatibilityEvaluation => {
  const referencedEntities = extractReferencedEntities(template.placeholders);
  const supportedEntities = CONTEXT_SUPPORTED_ENTITIES[context];
  const requiredAllowedContextKeys = CONTEXT_ALLOWED_CONTEXT_KEYS[context];

  if (!isAllowedInContext(template, context)) {
    return {
      compatible: false,
      referencedEntities,
      supportedEntities,
      requiredAllowedContextKeys,
    };
  }

  const supportsAllEntities = referencedEntities.every((entity) => supportedEntities.includes(entity));
  return {
    compatible: supportsAllEntities,
    referencedEntities,
    supportedEntities,
    requiredAllowedContextKeys,
  };
};

export const isTemplateCompatibleWithContext = (
  template: Pick<EmailTemplate, "allowedContexts" | "placeholders">,
  context: EmailTemplateCompatibilityContext,
): boolean => evaluateTemplateCompatibility(template, context).compatible;

export const getCompatibleTemplateContexts = (
  template: Pick<EmailTemplate, "allowedContexts" | "placeholders">,
): EmailTemplateCompatibilityContext[] => {
  const contexts: EmailTemplateCompatibilityContext[] = [
    "invoice_send",
    "proposal_send",
    "workflow_invoice",
    "workflow_proposal",
    "workflow_contact",
    "workflow_product",
    "workflow_generic",
  ];

  return contexts.filter((context) => isTemplateCompatibleWithContext(template, context));
};

export const resolveWorkflowTemplateContext = (
  triggerType: WorkflowTriggerType | string | undefined,
): EmailTemplateCompatibilityContext => {
  if (!triggerType) return "workflow_generic";

  if (triggerType.startsWith("invoice.")) return "workflow_invoice";
  if (triggerType.startsWith("proposal.")) return "workflow_proposal";
  if (triggerType.startsWith("contact.")) return "workflow_contact";
  if (triggerType.startsWith("product.")) return "workflow_product";

  return "workflow_generic";
};

export const inferTemplateTypeFromAllowedContexts = (
  allowedContexts: string[] | undefined,
): EmailTemplateTypeId => {
  const normalized = new Set((allowedContexts ?? []).map((value) => normalizeContextKey(value)));
  if (normalized.size === 0 || normalized.has("organization") || normalized.has("all")) {
    return "all";
  }

  const matches: EmailTemplateTypeId[] = EMAIL_TEMPLATE_TYPE_DEFINITIONS
    .filter((definition) => definition.id !== "all")
    .filter((definition) =>
      definition.allowedContexts.some((contextKey) => normalized.has(normalizeContextKey(contextKey))),
    )
    .map((definition) => definition.id);

  if (matches.length === 1) {
    return matches[0];
  }

  return "all";
};

export const allowedContextsForTemplateType = (typeId: EmailTemplateTypeId): string[] => {
  const definition = EMAIL_TEMPLATE_TYPE_DEFINITIONS.find((item) => item.id === typeId);
  return definition ? [...definition.allowedContexts] : [];
};
