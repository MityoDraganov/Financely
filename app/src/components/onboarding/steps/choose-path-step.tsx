import { motion } from "framer-motion";
import { Building2, Users, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChoosePathStepProps {
  onCreate: () => void;
  onJoin: () => void;
}

export function ChoosePathStep({ onCreate, onJoin }: ChoosePathStepProps) {
  const [selected, setSelected] = useState<"create" | "join" | null>(null);

  const handleContinue = () => {
    if (selected === "create") onCreate();
    else if (selected === "join") onJoin();
  };

  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      <div className="space-y-2">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          How are you joining?
        </h2>
        <p className="text-muted-foreground text-base">
          Choose the option that fits your situation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            id: "create" as const,
            icon: Building2,
            title: "Create a new workspace",
            desc: "Set up Financely for your business. Configure your brand, templates, and preferences.",
            cta: "Start fresh",
          },
          {
            id: "join" as const,
            icon: Users,
            title: "Join an existing workspace",
            desc: "Someone shared an invite link or code with you. Enter it to join their workspace.",
            cta: "Enter invite code",
          },
        ].map(({ id, icon: Icon, title, desc, cta }) => (
          <motion.button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            className={cn(
              "relative text-left p-5 rounded-2xl border-2 transition-all duration-200",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              selected === id
                ? "border-primary bg-primary/5 shadow-lg"
                : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60"
            )}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {selected === id && (
              <motion.div
                className="absolute top-4 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            )}

            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
              {cta}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </motion.button>
        ))}
      </div>

      <div>
        <Button
          onClick={handleContinue}
          disabled={!selected}
          size="lg"
          className="rounded-xl px-8 gap-2 text-base"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
