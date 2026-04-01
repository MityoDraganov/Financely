import z from "zod";
import { logger } from "firebase-functions";
import type { OfficialTemplateGenkit } from "./runtime";
import {
  officialTemplateBlueprintSchema,
  type OfficialTemplateBlueprint,
  invoiceGenerationSchema,
  emailGenerationSchema,
  officialTemplatePackFlowInputSchema,
  officialTemplatePackFlowOutputSchema,
  type InvoiceGenerationData,
  type EmailGenerationData,
  type OfficialTemplatePackFlowInput,
  type OfficialTemplatePackFlowOutput,
} from "./schemas";
import {
  LOCALIZED_TABLE_HEADERS,
  getInvoiceStyleProfileByBlueprintId,
  getLocalizedKeyBindingLabel,
  isInvoiceKeyFieldBinding,
  type OfficialInvoiceStyleProfile,
} from "./invoice-style-profiles";

const INVOICE_MODEL = "gemini-2.5-flash";
const EMAIL_MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const GENERATION_TIMEOUT_MS = 45_000;
const PACK_CONCURRENCY = 4;
const A4_CANVAS_WIDTH = 794;
const A4_CANVAS_HEIGHT = 1123;
const DEFAULT_BRAND = {
  fonts: ["Inter"],
  colors: {
    primary: "#111827",
    secondary: "#6b7280",
    accent: "#2563eb",
  },
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
};
const EU_REQUIRED_BINDINGS = [
  "invoiceNumber",
  "invoiceDate",
  "supplier.name",
  "supplier.address",
  "supplier.vatId",
  "customer.name",
  "customer.address",
  "items",
  "netAmount",
  "vatTotal",
  "grossTotal",
  "currency",
];

function resolveModel(modelName: string): unknown {
  try {
    const { googleAI } = require("@genkit-ai/google-genai") as { googleAI: any };
    if (googleAI && typeof googleAI.model === "function") {
      return googleAI.model(modelName);
    }
  } catch {
    // Testing and local typecheck environments may not have Genkit deps installed.
  }
  return modelName;
}

const invoiceFlowInputSchema = z.object({
  blueprint: officialTemplateBlueprintSchema,
});

const emailFlowInputSchema = z.object({
  blueprint: officialTemplateBlueprintSchema,
});

function getLanguageInstruction(language: "en" | "bg"): string {
  return language === "bg"
    ? "All visible template text must be in Bulgarian (Cyrillic)."
    : "All visible template text must be in English.";
}

function buildStyleProfilePrompt(styleProfile: OfficialInvoiceStyleProfile | null): string {
  if (!styleProfile) return "";
  return [
    `Style profile ID: ${styleProfile.id}`,
    `Style profile name: ${styleProfile.name}`,
    `Typography: primary ${styleProfile.typography.primaryFamily}, secondary ${styleProfile.typography.secondaryFamily}, title weight ${styleProfile.typography.titleWeight}.`,
    `Color system: primary ${styleProfile.colors.primary}, secondary ${styleProfile.colors.secondary}, accent ${styleProfile.colors.accent}, surface ${styleProfile.colors.surface}, background ${styleProfile.colors.background}.`,
    `Section layout pattern: ${styleProfile.sectionLayoutPattern}.`,
    `Decorative layer strategy: ${styleProfile.decorativeLayerStrategy}.`,
    `Totals block pattern: ${styleProfile.totalsBlockPattern}.`,
    "Profile directives:",
    ...styleProfile.promptDirectives.map((directive) => `- ${directive}`),
  ].join("\n");
}

