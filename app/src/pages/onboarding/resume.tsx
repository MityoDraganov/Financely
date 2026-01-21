import * as React from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { functionsService } from "@/services";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { saveProgressLocally } from "@/utils/progress-storage";

export default function ResumeOnboardingPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const { progress } = useOnboardingProgress();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid resume link");
      return;
    }

    const validateAndLoad = async () => {
      try {
        // Validate token via Cloud Function
        const result = await functionsService.validateResumeLink({ token });

        if (!result.valid || !result.progressId) {
          setStatus("error");
          setError(result.error || "Invalid or expired resume link");
          return;
        }

        // Load progress from backend
        // The progress will be loaded by the useOnboardingProgress hook
        // We'll restore it to localStorage for immediate access
        if (progress) {
          saveProgressLocally(progress);
        }

        setStatus("success");

        // Redirect to onboarding with progress restored
        setTimeout(() => {
          navigate("/onboarding", { replace: true });
        }, 1500);
      } catch (err) {
        console.error("Error validating resume link:", err);
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to validate resume link"
        );
      }
    };

    validateAndLoad();
  }, [token, navigate, progress]);

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#166534] dark:text-[#22c55e] mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Validating your resume link...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Invalid Resume Link
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate("/onboarding")}
                className="rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0f1115] hover:bg-[#12502b] dark:hover:bg-[#16a34a]"
              >
                Start Fresh
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="rounded-xl border-gray-300 dark:border-gray-700"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#166534] to-[#0e4424]">
      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1b1e24] shadow-lg dark:shadow-[0px_4px_4px_#00000030,0px_12px_12px_#00000015]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome Back!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Picking up where you left off...
          </p>
          <Loader2 className="h-6 w-6 animate-spin text-[#166534] dark:text-[#22c55e] mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
