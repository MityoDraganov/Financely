import {
  convertCurrencyAmount,
  type CurrencyConversionPair,
} from "./currency-conversion";

type OrganizationSettingsLike = {
  defaultCurrency?: string;
  currencyRates?: {
    overrides?: Array<{
      from?: string;
      to?: string;
      rate?: number;
      updatedAt?: string;
    }>;
  };
  multiCurrency?: {
    pairs?: Array<{
      from?: string;
      to?: string;
      rate?: number;
    }>;
  };
};

type OrganizationLike = {
  settings?: OrganizationSettingsLike;
};

export interface CurrencyRateOverride {
  from: string;
  to: string;
  rate: number;
  updatedAt?: string;
}

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  if (!CURRENCY_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

export function getOrganizationBaseCurrency(org: OrganizationLike | undefined): string {
  const normalized = normalizeCurrencyCode(org?.settings?.defaultCurrency);
  const legacyNormalized = normalizeCurrencyCode(
    (org?.settings as { currency?: string } | undefined)?.currency,
  );
  return normalized || legacyNormalized || "USD";
}

export function getOrganizationCurrencyRateOverrides(
  orgOrSettings: OrganizationLike | OrganizationSettingsLike | undefined,
): CurrencyRateOverride[] {
  const settings = isSettingsLike(orgOrSettings)
    ? orgOrSettings
    : orgOrSettings?.settings;

  const next: CurrencyRateOverride[] = [];
  const seen = new Set<string>();

  const overrides = settings?.currencyRates?.overrides || [];
  for (const override of overrides) {
    const from = normalizeCurrencyCode(override?.from);
    const to = normalizeCurrencyCode(override?.to);
    const rate = typeof override?.rate === "number" ? override.rate : NaN;
    if (!from || !to || !Number.isFinite(rate) || rate <= 0 || from === to) continue;

    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      from,
      to,
      rate,
      updatedAt: typeof override?.updatedAt === "string" ? override.updatedAt : undefined,
    });
  }

  // Backward compatibility: legacy organization.settings.multiCurrency.pairs
  const legacyPairs = settings?.multiCurrency?.pairs || [];
  for (const pair of legacyPairs) {
    const from = normalizeCurrencyCode(pair?.from);
    const to = normalizeCurrencyCode(pair?.to);
    const rate = typeof pair?.rate === "number" ? pair.rate : NaN;
    if (!from || !to || !Number.isFinite(rate) || rate <= 0 || from === to) continue;

    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ from, to, rate });
  }

  return next;
}

export function toManualCurrencyPairs(
  overrides: CurrencyRateOverride[],
): CurrencyConversionPair[] {
  return overrides.map((override) => ({
    from: override.from,
    to: override.to,
    rate: override.rate,
  }));
}

export async function convertAmountWithOrganizationRates(params: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  organizationOrSettings: OrganizationLike | OrganizationSettingsLike | undefined;
}): Promise<number> {
  const fromCurrency = normalizeCurrencyCode(params.fromCurrency);
  const toCurrency = normalizeCurrencyCode(params.toCurrency);
  if (!fromCurrency || !toCurrency) {
    throw new Error("Both source and target currency codes must be valid ISO codes");
  }

  if (fromCurrency === toCurrency) {
    return params.amount;
  }

  const overrides = getOrganizationCurrencyRateOverrides(params.organizationOrSettings);
  return convertCurrencyAmount(params.amount, fromCurrency, toCurrency, {
    manualPairs: toManualCurrencyPairs(overrides),
  });
}

export function normalizeInvoiceDataForCurrencyPolicy(params: {
  data: Record<string, unknown>;
  defaultCurrency: string;
}): {
  data: Record<string, unknown>;
  currency: string;
} {
  const entityCurrency = normalizeCurrencyCode(
    readEntityCurrency(params.data),
  ) || normalizeCurrencyCode(params.defaultCurrency) || "USD";

  const normalized = deepCloneRecord(params.data);
  normalized.currency = entityCurrency;
  stripLineItemCurrencies(normalized);

  return {
    data: normalized,
    currency: entityCurrency,
  };
}

function readEntityCurrency(data: Record<string, unknown>): string | undefined {
  const direct = data.currency;
  if (typeof direct === "string") return direct;

  const moneyCurrency = asRecord(data.money)?.currency;
  if (typeof moneyCurrency === "string") return moneyCurrency;

  const totalsCurrency = asRecord(data.totals)?.currency;
  if (typeof totalsCurrency === "string") return totalsCurrency;

  const invoiceCurrency = asRecord(data.invoice)?.currency;
  if (typeof invoiceCurrency === "string") return invoiceCurrency;

  return undefined;
}

function stripLineItemCurrencies(data: Record<string, unknown>): void {
  const lineItemKeys = ["items", "lineItems", "invoiceItems"];
  for (const key of lineItemKeys) {
    const value = data[key];
    if (!Array.isArray(value)) continue;

    data[key] = value.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }
      const row = { ...(entry as Record<string, unknown>) };
      delete row.currency;
      return row;
    });
  }
}

function isSettingsLike(value: unknown): value is OrganizationSettingsLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    "defaultCurrency" in value ||
    "currencyRates" in value ||
    "multiCurrency" in value
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function deepCloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