function buildInvoicePrompt(
  blueprint: OfficialTemplateBlueprint,
  styleProfile: OfficialInvoiceStyleProfile | null,
  previousErrors?: string,
): string {
  return [
    "Generate an official marketplace invoice template for Financely.",
    "Region must be EU and template must satisfy EU compliance field bindings.",
    "Output must be valid JSON for the provided schema. Do not include markdown.",
    `Template archetype: ${blueprint.archetype}`,
    `Template title: ${blueprint.title}`,
    `Style: ${blueprint.style}`,
    getLanguageInstruction(blueprint.language),
    "Visible labels are mandatory for key bound fields: invoiceNumber, invoiceDate, supplier.*, customer.*, currency, netAmount, vatTotal, grossTotal.",
    "Render clear section hierarchy: issuer, customer, invoice metadata, items table, totals.",
    "For field labels, use static text elements near their bound fields; do not rely on placeholders as labels.",
    "Template must fit A4 canvas 794x1123 and keep all elements within bounds.",
    "Use Currency elements for monetary values and include productTableConfig.",
    buildStyleProfilePrompt(styleProfile),
    blueprint.customPrompt ? `Additional instructions: ${blueprint.customPrompt}` : "",
    previousErrors ? `Previous validation errors to fix: ${previousErrors}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEmailPrompt(blueprint: OfficialTemplateBlueprint, previousErrors?: string): string {
  return [
    "Generate an official marketplace email template for Financely invoice workflows.",
    "Output must be valid JSON for the provided schema. Do not include markdown.",
    `Template archetype: ${blueprint.archetype}`,
    `Template title: ${blueprint.title}`,
    `Style: ${blueprint.style}`,
    getLanguageInstruction(blueprint.language),
    "Template must be compatible with invoice send context.",
    "Include subject, htmlContent, allowedContexts, placeholders and sections.",
    "Include placeholders for invoice and contact data that are actually used in content.",
    blueprint.customPrompt ? `Additional instructions: ${blueprint.customPrompt}` : "",
    previousErrors ? `Previous validation errors to fix: ${previousErrors}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksLikeJson) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function deepNormalizeJson(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return value;
  }
  const parsed = tryParseJsonString(value);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => deepNormalizeJson(item, depth + 1));
  }
  if (parsed && typeof parsed === "object") {
    const normalizedEntries = Object.entries(parsed as Record<string, unknown>).map(
      ([key, entryValue]) => [key, deepNormalizeJson(entryValue, depth + 1)] as const,
    );
    return Object.fromEntries(normalizedEntries);
  }
  return parsed;
}

function ensureObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getElementBounds(element: Record<string, unknown>) {
  const x = toNumber(element.x, 0);
  const y = toNumber(element.y, 0);
  const width = toNumber(element.width, 0);
  const height = toNumber(element.height, 0);
  return { x, y, width, height };
}

function createLabelElement(
  id: string,
  x: number,
  y: number,
  text: string,
  styleProfile: OfficialInvoiceStyleProfile | null,
) {
  return {
    id,
    type: "text",
    x,
    y,
    width: 220,
    height: 20,
    text,
    typography: {
      fontFamily: styleProfile?.typography.primaryFamily ?? "Inter",
      fontSize: 11,
      fontWeight: "semibold",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: styleProfile?.colors.secondary ?? "#4b5563",
      align: "left",
      uppercase: false,
      lowercase: false,
    },
    zIndex: 2,
    visible: true,
    rotation: 0,
  };
}

function createBoundFieldElement(
  id: string,
  binding: string,
  x: number,
  y: number,
  width: number,
  styleProfile: OfficialInvoiceStyleProfile | null,
): Record<string, unknown> {
  const isCurrency =
    binding === "currency" ||
    binding === "netAmount" ||
    binding === "vatTotal" ||
    binding === "grossTotal";
  if (isCurrency && binding !== "currency") {
    const formula =
      binding === "netAmount"
        ? "=SUM(items[*].total)"
        : binding === "vatTotal"
        ? "=netAmount*0.2"
        : "=netAmount+vatTotal";
    return {
      id,
      type: "currency",
      x,
      y,
      width,
      height: 26,
      binding,
      currency: "EUR",
      mode: "formula",
      formula,
      align: "right",
      zIndex: 3,
      visible: true,
      rotation: 0,
    };
  }
  if (binding === "currency") {
    return {
      id,
      type: "input",
      x,
      y,
      width,
      height: 26,
      binding,
      placeholder: "EUR",
      variant: "text",
      align: "left",
      fontFamily: styleProfile?.typography.secondaryFamily ?? "Inter",
      zIndex: 3,
      visible: true,
      rotation: 0,
    };
  }
  return {
    id,
    type: "input",
    x,
    y,
    width,
    height: 26,
    binding,
    placeholder: "",
    variant: binding.toLowerCase().includes("date") ? "date" : "text",
    align: "left",
    fontFamily: styleProfile?.typography.secondaryFamily ?? "Inter",
    zIndex: 3,
    visible: true,
    rotation: 0,
  };
}

