import type { EmailTemplateData } from "../core/entities/email-template";
import type { TemplateData, TemplateElement } from "../core/entities/template";
import { validateTemplateCompliance } from "../utils/invoice-compliance";
import { evaluateTemplateCompatibility } from "../utils/email-template-compatibility";
import { extractEmailTemplateRequirements } from "../utils/email-template-requirements";
import type { OfficialTemplateLanguage } from "./schemas";
import {
  getInvoiceStyleProfileById,
  isInvoiceKeyFieldBinding,
} from "./invoice-style-profiles";

export type QaResult = {
  score: number;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
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

function getOverlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return overlapX * overlapY;
}

function isDecorativeElementType(type: TemplateElement["type"]): boolean {
  return type === "box" || type === "line" || type === "path" || type === "spacer" || type === "pageBreak";
}

function isLayoutOverlapCandidate(element: TemplateElement): boolean {
  if (element.visible === false) return false;
  if (isDecorativeElementType(element.type)) return false;
  const bounds = getElementBounds(element);
  return bounds.width > 1 && bounds.height > 1;
}

function findProblematicOverlaps(template: TemplateData): Array<{ firstId: string; secondId: string }> {
  const candidates = template.elements.filter(isLayoutOverlapCandidate);
  const minOverlapArea = 24;
  const overlaps: Array<{ firstId: string; secondId: string }> = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const first = candidates[i];
      const second = candidates[j];
      const overlapArea = getOverlapArea(getElementBounds(first), getElementBounds(second));
      if (overlapArea < minOverlapArea) continue;
      overlaps.push({ firstId: first.id, secondId: second.id });
      if (overlaps.length >= 10) return overlaps;
    }
  }

  return overlaps;
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

function getElementBounds(element: TemplateElement) {
  return {
    x: element.x ?? 0,
    y: element.y ?? 0,
    width: element.width ?? 0,
    height: element.height ?? 0,
  };
}

function hasNearbyLabel(
  targetElement: TemplateElement,
  textElements: Array<Extract<TemplateElement, { type: "text" }>>,
): boolean {
  const bounds = getElementBounds(targetElement);
  return textElements.some((textElement) => {
    const text = typeof textElement.text === "string" ? textElement.text.trim() : "";
    if (!text || text.length > 90) return false;
    if (text.includes("{{") && text.includes("}}")) return false;

    const textBounds = getElementBounds(textElement);
    const aboveAndClose =
      textBounds.y <= bounds.y + 8 &&
      bounds.y - textBounds.y <= 76 &&
      Math.abs(textBounds.x - bounds.x) <= 220;
    const leftAligned =
      textBounds.x <= bounds.x + 6 &&
      bounds.x - textBounds.x <= 180 &&
      Math.abs(textBounds.y - bounds.y) <= 24;
    return aboveAndClose || leftAligned;
  });
}

function hasKeyFieldLabels(template: TemplateData): boolean {
  const textElements = template.elements.filter(
    (element): element is Extract<TemplateElement, { type: "text" }> => element.type === "text",
  );
  const bindingElements = template.elements.filter((element) => {
    if (element.type !== "input" && element.type !== "currency" && element.type !== "text") return false;
    return typeof element.binding === "string" && isInvoiceKeyFieldBinding(element.binding);
  });

  if (bindingElements.length === 0) return false;

  return bindingElements.every((element) => {
    if (element.type === "text") {
      const text = typeof element.text === "string" ? element.text.trim() : "";
      if (text.length > 0 && !text.includes("{{")) return true;
    }
    return hasNearbyLabel(element, textElements);
  });
}

function detectSevereLocalizationMiss(language: OfficialTemplateLanguage, content: string): boolean {
  const letters = content.match(LETTER_REGEX)?.length ?? 0;
  if (letters === 0) return true;

  const cyrillicLetters = content.match(CYRILLIC_REGEX)?.length ?? 0;
  const cyrillicRatio = cyrillicLetters / letters;

  if (language === "bg") {
    return cyrillicRatio < 0.12;
  }

  return cyrillicRatio > 0.35;
}

function evaluateInvoiceLocalization(
  template: TemplateData,
  language: OfficialTemplateLanguage,
): { hardPass: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const content = getInvoiceLocalizationText(template);
  const letters = content.match(LETTER_REGEX)?.length ?? 0;
  const cyrillicLetters = content.match(CYRILLIC_REGEX)?.length ?? 0;
  const cyrillicRatio = letters > 0 ? cyrillicLetters / letters : 0;

  if (detectSevereLocalizationMiss(language, content)) {
    return { hardPass: false, warnings };
  }

  if (language === "bg") {
    if (cyrillicRatio < 0.6) {
      warnings.push("Localization warning: mixed Bulgarian/English visible text detected.");
    }

    const englishUiTerms = [
      "invoice",
      "supplier",
      "customer",
      "quantity",
      "description",
      "amount",
      "vat",
      "total",
      "due date",
    ];
    const lowercaseContent = content.toLowerCase();
    const termHits = englishUiTerms.filter((term) => lowercaseContent.includes(term)).length;
    if (termHits >= 3) {
      warnings.push("Localization warning: key UI labels still contain English terms.");
    }
  }

  return { hardPass: true, warnings };
}

