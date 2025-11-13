/**
 * Comprehensive list of ISO 4217 currencies with their codes and names
 * Includes all major and minor currencies
 */
export interface Currency {
  code: string;
  name: string;
  symbol?: string;
  decimalDigits: number;
}

export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", decimalDigits: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalDigits: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalDigits: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalDigits: 0 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalDigits: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalDigits: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalDigits: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalDigits: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimalDigits: 2 },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", decimalDigits: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalDigits: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalDigits: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalDigits: 2 },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", decimalDigits: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimalDigits: 0 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimalDigits: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimalDigits: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalDigits: 2 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimalDigits: 2 },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", decimalDigits: 2 },
  { code: "RON", name: "Romanian Leu", symbol: "lei", decimalDigits: 2 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", decimalDigits: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimalDigits: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalDigits: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimalDigits: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimalDigits: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalDigits: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimalDigits: 2 },
  { code: "ARS", name: "Argentine Peso", symbol: "$", decimalDigits: 2 },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب", decimalDigits: 3 },
  { code: "BND", name: "Brunei Dollar", symbol: "B$", decimalDigits: 2 },
  { code: "CLP", name: "Chilean Peso", symbol: "$", decimalDigits: 0 },
  { code: "COP", name: "Colombian Peso", symbol: "$", decimalDigits: 2 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimalDigits: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimalDigits: 2 },
  { code: "EGP", name: "Egyptian Pound", symbol: "£", decimalDigits: 2 },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimalDigits: 2 },
  { code: "ISK", name: "Icelandic Krona", symbol: "kr", decimalDigits: 0 },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا", decimalDigits: 3 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimalDigits: 3 },
  { code: "LBP", name: "Lebanese Pound", symbol: "£", decimalDigits: 2 },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م.", decimalDigits: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimalDigits: 2 },
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", decimalDigits: 3 },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/", decimalDigits: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimalDigits: 2 },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", decimalDigits: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", decimalDigits: 2 },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", decimalDigits: 2 },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", decimalDigits: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimalDigits: 0 },
  { code: "XAF", name: "Central African CFA Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "XOF", name: "West African CFA Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "ALL", name: "Albanian Lek", symbol: "L", decimalDigits: 2 },
  { code: "AMD", name: "Armenian Dram", symbol: "֏", decimalDigits: 2 },
  { code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ", decimalDigits: 2 },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimalDigits: 2 },
  { code: "AWG", name: "Aruban Florin", symbol: "ƒ", decimalDigits: 2 },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼", decimalDigits: 2 },
  { code: "BAM", name: "Bosnia-Herzegovina Convertible Mark", symbol: "КМ", decimalDigits: 2 },
  { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$", decimalDigits: 2 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimalDigits: 2 },
  { code: "BIF", name: "Burundian Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "BMD", name: "Bermudan Dollar", symbol: "$", decimalDigits: 2 },
  { code: "BWP", name: "Botswanan Pula", symbol: "P", decimalDigits: 2 },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br", decimalDigits: 2 },
  { code: "BZD", name: "Belize Dollar", symbol: "BZ$", decimalDigits: 2 },
  { code: "CDF", name: "Congolese Franc", symbol: "Fr", decimalDigits: 2 },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡", decimalDigits: 2 },
  { code: "CUP", name: "Cuban Peso", symbol: "$", decimalDigits: 2 },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "Esc", decimalDigits: 2 },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "DOP", name: "Dominican Peso", symbol: "$", decimalDigits: 2 },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", decimalDigits: 2 },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk", decimalDigits: 2 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimalDigits: 2 },
  { code: "FJD", name: "Fijian Dollar", symbol: "FJ$", decimalDigits: 2 },
  { code: "FKP", name: "Falkland Islands Pound", symbol: "£", decimalDigits: 2 },
  { code: "GEL", name: "Georgian Lari", symbol: "₾", decimalDigits: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", decimalDigits: 2 },
  { code: "GIP", name: "Gibraltar Pound", symbol: "£", decimalDigits: 2 },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D", decimalDigits: 2 },
  { code: "GNF", name: "Guinean Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q", decimalDigits: 2 },
  { code: "GYD", name: "Guyanaese Dollar", symbol: "$", decimalDigits: 2 },
  { code: "HNL", name: "Honduran Lempira", symbol: "L", decimalDigits: 2 },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn", decimalDigits: 2 },
  { code: "HTG", name: "Haitian Gourde", symbol: "G", decimalDigits: 2 },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د", decimalDigits: 3 },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼", decimalDigits: 2 },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$", decimalDigits: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "Sh", decimalDigits: 2 },
  { code: "KGS", name: "Kyrgystani Som", symbol: "с", decimalDigits: 2 },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛", decimalDigits: 2 },
  { code: "KMF", name: "Comorian Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "KPW", name: "North Korean Won", symbol: "₩", decimalDigits: 2 },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", decimalDigits: 2 },
  { code: "LAK", name: "Laotian Kip", symbol: "₭", decimalDigits: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", decimalDigits: 2 },
  { code: "LRD", name: "Liberian Dollar", symbol: "$", decimalDigits: 2 },
  { code: "LSL", name: "Lesotho Loti", symbol: "L", decimalDigits: 2 },
  { code: "LYD", name: "Libyan Dinar", symbol: "د.ل", decimalDigits: 3 },
  { code: "MDL", name: "Moldovan Leu", symbol: "L", decimalDigits: 2 },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar", decimalDigits: 2 },
  { code: "MKD", name: "Macedonian Denar", symbol: "ден", decimalDigits: 2 },
  { code: "MMK", name: "Myanma Kyat", symbol: "K", decimalDigits: 2 },
  { code: "MNT", name: "Mongolian Tugrik", symbol: "₮", decimalDigits: 2 },
  { code: "MOP", name: "Macanese Pataca", symbol: "P", decimalDigits: 2 },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM", decimalDigits: 2 },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨", decimalDigits: 2 },
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf", decimalDigits: 2 },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimalDigits: 2 },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimalDigits: 2 },
  { code: "NAD", name: "Namibian Dollar", symbol: "$", decimalDigits: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimalDigits: 2 },
  { code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$", decimalDigits: 2 },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨", decimalDigits: 2 },
  { code: "PAB", name: "Panamanian Balboa", symbol: "B/.", decimalDigits: 2 },
  { code: "PGK", name: "Papua New Guinean Kina", symbol: "K", decimalDigits: 2 },
  { code: "PYG", name: "Paraguayan Guarani", symbol: "₲", decimalDigits: 0 },
  { code: "RSD", name: "Serbian Dinar", symbol: "дин", decimalDigits: 2 },
  { code: "RWF", name: "Rwandan Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "SBD", name: "Solomon Islands Dollar", symbol: "SI$", decimalDigits: 2 },
  { code: "SCR", name: "Seychellois Rupee", symbol: "₨", decimalDigits: 2 },
  { code: "SDG", name: "Sudanese Pound", symbol: "ج.س.", decimalDigits: 2 },
  { code: "SHP", name: "Saint Helena Pound", symbol: "£", decimalDigits: 2 },
  { code: "SLE", name: "Sierra Leonean Leone", symbol: "Le", decimalDigits: 2 },
  { code: "SLL", name: "Sierra Leonean Leone (old)", symbol: "Le", decimalDigits: 2 },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh", decimalDigits: 2 },
  { code: "SRD", name: "Surinamese Dollar", symbol: "$", decimalDigits: 2 },
  { code: "SSP", name: "South Sudanese Pound", symbol: "£", decimalDigits: 2 },
  { code: "STN", name: "São Tomé and Príncipe Dobra", symbol: "Db", decimalDigits: 2 },
  { code: "SYP", name: "Syrian Pound", symbol: "£", decimalDigits: 2 },
  { code: "SZL", name: "Swazi Lilangeni", symbol: "L", decimalDigits: 2 },
  { code: "TJS", name: "Tajikistani Somoni", symbol: "ЅМ", decimalDigits: 2 },
  { code: "TMT", name: "Turkmenistani Manat", symbol: "m", decimalDigits: 2 },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت", decimalDigits: 3 },
  { code: "TOP", name: "Tongan Paʻanga", symbol: "T$", decimalDigits: 2 },
  { code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "TT$", decimalDigits: 2 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "Sh", decimalDigits: 2 },
  { code: "UGX", name: "Ugandan Shilling", symbol: "Sh", decimalDigits: 0 },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U", decimalDigits: 2 },
  { code: "UZS", name: "Uzbekistan Som", symbol: "лв", decimalDigits: 2 },
  { code: "VES", name: "Venezuelan Bolívar", symbol: "Bs.S", decimalDigits: 2 },
  { code: "VUV", name: "Vanuatu Vatu", symbol: "Vt", decimalDigits: 0 },
  { code: "WST", name: "Samoan Tala", symbol: "T", decimalDigits: 2 },
  { code: "XCD", name: "East Caribbean Dollar", symbol: "$", decimalDigits: 2 },
  { code: "XDR", name: "Special Drawing Rights", symbol: "SDR", decimalDigits: 2 },
  { code: "XPF", name: "CFP Franc", symbol: "Fr", decimalDigits: 0 },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼", decimalDigits: 2 },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimalDigits: 2 },
  { code: "ZWL", name: "Zimbabwean Dollar", symbol: "$", decimalDigits: 2 },
];

