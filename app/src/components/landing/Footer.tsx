import * as React from "react";
import { useTranslation } from "react-i18next";

export function Footer(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <footer className="bg-[#0f172a] dark:bg-[#0a0a0a] py-16 text-gray-300 dark:text-gray-400 border-t border-gray-800 dark:border-gray-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 md:grid-cols-4">
        <div>
          <h4 className="mb-4 text-lg font-bold text-white dark:text-gray-100">Financely</h4>
          <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500">{t('landing.footer.description')}</p>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">{t('landing.footer.product')}</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#features" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.features')}</a></li>
            <li><a href="#pricing" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.pricing')}</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">{t('landing.footer.company')}</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.about')}</a></li>
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.careers')}</a></li>
          </ul>
        </div>
        <div>
          <h5 className="mb-3 font-semibold text-white dark:text-gray-100">{t('landing.footer.legal')}</h5>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.privacy')}</a></li>
            <li><a href="#" className="text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors">{t('landing.footer.terms')}</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-600">{t('landing.footer.copyright', { year: new Date().getFullYear() })}</div>
    </footer>
  );
}


