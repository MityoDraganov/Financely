import * as React from "react";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { QuizQuestion } from "./quiz-question";
import {
  Users,
  Building2,
  FileText,
  Workflow,
  Zap,
  CreditCard,
} from "lucide-react";
import {
  CompanySize,
  UseCase,
  InvoiceVolume,
  BudgetRange,
  recommendPlan,
  QuizResultData,
} from "@/core/entities/quiz-result";

interface QuizAnswers {
  companySize?: CompanySize;
  useCase?: UseCase;
  invoiceVolume?: InvoiceVolume;
  budgetRange?: BudgetRange;
  teamCollaboration?: boolean;
}

interface QuizFlowProps {
  onComplete: (result: QuizResultData) => void;
}

const QUESTIONS = [
  {
    id: "companySize",
    question: "What's your company size?",
    description: "This helps us recommend the right plan for your team",
    options: [
      {
        id: "solo",
        label: "Just me",
        description: "Solo entrepreneur or freelancer",
        icon: Users,
      },
      {
        id: "small",
        label: "Small team",
        description: "2-10 people",
        icon: Building2,
      },
      {
        id: "medium",
        label: "Medium team",
        description: "11-50 people",
        icon: Building2,
      },
      {
        id: "large",
        label: "Large team",
        description: "50+ people",
        icon: Building2,
      },
    ],
  },
  {
    id: "useCase",
    question: "What's your primary use case?",
    description: "What will you use Financely for most?",
    options: [
      {
        id: "invoicing",
        label: "Invoicing",
        description: "Create and manage invoices",
        icon: FileText,
      },
      {
        id: "proposals",
        label: "Proposals",
        description: "Create and send proposals",
        icon: FileText,
      },
      {
        id: "workflows",
        label: "Workflows",
        description: "Automate business processes",
        icon: Workflow,
      },
      {
        id: "all",
        label: "All of the above",
        description: "Complete finance operations",
        icon: Zap,
      },
    ],
  },
  {
    id: "invoiceVolume",
    question: "How many invoices do you send per month?",
    description: "This helps us understand your usage needs",
    options: [
      {
        id: "0-10",
        label: "0-10 invoices",
        description: "Low volume",
      },
      {
        id: "11-50",
        label: "11-50 invoices",
        description: "Medium volume",
      },
      {
        id: "51-200",
        label: "51-200 invoices",
        description: "High volume",
      },
      {
        id: "200+",
        label: "200+ invoices",
        description: "Very high volume",
      },
    ],
  },
  {
    id: "budgetRange",
    question: "What's your budget range?",
    description: "We'll recommend the best plan within your budget",
    options: [
      {
        id: "free",
        label: "Free",
        description: "Start with free features",
        icon: CreditCard,
      },
      {
        id: "starter",
        label: "Starter",
        description: "Basic paid features",
        icon: CreditCard,
      },
      {
        id: "pro",
        label: "Professional",
        description: "Advanced features for teams",
        icon: CreditCard,
      },
      {
        id: "enterprise",
        label: "Enterprise",
        description: "Custom solutions",
        icon: CreditCard,
      },
    ],
  },
  {
    id: "teamCollaboration",
    question: "Do you need team collaboration features?",
    description: "Multiple users, approvals, and shared workflows",
    options: [
      {
        id: "true",
        label: "Yes",
        description: "I work with a team",
        icon: Users,
      },
      {
        id: "false",
        label: "No",
        description: "I work solo",
        icon: Users,
      },
    ],
  },
];

export function QuizFlow({ onComplete }: QuizFlowProps): React.ReactElement {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;

  const handleSelect = (value: string) => {
    const questionId = currentQuestion.id as keyof QuizAnswers;
    
    if (questionId === "teamCollaboration") {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: value === "true",
      }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: value as CompanySize | UseCase | InvoiceVolume | BudgetRange,
      }));
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Calculate recommendation and complete
      const recommendedPlan = recommendPlan({
        companySize: answers.companySize!,
        useCase: answers.useCase!,
        invoiceVolume: answers.invoiceVolume!,
        budgetRange: answers.budgetRange!,
        teamCollaboration: answers.teamCollaboration ?? false,
      });

      const result: QuizResultData = {
        companySize: answers.companySize!,
        useCase: answers.useCase!,
        invoiceVolume: answers.invoiceVolume!,
        budgetRange: answers.budgetRange!,
        teamCollaboration: answers.teamCollaboration ?? false,
        recommendedPlan,
        createdAt: new Date().toISOString(),
      };

      onComplete(result);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const getSelectedValue = (): string | undefined => {
    const questionId = currentQuestion.id as keyof QuizAnswers;
    const value = answers[questionId];
    
    if (questionId === "teamCollaboration") {
      return value === true ? "true" : value === false ? "false" : undefined;
    }
    
    return value as string | undefined;
  };

  const canProceed = getSelectedValue() !== undefined;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
      <div className="w-full max-w-4xl">
        <AnimatePresence mode="wait">
          <QuizQuestion
            key={currentQuestionIndex}
            question={currentQuestion.question}
            description={currentQuestion.description}
            options={currentQuestion.options}
            selectedValue={getSelectedValue()}
            onSelect={handleSelect}
            onNext={handleNext}
            onBack={currentQuestionIndex > 0 ? handleBack : undefined}
            canProceed={canProceed}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={QUESTIONS.length}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
