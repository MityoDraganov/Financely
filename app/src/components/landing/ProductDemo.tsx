import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Zap, FileText, BarChart3, Users } from "lucide-react";

export function ProductDemo(): React.ReactElement {
  const { t } = useTranslation();
  
  const features = [
    {
      icon: FileText,
      title: t('landing.productDemo.features.invoices.title'),
      description: t('landing.productDemo.features.invoices.description'),
    },
    {
      icon: Users,
      title: t('landing.productDemo.features.contacts.title'),
      description: t('landing.productDemo.features.contacts.description'),
    },
    {
      icon: Zap,
      title: t('landing.productDemo.features.automation.title'),
      description: t('landing.productDemo.features.automation.description'),
    },
    {
      icon: BarChart3,
      title: t('landing.productDemo.features.analytics.title'),
      description: t('landing.productDemo.features.analytics.description'),
    },
  ];

  return (
    <section className="bg-gradient-to-b from-white to-gray-50 dark:from-[#1b1e24] dark:to-[#0f1115] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('landing.productDemo.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.productDemo.subtitle')}
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-1 items-center mb-12">


          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-[#166534]/10 dark:bg-[#22c55e]/10 p-3">
                    <feature.icon className="h-6 w-6 text-[#166534] dark:text-[#22c55e]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Button
            asChild
            size="lg"
            className="rounded-xl bg-[#166534] dark:bg-[#22c55e] px-8 text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-[#12502b] dark:hover:bg-[#16a34a] transition-colors"
          >
            <Link to="/onboarding">{t('landing.productDemo.tryNow')}</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

