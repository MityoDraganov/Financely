import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface JoinOrgStepProps {
  inviteCode: string;
  setInviteCode: (code: string) => void;
  setStoreInviteCode?: (code: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function JoinOrgStep({
  inviteCode,
  setInviteCode,
  setStoreInviteCode,
  onBack,
  onSubmit,
  isLoading = false,
}: JoinOrgStepProps) {
  const { t } = useTranslation();

  const handleChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setInviteCode(upperValue);
    if (setStoreInviteCode) {
      setStoreInviteCode(upperValue);
    }
  };
  
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
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4 break-words">
            {t("onboarding.joinOrg.title")}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground break-words px-2">
            {t("onboarding.joinOrg.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 min-w-0">
          <div className="space-y-4">
            <div>
              <Label htmlFor="inviteCode" className="text-sm font-medium text-foreground">
                {t("onboarding.joinOrg.inviteCode")}
              </Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder={t("onboarding.joinOrg.inviteCodePlaceholder")}
                value={inviteCode}
                onChange={(e) => handleChange(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-between pt-6 hidden md:flex">
            <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("onboarding.buttons.back")}
            </Button>
            <Button
              onClick={onSubmit}
              disabled={isLoading || !inviteCode.trim()}
              className="flex items-center gap-2 bg-[#166534] hover:bg-[#0e4424]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("onboarding.joinOrg.joining")}
                </>
              ) : (
                <>
                  {t("onboarding.joinOrg.joinButton")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
