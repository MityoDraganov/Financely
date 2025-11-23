import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from '../locales/en.json';
import bgTranslations from '../locales/bg.json';

// Get saved language from localStorage or default to 'en'
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && (saved === 'en' || saved === 'bg')) {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      bg: {
        translation: bgTranslations,
      },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

