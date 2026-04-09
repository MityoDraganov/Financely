import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Users, Layers, X, CheckCircle2, ArrowRight } from "lucide-react";

interface ActivationTask {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  isDone: boolean;
}

interface ActivationGuideProps {
  orgId: string;
  invoiceCount: number;
  templateCount: number;
  contactCount: number;
}

const DISMISSED_KEY = "financely_activation_dismissed";

function getDismissedOrgs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismissOrg(orgId: string) {
  const dismissed = getDismissedOrgs();
  if (!dismissed.includes(orgId)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, orgId]));
  }
}

export function ActivationGuide({
  orgId,
  invoiceCount,
  templateCount,
  contactCount,
}: ActivationGuideProps) {
  const [dismissed, setDismissed] = useState(() => getDismissedOrgs().includes(orgId));

  const tasks: ActivationTask[] = [
    {
      id: "templates",
      icon: Layers,
      title: "View your starter templates",
      description: "Your workspace has templates ready to use",
      href: "/templates",
      isDone: templateCount > 0,
    },
    {
      id: "contact",
      icon: Users,
      title: "Add your first client",
      description: "Store client details to use on documents",
      href: "/contacts?action=create",
      isDone: contactCount > 0,
    },
    {
      id: "invoice",
      icon: FileText,
      title: "Create your first invoice",
      description: "Send a professional invoice in minutes",
      href: "/cases",
      isDone: invoiceCount > 0,
    },
  ];

  const completedCount = tasks.filter((t) => t.isDone).length;
  const allDone = completedCount === tasks.length;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    dismissOrg(orgId);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Get started with Financely</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completedCount} of {tasks.length} steps done
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 w-6 h-6 rounded-md text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Task cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tasks.map((task) => {
            const Icon = task.icon;
            if (task.isDone) {
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border opacity-60"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground line-through">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">Done</p>
                  </div>
                </div>
              );
            }
            return (
              <Link key={task.id} to={task.href} className="block group">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/40 hover:bg-primary/5 transition-all h-full">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
