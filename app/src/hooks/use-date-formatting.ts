import { useTranslation } from 'react-i18next';
import { formatDateShort, formatDateTime, formatDateTable, formatDateLocale } from '@/utils/date-formatting';

/**
 * Hook to get locale-aware date formatting functions
 */
export function useDateFormatting() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return {
    formatDateShort: (date: Date | string | number) => formatDateShort(date, language),
    formatDateTime: (date: Date | string | number) => formatDateTime(date, language),
    formatDateTable: (date: Date | string | number) => formatDateTable(date, language),
    formatDateLocale: (date: Date | string | number, formatStr: string) => 
      formatDateLocale(date, formatStr, language),
    language,
  };
}

