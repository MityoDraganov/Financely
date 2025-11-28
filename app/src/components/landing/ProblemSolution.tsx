import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { X, CheckCircle2, Clock, AlertCircle, FileX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ProblemSolution(): React.ReactElement {
  const { t } = useTranslation();
  
  const problems = [
    {
      icon: Clock,
      title: t('landing.problemSolution.problems.timeWasting.title'),
      description: t('landing.problemSolution.problems.timeWasting.description'),
    },
    {
      icon: AlertCircle,
      title: t('landing.problemSolution.problems.errors.title'),
      description: t('landing.problemSolution.problems.errors.description'),
    },
    {
      icon: FileX,
      title: t('landing.problemSolution.problems.compliance.title'),
      description: t('landing.problemSolution.problems.compliance.description'),
    },
  ];

  const solutions = [
    t('landing.problemSolution.solutions.automation'),
    t('landing.problemSolution.solutions.compliance'),
    t('landing.problemSolution.solutions.tracking'),
  ];

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white dark:from-[#0f1115] dark:to-[#1b1e24] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('landing.problemSolution.title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.problemSolution.subtitle')}
          </p>
        </motion.div>

        <div className="grid gap-12 md:grid-cols-2 mb-16">
          {/* Problems */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
                <X className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {t('landing.problemSolution.problemsTitle')}
              </h3>
            </div>
            <div className="space-y-4">
              {problems.map((problem, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <problem.icon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {problem.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {problem.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {t('landing.problemSolution.solutionsTitle')}
              </h3>
            </div>
            <div className="space-y-4">
              {solutions.map((solution, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {solution}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('landing.problemSolution.cta')}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {t('landing.problemSolution.ctaSubtext')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

