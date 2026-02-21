import { processEmailTemplate } from "./email-template-processor";

type EmailTemplatePlaceholderSource = {
  type?: string;
  entity?: string;
  path?: string;
};

type EmailTemplatePlaceholderLike = {
  key?: string;
  source?: EmailTemplatePlaceholderSource;
};

type EmailTemplateLike = {
  htmlContent?: string;
  subject?: string;
  preheader?: string;
  placeholders?: EmailTemplatePlaceholderLike[];
};

export type TemplateRenderResult = {
  html: string;
  subject: string;
  preheader: string;
};

export const buildSourceMappingsFromPlaceholders = (
  placeholders: EmailTemplatePlaceholderLike[] | undefined,
): Record<string, string> => {
  const mappings: Record<string, string> = {};

  (placeholders ?? []).forEach((placeholder) => {
    const placeholderKey = placeholder.key?.trim();
    const source = placeholder.source;
    if (!placeholderKey || !source) return;
    if (source.type !== "entity_field") return;

    const entity = source.entity?.trim();
    const path = source.path?.trim();
    if (!entity || !path) return;

    mappings[placeholderKey] = path.startsWith(`${entity}.`) ? path : `${entity}.${path}`;
  });

  return mappings;
};

export const mergeMappings = (
  explicitMappings: Record<string, string> | undefined,
  sourceMappings: Record<string, string> | undefined,
): Record<string, string> => ({
  ...(sourceMappings ?? {}),
  ...(explicitMappings ?? {}),
});

export const buildRenderDataWithAliases = (
  rootData: Record<string, unknown>,
  aliases?: Record<string, unknown>,
): Record<string, unknown> => ({
  ...rootData,
  ...(aliases ?? {}),
});

export const renderTemplate = (
  template: EmailTemplateLike,
  mappings: Record<string, string>,
  data: Record<string, unknown>,
  options?: {
    escapeHtml?: boolean;
    enableLogging?: boolean;
  },
): TemplateRenderResult =>
  processEmailTemplate(
    {
      html: template.htmlContent || "",
      subject: template.subject || "",
      preheader: template.preheader || "",
    },
    mappings,
    data,
    options,
  );
