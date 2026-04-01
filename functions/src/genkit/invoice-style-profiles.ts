import type { TemplateElement } from "../core/entities/template";

export type InvoiceSectionLayoutPattern =
  | "split_dual_column"
  | "stacked_cards"
  | "header_banner"
  | "left_sidebar"
  | "diagonal_accent"
  | "bottom_totals_band";

export type InvoiceDecorativeLayerStrategy =
  | "subtle_lines"
  | "corner_blocks"
  | "banner_shapes"
  | "panel_stack"
  | "diagonal_path"
  | "totals_band";

export type InvoiceTotalsBlockPattern = "right_column" | "card_stack" | "center_band";

export type InvoiceLanguage = "en" | "bg";

export type OfficialInvoiceStyleProfile = {
  id: string;
  blueprintId: string;
  name: string;
  typography: {
    primaryFamily: string;
    secondaryFamily: string;
    titleWeight: "bold" | "semibold";
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
    background: string;
  };
  sectionLayoutPattern: InvoiceSectionLayoutPattern;
  decorativeLayerStrategy: InvoiceDecorativeLayerStrategy;
  totalsBlockPattern: InvoiceTotalsBlockPattern;
  promptDirectives: string[];
  conformity: {
    minDecorativeElements: number;
    preferredDecorativeTypes: Array<Extract<TemplateElement["type"], "box" | "line" | "path">>;
    requireSplitSupplierCustomer: boolean;
    totalsRegion: "right" | "center";
    expectedFontFamilies: string[];
    expectedAccentColors: string[];
  };
};

export const INVOICE_KEY_FIELD_PATTERNS = [
  /^invoiceNumber$/,
  /^invoiceDate$/,
  /^supplier\./,
  /^customer\./,
  /^currency$/,
  /^netAmount$/,
  /^vatTotal$/,
  /^grossTotal$/,
];

const KEY_FIELD_LABELS: Record<InvoiceLanguage, Record<string, string>> = {
  en: {
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    "supplier.name": "Supplier",
    "supplier.address": "Supplier Address",
    "supplier.vatId": "Supplier VAT ID",
    "customer.name": "Customer",
    "customer.address": "Customer Address",
    "customer.vatId": "Customer VAT ID",
    currency: "Currency",
    netAmount: "Net Amount",
    vatTotal: "VAT Total",
    grossTotal: "Gross Total",
  },
  bg: {
    invoiceNumber: "Номер на фактура",
    invoiceDate: "Дата на фактура",
    "supplier.name": "Доставчик",
    "supplier.address": "Адрес на доставчик",
    "supplier.vatId": "ДДС номер на доставчик",
    "customer.name": "Клиент",
    "customer.address": "Адрес на клиент",
    "customer.vatId": "ДДС номер на клиент",
    currency: "Валута",
    netAmount: "Нетна сума",
    vatTotal: "ДДС общо",
    grossTotal: "Крайна сума",
  },
};

export const LOCALIZED_TABLE_HEADERS: Record<
  InvoiceLanguage,
  { description: string; quantity: string; unitPrice: string; total: string }
> = {
  en: {
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    total: "Total",
  },
  bg: {
    description: "Описание",
    quantity: "Количество",
    unitPrice: "Ед. цена",
    total: "Общо",
  },
};

