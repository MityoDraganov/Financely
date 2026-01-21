import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ChoosePathStepProps {
  onCreate: () => void;
  onJoin: () => void;
}

export function ChoosePathStep({ onCreate, onJoin }: ChoosePathStepProps) {
  const { t } = useTranslation();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/20 bg-card/95 backdrop-blur-sm shadow-2xl overflow-visible min-w-0">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4 break-words">
            {t("onboarding.choosePath.title")}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground break-words">
            {t("onboarding.choosePath.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Create Organization Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={onCreate}
            >
              <Card className="border-2 border-transparent group-hover:border-primary/20 transition-all duration-200 h-full">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">{t("onboarding.choosePath.createOrg.title")}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t("onboarding.choosePath.createOrg.description")}
                  </p>
                  <Button className="w-full bg-[#166534] hover:bg-[#0e4424]">
                    {t("onboarding.choosePath.createOrg.button")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Join Organization Option */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer"
              onClick={onJoin}
            >
              <Card className="border-2 border-transparent group-hover:border-primary/20 transition-all duration-200 h-full">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">{t("onboarding.choosePath.joinOrg.title")}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t("onboarding.choosePath.joinOrg.description")}
                  </p>
                  <Button className="w-full bg-[#166534] hover:bg-[#0e4424]">
                    {t("onboarding.choosePath.joinOrg.button")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
