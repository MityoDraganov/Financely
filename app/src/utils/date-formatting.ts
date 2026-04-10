import { format } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { bg } from 'date-fns/locale/bg';
import type { Locale } from 'date-fns';

const localeMap: Record<string, Locale> = {
  en: enUS,
  'en-US': enUS,
  bg: bg,
};

/**
 * Get the date-fns locale based on language code
 */
export function getDateLocale(language: string): Locale {
  return localeMap[language] || enUS;
}

/**
 * Format date with locale support
 * Uses regional date formats based on language
 */
export function formatDateLocale(
  date: Date | string | number,
  formatStr: string,
  language: string = 'en'
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;

  if (Number.isNaN(dateObj.getTime())) {
    if (typeof date === 'string') return date;
    if (typeof date === 'number') return String(date);
    return '-';
  }
  
  const locale = getDateLocale(language);
  return format(dateObj, formatStr, { locale });
}

/**
 * Format date for short display (e.g., "Jan 15, 2024" or "15 яну. 2024" for BG)
 */
export function formatDateShort(
  date: Date | string | number,
  language: string = 'en'
): string {
  if (language === 'bg') {
    // Bulgarian format: DD MMM YYYY (e.g., "18 ноем. 2025")
    return formatDateLocale(date, 'dd MMM yyyy', language);
  }
  // English format: MMM d, yyyy
  return formatDateLocale(date, 'MMM d, yyyy', language);
}

/**
 * Format date with time for detailed display
 */
export function formatDateTime(
  date: Date | string | number,
  language: string = 'en'
): string {
  if (language === 'bg') {
    // Bulgarian format: DD.MM.YYYY HH:mm
    return formatDateLocale(date, 'dd.MM.yyyy HH:mm', language);
  }
  // English format: MMM d, yyyy 'at' h:mm a
  return formatDateLocale(date, "MMM d, yyyy 'at' h:mm a", language);
}

/**
 * Format date for table display
 */
export function formatDateTable(
  date: Date | string | number,
  language: string = 'en'
): string {
  if (language === 'bg') {
    // Bulgarian format: DD MMM YYYY (e.g., "18 ноем. 2025")
    return formatDateLocale(date, 'dd MMM yyyy', language);
  }
  // English format: MMM d, yyyy
  return formatDateLocale(date, 'MMM d, yyyy', language);
}