function matchesStyleProfile(
  template: TemplateData,
  profileId?: string,
): { pass: boolean; reasons: string[] } {
  const profile = getInvoiceStyleProfileById(profileId);
  if (!profile) return { pass: true, reasons: [] };

  const reasons: string[] = [];

  const fonts = Array.isArray(template.brand?.fonts)
    ? template.brand.fonts.map((font) => font.toLowerCase())
    : [];
  const hasExpectedFont = profile.conformity.expectedFontFamilies.some((font) =>
    fonts.includes(font.toLowerCase()),
  );
  if (!hasExpectedFont) {
    reasons.push("Expected style profile font family is missing.");
  }

  const decorativeCount = template.elements.filter((element) =>
    profile.conformity.preferredDecorativeTypes.includes(
      element.type as (typeof profile.conformity.preferredDecorativeTypes)[number],
    ),
  ).length;
  if (decorativeCount < profile.conformity.minDecorativeElements) {
    reasons.push("Not enough decorative profile elements for the selected style.");
  }

  if (profile.conformity.requireSplitSupplierCustomer) {
    const supplierElements = template.elements.filter(
      (element) =>
        (element.type === "input" || element.type === "currency" || element.type === "text") &&
        typeof element.binding === "string" &&
        element.binding.startsWith("supplier."),
    );
    const customerElements = template.elements.filter(
      (element) =>
        (element.type === "input" || element.type === "currency" || element.type === "text") &&
        typeof element.binding === "string" &&
        element.binding.startsWith("customer."),
    );
    if (supplierElements.length === 0 || customerElements.length === 0) {
      reasons.push("Supplier/customer split is required but one side is missing.");
    } else {
      const avgSupplierX =
        supplierElements.reduce((sum, element) => sum + (element.x ?? 0), 0) / supplierElements.length;
      const avgCustomerX =
        customerElements.reduce((sum, element) => sum + (element.x ?? 0), 0) / customerElements.length;
      if (avgCustomerX - avgSupplierX < 140) {
        reasons.push("Supplier/customer sections are not visually split as required.");
      }
    }
  }

  const totalBindings = new Set(["netAmount", "vatTotal", "grossTotal"]);
  const totalElements = template.elements.filter(
    (element) =>
      (element.type === "currency" || element.type === "input" || element.type === "text") &&
      typeof element.binding === "string" &&
      totalBindings.has(element.binding),
  );
  if (totalElements.length > 0) {
    const avgCenterX =
      totalElements.reduce((sum, element) => sum + (element.x + element.width / 2), 0) /
      totalElements.length;
    if (profile.conformity.totalsRegion === "right" && avgCenterX < 500) {
      reasons.push("Totals block is not in the expected right region.");
    }
    if (profile.conformity.totalsRegion === "center" && (avgCenterX < 280 || avgCenterX > 540)) {
      reasons.push("Totals block is not in the expected center region.");
    }
  }

  const accent = (template.brand?.colors?.accent || "").toLowerCase();
  if (
    accent &&
    !profile.conformity.expectedAccentColors.some((color) => color.toLowerCase() === accent)
  ) {
    reasons.push("Brand accent color does not match selected style profile.");
  }

  return { pass: reasons.length === 0, reasons };
}

export function evaluateInvoiceTemplateQa(
  template: TemplateData,
  language: OfficialTemplateLanguage,
  profileId?: string,
): QaResult {
  const complianceMissing = validateTemplateCompliance(template.elements, "EU");
  const localization = evaluateInvoiceLocalization(template, language);
  const keyLabelsPresent = hasKeyFieldLabels(template);
  const profileMatch = matchesStyleProfile(template, profileId);
  const layoutOverlaps = findProblematicOverlaps(template);
  const checks: Record<string, boolean> = {
    hasElements: template.elements.length > 0,
    validCanvasBounds: hasValidCanvasBounds(template.elements),
    hasItemsTable: hasTableForItems(template),
    hasValidProductTableConfig: hasValidProductTableConfig(template),
    passesEuComplianceBindings: complianceMissing.length === 0,
    keyFieldsHaveLabels: keyLabelsPresent,
    matchesStyleProfile: profileMatch.pass,
    nonOverlappingLayout: layoutOverlaps.length === 0,
    passesLocalization: localization.hardPass,
  };

  const errors: string[] = [];
  const warnings: string[] = [...localization.warnings];
  if (complianceMissing.length > 0) {
    errors.push(`Missing EU required bindings: ${complianceMissing.join(", ")}`);
  }
  if (!profileMatch.pass) {
    errors.push(`Style profile mismatch: ${profileMatch.reasons.join(" | ")}`);
  }
  if (layoutOverlaps.length > 0) {
    const overlapSummary = layoutOverlaps
      .slice(0, 5)
      .map((overlap) => `${overlap.firstId}↔${overlap.secondId}`)
      .join(", ");
    errors.push(`Overlapping content elements detected: ${overlapSummary}`);
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
    warnings,
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
  const warnings: string[] = [];
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
    warnings,
  };
}
