import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { QuizResultData, RecommendedPlan } from "@/core/entities/quiz-result";

interface QuizResultsProps {
  result: QuizResultData;
  onViewPricing: () => void;
}

const PLAN_DESCRIPTIONS: Record<RecommendedPlan, { name: string; benefits: string[] }> = {
  starter: {
    name: "Starter Plan",
    benefits: [
      "Perfect for solo entrepreneurs",
      "Essential invoicing features",
      "Basic templates and customization",
      "Email support",
    ],
  },
  professional: {
    name: "Professional Plan",
    benefits: [
      "Ideal for small to medium teams",
      "Unlimited invoices and proposals",
      "Advanced workflows and automation",
      "Priority support",
      "Team collaboration features",
    ],
  },
  enterprise: {
    name: "Enterprise Plan",
    benefits: [
      "Built for large organizations",
      "Custom integrations and APIs",
      "Dedicated account manager",
      "Advanced security and compliance",
      "Custom branding and white-labeling",
      "24/7 priority support",
    ],
  },
};

export function QuizResults({ result, onViewPricing }: QuizResultsProps): React.ReactElement {
  const planInfo = PLAN_DESCRIPTIONS[result.recommendedPlan];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardHeader className="text-center pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#166534] to-[#0e4424]"
            >
              <Sparkles className="h-10 w-10 text-white" />
            </motion.div>
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              We Found Your Perfect Plan!
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Based on your answers, we recommend the{" "}
              <span className="font-semibold text-[#166534] dark:text-[#22c55e]">
                {planInfo.name}
              </span>
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Recommended Plan Highlight */}
            <div className="rounded-lg border-2 border-[#166534] dark:border-[#22c55e] bg-[#166534]/10 dark:bg-[#22c55e]/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-[#166534] dark:text-[#22c55e]" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {planInfo.name}
                </h3>
              </div>
              <ul className="space-y-2">
                {planInfo.benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-2 text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[#166534] dark:text-[#22c55e] shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                onClick={onViewPricing}
                size="lg"
                className="flex-1 rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0f1115] hover:bg-[#12502b] dark:hover:bg-[#16a34a] shadow-sm dark:shadow-[0px_4px_4px_#00000030]"
              >
                Get Started with {planInfo.name}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="flex-1 rounded-xl border-gray-300 dark:border-gray-700"
              >
                <Link to="/">View All Plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
