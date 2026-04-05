import { logger } from "firebase-functions";

export interface CurrencyConversionPair {
  from: string;
  to: string;
  rate: number;
}

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

interface GetExchangeRateOptions {
  manualPairs?: CurrencyConversionPair[];
}

const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const exchangeRateCache = new Map<string, CachedRates>();

const normalizeCurrencyCode = (value: string): string => value.trim().toUpperCase();

const normalizePairs = (pairs: CurrencyConversionPair[]): CurrencyConversionPair[] =>
  pairs
    .filter((pair) => typeof pair.from === "string" && typeof pair.to === "string" && Number.isFinite(pair.rate) && pair.rate > 0)
    .map((pair) => ({
      from: normalizeCurrencyCode(pair.from),
      to: normalizeCurrencyCode(pair.to),
      rate: pair.rate,
    }));

const findManualRateDirectOrReverse = (
  fromCurrency: string,
  toCurrency: string,
  pairs: CurrencyConversionPair[],
): number | null => {
  for (const pair of pairs) {
    if (pair.from === fromCurrency && pair.to === toCurrency) {
      return pair.rate;
    }
    if (pair.from === toCurrency && pair.to === fromCurrency) {
      return 1 / pair.rate;
    }
  }
  return null;
};

const findManualRate = (
  fromCurrency: string,
  toCurrency: string,
  pairs: CurrencyConversionPair[],
): number | null => {
  const directRate = findManualRateDirectOrReverse(fromCurrency, toCurrency, pairs);
  if (directRate) {
    return directRate;
  }

  // Try a two-hop conversion path through known currencies.
  const knownCurrencies = new Set<string>();
  for (const pair of pairs) {
    knownCurrencies.add(pair.from);
    knownCurrencies.add(pair.to);
  }

  for (const viaCurrency of knownCurrencies) {
    if (viaCurrency === fromCurrency || viaCurrency === toCurrency) {
      continue;
    }

    const fromToVia = findManualRateDirectOrReverse(fromCurrency, viaCurrency, pairs);
    const viaToTarget = findManualRateDirectOrReverse(viaCurrency, toCurrency, pairs);

    if (fromToVia && viaToTarget) {
      return fromToVia * viaToTarget;
    }
  }

  return null;
};

const fetchExchangeRates = async (baseCurrency: string): Promise<Record<string, number>> => {
  const now = Date.now();
  const cached = exchangeRateCache.get(baseCurrency);
  if (cached && now - cached.timestamp < EXCHANGE_RATE_CACHE_TTL_MS) {
    return cached.rates;
  }

  const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
  if (!response.ok) {
    throw new Error(`Exchange rates request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { rates?: Record<string, number> };
  if (!payload.rates || typeof payload.rates !== "object") {
    throw new Error("Exchange rates response did not include rates");
  }

  exchangeRateCache.set(baseCurrency, {
    rates: payload.rates,
    timestamp: now,
  });

  return payload.rates;
};

export async function getExchangeRate(
  fromCurrencyRaw: string,
  toCurrencyRaw: string,
  options: GetExchangeRateOptions = {},
): Promise<number> {
  const fromCurrency = normalizeCurrencyCode(fromCurrencyRaw);
  const toCurrency = normalizeCurrencyCode(toCurrencyRaw);

  if (fromCurrency === toCurrency) {
    return 1;
  }

  const manualPairs = normalizePairs(options.manualPairs ?? []);
  const manualRate = findManualRate(fromCurrency, toCurrency, manualPairs);
  if (manualRate) {
    return manualRate;
  }

  const rates = await fetchExchangeRates(fromCurrency);
  const apiRate = rates[toCurrency];
  if (!Number.isFinite(apiRate) || apiRate <= 0) {
    throw new Error(`Exchange rate not available for ${fromCurrency} -> ${toCurrency}`);
  }

  return apiRate;
}

export async function convertCurrencyAmount(
  amount: number,
  fromCurrencyRaw: string,
  toCurrencyRaw: string,
  options: GetExchangeRateOptions = {},
): Promise<number> {
  const fromCurrency = normalizeCurrencyCode(fromCurrencyRaw);
  const toCurrency = normalizeCurrencyCode(toCurrencyRaw);

  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }

  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency, options);
  const convertedAmount = amount * rate;

  if (!Number.isFinite(convertedAmount)) {
    logger.error("Converted amount is not finite", {
      amount,
      fromCurrency,
      toCurrency,
      rate,
    });
    throw new Error("Converted amount is invalid");
  }

  return convertedAmount;
}

