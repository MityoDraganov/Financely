import type { EmailTemplateData } from "../core/entities/email-template";
import type { TemplateData, TemplateElement } from "../core/entities/template";
import { validateTemplateCompliance } from "../utils/invoice-compliance";
import { evaluateTemplateCompatibility } from "../utils/email-template-compatibility";
import { extractEmailTemplateRequirements } from "../utils/email-template-requirements";
import type { OfficialTemplateLanguage } from "./schemas";

export type QaResult = {
  score: number;
  checks: Record<string, boolean>;
  errors: string[];
};

const A4_CANVAS_WIDTH = 794;
const A4_CANVAS_HEIGHT = 1123;

const PLACEHOLDER_TOKEN_REGEX = /{{\s*([^{}#/@][^{}]*)\s*}}/g;
const CYRILLIC_REGEX = /[\u0400-\u04FF]/g;
const LETTER_REGEX = /[A-Za-z\u0400-\u04FF]/g;

function scoreChecks(checks: Record<string, boolean>): number {
  const values = Object.values(checks);
  if (values.length === 0) return 0;
  const passed = values.filter((value) => value).length;
  return Math.round((passed / values.length) * 100);
}

function trimToken(token: string): string {
  return token.trim().replace(/\s+/g, " ");
}

function collectTemplateTokens(template: EmailTemplateData): Set<string> {
  const tokens = new Set<string>();
  const searchable = [template.subject, template.preheader, template.htmlContent]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");

  for (const match of searchable.matchAll(PLACEHOLDER_TOKEN_REGEX)) {
    const token = trimToken(match[1] || "");
    if (token.length > 0) {
      tokens.add(token);
    }
  }

  return tokens;
}

function localizationPasses(language: OfficialTemplateLanguage, content: string): boolean {
  const letters = content.match(LETTER_REGEX)?.length ?? 0;
  if (letters === 0) {
    return false;
  }

  const cyrillicLetters = content.match(CYRILLIC_REGEX)?.length ?? 0;
  if (language === "bg") {
    return cyrillicLetters >= Math.max(20, Math.floor(letters * 0.15));
  }

  return cyrillicLetters <= Math.max(5, Math.floor(letters * 0.02));
}

function hasValidCanvasBounds(elements: TemplateElement[]): boolean {
  return elements.every((element) => {
    const width = element.width ?? 0;
    const height = element.height ?? 0;
    const x = element.x ?? 0;
    const y = element.y ?? 0;
    return x >= 0 && y >= 0 && x + width <= A4_CANVAS_WIDTH && y + height <= A4_CANVAS_HEIGHT;
  });
}

function hasTableForItems(template: TemplateData): boolean {
  return template.elements.some(
    (element) => element.type === "table" && "itemsBinding" in element && element.itemsBinding === "items",
  );
}

function hasValidProductTableConfig(template: TemplateData): boolean {
  const config = template.productTableConfig;
  if (!config || !config.itemsBinding || !Array.isArray(config.columnMappings) || config.columnMappings.length === 0) {
    return false;
  }

  const mappedFields = new Set(config.columnMappings.map((mapping) => mapping.productField));
  return mappedFields.has("description") && mappedFields.has("price");
}

function getInvoiceLocalizationText(template: TemplateData): string {
  const elementText = template.elements
    .filter((element) => element.type === "text" && "text" in element)
    .map((element) => {
      const value = "text" in element ? element.text : "";
      return typeof value === "string" ? value : "";
    })
    .join("\n");

  return [template.name, template.description, elementText].filter(Boolean).join("\n");
}

function getEmailLocalizationText(template: EmailTemplateData): string {
  return [template.name, template.subject, template.preheader, template.htmlContent]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
}

export function evaluateInvoiceTemplateQa(
  template: TemplateData,
  language: OfficialTemplateLanguage,
): QaResult {
  const complianceMissing = validateTemplateCompliance(template.elements, "EU");
  const checks: Record<string, boolean> = {
    hasElements: template.elements.length > 0,
    validCanvasBounds: hasValidCanvasBounds(template.elements),
    hasItemsTable: hasTableForItems(template),
    hasValidProductTableConfig: hasValidProductTableConfig(template),
    passesEuComplianceBindings: complianceMissing.length === 0,
    passesLocalization: localizationPasses(language, getInvoiceLocalizationText(template)),
  };

  const errors: string[] = [];
  if (complianceMissing.length > 0) {
    errors.push(`Missing EU required bindings: ${complianceMissing.join(", ")}`);
  }

  Object.entries(checks).forEach(([checkName, passed]) => {
    if (!passed) {
      errors.push(`Check failed: ${checkName}`);
    }
  });

  return {
    score: scoreChecks(checks),
    checks,
    errors,
  };
}

export function evaluateEmailTemplateQa(
  template: EmailTemplateData,
  language: OfficialTemplateLanguage,
): QaResult {
  const compatibility = evaluateTemplateCompatibility(template, "invoice_send");
  const tokens = collectTemplateTokens(template);
  const placeholderKeys = new Set(
    (template.placeholders ?? []).map((placeholder) => (typeof placeholder?.key === "string" ? placeholder.key : "")),
  );

  const tokensCovered = Array.from(tokens).every((token) => placeholderKeys.has(token));
  const placeholdersUsed = Array.from(placeholderKeys)
    .filter((key) => key.length > 0)
    .every((key) => tokens.has(key));

  const extractedRequirements = extractEmailTemplateRequirements(template);
  const hasRequirementsSignal =
    extractedRequirements.scalarPaths.length > 0 || extractedRequirements.loops.length > 0;

  const checks: Record<string, boolean> = {
    hasSubject: typeof template.subject === "string" && template.subject.trim().length > 0,
    hasHtmlContent: typeof template.htmlContent === "string" && template.htmlContent.trim().length > 0,
    compatibleWithInvoiceSend: compatibility.compatible,
    tokensCoveredByPlaceholders: tokensCovered,
    placeholdersUsedInContent: placeholdersUsed,
    hasRequirementsSignal,
    passesLocalization: localizationPasses(language, getEmailLocalizationText(template)),
  };

  const errors: string[] = [];
  if (!compatibility.compatible) {
    errors.push(
      `Template not compatible with invoice_send context. Required entities: ${compatibility.requiredEntities.join(", ")}`,
    );
  }

  Object.entries(checks).forEach(([checkName, passed]) => {
    if (!passed) {
      errors.push(`Check failed: ${checkName}`);
    }
  });

  return {
    score: scoreChecks(checks),
    checks,
    errors,
  };
}
