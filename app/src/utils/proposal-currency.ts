const normalizeCurrencyCode = (currency: string): string =>
  (currency || "USD").toUpperCase().trim();

const toSafeNumber = (value: unknown): number => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const roundProposalMoney = (value: unknown): number =>
  Math.round((toSafeNumber(value) + Number.EPSILON) * 100) / 100;

export const formatProposalCurrency = (
  value: unknown,
  currency: string,
  locale = "en-US",
): string => {
  const amount = roundProposalMoney(value);
  const currencyCode = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
};

