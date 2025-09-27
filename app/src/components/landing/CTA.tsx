import * as React from "react";
import { Button } from "@/components/ui/button";

export function CTA(): React.ReactElement {
  return (
    <section className="bg-gradient-to-r from-[#166534] to-[#12502b] py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div>
          <h3 className="text-2xl font-bold">Ready to streamline finance ops?</h3>
          <p className="text-white/80">Create your first invoice in under 2 minutes.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-xl bg-white px-6 text-[#166534]">Start Free</Button>
          <Button className="rounded-xl bg-white px-6 text-[#166534]">Book a Demo</Button>
        </div>
      </div>
    </section>
  );
}


