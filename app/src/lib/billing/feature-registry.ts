/**
 * SINGLE SOURCE OF TRUTH for subscription feature gating.
 *
 * To add billing control to a new feature:
 *   1. Add a key to FEATURE_KEYS
 *   2. Add an entry to FEATURE_REGISTRY with tier + label + description
 *   3. Optionally add an entry to ROUTE_FEATURE_MAP for route-level gating
 *
 * Tiers:
 *   "write"       — requires canOrgWrite (active | trialing)
 *   "read"        — requires canOrgRead  (active | trialing | past_due)
 *   "entitlement" — requires org.billing.entitlements[entitlementKey] === true
 */

export type FeatureAccessTier = "write" | "read" | "entitlement";

export interface FeatureDefinition {
  /**
   * Short name used in the lock badge / locked-page placeholder.
   * e.g. "Create Invoice"
   */
  label: string;
  /**
   * Outcome-oriented headline shown at the top of the paywall modal.
   * Should be specific to the workflow context, not a generic "Upgrade" message.
   * e.g. "Send this invoice and get paid faster"
   */
  contextualHeadline: string;
  /**
   * 3 short outcome-focused benefit bullets shown in the paywall modal.
   * Sell the result, not the feature name.
   */
  benefits: [string, string, string];
  tier: FeatureAccessTier;
  /** Required when tier === "entitlement". Maps to org.billing.entitlements key. */
  entitlementKey?: string;
}

