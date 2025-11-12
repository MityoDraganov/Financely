import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function Pricing(): React.ReactElement {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="mb-16 text-center text-4xl font-bold text-gray-900 dark:text-gray-100">Pricing for every stage</motion.h2>
      <div className="grid gap-8 md:grid-cols-3">
        <Card className="p-8 text-center shadow-sm dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35] border-gray-200 dark:border-gray-800 transition-shadow hover:shadow-md dark:hover:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Starter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534] dark:text-[#22c55e]">$19<span className="text-lg font-semibold text-gray-600 dark:text-gray-400">/mo</span></p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> 5 invoices / month</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Basic support</li>
            </ul>
            <Button className="mt-6 w-full rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-[#12502b] dark:hover:bg-[#16a34a] transition-colors">Choose Starter</Button>
          </CardContent>
        </Card>

        <Card className="scale-[1.02] border-2 border-[#166534] dark:border-[#22c55e] p-8 text-center shadow-md dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35]">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Pro <span className="ml-2 align-middle text-xs font-medium text-[#166534] dark:text-[#22c55e]">Most popular</span></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534] dark:text-[#22c55e]">$49<span className="text-lg font-semibold text-gray-700 dark:text-gray-300">/mo</span></p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Unlimited invoices</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Approval workflows</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Priority support</li>
            </ul>
            <Button className="mt-6 w-full rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0f1115] shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-[#12502b] dark:hover:bg-[#16a34a] transition-colors">Choose Pro</Button>
          </CardContent>
        </Card>

        <Card className="p-8 text-center shadow-sm dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35] border-gray-200 dark:border-gray-800 transition-shadow hover:shadow-md dark:hover:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Enterprise</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534] dark:text-[#22c55e]">Custom</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Advanced integrations</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534] dark:text-[#22c55e] flex-shrink-0" /> Dedicated manager</li>
            </ul>
            <Button variant="outline" className="mt-6 w-full rounded-xl border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#34373f] transition-colors">Talk to sales</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}


