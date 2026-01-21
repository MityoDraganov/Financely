import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function CTA(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <section className="bg-gradient-to-r from-[#166534] to-[#12502b] dark:from-[#22c55e] dark:to-[#16a34a] py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div>
          <h3 className="text-2xl font-bold">{t('landing.cta.title')}</h3>
          <p className="text-white/80 dark:text-white/90">{t('landing.cta.description')}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild className="rounded-xl bg-white dark:bg-[#2a2d35] px-6 text-[#166534] dark:text-gray-100 shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-gray-50 dark:hover:bg-[#34373f] transition-colors">
            <Link to="/onboarding">{t('landing.cta.startFree')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}


