import * as React from "react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function FAQ(): React.ReactElement {
  const { t } = useTranslation();
  
  return (
    <section id="faq" className="bg-white dark:bg-[#1b1e24] py-24">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="mb-10 text-center text-4xl font-bold text-gray-900 dark:text-gray-100">{t('landing.faq.title')}</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">{t('landing.faq.questions.legallyCompliant.question')}</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">{t('landing.faq.questions.legallyCompliant.answer')}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">{t('landing.faq.questions.invoiceNumbers.question')}</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">{t('landing.faq.questions.invoiceNumbers.answer')}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">{t('landing.faq.questions.payments.question')}</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">{t('landing.faq.questions.payments.answer')}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-left text-base font-semibold text-gray-900 dark:text-gray-100">{t('landing.faq.questions.dataSecurity.question')}</AccordionTrigger>
            <AccordionContent className="text-gray-700 dark:text-gray-300">{t('landing.faq.questions.dataSecurity.answer')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}


