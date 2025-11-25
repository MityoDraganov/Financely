import { EmailTemplateDesignTokens } from "@/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

type EmailTemplateSettingsProps = {
  name: string;
  designTokens: EmailTemplateDesignTokens;
  onChange: (updates: Partial<{
    name: string;
    designTokens: EmailTemplateDesignTokens;
  }>) => void;
};

export function EmailTemplateSettings({
  name,
  designTokens,
  onChange,
}: EmailTemplateSettingsProps) {
  const { t } = useTranslation();

  return (
    <Card className="border border-border/60 bg-background/80">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t("emailDesigner.settings.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="space-y-2">
          <Label>{t("emailDesigner.settings.name")}</Label>
          <Input value={name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
          <p className="font-medium mb-1">{t("emailDesigner.settings.subject")} & {t("emailDesigner.settings.preheader")}</p>
          <p className="text-xs">Add Subject and Preheader blocks from the blocks palette to edit them.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("emailDesigner.settings.background")}</Label>
            <Input
              type="color"
              value={designTokens.background}
              onChange={(e) =>
                onChange({
                  designTokens: { ...designTokens, background: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("emailDesigner.settings.surface")}</Label>
            <Input
              type="color"
              value={designTokens.surface}
              onChange={(e) =>
                onChange({
                  designTokens: { ...designTokens, surface: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("emailDesigner.settings.primaryColor")}</Label>
            <Input
              type="color"
              value={designTokens.primary}
              onChange={(e) =>
                onChange({
                  designTokens: { ...designTokens, primary: e.target.value },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("emailDesigner.settings.textColor")}</Label>
            <Input
              type="color"
              value={designTokens.text}
              onChange={(e) =>
                onChange({
                  designTokens: { ...designTokens, text: e.target.value },
                })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("emailDesigner.settings.fontFamily")}</Label>
          <Input
            value={designTokens.fontFamily}
            onChange={(e) =>
              onChange({
                designTokens: { ...designTokens, fontFamily: e.target.value },
              })
            }
          />
        </div>
        <Separator />
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
          <p className="font-medium mb-1">{t("emailDesigner.settings.subject")} & {t("emailDesigner.settings.preheader")}</p>
          <p className="text-xs">Add Subject and Preheader blocks from the blocks palette to edit them.</p>
        </div>
      </CardContent>
    </Card>
  );
}


