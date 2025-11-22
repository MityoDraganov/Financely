import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface EmbedScriptSectionProps {
  script: string;
  copied: boolean;
  onCopy: () => void;
}

export function EmbedScriptSection({ script, copied, onCopy }: EmbedScriptSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{t('siteBuilder.widgets.embedScript.title')}</Label>
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              {t('siteBuilder.widgets.embedScript.copied')}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              {t('siteBuilder.widgets.embedScript.copyScript')}
            </>
          )}
        </Button>
      </div>
      <p className="text-sm text-gray-600">
        {t('siteBuilder.widgets.embedScript.description')}
      </p>
      <div className="relative">
        <Textarea
          value={script}
          readOnly
          className="font-mono text-xs bg-white"
          rows={3}
        />
      </div>
      <p className="text-xs text-gray-500">
        {t('siteBuilder.widgets.embedScript.hint')}
      </p>
    </div>
  );
}