function createFallbackItemsTable(
  language: "en" | "bg",
  styleProfile: OfficialInvoiceStyleProfile | null,
): Record<string, unknown> {
  const headers = LOCALIZED_TABLE_HEADERS[language];
  return {
    id: "items-table-fallback",
    type: "table",
    x: 40,
    y: 304,
    width: 714,
    height: 250,
    itemsBinding: "items",
    rowHeight: 30,
    headerHeight: 32,
    stripe: true,
    headerBackground: styleProfile?.colors.surface ?? "#f8fafc",
    borderColor: styleProfile?.colors.secondary ?? "#cbd5e1",
    borderWidth: 1,
    columns: [
      {
        id: "description",
        header: headers.description,
        binding: "description",
        type: "text",
        align: "left",
        width: "3fr",
      },
      {
        id: "quantity",
        header: headers.quantity,
        binding: "quantity",
        type: "number",
        align: "right",
        width: "1fr",
      },
      {
        id: "unitPrice",
        header: headers.unitPrice,
        binding: "unitPrice",
        type: "currency",
        align: "right",
        width: "1fr",
        currency: "EUR",
      },
      {
        id: "total",
        header: headers.total,
        binding: "total",
        type: "currency",
        align: "right",
        width: "1fr",
        currency: "EUR",
      },
    ],
    zIndex: 3,
    visible: true,
    rotation: 0,
  };
}

function createProfileAwareInvoiceFallback(
  blueprint: OfficialTemplateBlueprint,
  styleProfile: OfficialInvoiceStyleProfile | null,
): Record<string, unknown>[] {
  const language = blueprint.language === "bg" ? "bg" : "en";

  const titleText = language === "bg" ? "Фактура" : "Invoice";
  const elements: Record<string, unknown>[] = [
    {
      id: "decorative-banner",
      type: "box",
      x: 40,
      y: 40,
      width: 714,
      height: 64,
      fill: styleProfile?.colors.surface ?? "#f8fafc",
      stroke: styleProfile?.colors.accent ?? "#2563eb",
      strokeWidth: 1,
      radius: 12,
      zIndex: 0,
      visible: true,
      rotation: 0,
    },
    {
      id: "invoice-title",
      type: "text",
      x: 56,
      y: 58,
      width: 320,
      height: 28,
      text: titleText,
      typography: {
        fontFamily: styleProfile?.typography.primaryFamily ?? "Inter",
        fontSize: 24,
        fontWeight: styleProfile?.typography.titleWeight ?? "bold",
        lineHeight: 1.2,
        letterSpacing: 0,
        color: styleProfile?.colors.primary ?? "#111827",
        align: "left",
        uppercase: false,
        lowercase: false,
      },
      zIndex: 2,
      visible: true,
      rotation: 0,
    },
    {
      id: "decorative-rule",
      type: "line",
      x: 56,
      y: 92,
      width: 220,
      height: 1,
      x2: 276,
      y2: 92,
      stroke: styleProfile?.colors.accent ?? "#2563eb",
      strokeWidth: 2,
      zIndex: 1,
      visible: true,
      rotation: 0,
    },
  ];

  const coreFields: Array<{ binding: string; x: number; y: number; width: number }> = [
    { binding: "invoiceNumber", x: 56, y: 132, width: 280 },
    { binding: "invoiceDate", x: 360, y: 132, width: 220 },
    { binding: "supplier.name", x: 56, y: 190, width: 300 },
    { binding: "supplier.address", x: 56, y: 246, width: 300 },
    { binding: "supplier.vatId", x: 56, y: 274, width: 300 },
    { binding: "customer.name", x: 420, y: 190, width: 300 },
    { binding: "customer.address", x: 420, y: 246, width: 300 },
  ];

  coreFields.forEach((field) => {
    const label = getLocalizedKeyBindingLabel(field.binding, language);
    elements.push(
      createLabelElement(`label-${field.binding}`, field.x, field.y, label, styleProfile),
      createBoundFieldElement(
        `field-${field.binding}`,
        field.binding,
        field.x,
        field.y + 20,
        field.width,
        styleProfile,
      ),
    );
  });

  elements.push(createFallbackItemsTable(language, styleProfile));

  const totalFields: Array<{ binding: string; x: number; y: number; width: number }> = [
    { binding: "currency", x: 520, y: 582, width: 200 },
    { binding: "netAmount", x: 520, y: 636, width: 200 },
    { binding: "vatTotal", x: 520, y: 690, width: 200 },
    { binding: "grossTotal", x: 520, y: 744, width: 200 },
  ];

  totalFields.forEach((field) => {
    const label = getLocalizedKeyBindingLabel(field.binding, language);
    elements.push(
      createLabelElement(`label-${field.binding}`, field.x, field.y, label, styleProfile),
      createBoundFieldElement(
        `field-${field.binding}`,
        field.binding,
        field.x,
        field.y + 20,
        field.width,
        styleProfile,
      ),
    );
  });

  return elements;
}

