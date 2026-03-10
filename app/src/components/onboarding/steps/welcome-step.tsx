import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Eye, Layers } from "lucide-react";

interface WelcomeStepProps {
  userName: string;
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <motion.div
      className="relative flex flex-col flex-1 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      {/* Character — absolute right, desktop only, fills card height */}
      <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[44%] pointer-events-none select-none">
        <motion.img
          src="/onboarding-character.png"
          alt=""
          className="absolute bottom-0 right-0 h-[95%] w-full object-contain object-bottom drop-shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
        {/* Subtle gradient fade so character blends at the left edge */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white dark:from-zinc-900 to-transparent pointer-events-none" />
      </div>

      {/* Content — left side, capped so it doesn't bleed under character */}
      <div className="relative z-10 flex flex-col flex-1 justify-center gap-8 lg:max-w-[56%]">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Setting up your workspace</span>
        </motion.div>

        {/* Headline */}
        <div className="space-y-4">
          <motion.h1
            className="text-4xl sm:text-5xl font-bold text-foreground leading-tight tracking-tight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            Set up your
            <br />
            <span className="text-primary">Financely workspace</span>
          </motion.h1>
          <motion.p
            className="text-lg text-muted-foreground leading-relaxed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            Add your business details, branding, and starter templates in a few quick steps.
            Your setup updates live as you go.
          </motion.p>
        </div>

        {/* Feature highlights */}
        <motion.div
          className="flex flex-col gap-2.5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          {[
            { icon: Zap,    label: "Fast setup",   desc: "Done in minutes" },
            { icon: Eye,    label: "Live preview",  desc: "See changes instantly" },
            { icon: Layers, label: "Ready to use",  desc: "Templates from day one" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {label} <span className="text-muted-foreground font-normal">— {desc}</span>
              </p>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="flex flex-col sm:flex-row items-start gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          <Button
            onClick={onNext}
            size="lg"
            className="rounded-xl px-8 gap-2 text-base"
          >
            Get started
            <ArrowRight className="w-5 h-5" />
          </Button>
          <p className="text-xs text-muted-foreground self-center">
            Takes about 3 minutes · You can change everything later
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
