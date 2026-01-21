import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Zap, Shield, Users, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface WelcomeStepProps {
  userName: string;
  onNext: () => void;
}

export function WelcomeStep({ userName, onNext }: WelcomeStepProps) {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center space-y-4 pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto w-14 h-14 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-[#166534] to-[#0e4424] flex items-center justify-center"
          >
            <Sparkles className="w-full h-full text-white p-3 lg:p-5" />
          </motion.div>
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-card-foreground break-words px-2">
            {t("onboarding.welcome.title", { name: userName })}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto break-words px-2">
            {t("onboarding.welcome.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center space-y-2 p-4 rounded-lg bg-muted">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{t("onboarding.welcome.lightningFast")}</h3>
              <p className="text-sm text-muted-foreground">{t("onboarding.welcome.lightningFastDesc")}</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-lg bg-muted">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{t("onboarding.welcome.secureCompliant")}</h3>
              <p className="text-sm text-muted-foreground">{t("onboarding.welcome.secureCompliantDesc")}</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-lg bg-muted">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{t("onboarding.welcome.teamCollaboration")}</h3>
              <p className="text-sm text-muted-foreground">{t("onboarding.welcome.teamCollaborationDesc")}</p>
            </div>
          </div>

          <div className="flex justify-center pt-4 hidden md:flex">
            <Button
              onClick={onNext}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
            >
              {t("onboarding.welcome.getStarted")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
