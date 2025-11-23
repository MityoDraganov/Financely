import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileText, CheckCircle2, BellRing, Shield, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function Features(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <section id="features" className="bg-[#F5F9F7] dark:bg-[#1b1e24] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('landing.features.title')}</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{t('landing.features.description')}</p>
        </motion.div>
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}>
          <ul className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-3"><FileText className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span>{t('landing.features.smartInvoiceEditor')}</span></li>
            <li className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span>{t('landing.features.approvalTrails')}</span></li>
            <li className="flex items-start gap-3"><BellRing className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span>{t('landing.features.renewalRadar')}</span></li>
            <li className="flex items-start gap-3"><Shield className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span>{t('landing.features.dataSecure')}</span></li>
            <li className="flex items-start gap-3"><Zap className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span>{t('landing.features.fastByDefault')}</span></li>
          </ul>
          <div className="mt-8 flex gap-3">
            <Button asChild className="rounded-xl bg-[#166534] dark:bg-[#22c55e] px-6 text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-[#12502b] dark:hover:bg-[#16a34a] transition-colors">
              <Link to="/sign-up">{t('landing.features.tryItNow')}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2d35] transition-colors">
              <Link to="/sign-up">{t('landing.features.seeSampleInvoice')} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </motion.div>
        </div>
      </div>
    </section>
  );
}


