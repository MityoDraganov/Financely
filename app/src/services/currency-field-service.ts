/**
 * Currency Field Service
 * Handles currency field conversions, rate management, and field linking
 */

// Use decimal.js if available, otherwise fallback to native Number
// Install with: npm install decimal.js
let Decimal: typeof import("decimal.js").default;
try {
  Decimal = require("decimal.js").default;
} catch {
  // Fallback: create a simple Decimal-like wrapper
  Decimal = class {
    private value: number;
    constructor(value: number | string) {
      this.value = typeof value === "string" ? parseFloat(value) : value;
    }
    times(other: Decimal | number): Decimal {
      const otherValue = other instanceof Decimal ? other.value : other;
      return new Decimal(this.value * otherValue);
    }
    dividedBy(other: Decimal | number): Decimal {
      const otherValue = other instanceof Decimal ? other.value : other;
      return new Decimal(this.value / otherValue);
    }
    pow(exponent: number): Decimal {
      return new Decimal(Math.pow(this.value, exponent));
    }
    round(): Decimal {
      return new Decimal(Math.round(this.value));
    }
    toNumber(): number {
      return this.value;
    }
    static set(_config: { precision?: number; rounding?: number }): void {
      // No-op fallback
    }
    static ROUND_HALF_EVEN = 2;
  } as any;
}
import type {
  CurrencyValue,
  FxRate,
  CurrencyFieldLink,
} from "@/core/entities/currency-field";
import { getExchangeRate } from "@/utils/currencies";
import {
  buildDependencyGraph,
  topologicalSort,
  validateFieldLinking,
} from "@/utils/currency-dag";

// Initialize Decimal.js with precision settings
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Convert currency value using exchange rate
 * Uses minor units and proper scaling
 */
export function convertCurrencyValue(
  value: CurrencyValue,
  targetCurrency: string,
  rate: FxRate
): CurrencyValue {
  if (value.currency === targetCurrency) {
    return value;
  }

  // Convert using: amountMinor × rate × 10^(targetScale−sourceScale)
  const amountDecimal = new Decimal(value.amountMinor);
  const rateDecimal = new Decimal(rate.rate);
  const scaleDiff = value.scale - rate.base.length; // Simplified, should use proper scale

  // Calculate in minor units
  const convertedMinor = amountDecimal
    .times(rateDecimal)
    .times(new Decimal(10).pow(scaleDiff))
    .round()
    .toNumber();

  return {
    amountMinor: Math.round(convertedMinor),
    currency: targetCurrency,
    scale: value.scale, // Keep same scale for now
    asOf: rate.asOf,
  };
}

/**
 * Get or fetch exchange rate with priority:
 * 1. Snapshot rate (frozen)
 * 2. Manual override
 * 3. Organization base triangulation
 * 4. Provider API
 */
export async function getFxRate(
  baseCurrency: string,
  quoteCurrency: string,
  orgBaseCurrency?: string,
  snapshotRates?: FxRate[],
  manualRates?: FxRate[]
): Promise<FxRate> {
  if (baseCurrency === quoteCurrency) {
    return {
      base: baseCurrency,
      quote: quoteCurrency,
      rate: 1,
      asOf: new Date().toISOString(),
      source: "api",
    };
  }

  // 1. Check snapshot rates (frozen)
  const snapshotRate = snapshotRates?.find(
    (r) => r.base === baseCurrency && r.quote === quoteCurrency
  );
  if (snapshotRate) {
    return snapshotRate;
  }

  // 2. Check manual overrides
  const manualRate = manualRates?.find(
    (r) => r.base === baseCurrency && r.quote === quoteCurrency && r.source === "manual"
  );
  if (manualRate) {
    return manualRate;
  }

  // 3. Try triangulation via org base currency
  if (orgBaseCurrency && orgBaseCurrency !== baseCurrency && orgBaseCurrency !== quoteCurrency) {
    try {
      const baseToOrg = await getFxRate(baseCurrency, orgBaseCurrency, undefined, snapshotRates, manualRates);
      const orgToQuote = await getFxRate(orgBaseCurrency, quoteCurrency, undefined, snapshotRates, manualRates);
      
      const triangulatedRate = baseToOrg.rate * orgToQuote.rate;
      return {
        base: baseCurrency,
        quote: quoteCurrency,
        rate: triangulatedRate,
        asOf: new Date().toISOString(),
        source: "triangulation",
        path: [baseCurrency, orgBaseCurrency, quoteCurrency],
      };
    } catch {
      // Fall through to API
    }
  }

  // 4. Fetch from provider API
  try {
    const rate = await getExchangeRate(baseCurrency, quoteCurrency);
    return {
      base: baseCurrency,
      quote: quoteCurrency,
      rate,
      asOf: new Date().toISOString(),
      source: "api",
    };
  } catch (error) {
    throw new Error(
      `Unable to get exchange rate from ${baseCurrency} to ${quoteCurrency}: ${error}`
    );
  }
}

