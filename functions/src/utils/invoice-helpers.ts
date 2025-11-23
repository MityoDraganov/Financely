import type { Invoice, InvoiceDataValue } from "../core/entities/invoice";

/**
 * Get a value from invoice data by path (dot notation)
 */
function getBindingValue(
  data: Record<string, InvoiceDataValue>,
  binding: string
): InvoiceDataValue | undefined {
  const parts = binding.split(".");
  let current: InvoiceDataValue | undefined = data;

  for (const part of parts) {
    // Handle array indices like items[0]
    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      
      if (
        current &&
        typeof current === "object" &&
        !Array.isArray(current) &&
        arrayName in current
      ) {
        const array: InvoiceDataValue = (current as Record<string, InvoiceDataValue>)[arrayName];
        if (Array.isArray(array) && array[index] !== undefined) {
          current = array[index];
          continue;
        }
      }
      return undefined;
    }

    // Handle object property access
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      part in current
    ) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Get invoice amount and currency from invoice data
 * Checks multiple common field names for the total amount
 * Returns the amount as a number and the currency code
 */
export function getInvoiceAmountAndCurrency(
  invoice: Invoice
): { amount: number; currency: string } {
  const data = invoice.data;
  
  // Try multiple common field names for total amount
  const amountFields = [
    "grossTotal",
    "total",
    "totalAmount",
    "grandTotal",
    "amount",
    "netAmount", // Sometimes netAmount is the total
  ];
  
  let amount: number = 0;
  
  for (const field of amountFields) {
    const value = getBindingValue(data, field);
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "number") {
        amount = value;
        break;
      } else if (typeof value === "string") {
        // Try to parse string as number
        const cleaned = value.replace(/[^0-9.-]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && isFinite(parsed)) {
          amount = parsed;
          break;
        }
      }
    }
  }
  
  // Get currency from invoice data
  const currencyValue = getBindingValue(data, "currency");
  const currency = 
    (typeof currencyValue === "string" && currencyValue.trim() 
      ? currencyValue.trim().toUpperCase() 
      : "USD");
  
  return { amount, currency };
}

/**
 * Format invoice amount with currency
 */
export function formatInvoiceAmount(
  invoice: Invoice,
  options?: { locale?: string }
): string {
  const { amount, currency } = getInvoiceAmountAndCurrency(invoice);
  
  if (amount === 0) {
    return "N/A";
  }
  
  try {
    const formatter = new Intl.NumberFormat(options?.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount);
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${amount.toFixed(2)}`;
  }
}