function hasNearbyLabel(
  element: Record<string, unknown>,
  textElements: Record<string, unknown>[],
): boolean {
  const bounds = getElementBounds(element);
  return textElements.some((labelCandidate) => {
    const text = typeof labelCandidate.text === "string" ? labelCandidate.text.trim() : "";
    if (!text || text.length > 80) return false;
    const labelBounds = getElementBounds(labelCandidate);
    const aboveAndClose =
      labelBounds.y <= bounds.y + 8 &&
      bounds.y - labelBounds.y <= 76 &&
      Math.abs(labelBounds.x - bounds.x) <= 220;
    const leftAligned =
      labelBounds.x <= bounds.x + 6 &&
      bounds.x - labelBounds.x <= 180 &&
      Math.abs(labelBounds.y - bounds.y) <= 24;
    return aboveAndClose || leftAligned;
  });
}

function ensureKeyFieldLabels(
  elements: Record<string, unknown>[],
  language: "en" | "bg",
  styleProfile: OfficialInvoiceStyleProfile | null,
): Record<string, unknown>[] {
  const existing = [...elements];
  const textElements = existing.filter(
    (item) => item && item.type === "text" && typeof item.text === "string",
  );
  const bindingElements = existing.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (item.type !== "input" && item.type !== "currency" && item.type !== "text") return false;
    return typeof item.binding === "string" && isInvoiceKeyFieldBinding(item.binding);
  });

  const additions: Record<string, unknown>[] = [];
  const addedLabels = new Set<string>();

  bindingElements.forEach((boundElement) => {
    const binding = typeof boundElement.binding === "string" ? boundElement.binding : "";
    if (!binding || addedLabels.has(binding)) return;
    if (hasNearbyLabel(boundElement, textElements)) return;

    const bounds = getElementBounds(boundElement);
    const label = getLocalizedKeyBindingLabel(binding, language);
    additions.push(
      createLabelElement(
        `auto-label-${binding.replace(/\W+/g, "-")}`,
        bounds.x,
        Math.max(40, bounds.y - 20),
        label,
        styleProfile,
      ),
    );
    addedLabels.add(binding);
  });

  return additions.length > 0 ? [...existing, ...additions] : existing;
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

function isDecorativeElementType(type: unknown): boolean {
  return type === "box" || type === "line" || type === "path" || type === "spacer" || type === "pageBreak";
}

function isBoundFieldElement(element: Record<string, unknown>): boolean {
  return (
    (element.type === "input" || element.type === "currency" || element.type === "text") &&
    typeof element.binding === "string" &&
    element.binding.length > 0
  );
}

function isLabelElement(element: Record<string, unknown>): boolean {
  return (
    element.type === "text" &&
    typeof element.text === "string" &&
    element.text.trim().length > 0 &&
    typeof element.binding !== "string"
  );
}

function getLayoutRole(element: Record<string, unknown>): number {
  if (element.type === "table") return 2;
  if (isBoundFieldElement(element)) {
    const binding = typeof element.binding === "string" ? element.binding : "";
    if (binding === "currency" || binding === "netAmount" || binding === "vatTotal" || binding === "grossTotal") {
      return 3;
    }
    return 1;
  }
  return 1;
}

function findCompanionIndices(
  elements: Record<string, unknown>[],
  currentIndex: number,
): number[] {
  const current = elements[currentIndex];
  if (!current || typeof current !== "object") return [currentIndex];
  const currentBounds = getElementBounds(current);
  const companions = new Set<number>([currentIndex]);

  if (isBoundFieldElement(current)) {
    elements.forEach((candidate, index) => {
      if (index === currentIndex || !isLabelElement(candidate)) return;
      const candidateBounds = getElementBounds(candidate);
      const aboveAndNear =
        candidateBounds.y <= currentBounds.y + 8 &&
        currentBounds.y - candidateBounds.y <= 76 &&
        Math.abs(candidateBounds.x - currentBounds.x) <= 220;
      const leftAndNear =
        candidateBounds.x <= currentBounds.x + 6 &&
        currentBounds.x - candidateBounds.x <= 180 &&
        Math.abs(candidateBounds.y - currentBounds.y) <= 24;
      if (aboveAndNear || leftAndNear) companions.add(index);
    });
  } else if (isLabelElement(current)) {
    elements.forEach((candidate, index) => {
      if (index === currentIndex || !isBoundFieldElement(candidate)) return;
      const candidateBounds = getElementBounds(candidate);
      const belowAndNear =
        candidateBounds.y >= currentBounds.y - 8 &&
        candidateBounds.y - currentBounds.y <= 76 &&
        Math.abs(candidateBounds.x - currentBounds.x) <= 220;
      if (belowAndNear) companions.add(index);
    });
  }

  return [...companions];
}

