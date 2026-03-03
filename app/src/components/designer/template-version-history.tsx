import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { History, Eye, RotateCcw, Loader2, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TemplateVersion, Template } from "@/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { TemplatePreview } from "@/components/templates/template-preview";
import { useUser } from "@clerk/clerk-react";

interface TemplateVersionHistoryProps {
  templateId: string | undefined;
  versions: TemplateVersion[];
  currentVersion: number | null;
  onRestoreVersion: (version: number) => Promise<void>;
  isRestoring: boolean;
  currentUserId?: string;
}

export function TemplateVersionHistory({
  versions,
  currentVersion,
  onRestoreVersion,
  isRestoring,
  currentUserId,
}: TemplateVersionHistoryProps) {
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormatting();
  const { user: clerkUser } = useUser();
  const [previewingVersion, setPreviewingVersion] = useState<TemplateVersion | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<number | null>(null);

  // Helper to get user name - for now, just show the userId or "Unknown"
  // In the future, this could fetch user info from Firestore
  const getUserName = (userId: string | undefined): string | undefined => {
    if (!userId) return undefined;
    // If it's the current user, use Clerk info
    if (clerkUser && userId === clerkUser.id) {
      return clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] || t('designer.versionHistory.you');
    }
    // For other users, we'd need to fetch from Firestore
    // For now, return undefined to show just the user icon
    return undefined;
  };

  const handleRestoreClick = (version: number) => {
    setVersionToRestore(version);
    setRestoreConfirmOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (versionToRestore === null) return;
    await onRestoreVersion(versionToRestore);
    setRestoreConfirmOpen(false);
    setVersionToRestore(null);
  };

  const sortedVersions = [...versions].sort((a, b) => {
    // Sort by version number descending
    if (b.version !== a.version) {
      return b.version - a.version;
    }
    // If versions are equal, sort by createdAt descending
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const dedupedVersions = sortedVersions.filter(
    (version, index, all) =>
      index === all.findIndex((candidate) => candidate.version === version.version)
  );

  if (versions.length === 0) {
    return (
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-foreground">
            <History className="h-4 w-4" />
            {t('designer.versionHistory.title')}
          </Label>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('designer.versionHistory.noVersions')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-foreground">
            <History className="h-4 w-4" />
            {t('designer.versionHistory.title')}
          </Label>
          {currentVersion && (
            <span className="text-xs text-muted-foreground">
              {t('designer.versionHistory.current')}: v{currentVersion}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {dedupedVersions.map((version) => {
            const isCurrent = version.version === currentVersion;
            const isCreatedByCurrentUser = version.createdBy === currentUserId;

            return (
              <div
                key={version.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{t('designer.versionHistory.version', { number: version.version })}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded shrink-0">
                        {t('designer.versionHistory.current')}
                      </span>
                    )}
                  </div>
                  {version.description && (
                    <p className="text-xs text-muted-foreground mt-1 wrap-break-word">{version.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {version.createdAt
                        ? formatDateTime(version.createdAt)
                        : t('designer.versionHistory.unknownDate')}
                    </p>
                    {version.createdBy && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {isCreatedByCurrentUser ? t('designer.versionHistory.you') : (getUserName(version.createdBy) || t('designer.versionHistory.unknownUser'))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewingVersion(version)}
                    className="h-8 text-foreground"
                    title={t('designer.versionHistory.previewButton')}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {t('designer.versionHistory.templatePreview')}
                  </Button>
                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreClick(version.version)}
                      disabled={isRestoring}
                      className="h-8"
                    >
                      {isRestoring ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1" />
                          {t('designer.versionHistory.restore')}
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

      {/* Preview Dialog */}
      {previewingVersion && (
        <Dialog open={!!previewingVersion} onOpenChange={() => setPreviewingVersion(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('designer.versionHistory.previewTitle', { number: previewingVersion.version })}</DialogTitle>
              <DialogDescription>
                {previewingVersion.description || t('designer.versionHistory.templatePreview')}
                {previewingVersion.createdAt && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    {t('designer.versionHistory.created', { date: formatDateTime(previewingVersion.createdAt) })}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <TemplatePreview
                template={{
                  id: previewingVersion.id,
                  ...previewingVersion.data,
                } as Template}
                context={{}}
                zoom={0.8}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('designer.versionHistory.restoreTitle', { number: versionToRestore || 0 })}</DialogTitle>
            <DialogDescription>
              {t('designer.versionHistory.restoreWarning', { version: versionToRestore || 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRestoreConfirmOpen(false);
                setVersionToRestore(null);
              }}
            >
              {t('designer.aiBuilder.cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('designer.versionHistory.restoring')}
                </>
              ) : (
                t('designer.versionHistory.restoreVersion')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
