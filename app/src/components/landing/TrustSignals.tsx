import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Shield, Award, Star } from "lucide-react";

export function TrustSignals(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <section className="bg-white dark:bg-[#1b1e24] py-16 border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-6">
        {/* Trust Badges */}
        <div className="mb-12 flex flex-wrap items-center justify-center gap-8 opacity-60">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <Shield className="h-5 w-5 text-[#166534] dark:text-[#22c55e]" />
            <span>{t('landing.trustSignals.soc2Compliant')}</span>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <Award className="h-5 w-5 text-[#166534] dark:text-[#22c55e]" />
            <span>{t('landing.trustSignals.gdprCompliant')}</span>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <Star className="h-5 w-5 text-[#166534] dark:text-[#22c55e]" />
            <span>{t('landing.trustSignals.rated')}</span>
          </motion.div>
        </div>


        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-[#166534] dark:text-[#22c55e]">10k+</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('landing.trustSignals.activeUsers')}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-[#166534] dark:text-[#22c55e]">500+</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('landing.trustSignals.companies')}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-[#166534] dark:text-[#22c55e]">99.9%</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('landing.trustSignals.uptime')}</div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-[#166534] dark:text-[#22c55e]">24/7</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('landing.trustSignals.support')}</div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