export const FEATURE_KEYS = {
  // ── Invoices ──────────────────────────────────────────────────────────────
  INVOICE_CREATE:            "invoice_create",
  INVOICE_SEND:              "invoice_send",
  INVOICE_PDF:               "invoice_pdf",

  // ── Proposals ─────────────────────────────────────────────────────────────
  PROPOSAL_CREATE:           "proposal_create",
  PROPOSAL_SEND:             "proposal_send",
  PROPOSAL_TO_INVOICE:       "proposal_to_invoice",

  // ── CRM ───────────────────────────────────────────────────────────────────
  CONTACT_CREATE:            "contact_create",

  // ── Products ──────────────────────────────────────────────────────────────
  PRODUCT_CREATE:            "product_create",

  // ── Workflows ─────────────────────────────────────────────────────────────
  WORKFLOW_CREATE:           "workflow_create",

  // ── Templates ─────────────────────────────────────────────────────────────
  TEMPLATE_CREATE:           "template_create",

  // ── Brand Sites ───────────────────────────────────────────────────────────
  SITE_GENERATE:             "site_generate",
  SITE_PUBLISH:              "site_publish",

  // ── Integrations / Widgets ────────────────────────────────────────────────
  INTEGRATION_CONFIGURE:     "integration_configure",
  WIDGET_CREATE:             "widget_create",

  // ── AI Features ───────────────────────────────────────────────────────────
  AI_INVOICE_TEMPLATE:       "ai_invoice_template",
  AI_EMAIL_TEMPLATE:         "ai_email_template",
  AI_PROPOSAL_GENERATE:      "ai_proposal_generate",
  AI_INVOICE_EXTRACT:        "ai_invoice_extract",
  AI_SITE_GENERATE:          "ai_site_generate",
  AI_TEXT_IMPROVE:           "ai_text_improve",

  // ── Read-gated ────────────────────────────────────────────────────────────
  ANALYTICS_VIEW:            "analytics_view",
  AUDIT_LOG_VIEW:            "audit_log_view",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_REGISTRY: Record<FeatureKey, FeatureDefinition> = {
  // ── Invoices ──────────────────────────────────────────────────────────────
  [FEATURE_KEYS.INVOICE_CREATE]: {
    label: "Create Invoice",
    contextualHeadline: "Start getting paid professionally",
    benefits: [
      "Send branded invoices clients actually trust",
      "Track payment status without chasing emails",
      "Collect payments online with one link",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.INVOICE_SEND]: {
    label: "Send Invoice",
    contextualHeadline: "Send this invoice and get paid faster",
    benefits: [
      "Deliver invoices straight to the client's inbox",
      "See when they open it — follow up at the right moment",
      "Automated reminders handle the awkward chase for you",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.INVOICE_PDF]: {
    label: "Export Invoice as PDF",
    contextualHeadline: "Export a polished, print-ready PDF",
    benefits: [
      "Generate clean PDFs with your logo and brand colours",
      "Share instantly via link or attach to any email",
      "Looks professional in every client's inbox",
    ],
    tier: "write",
  },

  // ── Proposals ─────────────────────────────────────────────────────────────
  [FEATURE_KEYS.PROPOSAL_CREATE]: {
    label: "Create Proposal",
    contextualHeadline: "Win more work with better proposals",
    benefits: [
      "Build detailed proposals in minutes, not hours",
      "Convert accepted proposals to invoices in one click",
      "Track client views so you know when to follow up",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.PROPOSAL_SEND]: {
    label: "Send Proposal",
    contextualHeadline: "Get this proposal in front of your client",
    benefits: [
      "Send proposals directly from Financely — no copy-pasting",
      "Know the moment your client opens it",
      "One click to convert to an invoice when they say yes",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.PROPOSAL_TO_INVOICE]: {
    label: "Convert Proposal to Invoice",
    contextualHeadline: "Turn this proposal into an invoice instantly",
    benefits: [
      "No re-keying — all line items carry over automatically",
      "Send the invoice before the momentum fades",
      "Keep your whole deal in one place",
    ],
    tier: "write",
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  [FEATURE_KEYS.CONTACT_CREATE]: {
    label: "Create Contact",
    contextualHeadline: "Keep your client relationships organised",
    benefits: [
      "Store client details, history, and documents in one place",
      "Link contacts to invoices, proposals, and leads automatically",
      "Spend less time hunting for information before client calls",
    ],
    tier: "write",
  },

  // ── Products ──────────────────────────────────────────────────────────────
  [FEATURE_KEYS.PRODUCT_CREATE]: {
    label: "Create Product",
    contextualHeadline: "Build your catalog and invoice faster",
    benefits: [
      "Add products once — reuse them across every invoice and proposal",
      "Keep pricing consistent without manual checking",
      "Publish your catalog to a branded storefront clients can browse",
    ],
    tier: "write",
  },

  // ── Workflows ─────────────────────────────────────────────────────────────
  [FEATURE_KEYS.WORKFLOW_CREATE]: {
    label: "Automated Workflows",
    contextualHeadline: "Automate the repetitive work in your business",
    benefits: [
      "Trigger follow-ups, reminders, and actions automatically",
      "Stop doing the same admin task every week",
      "Run your finance workflow without thinking about it",
    ],
    tier: "write",
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  [FEATURE_KEYS.TEMPLATE_CREATE]: {
    label: "Custom Templates",
    contextualHeadline: "Build documents that look like your brand",
    benefits: [
      "Design once, reuse forever — no starting from scratch",
      "Your logo, colours, and layout on every document",
      "Clients notice the consistency — it builds trust",
    ],
    tier: "write",
  },

  // ── Brand Sites ───────────────────────────────────────────────────────────
  [FEATURE_KEYS.SITE_GENERATE]: {
    label: "Brand Site",
    contextualHeadline: "Give your business a professional online presence",
    benefits: [
      "Publish a branded storefront clients can browse and order from",
      "No code needed — generated from your existing catalog",
      "Share a single link instead of attaching PDFs to every email",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.SITE_PUBLISH]: {
    label: "Publish Brand Site",
    contextualHeadline: "Make your brand site live for clients",
    benefits: [
      "Go live in seconds — hosting and delivery included",
      "Updates publish instantly whenever you change your catalog",
      "Your own branded URL, no Financely branding in the way",
    ],
    tier: "write",
  },

  // ── Integrations ──────────────────────────────────────────────────────────
  [FEATURE_KEYS.INTEGRATION_CONFIGURE]: {
    label: "Integrations",
    contextualHeadline: "Connect Financely to the tools you already use",
    benefits: [
      "Embed your catalog or payment widget anywhere",
      "Sync data without manual exports or copy-paste",
      "Build the exact workflow your business needs",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.WIDGET_CREATE]: {
    label: "Embeddable Widget",
    contextualHeadline: "Embed your catalog anywhere in minutes",
    benefits: [
      "Drop a product or payment widget into any website",
      "Clients browse and order without leaving your site",
      "One snippet — updates automatically when your catalog changes",
    ],
    tier: "write",
  },

  // ── AI Features ───────────────────────────────────────────────────────────
  [FEATURE_KEYS.AI_INVOICE_TEMPLATE]: {
    label: "AI Template Generation",
    contextualHeadline: "Generate a polished template in seconds",
    benefits: [
      "Describe your business — AI builds the layout for you",
      "Skip the blank page and start with something real",
      "Customise from a strong starting point, not from scratch",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.AI_EMAIL_TEMPLATE]: {
    label: "AI Email Templates",
    contextualHeadline: "Write better client emails without the effort",
    benefits: [
      "Generate professional follow-ups and invoice emails instantly",
      "Consistent tone across every message you send",
      "Edit and send in under a minute",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.AI_PROPOSAL_GENERATE]: {
    label: "AI Proposal Generation",
    contextualHeadline: "Draft a full proposal from a brief description",
    benefits: [
      "Turn a few sentences into a detailed, structured proposal",
      "Win more work by responding to leads faster",
      "Edit and personalise before sending — AI does the heavy lifting",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.AI_INVOICE_EXTRACT]: {
    label: "AI Invoice Extraction",
    contextualHeadline: "Pull data from any document automatically",
    benefits: [
      "Upload a PDF or image — Financely reads the line items for you",
      "Stop retyping data from supplier invoices and receipts",
      "Accurate extraction in seconds, not minutes",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.AI_SITE_GENERATE]: {
    label: "AI Site Generation",
    contextualHeadline: "Build your brand site with AI assistance",
    benefits: [
      "Generate copy, layout, and structure from your catalog",
      "Looks professional without hiring a designer",
      "Publish the same day — no back-and-forth",
    ],
    tier: "write",
  },
  [FEATURE_KEYS.AI_TEXT_IMPROVE]: {
    label: "AI Text Improvement",
    contextualHeadline: "Make every client-facing word count",
    benefits: [
      "Rewrite invoice notes and proposal copy to sound more professional",
      "One click to sharpen language before you send",
      "Consistent quality across every document, every time",
    ],
    tier: "write",
  },

  // ── Read-gated ────────────────────────────────────────────────────────────
  [FEATURE_KEYS.ANALYTICS_VIEW]: {
    label: "Analytics",
    contextualHeadline: "See exactly how your business is performing",
    benefits: [
      "Track revenue, outstanding payments, and invoice trends in one view",
      "Know which clients drive the most value — and which are overdue",
      "Make decisions from data, not gut feeling",
    ],
    tier: "read",
  },
  [FEATURE_KEYS.AUDIT_LOG_VIEW]: {
    label: "Audit Log",
    contextualHeadline: "Full visibility into everything that happens",
    benefits: [
      "See a timestamped record of every action in your organisation",
      "Catch mistakes and unauthorised changes before they cause problems",
      "Essential for teams and compliance-sensitive businesses",
    ],
    tier: "read",
  },
};

/** Route-level gates. Prefix-matched against location.pathname, first match wins. */
export interface RouteFeatureGate {
  pattern: string;
  feature: FeatureKey;
}

export const ROUTE_FEATURE_MAP: RouteFeatureGate[] = [
  { pattern: "/analytics",  feature: FEATURE_KEYS.ANALYTICS_VIEW },
  { pattern: "/workflows",  feature: FEATURE_KEYS.WORKFLOW_CREATE },
  { pattern: "/content",    feature: FEATURE_KEYS.SITE_GENERATE },
];
