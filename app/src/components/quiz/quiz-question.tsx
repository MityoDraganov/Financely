import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

interface QuizQuestionProps {
  question: string;
  description?: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  selectedValue?: string;
  onSelect: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  canProceed: boolean;
  questionNumber: number;
  totalQuestions: number;
}

export function QuizQuestion({
  question,
  description,
  options,
  selectedValue,
  onSelect,
  onNext,
  onBack,
  canProceed,
  questionNumber,
  totalQuestions,
}: QuizQuestionProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-sm dark:shadow-[0px_4px_4px_#00000030]">
        <CardContent className="p-8">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Question {questionNumber} of {totalQuestions}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-500">
                {Math.round((questionNumber / totalQuestions) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#166534] dark:bg-[#22c55e]"
                initial={{ width: 0 }}
                animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {question}
            </h2>
            {description && (
              <p className="text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 mb-8">
            {options.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedValue === option.id;

              return (
                <motion.button
                  key={option.id}
                  onClick={() => onSelect(option.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-[#166534] dark:border-[#22c55e] bg-[#166534]/10 dark:bg-[#22c55e]/10"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[#2a2d35] hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {Icon && (
                      <div
                        className={`shrink-0 p-2 rounded-lg ${
                          isSelected
                            ? "bg-[#166534] dark:bg-[#22c55e] text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {option.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="shrink-0">
                        <div className="h-5 w-5 rounded-full bg-[#166534] dark:bg-[#22c55e] flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                className="rounded-xl border-gray-300 dark:border-gray-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              onClick={onNext}
              disabled={!canProceed}
              className="ml-auto rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0f1115] hover:bg-[#12502b] dark:hover:bg-[#16a34a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {questionNumber === totalQuestions ? "See Results" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
