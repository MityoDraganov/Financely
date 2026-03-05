import type { EmailTemplateData, EmailTemplatePlaceholder } from "@/core";

type TemplateLike = Pick<
  EmailTemplateData,
  "htmlContent" | "subject" | "preheader" | "placeholders"
>;

const LOOP_REGEX = /{{#each\s+([^\s}]+)\s+as\s+([^\s}]+)\s*}}([\s\S]*?){{\/each}}/g;
const TOKEN_REGEX = /{{\s*([^{}]+?)\s*}}/g;

const toKebabCaseCssProperty = (property: string): string =>
  property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

export const normalizeInlineStylePropertyNames = (html: string): string => {
  if (!html || !html.includes("style=")) return html;
  const normalizeStyleValue = (styleValue: string): string =>
    styleValue.replace(/(^|;)\s*([a-z][a-zA-Z0-9]*)\s*:/g, (_full, prefix: string, prop: string) => {
      if (prop.startsWith("--") || prop.includes("-")) {
        return `${prefix}${prop}:`;
      }
      return `${prefix}${toKebabCaseCssProperty(prop)}:`;
    });

  return html.replace(/style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote: string, styleValue: string) => {
    const normalized = normalizeStyleValue(styleValue);
    return `style=${quote}${normalized}${quote}`;
  });
};

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const getNestedValue = (source: unknown, path: string): unknown => {
  if (!source || !path) return undefined;
  const normalizedPath = path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/\[\*\]/g, ".0")
    .replace(/^\./, "");
  const parts = normalizedPath.split(".").filter(Boolean);
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).filter(Boolean).join(", ");
  const objectValue = toRecord(value);
  if (objectValue) {
    const preferred = ["name", "title", "description", "label", "text", "value", "email", "number", "id"];
    for (const key of preferred) {
      const candidate = objectValue[key];
      const formatted = formatValue(candidate);
      if (formatted.trim()) return formatted;
    }
  }
  return "";
};

