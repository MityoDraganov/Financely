export type EmailTemplateEntity = "product" | "contact" | "invoice" | "proposal";

export type EmailTemplateCompatibilityContext = "invoice_send" | "proposal_send";

type TemplatePlaceholderSource = {
  type?: string;
  entity?: string;
};

type TemplatePlaceholderLike = {
  source?: TemplatePlaceholderSource;
};

type TemplateLike = {
  allowedContexts?: string[];
  placeholders?: TemplatePlaceholderLike[];
};

type CompatibilityEvaluation = {
  compatible: boolean;
  requiredEntities: EmailTemplateEntity[];
  supportedEntities: EmailTemplateEntity[];
  requiredAllowedContextKeys: string[];
};

const CONTEXT_SUPPORTED_ENTITIES: Record<EmailTemplateCompatibilityContext, EmailTemplateEntity[]> = {
  invoice_send: ["invoice", "contact"],
  proposal_send: ["proposal", "contact"],
};

const CONTEXT_ALLOWED_CONTEXT_KEYS: Record<EmailTemplateCompatibilityContext, string[]> = {
  invoice_send: ["invoice_send", "invoice_email", "invoice"],
  proposal_send: ["proposal_send", "proposal_email", "proposal"],
};

const normalizeContextKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const isEntity = (value: string | undefined): value is EmailTemplateEntity =>
  value === "product" || value === "contact" || value === "invoice" || value === "proposal";

export const extractRequiredTemplateEntities = (
  placeholders: TemplatePlaceholderLike[] | undefined,
): EmailTemplateEntity[] => {
  const entities = new Set<EmailTemplateEntity>();

  (placeholders ?? []).forEach((placeholder) => {
    const source = placeholder.source;
    if (!source || source.type !== "entity_field") return;
    if (!isEntity(source.entity)) return;
    entities.add(source.entity);
  });

  return Array.from(entities);
};

const isAllowedInContext = (
  template: Pick<TemplateLike, "allowedContexts">,
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
  template: TemplateLike,
  context: EmailTemplateCompatibilityContext,
): CompatibilityEvaluation => {
  const requiredEntities = extractRequiredTemplateEntities(template.placeholders);
  const supportedEntities = CONTEXT_SUPPORTED_ENTITIES[context];
  const requiredAllowedContextKeys = CONTEXT_ALLOWED_CONTEXT_KEYS[context];

  if (!isAllowedInContext(template, context)) {
    return {
      compatible: false,
      requiredEntities,
      supportedEntities,
      requiredAllowedContextKeys,
    };
  }

  const compatible = requiredEntities.every((entity) => supportedEntities.includes(entity));
  return {
    compatible,
    requiredEntities,
    supportedEntities,
    requiredAllowedContextKeys,
  };
};

export const hasAllRequiredEntities = (
  requiredEntities: EmailTemplateEntity[],
  availableEntities: Set<EmailTemplateEntity>,
): boolean => requiredEntities.every((entity) => availableEntities.has(entity));

