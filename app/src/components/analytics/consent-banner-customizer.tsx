import { useState } from "react";
import { Palette, Sparkles, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConsentBannerStyling } from "@/core/entities/analytics-config";
import { useGenerateConsentBanner } from "@/hooks/service-hooks/use-generate-consent-banner";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { toast } from "sonner";

interface ConsentBannerCustomizerProps {
  styling: ConsentBannerStyling;
  onStylingChange: (styling: ConsentBannerStyling) => void;
}

export function ConsentBannerCustomizer({
  styling,
  onStylingChange,
}: ConsentBannerCustomizerProps) {
  const { t } = useTranslation();
  const { data: organization } = useCurrentOrganization();
  const generateConsentBanner = useGenerateConsentBanner();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional" | "bold" | "elegant">("modern");
  const [aiContext, setAiContext] = useState("");

  const updateStyling = (updates: Partial<ConsentBannerStyling>) => {
    onStylingChange({ ...styling, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('analytics.consentBanner.title')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('analytics.consentBanner.description')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAiDialogOpen(true)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {t('analytics.consentBanner.generateWithAI')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Colors Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{t('analytics.consentBanner.colors')}</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorPicker
                label={t('analytics.consentBanner.backgroundColor')}
                value={styling.backgroundColor}
                onChange={(color) => updateStyling({ backgroundColor: color })}
              />
              <ColorPicker
                label={t('analytics.consentBanner.textColor')}
                value={styling.textColor}
                onChange={(color) => updateStyling({ textColor: color })}
              />
              <ColorPicker
                label={t('analytics.consentBanner.buttonBackground')}
                value={styling.buttonBackgroundColor}
                onChange={(color) => updateStyling({ buttonBackgroundColor: color })}
              />
              <ColorPicker
                label={t('analytics.consentBanner.buttonTextColor')}
                value={styling.buttonTextColor}
                onChange={(color) => updateStyling({ buttonTextColor: color })}
              />
              <ColorPicker
                label={t('analytics.consentBanner.linkColor')}
                value={styling.linkColor}
                onChange={(color) => updateStyling({ linkColor: color })}
              />
              <ColorPicker
                label={t('analytics.consentBanner.borderColor')}
                value={styling.borderColor}
                onChange={(color) => updateStyling({ borderColor: color })}
              />
            </div>
          </div>

          <Separator />

          {/* Typography Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('analytics.consentBanner.typography')}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.fontFamily')}</Label>
                <Input
                  value={styling.fontFamily}
                  onChange={(e) => updateStyling({ fontFamily: e.target.value })}
                  placeholder={t('analytics.consentBanner.fontFamilyPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.fontSize')}</Label>
                <Input
                  value={styling.fontSize}
                  onChange={(e) => updateStyling({ fontSize: e.target.value })}
                  placeholder={t('analytics.consentBanner.fontSizePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.fontWeight')}</Label>
                <Select
                  value={styling.fontWeight}
                  onValueChange={(value) => updateStyling({ fontWeight: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">{t('analytics.consentBanner.fontWeightLight')}</SelectItem>
                    <SelectItem value="400">{t('analytics.consentBanner.fontWeightNormal')}</SelectItem>
                    <SelectItem value="500">{t('analytics.consentBanner.fontWeightMedium')}</SelectItem>
                    <SelectItem value="600">{t('analytics.consentBanner.fontWeightSemiBold')}</SelectItem>
                    <SelectItem value="700">{t('analytics.consentBanner.fontWeightBold')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Layout Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('analytics.consentBanner.layout')}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.position')}</Label>
                <Select
                  value={styling.position}
                  onValueChange={(value: "bottom" | "top" | "center") =>
                    updateStyling({ position: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom">{t('analytics.consentBanner.positionBottom')}</SelectItem>
                    <SelectItem value="top">{t('analytics.consentBanner.positionTop')}</SelectItem>
                    <SelectItem value="center">{t('analytics.consentBanner.positionCenter')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.maxWidth')}</Label>
                <Input
                  value={styling.maxWidth}
                  onChange={(e) => updateStyling({ maxWidth: e.target.value })}
                  placeholder={t('analytics.consentBanner.maxWidthPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.padding')}</Label>
                <Input
                  value={styling.padding}
                  onChange={(e) => updateStyling({ padding: e.target.value })}
                  placeholder={t('analytics.consentBanner.paddingPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.borderRadius')}</Label>
                <Input
                  value={styling.borderRadius}
                  onChange={(e) => updateStyling({ borderRadius: e.target.value })}
                  placeholder={t('analytics.consentBanner.borderRadiusPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.shadow')}</Label>
                <Input
                  value={styling.shadow}
                  onChange={(e) => updateStyling({ shadow: e.target.value })}
                  placeholder={t('analytics.consentBanner.shadowPlaceholder')}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Content Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('analytics.consentBanner.content')}</Label>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('analytics.consentBanner.message')}</Label>
                <Textarea
                  value={styling.message}
                  onChange={(e) => updateStyling({ message: e.target.value })}
                  placeholder={t('analytics.consentBanner.messagePlaceholder')}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('analytics.consentBanner.acceptButtonText')}</Label>
                  <Input
                    value={styling.acceptButtonText}
                    onChange={(e) => updateStyling({ acceptButtonText: e.target.value })}
                    placeholder={t('analytics.consentBanner.acceptButtonTextPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('analytics.consentBanner.rejectButtonText')}</Label>
                  <Input
                    value={styling.rejectButtonText}
                    onChange={(e) => updateStyling({ rejectButtonText: e.target.value })}
                    placeholder={t('analytics.consentBanner.rejectButtonTextPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('analytics.consentBanner.showRejectButton')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.consentBanner.showRejectButtonDescription')}
                  </p>
                </div>
                <Switch
                  checked={styling.showRejectButton}
                  onCheckedChange={(checked) => updateStyling({ showRejectButton: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('analytics.consentBanner.aiDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('analytics.consentBanner.aiDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('analytics.consentBanner.aiDialog.style')}</Label>
              <Select value={aiStyle} onValueChange={(value: typeof aiStyle) => setAiStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">{t('analytics.consentBanner.aiDialog.styleModern')}</SelectItem>
                  <SelectItem value="classic">{t('analytics.consentBanner.aiDialog.styleClassic')}</SelectItem>
                  <SelectItem value="minimal">{t('analytics.consentBanner.aiDialog.styleMinimal')}</SelectItem>
                  <SelectItem value="professional">{t('analytics.consentBanner.aiDialog.styleProfessional')}</SelectItem>
                  <SelectItem value="bold">{t('analytics.consentBanner.aiDialog.styleBold')}</SelectItem>
                  <SelectItem value="elegant">{t('analytics.consentBanner.aiDialog.styleElegant')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('analytics.consentBanner.aiDialog.additionalContext')}</Label>
              <Textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder={t('analytics.consentBanner.aiDialog.additionalContextPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiDialogOpen(false)}
            >
              {t('analytics.consentBanner.aiDialog.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!organization?.id) {
                  toast.error(t('analytics.consentBanner.toasts.organizationNotFound'));
                  return;
                }

                try {
                  const result = await generateConsentBanner.mutateAsync({
                    organizationId: organization.id,
                    options: {
                      style: aiStyle,
                      context: aiContext || undefined,
                      existingStyling: styling,
                    },
                  });

                  onStylingChange(result.styling);
                  toast.success(t('analytics.consentBanner.toasts.generatedSuccessfully'));
                  setAiDialogOpen(false);
                  setAiContext("");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(t('analytics.consentBanner.toasts.generationFailed', { message }));
                }
              }}
              disabled={generateConsentBanner.isPending || !organization?.id}
            >
              {generateConsentBanner.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('analytics.consentBanner.aiDialog.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('analytics.consentBanner.aiDialog.generateBanner')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

