import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sanitizeTranslationHtml } from "@/utils/html-sanitizer";

interface SuccessStepProps {
  orgName: string;
  onComplete: () => void;
}

export function SuccessStep({ orgName, onComplete }: SuccessStepProps) {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardContent className="text-center space-y-6 py-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center"
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-card-foreground break-words px-2">{t("onboarding.success.title")}</h2>
            {/* HTML is sanitized before rendering to prevent XSS */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto break-words px-2" dangerouslySetInnerHTML={{ __html: sanitizeTranslationHtml(t("onboarding.success.description", { orgName })) }} />
          </div>

          <div className="grid gap-3 max-w-md mx-auto text-left">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("onboarding.success.orgCreated")}</p>
                <p className="text-sm text-muted-foreground">{t("onboarding.success.orgCreatedDesc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("onboarding.success.readyToCreate")}</p>
                <p className="text-sm text-muted-foreground">{t("onboarding.success.readyToCreateDesc")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{t("onboarding.success.inviteTeam")}</p>
                <p className="text-sm text-muted-foreground">{t("onboarding.success.inviteTeamDesc")}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={onComplete}
            size="lg"
            className="bg-[#166534] hover:bg-[#0e4424] text-white px-12 rounded-xl mt-4 hidden md:flex mx-auto"
          >
            {t("onboarding.success.goToDashboard")}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
