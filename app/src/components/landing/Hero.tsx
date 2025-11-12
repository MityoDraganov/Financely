import * as React from "react";
import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import { Button } from "@/components/ui/button";
import { LOTTIE } from "./constants";

export function Hero(): React.ReactElement {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#166534] to-[#0e4424] py-24 text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="mb-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white">New · Approvals → Invoice in one click</p>
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">Automate Invoices, Approvals & Renewals</h1>
          <p className="mt-6 max-w-xl text-lg text-gray-100">Financely is a finance ops hub: create legally compliant invoices, route proposals for approval, and never miss a contract renewal.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button variant="outline" className="rounded-xl bg-white dark:bg-[#2a2d35] px-7 py-3 font-semibold text-[#166534] dark:text-gray-100 shadow dark:shadow-[0px_4px_4px_#00000030] hover:bg-gray-50 dark:hover:bg-[#34373f] transition-colors">Start Free Trial</Button>
            <Button variant="outline" className="rounded-xl border-white dark:border-gray-400 px-7 py-3 transition-colors text-white dark:text-gray-100 hover:bg-white/10 dark:hover:bg-gray-400/10">Book a Demo</Button>
            <span className="ml-2 text-sm text-gray-200 dark:text-gray-300">No credit card · Cancel anytime</span>
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


