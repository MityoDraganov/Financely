import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, SkipForward, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ColorPicker } from "@/components/ui/color-picker";
import { sanitizeTranslationHtml } from "@/utils/html-sanitizer";

interface BrandingData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface BrandingStepProps {
  brandingData: BrandingData;
  setBrandingData: (data: Partial<BrandingData>) => void;
  setStoreBrandingData?: (data: Partial<BrandingData>) => void;
  onSkip: () => void;
  onSave: () => void;
  isLoading?: boolean;
}

export function BrandingStep({
  brandingData,
  setBrandingData,
  setStoreBrandingData,
  onSkip,
  onSave,
  isLoading = false,
}: BrandingStepProps) {
  const { t } = useTranslation();

  const handleColorChange = (field: keyof BrandingData, color: string) => {
    const newData = { [field]: color };
    setBrandingData(newData);
    if (setStoreBrandingData) {
      setStoreBrandingData(newData);
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
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Palette className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4 break-words px-2">
            {t("onboarding.branding.title")}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg text-muted-foreground break-words px-2">
            {t("onboarding.branding.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("onboarding.branding.primaryColor")}</Label>
                <ColorPicker
                  label=""
                  value={brandingData.primaryColor}
                  onChange={(color) => handleColorChange("primaryColor", color)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("onboarding.branding.secondaryColor")}</Label>
                <ColorPicker
                  label=""
                  value={brandingData.secondaryColor}
                  onChange={(color) => handleColorChange("secondaryColor", color)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("onboarding.branding.accentColor")}</Label>
                <ColorPicker
                  label=""
                  value={brandingData.accentColor}
                  onChange={(color) => handleColorChange("accentColor", color)}
                />
              </div>
            </div>

            <div className="bg-accent rounded-lg p-4">
              {/* HTML is sanitized before rendering to prevent XSS */}
              <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeTranslationHtml(t("onboarding.branding.tip")) }} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 hidden md:flex">
            <Button
              onClick={onSkip}
              variant="outline"
              size="lg"
              className="rounded-xl"
            >
              <SkipForward className="mr-2 w-5 h-5" />
              {t("onboarding.buttons.skip")}
            </Button>
            <Button
              onClick={onSave}
              size="lg"
              className="bg-[#166534] hover:bg-[#0e4424] text-white px-8 rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  {t("onboarding.branding.saving")}
                </>
              ) : (
                <>
                  {t("onboarding.branding.saveContinue")}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
