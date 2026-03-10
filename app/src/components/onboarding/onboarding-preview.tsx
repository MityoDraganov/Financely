import { motion, AnimatePresence } from "framer-motion";
import { Building2, Palette, FileText, CheckCircle2, Sparkles, Tag, Briefcase } from "lucide-react";
import { useOnboardingStore, STEPS } from "@/hooks/use-onboarding-store";
import { useShallow } from "zustand/react/shallow";

/**
 * Renders a name character-by-character so only newly appended characters animate in.
 * Existing characters are stable (same key = same index) and never re-animate.
 * Spaces are converted to NBSP so they render correctly in inline context.
 */
function AnimatedName({ name, className }: { name: string; className?: string }) {
  return (
    <span className={className}>
      {name.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  PLN: "zł",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
};

const STEP_LABELS: Record<number, string> = {
  [STEPS.WELCOME]: "Welcome",
  [STEPS.CHOOSE_PATH]: "Choose path",
  [STEPS.BUSINESS_DETAILS]: "Business details",
  [STEPS.BUSINESS_DESCRIPTION]: "Business type",
  [STEPS.BRANDING]: "Branding",
  [STEPS.TEMPLATE_SUGGESTIONS]: "Templates",
  [STEPS.SIGN_UP]: "Account",
  [STEPS.PAYWALL]: "Plan",
  [STEPS.SUCCESS]: "Done",
};

// Steps that are relevant for setup progress (create-org path only)
const SETUP_STEPS = [
  STEPS.BUSINESS_DETAILS,
  STEPS.BUSINESS_DESCRIPTION,
  STEPS.BRANDING,
  STEPS.TEMPLATE_SUGGESTIONS,
];

export function OnboardingPreview() {
  const {
    currentStep,
    formData,
    businessData,
    brandingData,
    selectedTemplates,
  } = useOnboardingStore(
    useShallow((state) => ({
      currentStep: state.currentStep,
      formData: state.formData,
      businessData: state.businessData,
      brandingData: state.brandingData,
      selectedTemplates: state.selectedTemplates,
    }))
  );

  const currencySymbol = CURRENCY_SYMBOLS[businessData.currency] ?? businessData.currency;
  const setupStepsCompleted = SETUP_STEPS.filter((s) => currentStep > s).length;
  const totalSetupSteps = SETUP_STEPS.length;

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Live workspace card */}
      <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden flex flex-col">
        {/* Sample invoice header — applies brand color */}
        <div
          className="px-5 py-4 flex items-center gap-3 transition-colors duration-500"
          style={{ backgroundColor: brandingData.primaryColor }}
        >
          <AnimatePresence mode="wait">
            {businessData.logoUrl ? (
              <motion.img
                key="logo"
                src={businessData.logoUrl}
                alt="Logo"
                className="w-8 h-8 rounded object-contain bg-white/10"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              />
            ) : (
              <motion.div
                key="placeholder"
                className="w-8 h-8 rounded bg-white/20 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Building2 className="w-4 h-4 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {formData.name ? (
              /* key="name" is intentionally stable — AnimatePresence only fires
                 the enter animation once (empty → non-empty). After that the
                 AnimatedName component owns per-character animation internally. */
              <AnimatedName
                key="name"
                name={formData.name}
                className="text-white font-semibold text-sm truncate"
              />
            ) : (
              <motion.span
                key="placeholder-name"
                className="text-white/50 font-medium text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Your Company
              </motion.span>
            )}
          </AnimatePresence>
          <span className="ml-auto text-white/60 text-xs font-mono">INVOICE</span>
        </div>

        {/* Invoice body */}
        <div className="flex-1 p-5 flex flex-col gap-4 bg-white dark:bg-zinc-900">
          {/* Bill to / From row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">From</p>
              <p className="text-xs font-semibold text-foreground truncate">
                {formData.name || "Your Company"}
              </p>
              <AnimatePresence>
                {businessData.country && (
                  <motion.p
                    key="country"
                    className="text-[11px] text-muted-foreground"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {businessData.country}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
              <p className="text-xs text-muted-foreground">Client Name</p>
              <p className="text-[11px] text-muted-foreground">client@example.com</p>
            </div>
          </div>

          {/* Sample line items */}
          <div className="space-y-1">
            <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground pb-1 border-b border-border">
              <span className="col-span-2">Service</span>
              <span className="text-right">Amount</span>
            </div>

            <AnimatePresence>
              {businessData.suggestedServices.slice(0, 2).map((service, i) => (
                <motion.div
                  key={service}
                  className="grid grid-cols-3 text-xs py-1"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <span className="col-span-2 text-foreground truncate">{service}</span>
                  <span className="text-right text-foreground font-mono">
                    {currencySymbol}1,200
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {businessData.suggestedServices.length === 0 && (
              <>
                <div className="grid grid-cols-3 text-xs py-1 opacity-30">
                  <span className="col-span-2 text-foreground">Service item</span>
                  <span className="text-right text-foreground font-mono">{currencySymbol}—</span>
                </div>
                <div className="grid grid-cols-3 text-xs py-1 opacity-20">
                  <span className="col-span-2 text-foreground">Service item</span>
                  <span className="text-right text-foreground font-mono">{currencySymbol}—</span>
                </div>
              </>
            )}
          </div>

          {/* Total */}
          <div className="mt-auto pt-2 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span
              className="text-sm font-bold transition-colors duration-500"
              style={{ color: brandingData.primaryColor }}
            >
              {businessData.suggestedServices.length > 0
                ? `${currencySymbol}2,400`
                : `${currencySymbol}—`}
            </span>
          </div>
        </div>
      </div>

      {/* Workspace summary card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-3">
        <p className="text-white/60 text-[11px] font-medium uppercase tracking-wider">Workspace setup</p>

        <div className="space-y-2">
          {/* Business type */}
          <AnimatePresence>
            {businessData.businessType && (
              <motion.div
                key="business-type"
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Briefcase className="w-3.5 h-3.5 text-white/50 shrink-0" />
                <span className="text-white/80 text-xs truncate">{businessData.businessType}</span>
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Detected</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Industry */}
          <AnimatePresence>
            {businessData.industry && (
              <motion.div
                key="industry"
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Tag className="w-3.5 h-3.5 text-white/50 shrink-0" />
                <span className="text-white/70 text-xs truncate">{businessData.industry}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Brand color */}
          <div className="flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-white/50 shrink-0" />
            <div
              className="w-3 h-3 rounded-full border border-white/20 transition-colors duration-300 shrink-0"
              style={{ backgroundColor: brandingData.primaryColor }}
            />
            <span className="text-white/70 text-xs font-mono">{brandingData.primaryColor}</span>
          </div>

          {/* Templates */}
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-white/50 shrink-0" />
            <span className="text-white/70 text-xs">
              {selectedTemplates.length > 0
                ? `${selectedTemplates.length} template${selectedTemplates.length !== 1 ? "s" : ""} selected`
                : "No templates yet"}
            </span>
            <AnimatePresence>
              {selectedTemplates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="ml-auto"
                >
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Progress */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/50 text-[10px] uppercase tracking-wider">Setup progress</span>
            <span className="text-white/60 text-[10px]">
              {setupStepsCompleted} / {totalSetupSteps}
            </span>
          </div>
          <div className="flex gap-1">
            {SETUP_STEPS.map((step) => (
              <div
                key={step}
                className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{
                  backgroundColor:
                    currentStep > step
                      ? brandingData.primaryColor
                      : currentStep === step
                      ? `${brandingData.primaryColor}60`
                      : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Current step label */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-white/30 shrink-0" />
        <span className="text-white/40 text-xs">
          {STEP_LABELS[currentStep] ?? "Setup"} — updates live as you go
        </span>
      </div>
    </div>
  );
}
