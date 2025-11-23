import { History, Eye, ExternalLink, RotateCcw, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/utils/date-formatting";

interface BrandSiteVersion {
  version: number;
  description?: string;
  createdAt?: string;
  previewUrl?: string;
}

interface BrandSite {
  metadata?: { version?: number };
  deployedUrl?: string;
  versions?: BrandSiteVersion[];
}

interface SiteVersionHistoryProps {
  brandSite: BrandSite | null;
  currentVersion: number | null;
  previewingVersion: number | null;
  onPreviewVersion: (version: number) => Promise<void>;
  onRestoreVersion: (version: number) => void;
  isRestoring: boolean;
}

export function SiteVersionHistory({
  brandSite,
  currentVersion,
  previewingVersion,
  onPreviewVersion,
  onRestoreVersion,
  isRestoring,
}: SiteVersionHistoryProps) {
  const { t, i18n } = useTranslation();
  if (!brandSite) return null;

  const versions = brandSite.versions || [];
  const currentVersionNumber = currentVersion ?? brandSite.metadata?.version;

  if (versions.length === 0) {
    return (
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('siteBuilder.siteVersionHistory.title')}
          </Label>
          {currentVersionNumber && (
            <span className="text-xs text-gray-500">
              {t('siteBuilder.siteVersionHistory.current', { version: currentVersionNumber })}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          {t('siteBuilder.siteVersionHistory.noVersions')}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <History className="h-4 w-4" />
          {t('siteBuilder.siteVersionHistory.title')}
        </Label>
        {currentVersionNumber && (
          <span className="text-xs text-gray-500">
            {t('siteBuilder.siteVersionHistory.current', { version: currentVersionNumber })}
          </span>
        )}
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...versions]
          .sort((a, b) => b.version - a.version)
          .map((version) => {
            const isCurrent = version.version === currentVersionNumber;
            const isPreviewing = previewingVersion === version.version;

            return (
              <div
                key={version.version}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t('siteBuilder.siteVersionHistory.version', { number: version.version })}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        {t('siteBuilder.siteVersionHistory.currentBadge')}
                      </span>
                    )}
                  </div>
                  {version.description && (
                    <p className="text-xs text-gray-500 mt-1">{version.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {version.createdAt
                      ? formatDateTime(version.createdAt, i18n.language)
                      : t('siteBuilder.siteVersionHistory.unknownDate')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Preview button */}
                  {version.previewUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const previewWindow = window.open(version.previewUrl, "_blank");
                        if (!previewWindow) {
                          toast.error(t('siteBuilder.siteVersionHistory.popupBlocked'));
                        }
                      }}
                      className="h-8"
                      title={t('siteBuilder.siteVersionHistory.previewTitle')}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {t('siteBuilder.siteVersionHistory.preview')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await onPreviewVersion(version.version);
                        } catch (error) {
                          console.error("Failed to create preview:", error);
                        }
                      }}
                      disabled={isPreviewing}
                      className="h-8"
                      title={isPreviewing ? t('siteBuilder.siteVersionHistory.creatingPreviewTitle') : t('siteBuilder.siteVersionHistory.createPreviewTitle')}
                    >
                      {isPreviewing ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {t('siteBuilder.siteVersionHistory.creatingPreview')}
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          {t('siteBuilder.siteVersionHistory.preview')}
                        </>
                      )}
                    </Button>
                  )}
                  {/* Live URL button - only show if this is the current version */}
                  {isCurrent && brandSite.deployedUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(brandSite.deployedUrl, "_blank")}
                      className="h-8"
                      title={t('siteBuilder.siteVersionHistory.liveTitle')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t('siteBuilder.siteVersionHistory.live')}
                    </Button>
                  )}
                  {/* Restore button - only show for non-current versions */}
                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!confirm(t('siteBuilder.siteVersionHistory.restoreConfirm'))) {
                          return;
                        }
                        onRestoreVersion(version.version);
                      }}
                      disabled={isRestoring}
                      className="h-8"
                    >
                      {isRestoring ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1" />
                          {t('siteBuilder.siteVersionHistory.restore')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

