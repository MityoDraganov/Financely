import { History, Eye, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/utils/date-formatting";

interface WidgetVersion {
  version: number;
  widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
  widgets: Record<string, unknown>;
  createdAt: string;
  description?: string;
}

interface WidgetVersionHistoryProps {
  versions: WidgetVersion[];
  currentVersion: number | null;
  onPreviewVersion: (version: WidgetVersion) => void;
  onRestoreVersion: (version: number) => Promise<void>;
  isRestoring: boolean;
}

export function WidgetVersionHistory({
  versions,
  currentVersion,
  onPreviewVersion,
  onRestoreVersion,
  isRestoring,
}: WidgetVersionHistoryProps) {
  const { t, i18n } = useTranslation();
  if (versions.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" />
          {t('siteBuilder.widgets.widgetVersionHistory.title')}
        </Label>
        {currentVersion && (
          <span className="text-xs text-muted-foreground">
            {t('siteBuilder.widgets.widgetVersionHistory.current', { version: currentVersion })}
          </span>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...versions]
          .sort((a, b) => b.version - a.version)
          .map((version) => (
            <div
              key={version.version}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t('siteBuilder.widgets.widgetVersionHistory.version', { number: version.version })}</span>
                  {version.version === currentVersion && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      {t('siteBuilder.widgets.widgetVersionHistory.currentBadge')}
                    </span>
                  )}
                </div>
                {version.description && (
                  <p className="text-xs text-gray-500 mt-1">{version.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {version.createdAt
                    ? formatDateTime(version.createdAt, i18n.language)
                    : t('siteBuilder.widgets.widgetVersionHistory.unknownDate')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreviewVersion(version)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {t('siteBuilder.widgets.widgetVersionHistory.preview')}
                </Button>
                {version.version !== currentVersion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestoreVersion(version.version)}
                    disabled={isRestoring}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('siteBuilder.widgets.widgetVersionHistory.restore')}
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
