import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function Pricing(): React.ReactElement {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="mb-16 text-center text-4xl font-bold text-gray-900">Pricing for every stage</motion.h2>
      <div className="grid gap-8 md:grid-cols-3">
        <Card className="p-8 text-center shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Starter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534]">$19<span className="text-lg font-semibold text-gray-600">/mo</span></p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> 5 invoices / month</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Basic support</li>
            </ul>
            <Button className="mt-6 w-full rounded-xl bg-[#166534] text-white">Choose Starter</Button>
          </CardContent>
        </Card>

        <Card className="scale-[1.02] border-2 border-[#166534] p-8 text-center shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Pro <span className="ml-2 align-middle text-xs font-medium text-[#166534]">Most popular</span></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534]">$49<span className="text-lg font-semibold text-gray-700">/mo</span></p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Unlimited invoices</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Approval workflows</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Priority support</li>
            </ul>
            <Button className="mt-6 w-full rounded-xl bg-[#166534] text-white">Choose Pro</Button>
          </CardContent>
        </Card>

        <Card className="p-8 text-center shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Enterprise</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-extrabold text-[#166534]">Custom</p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Advanced integrations</li>
              <li className="flex items-center justify-center gap-2"><Check className="h-4 w-4 text-[#166534]" /> Dedicated manager</li>
            </ul>
            <Button variant="outline" className="mt-6 w-full rounded-xl">Talk to sales</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}


