import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LOTTIE } from "./constants";

export function Hero(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#166534] to-[#0e4424] py-24 text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="mb-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white">{t('landing.hero.badge')}</p>
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">{t('landing.hero.title')}</h1>
          <p className="mt-6 max-w-xl text-lg md:text-xl text-gray-100 leading-relaxed">{t('landing.hero.description')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild variant="outline" className="rounded-xl bg-white dark:bg-[#2a2d35] px-7 py-3 font-semibold text-[#166534] dark:text-gray-100 shadow dark:shadow-[0px_4px_4px_#00000030] hover:bg-gray-50 dark:hover:bg-[#34373f] transition-colors">
              <Link to="/sign-up">{t('landing.hero.startFreeTrial')}</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="relative hidden md:block">
          <div className="relative z-10 rounded-3xl border border-white/20 bg-white/5 p-4 shadow-2xl ring-1 ring-black/5">
            <Player autoplay loop keepLastFrame src={LOTTIE.hero} className="h-80 w-full" />
          </div>
          <div className="absolute -left-6 -top-6 -z-0 h-24 w-24 rounded-2xl bg-white/20 blur-xl" aria-hidden />
        </motion.div>
      </div>
    </section>
  );
}


