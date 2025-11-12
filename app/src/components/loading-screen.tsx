import { useEffect, useState } from "react";

const slogans = [
  "Streamline your finances",
  "Invoice smarter, not harder",
  "Your business, simplified",
  "Financial clarity at your fingertips",
  "Empower your workflow",
  "Where finance meets efficiency",
];

export function LoadingScreen() {
  const [currentSlogan, setCurrentSlogan] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlogan((prev) => (prev + 1) % slogans.length);
    }, 3000); // Change slogan every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center space-y-6">
        {/* Logo/Brand */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-[#166534] dark:text-[#22c55e] tracking-tight">
            Financely
          </h1>
          <div className="h-1 w-24 bg-[#166534] dark:bg-[#22c55e] mx-auto rounded-full" />
        </div>

        {/* Spinner */}
        <div className="flex justify-center pt-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-[#166534] dark:border-t-[#22c55e]" />
        </div>

        {/* Rotating Slogan */}
        <div className="h-8 flex items-center justify-center">
          <p
            key={currentSlogan}
            className="text-gray-600 dark:text-gray-400 text-lg font-medium transition-opacity duration-500"
            style={{
              animation: "fadeIn 0.5s ease-in",
            }}
          >
            {slogans[currentSlogan]}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

