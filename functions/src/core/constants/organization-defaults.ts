/**
 * Centralized default values for organization entities.
 * These values should match the defaults defined in organization.ts schema.
 */

export const DEFAULT_BRAND_COLORS: { primary: string; secondary: string; accent: string } = {
  primary: "#2563eb",
  secondary: "#6b7280",
  accent: "#10b981",
};

export const DEFAULT_ORGANIZATION_SETTINGS = {
  brandColors: DEFAULT_BRAND_COLORS,
  defaultCurrency: "USD",
  defaultLanguage: "en",
  defaultTimezone: "UTC",
  invoicePrefix: "INV",
  invoiceNumberStart: 1,
  paymentFallback: {
    referenceFormat: "{{invoiceNumber}}",
    bankInstructions: "Online payment is unavailable. Use bank transfer and include the payment reference.",
    bankAccountName: "",
    bankAccountNumber: "",
    iban: "",
    swift: "",
    beneficiaryName: "",
    beneficiaryAddress: "",
  },
  features: {
    customTemplates: true,
    pdfGeneration: true,
    emailSending: true,
    apiAccess: false,
  },
  ai: {
    autoProposalSuggestions: false,
    routing: {
      default: {
        provider: "auto",
        model: "auto",
      },
      tasks: {},
    },
    providers: {
      gemini: {
        enabled: true,
        model: "auto",
      },
      openai: {
        enabled: true,
        model: "auto",
      },
    },
  },
  currencyRates: {
    overrides: [],
  },
  multiCurrency: {
    enabled: false,
    pairs: [],
  },
} as const;