function clampElementToCanvas(element: Record<string, unknown>): Record<string, unknown> {
  const next = { ...element };
  const width = Math.max(0, toNumber(next.width, 0));
  const height = Math.max(0, toNumber(next.height, 0));
  const maxX = Math.max(0, A4_CANVAS_WIDTH - width);
  const maxY = Math.max(0, A4_CANVAS_HEIGHT - height);
  next.x = Math.min(maxX, Math.max(0, toNumber(next.x, 0)));
  next.y = Math.min(maxY, Math.max(0, toNumber(next.y, 0)));
  return next;
}

function resolveInvoiceContentOverlaps(elements: Record<string, unknown>[]): Record<string, unknown>[] {
  const normalizedElements = elements.map((element) => clampElementToCanvas(element));
  const gap = 10;
  const minOverlapArea = 24;
  const maxPasses = 10;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let movedSomething = false;

    const candidates = normalizedElements
      .map((element, index) => ({ index, element }))
      .filter(({ element }) => {
        if (!element || typeof element !== "object") return false;
        if (element.visible === false) return false;
        if (isDecorativeElementType(element.type)) return false;
        const bounds = getElementBounds(element);
        return bounds.width > 1 && bounds.height > 1;
      })
      .sort((a, b) => {
        const aRole = getLayoutRole(a.element);
        const bRole = getLayoutRole(b.element);
        if (aRole !== bRole) return aRole - bRole;
        const aBounds = getElementBounds(a.element);
        const bBounds = getElementBounds(b.element);
        if (aBounds.y !== bBounds.y) return aBounds.y - bBounds.y;
        return aBounds.x - bBounds.x;
      });

    for (let i = 0; i < candidates.length; i += 1) {
      const currentIndex = candidates[i].index;
      const currentElement = normalizedElements[currentIndex];
      const currentBounds = getElementBounds(currentElement);

      for (let j = 0; j < i; j += 1) {
        const previousIndex = candidates[j].index;
        const previousElement = normalizedElements[previousIndex];
        const previousBounds = getElementBounds(previousElement);
        const overlapArea = getOverlapArea(currentBounds, previousBounds);
        if (overlapArea < minOverlapArea) continue;

        const shiftY = previousBounds.y + previousBounds.height + gap - currentBounds.y;
        if (shiftY <= 0) continue;

        const companionIndices = findCompanionIndices(normalizedElements, currentIndex);
        companionIndices.forEach((companionIndex) => {
          const target = normalizedElements[companionIndex];
          if (!target || typeof target !== "object") return;
          target.y = toNumber(target.y, 0) + shiftY;
          normalizedElements[companionIndex] = clampElementToCanvas(target);
        });

        movedSomething = true;
      }
    }

    if (!movedSomething) break;
  }

  return normalizedElements.map((element) => clampElementToCanvas(element));
}

