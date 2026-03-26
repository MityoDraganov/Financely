import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from '../locales/en.json';
import bgTranslations from '../locales/bg.json';
import pcEn from '../locales/public-catalog/en.json';
import pcBg from '../locales/public-catalog/bg.json';
import pcEl from '../locales/public-catalog/el.json';
import pcRo from '../locales/public-catalog/ro.json';
import pcDe from '../locales/public-catalog/de.json';
import pcFr from '../locales/public-catalog/fr.json';
import pcEs from '../locales/public-catalog/es.json';
import pcIt from '../locales/public-catalog/it.json';
import pcPt from '../locales/public-catalog/pt.json';
import pcRu from '../locales/public-catalog/ru.json';
import pcNl from '../locales/public-catalog/nl.json';
import pcPl from '../locales/public-catalog/pl.json';
import pcTr from '../locales/public-catalog/tr.json';
import pcCs from '../locales/public-catalog/cs.json';
import pcHr from '../locales/public-catalog/hr.json';
import pcHu from '../locales/public-catalog/hu.json';
import pcSk from '../locales/public-catalog/sk.json';
import pcSl from '../locales/public-catalog/sl.json';
import pcSr from '../locales/public-catalog/sr.json';
import pcUk from '../locales/public-catalog/uk.json';

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
      en: { translation: enTranslations, publicCatalog: pcEn },
      bg: { translation: bgTranslations, publicCatalog: pcBg },
      el: { publicCatalog: pcEl },
      ro: { publicCatalog: pcRo },
      de: { publicCatalog: pcDe },
      fr: { publicCatalog: pcFr },
      es: { publicCatalog: pcEs },
      it: { publicCatalog: pcIt },
      pt: { publicCatalog: pcPt },
      ru: { publicCatalog: pcRu },
      nl: { publicCatalog: pcNl },
      pl: { publicCatalog: pcPl },
      tr: { publicCatalog: pcTr },
      cs: { publicCatalog: pcCs },
      hr: { publicCatalog: pcHr },
      hu: { publicCatalog: pcHu },
      sk: { publicCatalog: pcSk },
      sl: { publicCatalog: pcSl },
      sr: { publicCatalog: pcSr },
      uk: { publicCatalog: pcUk },
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

