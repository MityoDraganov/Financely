import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface WidgetEnableToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function WidgetEnableToggle({ enabled, onToggle }: WidgetEnableToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <Label className="text-base font-semibold">{t('siteBuilder.widgets.widgetEnableToggle.title')}</Label>
        <p className="text-sm text-gray-500 mt-1">
          {t('siteBuilder.widgets.widgetEnableToggle.description')}
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