function normalizeInvoiceCandidate(
  rawOutput: unknown,
  blueprint: OfficialTemplateBlueprint,
  styleProfile: OfficialInvoiceStyleProfile | null,
): unknown {
  const normalized = deepNormalizeJson(rawOutput);
  const objectValue = ensureObjectRecord(normalized);
  if (!objectValue) {
    return normalized;
  }

  const candidate: Record<string, unknown> = { ...objectValue };
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    candidate.name = blueprint.title;
  }
  if (
    candidate.pageSize !== "A4" &&
    candidate.pageSize !== "Letter" &&
    candidate.pageSize !== "Legal"
  ) {
    candidate.pageSize = "A4";
  }

  const brand = ensureObjectRecord(deepNormalizeJson(candidate.brand));
  const brandColors = ensureObjectRecord(brand?.colors);
  const brandMargins = ensureObjectRecord(brand?.margins);
  const defaultFonts = styleProfile
    ? [styleProfile.typography.primaryFamily, styleProfile.typography.secondaryFamily]
    : DEFAULT_BRAND.fonts;
  candidate.brand = {
    fonts: Array.isArray(brand?.fonts) && brand.fonts.length > 0 ? brand?.fonts : defaultFonts,
    colors: {
      primary:
        typeof brandColors?.primary === "string"
          ? brandColors.primary
          : styleProfile?.colors.primary ?? DEFAULT_BRAND.colors.primary,
      secondary:
        typeof brandColors?.secondary === "string"
          ? brandColors.secondary
          : styleProfile?.colors.secondary ?? DEFAULT_BRAND.colors.secondary,
      accent:
        typeof brandColors?.accent === "string"
          ? brandColors.accent
          : styleProfile?.colors.accent ?? DEFAULT_BRAND.colors.accent,
    },
    margins: {
      top:
        typeof brandMargins?.top === "number"
          ? brandMargins.top
          : DEFAULT_BRAND.margins.top,
      right:
        typeof brandMargins?.right === "number"
          ? brandMargins.right
          : DEFAULT_BRAND.margins.right,
      bottom:
        typeof brandMargins?.bottom === "number"
          ? brandMargins.bottom
          : DEFAULT_BRAND.margins.bottom,
      left:
        typeof brandMargins?.left === "number"
          ? brandMargins.left
          : DEFAULT_BRAND.margins.left,
    },
  };

  const normalizedElements = deepNormalizeJson(candidate.elements);
  const candidateElements: Record<string, unknown>[] = Array.isArray(normalizedElements)
    ? normalizedElements
        .map((item) => deepNormalizeJson(item))
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
    : [];

  const hasBinding = (binding: string) =>
    candidateElements.some((element) => {
      const el = element as Record<string, unknown>;
      if (typeof el.binding === "string" && el.binding === binding) {
        return true;
      }
      if (binding === "items" && typeof el.itemsBinding === "string" && el.itemsBinding === "items") {
        return true;
      }
      return false;
    });

  if (candidateElements.length === 0) {
    candidate.elements = createProfileAwareInvoiceFallback(blueprint, styleProfile);
  } else {
    const missingRequired = EU_REQUIRED_BINDINGS.filter((binding) => !hasBinding(binding));
    let cursorY = 680;
    const extraElements: Array<Record<string, unknown>> = [];
    const language = blueprint.language === "bg" ? "bg" : "en";
    for (const binding of missingRequired) {
      if (binding === "items") {
        extraElements.push(createFallbackItemsTable(language, styleProfile));
        continue;
      }
      if (binding === "netAmount" || binding === "vatTotal" || binding === "grossTotal") {
        extraElements.push({
          ...createLabelElement(
            `label-${binding}-fallback`,
            520,
            cursorY,
            getLocalizedKeyBindingLabel(binding, language),
            styleProfile,
          ),
        });
        extraElements.push(
          createBoundFieldElement(
            `${binding}-fallback`,
            binding,
            520,
            cursorY + 20,
            200,
            styleProfile,
          ),
        );
        cursorY += 30;
        continue;
      }
      const isSupplier = binding.startsWith("supplier.");
      const x = isSupplier ? 56 : 420;
      const width = 300;
      extraElements.push(
        createLabelElement(
          `label-${binding.replace(/\W+/g, "-")}-fallback`,
          x,
          cursorY,
          getLocalizedKeyBindingLabel(binding, language),
          styleProfile,
        ),
        createBoundFieldElement(
          `${binding.replace(/\W+/g, "-")}-fallback`,
          binding,
          x,
          cursorY + 20,
          width,
          styleProfile,
        ),
      );
      cursorY += 46;
    }
    candidate.elements = ensureKeyFieldLabels(
      [...candidateElements, ...extraElements],
      language,
      styleProfile,
    );
  }

  candidate.elements = resolveInvoiceContentOverlaps(
    Array.isArray(candidate.elements)
      ? candidate.elements.filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
      : [],
  );

  const productTableConfig = deepNormalizeJson(candidate.productTableConfig);
  if (productTableConfig && typeof productTableConfig === "object") {
    candidate.productTableConfig = productTableConfig;
  } else {
    candidate.productTableConfig = {
      itemsBinding: "items",
      columnMappings: [
        {
          columnBinding: "description",
          productField: "description",
          transform: "none",
          lockOnProductSelect: true,
        },
        {
          columnBinding: "unitPrice",
          productField: "price",
          transform: "currency_convert",
          targetCurrency: "EUR",
          lockOnProductSelect: true,
        },
      ],
      autoQuantity: false,
      defaultQuantity: 1,
      autoConvertCurrency: true,
      defaultCurrency: "EUR",
    };
  }

  return candidate;
}