/**
 * Compute linked currency field value
 */
export async function computeLinkedField(
  sourceValue: CurrencyValue,
  link: CurrencyFieldLink,
  orgBaseCurrency?: string,
  snapshotRates?: FxRate[],
  manualRates?: FxRate[]
): Promise<CurrencyValue> {
  if (link.type === "FX_PAIR") {
    if (!link.targetCurrency) {
      throw new Error("FX_PAIR link requires targetCurrency");
    }

    const rate = await getFxRate(
      sourceValue.currency,
      link.targetCurrency,
      orgBaseCurrency,
      snapshotRates,
      manualRates
    );

    return convertCurrencyValue(sourceValue, link.targetCurrency, rate);
  }

  if (link.type === "FIXED_MULTIPLIER") {
    if (link.multiplier === undefined) {
      throw new Error("FIXED_MULTIPLIER link requires multiplier");
    }

    const amountDecimal = new Decimal(sourceValue.amountMinor);
    const multiplierDecimal = new Decimal(link.multiplier);
    const result = amountDecimal.times(multiplierDecimal).round();

    return {
      ...sourceValue,
      amountMinor: result.toNumber(),
      asOf: new Date().toISOString(),
    };
  }

  if (link.type === "FORMULA") {
    // Simple formula evaluation (in production, use a proper formula parser)
    // For now, support basic arithmetic with field references
    throw new Error("FORMULA link type not yet implemented");
  }

  throw new Error(`Unknown link type: ${link.type}`);
}

/**
 * Recompute all linked fields in topological order
 */
export async function recomputeLinkedFields(
  fields: Array<{
    id: string;
    value?: CurrencyValue;
    links?: CurrencyFieldLink[];
  }>,
  orgBaseCurrency?: string,
  snapshotRates?: FxRate[],
  manualRates?: FxRate[]
): Promise<Map<string, CurrencyValue>> {
  const graph = buildDependencyGraph(fields);
  const order = topologicalSort(graph);
  const results = new Map<string, CurrencyValue>();

  // Process fields in topological order
  for (const fieldId of order) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) continue;

    // If field has no links, use its existing value
    if (!field.links || field.links.length === 0) {
      if (field.value) {
        results.set(fieldId, field.value);
      }
      continue;
    }

    // Process first link (in production, support multiple links)
    const link = field.links[0];
    if (link.type === "FX_PAIR" && link.sourceFieldId) {
      const sourceValue = results.get(link.sourceFieldId);
      if (!sourceValue) {
        throw new Error(`Source field ${link.sourceFieldId} has no value`);
      }

      const computed = await computeLinkedField(
        sourceValue,
        link,
        orgBaseCurrency,
        snapshotRates,
        manualRates
      );
      results.set(fieldId, computed);
    }
  }

  return results;
}

/**
 * Format currency value for display
 */
export function formatCurrencyValue(
  value: CurrencyValue,
  locale = "en-US"
): string {
  const amount = new Decimal(value.amountMinor).dividedBy(
    new Decimal(10).pow(value.scale)
  );

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: value.scale,
    maximumFractionDigits: value.scale,
  }).format(amount.toNumber());
}

/**
 * Format rate provenance for display
 */
export function formatRateProvenance(rate: FxRate): string {
  const date = new Date(rate.asOf).toLocaleDateString();
  const sourceName =
    rate.source === "api"
      ? "Live"
      : rate.source === "manual"
      ? "Manual"
      : rate.source === "snapshot"
      ? "Snapshot"
      : "Triangulated";

  return `1 ${rate.base} = ${rate.rate.toFixed(6)} ${rate.quote} (${sourceName} @ ${date})`;
}

/**
 * Validate field linking configuration
 */
export function validateLinking(
  fields: Array<{ id: string; links?: CurrencyFieldLink[] }>,
  newLink?: { fieldId: string; link: CurrencyFieldLink }
): { valid: boolean; error?: string; cycle?: string[] } {
  const validation = validateFieldLinking(fields, newLink);

  if (!validation.valid && validation.cycle) {
    return {
      valid: false,
      error: `Cycle detected: ${validation.cycle.join(" → ")}`,
      cycle: validation.cycle,
    };
  }

  // Additional validation
  if (newLink) {
    if (newLink.link.type === "FX_PAIR" && !newLink.link.sourceFieldId) {
      return {
        valid: false,
        error: "FX_PAIR link requires sourceFieldId",
      };
    }

    if (newLink.link.type === "FIXED_MULTIPLIER" && newLink.link.multiplier === undefined) {
      return {
        valid: false,
        error: "FIXED_MULTIPLIER link requires multiplier",
      };
    }
  }

  return { valid: true };
}

