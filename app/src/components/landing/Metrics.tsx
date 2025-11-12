import * as React from "react";

export function Metrics(): React.ReactElement {
  return (
    <section className="border-t border-gray-200 dark:border-gray-800 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 text-center sm:grid-cols-3">
          <div>
            <p className="text-5xl font-extrabold text-[#166534] dark:text-[#22c55e]">10k+</p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Invoices created</p>
          </div>
          <div>
            <p className="text-5xl font-extrabold text-[#166534] dark:text-[#22c55e]">500+</p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Teams onboarded</p>
          </div>
          <div>
            <p className="text-5xl font-extrabold text-[#166534] dark:text-[#22c55e]">2×</p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Faster approvals</p>
          </div>
        </div>
      </div>
    </section>
  );
}


