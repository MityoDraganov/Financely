import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function FAQ(): React.ReactElement {
  return (
    <section id="faq" className="bg-white dark:bg-[#1b1e24] py-24">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-10 text-center text-4xl font-bold text-gray-900 dark:text-gray-100">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">Are invoices legally compliant?</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">Yes. Financely captures the legal essentials (seller & buyer info, tax/VAT IDs, itemization, totals, issue & due dates, invoice number, currency, terms). You can export/share PDFs that meet common EU/US requirements.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">Do invoice numbers need to be government-issued?</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">No. Numbers must be unique, sequential in your system, and traceable. Financely auto-generates them with prefixes per organization and supports manual overrides with validation.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">What payments do you support?</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">Stripe links out of the box. You can also attach bank details and mark invoices as paid when you reconcile offline payments.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">How is my data secured?</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">We build on Google Cloud/Firebase with role-based access, audit logs, and org-level isolation. Only authorized users can view or edit invoices and approvals.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}


