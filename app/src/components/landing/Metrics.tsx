import * as React from "react";

export function Metrics(): React.ReactElement {
  return (
    <section className="border-t border-gray-200 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-10 text-center sm:grid-cols-3">
          <div>
            <p className="text-5xl font-extrabold text-[#166534]">10k+</p>
            <p className="mt-2 text-gray-600">Invoices created</p>
          </div>
          <div>
            <p className="text-5xl font-extrabold text-[#166534]">500+</p>
            <p className="mt-2 text-gray-600">Teams onboarded</p>
          </div>
          <div>
            <p className="text-5xl font-extrabold text-[#166534]">2×</p>
            <p className="mt-2 text-gray-600">Faster approvals</p>
          </div>
        </div>
      </div>
    </section>
  );
}


