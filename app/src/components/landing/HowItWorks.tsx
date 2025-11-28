import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOTTIE } from "./constants";

export function HowItWorks(): React.ReactElement {
  const { t } = useTranslation();
  
  const steps = React.useMemo(
    () => [
      {
        title: t('landing.howItWorks.steps.create.title'),
        copy: t('landing.howItWorks.steps.create.copy'),
        src: LOTTIE.create,
      },
      {
        title: t('landing.howItWorks.steps.approve.title'),
        copy: t('landing.howItWorks.steps.approve.copy'),
        src: LOTTIE.approve,
      },
      {
        title: t('landing.howItWorks.steps.convert.title'),
        copy: t('landing.howItWorks.steps.convert.copy'),
        src: LOTTIE.renew,
      },
    ],
    [t],
  );

  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="mb-14 text-center text-4xl font-bold text-gray-900 dark:text-gray-100">{t('landing.howItWorks.title')}</motion.h2>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
            <Card className="h-full overflow-hidden rounded-3xl border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35] transition-shadow hover:shadow-md dark:hover:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl font-semibold text-[#166534] dark:text-[#22c55e]">{i + 1}. {s.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Player autoplay loop keepLastFrame src={s.src} className="mx-auto h-40" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">{s.copy}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}