function normalizeEmailCandidate(
  rawOutput: unknown,
  blueprint: OfficialTemplateBlueprint,
): unknown {
  const normalized = deepNormalizeJson(rawOutput);
  const objectValue = ensureObjectRecord(normalized);
  if (!objectValue) {
    return normalized;
  }

  const candidate: Record<string, unknown> = { ...objectValue };
  if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
    candidate.name = blueprint.title;
  }
  if (typeof candidate.subject !== "string" || candidate.subject.trim().length === 0) {
    candidate.subject =
      blueprint.language === "bg"
        ? "Вашата фактура {{invoice.number}}"
        : "Your invoice {{invoice.number}}";
  }
  if (typeof candidate.htmlContent !== "string" || candidate.htmlContent.trim().length === 0) {
    candidate.htmlContent =
      blueprint.language === "bg"
        ? "<p>Здравейте {{contact.name}}, вашата фактура {{invoice.number}} е готова.</p>"
        : "<p>Hello {{contact.name}}, your invoice {{invoice.number}} is ready.</p>";
  }

  const normalizedBlocks = deepNormalizeJson(candidate.blocks);
  if (Array.isArray(normalizedBlocks)) {
    candidate.blocks = normalizedBlocks;
  } else if (normalizedBlocks && typeof normalizedBlocks === "object") {
    const blocksObject = normalizedBlocks as Record<string, unknown>;
    const headerBlocks = Array.isArray(blocksObject.header) ? blocksObject.header : [];
    const bodyBlocks = Array.isArray(blocksObject.body) ? blocksObject.body : [];
    const footerBlocks = Array.isArray(blocksObject.footer) ? blocksObject.footer : [];
    candidate.blocks = [...headerBlocks, ...bodyBlocks, ...footerBlocks];
    candidate.sections = {
      header: [],
      body: [],
      footer: [],
    };
  } else {
    candidate.blocks = [];
  }

  const normalizedAllowedContexts = deepNormalizeJson(candidate.allowedContexts);
  candidate.allowedContexts = Array.isArray(normalizedAllowedContexts)
    ? normalizedAllowedContexts
    : ["invoice_send"];

  const normalizedPlaceholders = deepNormalizeJson(candidate.placeholders);
  candidate.placeholders = Array.isArray(normalizedPlaceholders)
    ? normalizedPlaceholders
    : [];

  const normalizedSections = deepNormalizeJson(candidate.sections);
  if (normalizedSections && typeof normalizedSections === "object" && !Array.isArray(normalizedSections)) {
    const sections = normalizedSections as Record<string, unknown>;
    candidate.sections = {
      header: Array.isArray(sections.header) ? sections.header : [],
      body: Array.isArray(sections.body) ? sections.body : [],
      footer: Array.isArray(sections.footer) ? sections.footer : [],
    };
  } else {
    candidate.sections = {
      header: [],
      body: [],
      footer: [],
    };
  }

  return candidate;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        continue;
      }
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function generateInvoiceWithRetries(
  ai: OfficialTemplateGenkit,
  blueprint: OfficialTemplateBlueprint,
): Promise<InvoiceGenerationData> {
  let validationErrors = "";
  let lastError: Error | null = null;
  const styleProfile = getInvoiceStyleProfileByBlueprintId(blueprint.id);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { output } = await withTimeout(
        ai.generate({
          model: resolveModel(INVOICE_MODEL),
          prompt: buildInvoicePrompt(blueprint, styleProfile, validationErrors),
          output: { schema: invoiceGenerationSchema },
        }),
        GENERATION_TIMEOUT_MS,
        `Invoice generation attempt ${attempt}`,
      );

      const parsed = invoiceGenerationSchema.safeParse(
        normalizeInvoiceCandidate(output, blueprint, styleProfile),
      );
      if (parsed.success) {
        return parsed.data;
      }

      validationErrors = parsed.error.message;
      lastError = new Error(parsed.error.message);
      logger.warn("Invoice generation output failed schema validation", {
        blueprintId: blueprint.id,
        attempt,
        errors: parsed.error.issues.map((issue) => issue.message),
        outputType: typeof output,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;
      validationErrors = normalizedError.message;
      logger.warn("Invoice generation attempt failed", {
        blueprintId: blueprint.id,
        attempt,
        error: normalizedError.message,
      });
    }
  }

  throw new Error(
    `Failed to generate invoice template after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
  );
}

async function generateEmailWithRetries(
  ai: OfficialTemplateGenkit,
  blueprint: OfficialTemplateBlueprint,
): Promise<EmailGenerationData> {
  let validationErrors = "";
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { output } = await withTimeout(
        ai.generate({
          model: resolveModel(EMAIL_MODEL),
          prompt: buildEmailPrompt(blueprint, validationErrors),
          output: { schema: emailGenerationSchema },
        }),
        GENERATION_TIMEOUT_MS,
        `Email generation attempt ${attempt}`,
      );

      const parsed = emailGenerationSchema.safeParse(
        normalizeEmailCandidate(output, blueprint),
      );
      if (parsed.success) {
        return parsed.data;
      }

      validationErrors = parsed.error.message;
      lastError = new Error(parsed.error.message);
      logger.warn("Email generation output failed schema validation", {
        blueprintId: blueprint.id,
        attempt,
        errors: parsed.error.issues.map((issue) => issue.message),
        outputType: typeof output,
      });
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;
      validationErrors = normalizedError.message;
      logger.warn("Email generation attempt failed", {
        blueprintId: blueprint.id,
        attempt,
        error: normalizedError.message,
      });
    }
  }

  throw new Error(
    `Failed to generate email template after ${MAX_RETRIES} attempts: ${lastError?.message || "Unknown error"}`,
  );
}

export function buildOfficialTemplateFlows(ai: OfficialTemplateGenkit) {
  const generateOfficialInvoiceTemplateFlow = ai.defineFlow(
    {
      name: "generateOfficialInvoiceTemplateFlow",
      inputSchema: invoiceFlowInputSchema,
      outputSchema: invoiceGenerationSchema,
    },
    async (input: z.infer<typeof invoiceFlowInputSchema>) => {
      const { blueprint } = input;
      if (blueprint.type !== "invoice") {
        throw new Error(`Invoice flow received non-invoice blueprint: ${blueprint.type}`);
      }
      return generateInvoiceWithRetries(ai, blueprint);
    },
  );

  const generateOfficialEmailTemplateFlow = ai.defineFlow(
    {
      name: "generateOfficialEmailTemplateFlow",
      inputSchema: emailFlowInputSchema,
      outputSchema: emailGenerationSchema,
    },
    async (input: z.infer<typeof emailFlowInputSchema>) => {
      const { blueprint } = input;
      if (blueprint.type !== "email") {
        throw new Error(`Email flow received non-email blueprint: ${blueprint.type}`);
      }
      return generateEmailWithRetries(ai, blueprint);
    },
  );

  const generateOfficialTemplatePackFlow = ai.defineFlow(
    {
      name: "generateOfficialTemplatePackFlow",
      inputSchema: officialTemplatePackFlowInputSchema,
      outputSchema: officialTemplatePackFlowOutputSchema,
    },
    async (input: OfficialTemplatePackFlowInput): Promise<OfficialTemplatePackFlowOutput> => {
      const parsedInput = officialTemplatePackFlowInputSchema.parse(input);
      const results: OfficialTemplatePackFlowOutput["results"] = [];

      await runWithConcurrency(parsedInput.blueprints, PACK_CONCURRENCY, async (blueprint) => {
        try {
          if (blueprint.type === "invoice") {
            const template = await generateOfficialInvoiceTemplateFlow({
              blueprint,
            });

            results.push({
              blueprintId: blueprint.id,
              type: "invoice",
              language: blueprint.language,
              status: "ok",
              templateContent: template as Record<string, unknown>,
              errors: [],
            });
          } else {
            const template = await generateOfficialEmailTemplateFlow({
              blueprint,
            });

            results.push({
              blueprintId: blueprint.id,
              type: "email",
              language: blueprint.language,
              status: "ok",
              templateContent: template as Record<string, unknown>,
              errors: [],
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            blueprintId: blueprint.id,
            type: blueprint.type,
            language: blueprint.language,
            status: "failed",
            errors: [message],
          });
        }
      });

      return officialTemplatePackFlowOutputSchema.parse({ results });
    },
  );

  return {
    generateOfficialInvoiceTemplateFlow,
    generateOfficialEmailTemplateFlow,
    generateOfficialTemplatePackFlow,
  };
}
