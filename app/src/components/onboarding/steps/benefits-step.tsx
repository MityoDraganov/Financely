import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Target, Workflow, FileText, Shield, CheckCircle2, Users, ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BenefitsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function BenefitsStep({ onNext, onBack }: BenefitsStepProps) {
  const { t } = useTranslation();
  
  const benefits = [
    {
      icon: Bot,
      title: t("onboarding.benefits.aiAutomation.title"),
      description: t("onboarding.benefits.aiAutomation.description"),
      highlight: t("onboarding.benefits.aiAutomation.highlight"),
    },
    {
      icon: Target,
      title: t("onboarding.benefits.revenueCycle.title"),
      description: t("onboarding.benefits.revenueCycle.description"),
      highlight: t("onboarding.benefits.revenueCycle.highlight"),
    },
    {
      icon: Workflow,
      title: t("onboarding.benefits.workflows.title"),
      description: t("onboarding.benefits.workflows.description"),
      highlight: t("onboarding.benefits.workflows.highlight"),
    },
    {
      icon: FileText,
      title: t("onboarding.benefits.invoices.title"),
      description: t("onboarding.benefits.invoices.description"),
      highlight: t("onboarding.benefits.invoices.highlight"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center pb-5">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground break-words px-2">
            {t("onboarding.benefits.title")}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-muted-foreground break-words px-2 mt-2">
            {t("onboarding.benefits.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.2 }}
                className="group p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-foreground text-sm leading-tight">{benefit.title}</h3>
                      {benefit.highlight && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full whitespace-nowrap shrink-0">
                          {benefit.highlight}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">{t("onboarding.benefits.bankGrade")}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">{t("onboarding.benefits.gdprCompliant")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">{t("onboarding.benefits.teamReady")}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2 hidden md:flex">
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              {t("onboarding.buttons.back")}
            </Button>
            <Button
              onClick={onNext}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
            >
              {t("onboarding.benefits.createWorkspace")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
