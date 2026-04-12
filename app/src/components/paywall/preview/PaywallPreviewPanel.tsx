/**
 * Right-panel router for the paywall dialog.
 *
 * Maps feature keys to contextually relevant animated previews:
 *   - Invoice/proposal features → InvoicePreview (real org products + brand colors)
 *   - Analytics              → AnalyticsPreview
 *   - Everything else        → GeneralPreview (workflow animation)
 */

import { useMemo } from "react";
import type { FeatureKey } from "@/lib/billing/feature-registry";
import { FEATURE_KEYS } from "@/lib/billing/feature-registry";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useProductsByOrg } from "@/hooks/repository-hooks/use-products";
import { InvoicePreview }   from "./InvoicePreview";
import { AnalyticsPreview } from "./AnalyticsPreview";
import { GeneralPreview }   from "./GeneralPreview";

// ── Fallback items shown when the org has no products yet ─────────────────────
const FALLBACK_ITEMS = [
  { label: "Brand Identity Design", amount: 1800 },
  { label: "Website Development",   amount: 3200 },
  { label: "Monthly Retainer",      amount: 950  },
];
const FALLBACK_CURRENCY = "EUR";

// ── Feature → preview type mapping ───────────────────────────────────────────
const INVOICE_FEATURES = new Set<FeatureKey>([
  FEATURE_KEYS.INVOICE_CREATE,
  FEATURE_KEYS.INVOICE_SEND,
  FEATURE_KEYS.INVOICE_PDF,
  FEATURE_KEYS.PROPOSAL_CREATE,
  FEATURE_KEYS.PROPOSAL_SEND,
  FEATURE_KEYS.PROPOSAL_TO_INVOICE,
  FEATURE_KEYS.CONTACT_CREATE,
  FEATURE_KEYS.PRODUCT_CREATE,
]);

const ANALYTICS_FEATURES = new Set<FeatureKey>([
  FEATURE_KEYS.ANALYTICS_VIEW,
  FEATURE_KEYS.AUDIT_LOG_VIEW,
]);

function resolvePreview(featureKey: FeatureKey | null): "invoice" | "analytics" | "general" {
  if (!featureKey) return "general";
  if (INVOICE_FEATURES.has(featureKey)) return "invoice";
  if (ANALYTICS_FEATURES.has(featureKey)) return "analytics";
  return "general";
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PaywallPreviewPanelProps {
  featureKey: FeatureKey | null;
}

export function PaywallPreviewPanel({ featureKey }: PaywallPreviewPanelProps) {
  const type = resolvePreview(featureKey);
  const { currentOrganization } = useOrganizationContext();

  // Only fetch products when we're going to show the invoice preview
  const { data: allProducts = [] } = useProductsByOrg(
    type === "invoice" ? currentOrganization?.id : undefined,
  );

  // Derive brand primary color (fallback to a neutral blue)
  const primaryColor =
    currentOrganization?.settings?.brandColors?.primary ?? "#2563eb";

  // Pick up to 3 products in the same currency, preferring active ones.
  // Falls back to hardcoded demo items if the org has no products.
  const { items, currency } = useMemo(() => {
    const active = allProducts.filter((p) => p.status === "active" || !p.status);
    const pool   = active.length > 0 ? active : allProducts;

    if (pool.length === 0) {
      return { items: FALLBACK_ITEMS, currency: FALLBACK_CURRENCY };
    }

    // Anchor on the currency of the first (cheapest-to-show) product
    const baseCurrency = pool[0].currency ?? FALLBACK_CURRENCY;
    const sameCurrency = pool.filter(
      (p) => (p.currency ?? FALLBACK_CURRENCY) === baseCurrency,
    );

    const picked = sameCurrency.slice(0, 3);
    return {
      items:    picked.map((p) => ({ label: p.name, amount: p.price })),
      currency: baseCurrency,
    };
  }, [allProducts]);

  const orgName = currentOrganization?.name ?? undefined;

  return (
    <div
      className="w-full h-full"
      style={{
        background: "radial-gradient(ellipse at 50% 35%, #1a2744 0%, #0d1117 70%)",
      }}
    >
      {type === "invoice" && (
        <InvoicePreview
          orgName={orgName}
          items={items}
          currency={currency}
          primaryColor={primaryColor}
        />
      )}
      {type === "analytics" && <AnalyticsPreview />}
      {type === "general"   && <GeneralPreview />}
    </div>
  );
}
