import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, FileText, Users, Zap } from "lucide-react";

interface SuccessStepProps {
  orgName: string;
  onComplete: () => void;
}

export function SuccessStep({ orgName, onComplete }: SuccessStepProps) {
  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center"
      >
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </motion.div>

      {/* Headline */}
      <div className="space-y-3">
        <motion.h2
          className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          {orgName ? `${orgName} is ready` : "Your workspace is ready"}
        </motion.h2>
        <motion.p
          className="text-muted-foreground text-base max-w-md"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          Your workspace has been set up with your branding and starter templates.
          Time to start creating.
        </motion.p>
      </div>

      {/* What's ready */}
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
      >
        <p className="text-sm font-medium text-foreground">What's ready in your workspace:</p>
        <div className="space-y-2">
          {[
            { icon: CheckCircle2, text: "Organization created and configured", color: "text-green-500" },
            { icon: FileText, text: "Starter templates added", color: "text-primary" },
            { icon: Users, text: "Team invitations available in settings", color: "text-primary" },
            { icon: Zap, text: "Ready to create your first invoice or proposal", color: "text-primary" },
          ].map(({ icon: Icon, text, color }, i) => (
            <motion.div
              key={text}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.07, duration: 0.25 }}
            >
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <span className="text-sm text-muted-foreground">{text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.35 }}
      >
        <Button
          onClick={onComplete}
          size="lg"
          className="rounded-xl px-8 gap-2 text-base"
        >
          Enter workspace
          <ArrowRight className="w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
