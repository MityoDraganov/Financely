import * as React from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle2, BellRing, Shield, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function Features(): React.ReactElement {
  return (
    <section id="features" className="bg-[#F5F9F7] dark:bg-[#1b1e24] py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Built for speed, accuracy & compliance</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Opinionated defaults for finance teams, with the flexibility solo founders need. Seamless with Firebase + Stripe.</p>
          <ul className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-3"><FileText className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span><strong>Smart invoice editor</strong> – taxes, currency, and totals calculate live.</span></li>
            <li className="flex items-start gap-3"><CheckCircle2 className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span><strong>Approval trails</strong> – timestamped decisions for audit-ready records.</span></li>
            <li className="flex items-start gap-3"><BellRing className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span><strong>Renewal radar</strong> – reminders so you never miss a contract date.</span></li>
            <li className="flex items-start gap-3"><Shield className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span><strong>Data secure</strong> – built on Google Cloud/Firebase with role-based access.</span></li>
            <li className="flex items-start gap-3"><Zap className="mt-1 h-5 w-5 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /><span><strong>Fast by default</strong> – lightweight UI, keyboard shortcuts, autosave.</span></li>
          </ul>
          <div className="mt-8 flex gap-3">
            <Button className="rounded-xl bg-[#166534] dark:bg-[#22c55e] px-6 text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-[#12502b] dark:hover:bg-[#16a34a] transition-colors">Try it now</Button>
            <Button variant="outline" className="rounded-xl border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2d35] transition-colors">See a sample invoice <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}>
          <Card className="rounded-3xl border-gray-200 dark:border-gray-800 shadow-md dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35]">
            <CardContent className="p-0">
              <div className="flex h-80 items-center justify-center rounded-3xl bg-white dark:bg-[#1b1e24] text-gray-400 dark:text-gray-500">[Live preview / dashboard mock]</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}


