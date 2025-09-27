import * as React from "react";
import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOTTIE } from "./constants";

export function HowItWorks(): React.ReactElement {
  const steps = React.useMemo(
    () => [
      {
        title: "Create",
        copy: "Generate invoices with auto-numbering, tax rules, and your org profile in seconds.",
        src: LOTTIE.create,
      },
      {
        title: "Approve",
        copy: "Send proposals to the right approvers and track decisions for compliance.",
        src: LOTTIE.approve,
      },
      {
        title: "Renew",
        copy: "Stay ahead of contract renewals with reminders and one-click renewals.",
        src: LOTTIE.renew,
      },
    ],
    [],
  );

  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="mb-14 text-center text-4xl font-bold text-gray-900">How Financely Works</motion.h2>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
            <Card className="h-full overflow-hidden rounded-3xl border-gray-200 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl font-semibold text-[#166534]">{i + 1}. {s.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Player autoplay loop keepLastFrame src={s.src} className="mx-auto h-40" />
                <p className="mt-4 text-gray-600">{s.copy}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}


