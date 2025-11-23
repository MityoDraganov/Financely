import type { Invoice } from "@/core/entities/invoice";
import { getBindingValue } from "@/core/entities/invoice";

/**
 * Get a value from invoice data by path
 */
export function getInvoiceValue(invoice: Invoice, path: string): string {
  const value = getBindingValue(invoice.data, path);
  return value ? String(value) : "";
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
    return "—";
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

/**
 * Get invoice amount as a number (for calculations)
 */
export function getInvoiceAmount(invoice: Invoice): number {
  return getInvoiceAmountAndCurrency(invoice).amount;
}