const humanizeToken = (token: string): string => {
  const lastSegment = token.split(".").pop() || token;
  const withSpaces = lastSegment.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const cleaned = withSpaces.trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const buildSourceMappingsFromPlaceholders = (
  placeholders: EmailTemplatePlaceholder[] | undefined,
): Record<string, string> => {
  const mappings: Record<string, string> = {};
  (placeholders ?? []).forEach((placeholder) => {
    const key = placeholder.key?.trim();
    const source = placeholder.source;
    if (!key || !source || source.type !== "entity_field") return;
    const entity = source.entity?.trim();
    const path = source.path?.trim();
    if (!entity || !path) return;
    mappings[key] = path.startsWith(`${entity}.`) ? path : `${entity}.${path}`;
  });
  return mappings;
};

const buildLegacyHeuristicMappings = (
  placeholders: EmailTemplatePlaceholder[] | undefined,
): Record<string, string> => {
  const mappings: Record<string, string> = {};
  (placeholders ?? []).forEach((placeholder) => {
    const rawKey = placeholder.key?.trim();
    if (!rawKey) return;
    const key = rawKey.toLowerCase();
    if (key.startsWith("invoice_")) {
      mappings[rawKey] = `invoice.${key.slice("invoice_".length).replace(/_/g, ".")}`;
      return;
    }
    if (key.startsWith("proposal_")) {
      mappings[rawKey] = `proposal.${key.slice("proposal_".length).replace(/_/g, ".")}`;
      return;
    }
    if (key.startsWith("buyer_")) {
      mappings[rawKey] = `buyer.${key.slice("buyer_".length).replace(/_/g, ".")}`;
      return;
    }
    if (key.startsWith("customer_")) {
      mappings[rawKey] = `customer.${key.slice("customer_".length).replace(/_/g, ".")}`;
      return;
    }
  });
  return mappings;
};

const buildSamplePreviewData = (): Record<string, unknown> => {
  const buyer = {
    name: "Petar Petrov",
    email: "petar@example.com",
    phone: "+1 (555) 010-9933",
    taxId: "BG123456789",
    address: {
      line1: "25 Business Park Blvd",
      city: "Sofia",
      country: "Bulgaria",
    },
  };

  const seller = {
    name: "Financely Studio",
    email: "billing@financely.app",
    phone: "+1 (555) 010-1000",
    taxId: "EU998877665",
    address: {
      line1: "120 Market Street",
      city: "San Francisco",
      country: "USA",
    },
  };

  const items = [
    {
      id: "item_1",
      sku: "FL-001",
      name: "Event Floral Arrangement",
      description: "Elegant centerpiece arrangement",
      quantity: 2,
      unit: "pcs",
      unitPrice: 722.4,
      taxRate: 0.2,
      taxAmount: 288.96,
      discount: 0,
      total: 1444.8,
    },
    {
      id: "item_2",
      sku: "SV-102",
      name: "On-site Setup",
      description: "Delivery and setup service",
      quantity: 1,
      unit: "service",
      unitPrice: 180,
      taxRate: 0.2,
      taxAmount: 36,
      discount: 0,
      total: 180,
    },
  ];

  const invoice = {
    id: "INV-2026-001",
    number: "INV-2026-001",
    invoiceNumber: "INV-2026-001",
    status: "sent",
    issueDate: "2026-03-05",
    dueDate: "2026-03-19",
    reference: "PO-7781",
    seller,
    buyer,
    customer: buyer,
    client: buyer,
    money: {
      subtotal: 1624.8,
      tax: 324.96,
      discount: 0,
      total: 1949.76,
      paid: 0,
      due: 1949.76,
      currency: "USD",
    },
    currency: "USD",
    items,
    links: {
      viewUrl: "https://app.financely.example/invoices/INV-2026-001",
      payUrl: "https://app.financely.example/invoices/INV-2026-001/pay",
      pdfUrl: "https://app.financely.example/invoices/INV-2026-001.pdf",
    },
  };

  const proposal = {
    id: "PR-2026-014",
    number: "PR-2026-014",
    title: "Office Decor Proposal",
    status: "sent",
    validUntil: "2026-03-31",
    money: {
      total: 1949.76,
      currency: "USD",
    },
    links: {
      viewUrl: "https://app.financely.example/proposals/PR-2026-014",
      approveUrl: "https://app.financely.example/proposals/PR-2026-014/approve",
      pdfUrl: "https://app.financely.example/proposals/PR-2026-014.pdf",
    },
  };

  const email = {
    meta: {
      entityType: "invoice",
      orgId: "org_preview",
      locale: "en-US",
      timezone: "UTC",
      currency: "USD",
      sentAt: "2026-03-05T12:00:00.000Z",
    },
    recipient: {
      name: buyer.name,
      email: buyer.email,
      company: "Petrov Events",
    },
    invoice,
    proposal,
    workflow: {
      id: "wf_preview",
      name: "Invoice Send Workflow",
      runId: "wf_run_preview",
      stepId: "email_step_1",
      eventType: "invoice.sent",
      triggeredAt: "2026-03-05T12:00:00.000Z",
      triggeredBy: "system",
    },
  };

  return {
    email,
    invoice,
    buyer,
    customer: buyer,
    client: buyer,
    proposal,
    organization: {
      name: "Financely Studio",
      email: "support@financely.app",
    },
    items,
  };
};

const resolveTokenValue = (
  token: string,
  mappings: Record<string, string>,
  rootData: Record<string, unknown>,
  scope: Record<string, unknown>,
): string => {
  const trimmedToken = token.trim();
  if (!trimmedToken) return "";

  if (trimmedToken === "@index") {
    const index = scope["@index"];
    return typeof index === "number" ? String(index) : "";
  }

  const mappedPath = mappings[trimmedToken] || mappings[trimmedToken.toLowerCase()];
  const candidatePath = mappedPath || trimmedToken;

  const scopedValue = getNestedValue(scope, candidatePath);
  if (scopedValue !== undefined) {
    const formatted = formatValue(scopedValue);
    return formatted || humanizeToken(trimmedToken);
  }

  const rootValue = getNestedValue(rootData, candidatePath);
  if (rootValue !== undefined) {
    const formatted = formatValue(rootValue);
    return formatted || humanizeToken(trimmedToken);
  }

  if (!candidatePath.startsWith("email.")) {
    const emailRootValue = getNestedValue(rootData, `email.${candidatePath}`);
    if (emailRootValue !== undefined) {
      const formatted = formatValue(emailRootValue);
      return formatted || humanizeToken(trimmedToken);
    }
  }

  return humanizeToken(trimmedToken);
};

const renderTemplateString = (
  input: string,
  mappings: Record<string, string>,
  rootData: Record<string, unknown>,
  scope: Record<string, unknown>,
): string => {
  let output = input;

  // Expand loops first (repeat to support nested loops).
  for (let pass = 0; pass < 5; pass += 1) {
    const next = output.replace(
      LOOP_REGEX,
      (_full, loopPath: string, alias: string, loopBody: string) => {
        const resolvedPath = loopPath.trim();
        const scopedRows = getNestedValue(scope, resolvedPath);
        const rootRows = scopedRows ?? getNestedValue(rootData, resolvedPath);
        const rows = Array.isArray(rootRows) ? rootRows : [];
        if (rows.length === 0) return "";

        return rows
          .map((row, index) =>
            renderTemplateString(loopBody, mappings, rootData, {
              ...scope,
              [alias]: row,
              "@index": index,
            }),
          )
          .join("");
      },
    );

    if (next === output) break;
    output = next;
  }

  output = output.replace(TOKEN_REGEX, (_full, rawToken: string) => {
    const token = rawToken.trim();
    if (!token || token.startsWith("#each") || token === "/each") {
      return "";
    }
    return resolveTokenValue(token, mappings, rootData, scope);
  });

  return output;
};

export const buildMarketplaceEmailPreviewHtml = (
  template: TemplateLike | null | undefined,
): string => {
  if (!template?.htmlContent?.trim()) return "";

  const baseHtml = normalizeInlineStylePropertyNames(template.htmlContent);
  const sourceMappings = buildSourceMappingsFromPlaceholders(template.placeholders);
  const legacyMappings = buildLegacyHeuristicMappings(template.placeholders);
  const mergedMappings = {
    ...legacyMappings,
    ...sourceMappings,
  };
  const sampleData = buildSamplePreviewData();

  return renderTemplateString(baseHtml, mergedMappings, sampleData, {});
};

