/**
 * Currency Conversion Service
 * Handles multi-currency invoices with automatic API-based conversion
 * and manual rate override support
 */

import { getExchangeRate, fetchExchangeRates, type ExchangeRates } from "@/utils/currencies";

export interface ConversionRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: "api" | "manual";
  date: string; // ISO date string
  manualOverride?: boolean;
}

export interface CurrencyConversionMetadata {
  baseCurrency: string;
  rates: ConversionRate[];
  lastUpdated: string; // ISO date string
}

/**
 * Get or calculate conversion rate between two currencies
 * Uses cached rates or fetches from API, with support for manual override
 */
export async function getConversionRate(
  fromCurrency: string,
  toCurrency: string,
  existingRates?: ConversionRate[]
): Promise<ConversionRate> {
  // Same currency - no conversion needed
  if (fromCurrency === toCurrency) {
    return {
      fromCurrency,
      toCurrency,
      rate: 1,
      source: "api",
      date: new Date().toISOString(),
    };
  }

  // Check if we have a manual override in existing rates
  const existingRate = existingRates?.find(
    (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency && r.manualOverride
  );

  if (existingRate) {
    return existingRate;
  }

  // Check if we have a cached API rate (not overridden)
  const cachedRate = existingRates?.find(
    (r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency && !r.manualOverride
  );

  // If cached rate is less than 24 hours old, use it
  if (cachedRate) {
    const rateDate = new Date(cachedRate.date);
    const hoursSinceUpdate = (Date.now() - rateDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate < 24) {
      return cachedRate;
    }
  }

  // Fetch fresh rate from API
  try {
    const rate = await getExchangeRate(fromCurrency, toCurrency);
    return {
      fromCurrency,
      toCurrency,
      rate,
      source: "api",
      date: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
    // Fallback to cached rate if available, or throw error
    if (cachedRate) {
      return cachedRate;
    }
    throw new Error(`Unable to get exchange rate from ${fromCurrency} to ${toCurrency}`);
  }
}

/**
 * Convert an amount from one currency to another
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  existingRates?: ConversionRate[]
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const conversionRate = await getConversionRate(fromCurrency, toCurrency, existingRates);
  return amount * conversionRate.rate;
}

/**
 * Get all conversion rates needed for an invoice
 * Analyzes invoice items and determines which currency pairs need conversion
 */
export async function getInvoiceConversionRates(
  baseCurrency: string,
  items: Array<{ currency?: string; [key: string]: unknown }>,
  existingRates?: ConversionRate[]
): Promise<ConversionRate[]> {
  const rates: ConversionRate[] = [];
  const currencyPairs = new Set<string>();

  // Find all unique currency pairs needed
  for (const item of items) {
    const itemCurrency = item.currency || baseCurrency;
    if (itemCurrency !== baseCurrency) {
      const pairKey = `${itemCurrency}-${baseCurrency}`;
      if (!currencyPairs.has(pairKey)) {
        currencyPairs.add(pairKey);
      }
    }
  }

  // Get conversion rates for all needed pairs
  for (const pairKey of currencyPairs) {
    const [fromCurrency, toCurrency] = pairKey.split("-");
    const rate = await getConversionRate(fromCurrency, toCurrency, existingRates);
    rates.push(rate);
  }

  return rates;
}

/**
 * Format conversion rate for display
 * Shows rate in an understandable format
 */
export function formatConversionRate(rate: ConversionRate, showSource = true): string {
  const { fromCurrency, toCurrency, rate: rateValue, source, manualOverride } = rate;
  
  let formatted = `1 ${fromCurrency} = ${rateValue.toFixed(4)} ${toCurrency}`;
  
  if (showSource) {
    if (manualOverride) {
      formatted += " (Manual)";
    } else {
      formatted += " (Live)";
    }
  }
  
  return formatted;
}

/**
 * Format conversion information for invoice display
 * Shows original amount, converted amount, and rate
 */
export function formatConversionInfo(
  originalAmount: number,
  originalCurrency: string,
  convertedAmount: number,
  convertedCurrency: string,
  rate: number
): string {
  return `${formatCurrency(originalAmount, originalCurrency)} (${formatCurrency(convertedAmount, convertedCurrency)} @ ${rate.toFixed(4)})`;
}

/**
 * Helper to format currency
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

