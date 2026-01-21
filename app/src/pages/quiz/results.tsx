import * as React from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QuizResults } from "@/components/quiz/quiz-results";
import { QuizResultData } from "@/core/entities/quiz-result";

const QUIZ_RESULTS_STORAGE_KEY = "financely_quiz_results";

export default function QuizResultsPage(): React.ReactElement {
  const navigate = useNavigate();
  const [result, setResult] = React.useState<QuizResultData | null>(null);

  useEffect(() => {
    // Load quiz results from sessionStorage
    const stored = sessionStorage.getItem(QUIZ_RESULTS_STORAGE_KEY);
    if (!stored) {
      // No results found, redirect to quiz
      navigate("/quiz");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as QuizResultData;
      setResult(parsed);
    } catch (error) {
      console.error("Failed to parse quiz results:", error);
      navigate("/quiz");
    }
  }, [navigate]);

  const handleViewPricing = () => {
    if (!result) return;
    
    // Navigate to landing page with recommended plan
    navigate(`/#pricing?recommended=${result.recommendedPlan}`);
    
    // Scroll to pricing section after navigation
    setTimeout(() => {
      const pricingSection = document.getElementById("pricing");
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  if (!result) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading results...</div>
      </div>
    );
  }

  return <QuizResults result={result} onViewPricing={handleViewPricing} />;
}
