import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

export function Testimonials(): React.ReactElement {
  const { t } = useTranslation();
  
  const testimonials = [
    {
      name: t('landing.testimonials.testimonial1.name'),
      role: t('landing.testimonials.testimonial1.role'),
      company: t('landing.testimonials.testimonial1.company'),
      content: t('landing.testimonials.testimonial1.content'),
      rating: 5,
    },
    {
      name: t('landing.testimonials.testimonial2.name'),
      role: t('landing.testimonials.testimonial2.role'),
      company: t('landing.testimonials.testimonial2.company'),
      content: t('landing.testimonials.testimonial2.content'),
      rating: 5,
    },
    {
      name: t('landing.testimonials.testimonial3.name'),
      role: t('landing.testimonials.testimonial3.role'),
      company: t('landing.testimonials.testimonial3.company'),
      content: t('landing.testimonials.testimonial3.content'),
      rating: 5,
    },
  ];

  return (
    <section className="bg-white dark:bg-[#1b1e24] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('landing.testimonials.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.testimonials.subtitle')}
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
            >
              <Card className="h-full border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-[0px_4px_4px_#00000030] bg-white dark:bg-[#2a2d35] hover:shadow-md dark:hover:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015] transition-shadow">
                <CardContent className="p-6">
                  <div className="mb-4 flex gap-1">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <Quote className="mb-3 h-6 w-6 text-[#166534] dark:text-[#22c55e] opacity-50" />
                  <p className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                    {testimonial.content}
                  </p>
                  <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

