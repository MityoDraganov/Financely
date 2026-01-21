import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { sanitizeTranslationHtml } from "@/utils/html-sanitizer";

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface InviteStepProps {
  onSkip: () => void;
  onInvite: () => void;
  onContinue: () => void;
  onBack: () => void;
  invites: Invite[];
  hasAdditionalUsers: boolean;
}

export function InviteStep({
  onSkip,
  onInvite,
  onContinue,
  onBack,
  invites,
  hasAdditionalUsers,
}: InviteStepProps) {
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
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4 break-words px-2">
            {t("onboarding.invites.title")}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground break-words px-2">
            {t("onboarding.invites.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="text-center space-y-4">
              <div className="p-8 border-2 border-dashed border-border rounded-lg bg-muted">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("onboarding.invites.readyToInvite")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("onboarding.invites.inviteDescription")}
                </p>
                <Button
                  onClick={onInvite}
                  size="lg"
                  className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl mt-4"
                >
                  <Users className="mr-2 w-5 h-5" />
                  {t("onboarding.invites.inviteButton")}
                </Button>
              </div>
            </div>

            {invites.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground">{t("onboarding.invites.invitedMembers")}</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {invite.status === "sent" ? t("onboarding.invites.invitationSent") : t("onboarding.invites.pending")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {invite.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-accent rounded-lg p-4">
              {/* HTML is sanitized before rendering to prevent XSS */}
              <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeTranslationHtml(t("onboarding.invites.tip")) }} />
            </div>
          </div>

          <div className={`flex flex-col sm:flex-row ${hasAdditionalUsers ? 'justify-between' : 'justify-between'} gap-4 pt-4 hidden md:flex`}>
            <Button
              onClick={onBack}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              <ArrowLeft className="mr-2 w-5 h-5" />
              {t("onboarding.buttons.back")}
            </Button>
            {!hasAdditionalUsers && (
              <Button
                onClick={onSkip}
                variant="outline"
                size="lg"
                className="rounded-xl"
              >
                <SkipForward className="mr-2 w-5 h-5" />
                {t("onboarding.buttons.skip")}
              </Button>
            )}
            {hasAdditionalUsers && (
              <Button
                onClick={onContinue}
                size="lg"
                className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
              >
                {t("onboarding.buttons.continue")}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