/**
 * Get currency by code
 */
export function getCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/**
 * Get all currency codes
 */
export function getAllCurrencyCodes(): string[] {
  return CURRENCIES.map((c) => c.code);
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currencyCode: string, locale?: string): string {
  const currency = getCurrency(currencyCode);
  if (!currency) {
    return new Intl.NumberFormat(locale || "en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale || "en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: currency.decimalDigits,
    maximumFractionDigits: currency.decimalDigits,
  }).format(amount);
}

/**
 * Currency conversion using free API
 * Uses exchangerate-api.com (free tier: 1,500 requests/month)
 */
export interface ExchangeRates {
  [currencyCode: string]: number;
}

/**
 * Fetch exchange rates from free API
 * Always fetches fresh rates - no caching
 * Falls back to a basic conversion if API fails
 */
export async function fetchExchangeRates(baseCurrency: string = "USD"): Promise<ExchangeRates> {
  try {
    // Using exchangerate-api.com free tier (no API key needed for basic usage)
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch exchange rates");
    }

    const data = await response.json();
    const rates: ExchangeRates = data.rates;
    
    return rates;
  } catch (error) {
    console.warn("Failed to fetch exchange rates, using fallback:", error);
    
    // Fallback: return basic rates (1:1 for same currency, 0 for others)
    // In production, you might want to use a different fallback strategy
    const fallbackRates: ExchangeRates = { [baseCurrency]: 1 };
    return fallbackRates;
  }
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rates = await fetchExchangeRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not available for ${toCurrency}`);
  }

  return amount * rate;
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const rates = await fetchExchangeRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) {
    throw new Error(`Exchange rate not available for ${toCurrency}`);
  }

  return rate;
}