const INVOICE_STYLE_PROFILES: OfficialInvoiceStyleProfile[] = [
  {
    id: "invoice-style-service-professional",
    blueprintId: "official-eu-invoice-service-professional-en",
    name: "Service Professional Ledger",
    typography: {
      primaryFamily: "IBM Plex Sans",
      secondaryFamily: "Inter",
      titleWeight: "bold",
    },
    colors: {
      primary: "#1f2937",
      secondary: "#4b5563",
      accent: "#0ea5e9",
      surface: "#f8fafc",
      background: "#ffffff",
    },
    sectionLayoutPattern: "split_dual_column",
    decorativeLayerStrategy: "subtle_lines",
    totalsBlockPattern: "right_column",
    promptDirectives: [
      "Build a split two-column header: supplier details on the left, invoice metadata on the right.",
      "Use line-based separators and restrained geometric accents in the header area.",
      "Keep totals as a right aligned stacked block with strong hierarchy.",
    ],
    conformity: {
      minDecorativeElements: 2,
      preferredDecorativeTypes: ["line", "box"],
      requireSplitSupplierCustomer: true,
      totalsRegion: "right",
      expectedFontFamilies: ["IBM Plex Sans", "Inter"],
      expectedAccentColors: ["#0ea5e9"],
    },
  },
  {
    id: "invoice-style-service-professional-bg",
    blueprintId: "official-eu-invoice-service-professional-bg",
    name: "Service Professional Cyrillic",
    typography: {
      primaryFamily: "Manrope",
      secondaryFamily: "Inter",
      titleWeight: "bold",
    },
    colors: {
      primary: "#111827",
      secondary: "#374151",
      accent: "#16a34a",
      surface: "#f0fdf4",
      background: "#ffffff",
    },
    sectionLayoutPattern: "split_dual_column",
    decorativeLayerStrategy: "corner_blocks",
    totalsBlockPattern: "right_column",
    promptDirectives: [
      "Use clearly labeled Bulgarian section headers and field labels in Cyrillic.",
      "Decorate with subtle corner blocks and a highlighted VAT summary area.",
      "Keep supplier/customer sections mirrored but visually asymmetric.",
    ],
    conformity: {
      minDecorativeElements: 2,
      preferredDecorativeTypes: ["box", "line"],
      requireSplitSupplierCustomer: true,
      totalsRegion: "right",
      expectedFontFamilies: ["Manrope", "Inter"],
      expectedAccentColors: ["#16a34a"],
    },
  },
  {
    id: "invoice-style-product-minimal",
    blueprintId: "official-eu-invoice-product-minimal-en",
    name: "Product Minimal Grid",
    typography: {
      primaryFamily: "Space Grotesk",
      secondaryFamily: "Inter",
      titleWeight: "semibold",
    },
    colors: {
      primary: "#0f172a",
      secondary: "#475569",
      accent: "#f97316",
      surface: "#fff7ed",
      background: "#ffffff",
    },
    sectionLayoutPattern: "header_banner",
    decorativeLayerStrategy: "banner_shapes",
    totalsBlockPattern: "card_stack",
    promptDirectives: [
      "Use a bold top banner treatment with compact metadata chips.",
      "Table must be dominant, with strong product readability and restrained whitespace.",
      "Render totals as compact cards under the table with accent separators.",
    ],
    conformity: {
      minDecorativeElements: 3,
      preferredDecorativeTypes: ["box", "path", "line"],
      requireSplitSupplierCustomer: false,
      totalsRegion: "right",
      expectedFontFamilies: ["Space Grotesk", "Inter"],
      expectedAccentColors: ["#f97316"],
    },
  },
  {
    id: "invoice-style-product-minimal-bg",
    blueprintId: "official-eu-invoice-product-minimal-bg",
    name: "Product Minimal Cyrillic",
    typography: {
      primaryFamily: "Rubik",
      secondaryFamily: "Inter",
      titleWeight: "semibold",
    },
    colors: {
      primary: "#1e293b",
      secondary: "#475569",
      accent: "#8b5cf6",
      surface: "#faf5ff",
      background: "#ffffff",
    },
    sectionLayoutPattern: "left_sidebar",
    decorativeLayerStrategy: "panel_stack",
    totalsBlockPattern: "card_stack",
    promptDirectives: [
      "Use a left sidebar for issuer metadata and place customer/table on the main canvas.",
      "All visible text must be Bulgarian Cyrillic including table labels and totals labels.",
      "Use layered panels to separate metadata, items, and totals.",
    ],
    conformity: {
      minDecorativeElements: 3,
      preferredDecorativeTypes: ["box", "line"],
      requireSplitSupplierCustomer: false,
      totalsRegion: "right",
      expectedFontFamilies: ["Rubik", "Inter"],
      expectedAccentColors: ["#8b5cf6"],
    },
  },
  {
    id: "invoice-style-subscription-modern",
    blueprintId: "official-eu-invoice-subscription-modern-en",
    name: "Subscription Modern Rhythm",
    typography: {
      primaryFamily: "Sora",
      secondaryFamily: "Inter",
      titleWeight: "bold",
    },
    colors: {
      primary: "#0f172a",
      secondary: "#334155",
      accent: "#14b8a6",
      surface: "#f0fdfa",
      background: "#ffffff",
    },
    sectionLayoutPattern: "diagonal_accent",
    decorativeLayerStrategy: "diagonal_path",
    totalsBlockPattern: "center_band",
    promptDirectives: [
      "Use a diagonal accent path/shape to differentiate the subscription archetype.",
      "Highlight billing period and due date prominently in a modern metadata rail.",
      "Render totals in a centered band/card group instead of the classic right stack.",
    ],
    conformity: {
      minDecorativeElements: 3,
      preferredDecorativeTypes: ["path", "box", "line"],
      requireSplitSupplierCustomer: false,
      totalsRegion: "center",
      expectedFontFamilies: ["Sora", "Inter"],
      expectedAccentColors: ["#14b8a6"],
    },
  },
  {
    id: "invoice-style-subscription-modern-bg",
    blueprintId: "official-eu-invoice-subscription-modern-bg",
    name: "Subscription Modern Cyrillic",
    typography: {
      primaryFamily: "Montserrat",
      secondaryFamily: "Inter",
      titleWeight: "bold",
    },
    colors: {
      primary: "#111827",
      secondary: "#374151",
      accent: "#e11d48",
      surface: "#fff1f2",
      background: "#ffffff",
    },
    sectionLayoutPattern: "bottom_totals_band",
    decorativeLayerStrategy: "totals_band",
    totalsBlockPattern: "center_band",
    promptDirectives: [
      "Prioritize Bulgarian Cyrillic labels for recurring billing sections.",
      "Use a visually strong bottom totals band and subscription summary panel.",
      "Use expressive but printable contrast with clean spacing and clear hierarchy.",
    ],
    conformity: {
      minDecorativeElements: 2,
      preferredDecorativeTypes: ["box", "line"],
      requireSplitSupplierCustomer: false,
      totalsRegion: "center",
      expectedFontFamilies: ["Montserrat", "Inter"],
      expectedAccentColors: ["#e11d48"],
    },
  },
];

