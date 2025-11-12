import * as React from "react";
import { Button } from "@/components/ui/button";

export function CTA(): React.ReactElement {
  return (
    <section className="bg-gradient-to-r from-[#166534] to-[#12502b] dark:from-[#22c55e] dark:to-[#16a34a] py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div>
          <h3 className="text-2xl font-bold">Ready to streamline finance ops?</h3>
          <p className="text-white/80 dark:text-white/90">Create your first invoice in under 2 minutes.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-xl bg-white dark:bg-[#2a2d35] px-6 text-[#166534] dark:text-gray-100 shadow-sm dark:shadow-[0px_4px_4px_#00000030] hover:bg-gray-50 dark:hover:bg-[#34373f] transition-colors">Start Free</Button>
          <Button className="rounded-xl bg-white/10 dark:bg-white/20 backdrop-blur-sm px-6 text-white border border-white/20 dark:border-white/30 hover:bg-white/20 dark:hover:bg-white/30 transition-colors">Book a Demo</Button>
        </div>
      </div>
    </section>
  );
}


