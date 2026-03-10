import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Sparkles, Loader2, CheckCircle2, Tag, Briefcase } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";
import { useInterpretBusinessDescription } from "@/hooks/service-hooks/use-interpret-business-description";

const EXAMPLE_DESCRIPTIONS = [
  "We are a digital marketing agency offering SEO, Google Ads, and social media management.",
  "We sell handmade candles and seasonal gift boxes online and at local markets.",
  "We provide legal consulting and contract review for early-stage startups.",
  "We build custom software for e-commerce businesses — web apps, mobile apps, and integrations.",
];

interface BusinessDescriptionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function BusinessDescriptionStep({ onNext, onBack }: BusinessDescriptionStepProps) {
  const { businessData, setBusinessData } = useOnboardingStore(
    useShallow((state) => ({
      businessData: state.businessData,
      setBusinessData: state.setBusinessData,
    }))
  );

  const [text, setText] = useState(businessData.businessDescription || "");
  const [hasInterpreted, setHasInterpreted] = useState(
    !!businessData.businessType
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const interpret = useInterpretBusinessDescription();

  const runInterpretation = (value: string) => {
    if (value.trim().length < 20) return;
    interpret.mutate(value.trim(), {
      onSuccess: (result) => {
        setBusinessData({
          businessDescription: value.trim(),
          businessType: result.businessType,
          industry: result.industry,
          suggestedServices: result.suggestedServices,
          templateKeywords: result.templateKeywords,
        });
        setHasInterpreted(true);
      },
    });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length >= 20) {
      debounceRef.current = setTimeout(() => runInterpretation(text), 800);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const handleTextChange = (value: string) => {
    setText(value);
    setBusinessData({ businessDescription: value });
    if (hasInterpreted && value !== businessData.businessDescription) {
      setHasInterpreted(false);
    }
  };

  const canContinue = text.trim().length > 0;

  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Step 3 of 5</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Tell us about your business
        </h2>
        <p className="text-muted-foreground text-base max-w-md">
          Describe what your business does. We'll use this to suggest the right templates and services.
        </p>
      </div>

      <div className="space-y-5 max-w-md">
        {/* Text input */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">What does your business do?</Label>
          <Textarea
            placeholder="e.g. We are a digital marketing agency offering SEO, paid ads, and website design for e-commerce brands."
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={4}
            className="rounded-xl resize-none text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {text.length < 20 ? `${20 - text.length} more characters to activate suggestions` : ""}
            </p>
            {interpret.isPending && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Interpreting…
              </span>
            )}
          </div>
        </div>

        {/* Example prompts */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Examples:</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_DESCRIPTIONS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleTextChange(ex)}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left line-clamp-1"
              >
                {ex.slice(0, 40)}…
              </button>
            ))}
          </div>
        </div>

        {/* Interpreted result */}
        <AnimatePresence>
          {hasInterpreted && businessData.businessType && (
            <motion.div
              key="interpretation"
              className="rounded-2xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 space-y-3"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Business type detected
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-border text-xs font-medium">
                  <Briefcase className="w-3 h-3 text-primary" />
                  {businessData.businessType}
                </div>
                {businessData.industry && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-border text-xs text-muted-foreground">
                    <Tag className="w-3 h-3" />
                    {businessData.industry}
                  </div>
                )}
              </div>

              {businessData.suggestedServices.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Suggested services:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {businessData.suggestedServices.map((service) => (
                      <span
                        key={service}
                        className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="rounded-xl gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          size="lg"
          className="rounded-xl px-8 gap-2"
        >
          {text.trim().length === 0 ? "Skip for now" : "Continue"}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