const profileByBlueprintId = new Map(
  INVOICE_STYLE_PROFILES.map((profile) => [profile.blueprintId, profile]),
);
const profileById = new Map(INVOICE_STYLE_PROFILES.map((profile) => [profile.id, profile]));

export function getOfficialInvoiceStyleProfiles(): OfficialInvoiceStyleProfile[] {
  return [...INVOICE_STYLE_PROFILES];
}

export function getInvoiceStyleProfileByBlueprintId(
  blueprintId: string,
): OfficialInvoiceStyleProfile | null {
  return profileByBlueprintId.get(blueprintId) ?? null;
}

export function getInvoiceStyleProfileById(profileId?: string): OfficialInvoiceStyleProfile | null {
  if (!profileId) return null;
  return profileById.get(profileId) ?? null;
}

export function isInvoiceKeyFieldBinding(binding: string): boolean {
  return INVOICE_KEY_FIELD_PATTERNS.some((pattern) => pattern.test(binding));
}

function fallbackHumanizedLabel(binding: string, language: InvoiceLanguage): string {
  const terminal = binding.split(".").pop() || binding;
  const spaced = terminal
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return binding;
  if (language === "bg") {
    return `Поле: ${spaced}`;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function getLocalizedKeyBindingLabel(
  binding: string,
  language: InvoiceLanguage,
): string {
  const exact = KEY_FIELD_LABELS[language][binding];
  if (exact) return exact;
  if (binding.startsWith("supplier.")) {
    return language === "bg" ? "Данни за доставчик" : "Supplier Details";
  }
  if (binding.startsWith("customer.")) {
    return language === "bg" ? "Данни за клиент" : "Customer Details";
  }
  return fallbackHumanizedLabel(binding, language);
}
