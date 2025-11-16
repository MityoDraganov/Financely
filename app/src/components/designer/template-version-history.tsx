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
      return clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] || "You";
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

  if (versions.length === 0) {
    return (
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </Label>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          No versions saved yet. Versions are automatically created when you make changes.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Version History
          </Label>
          {currentVersion && (
            <span className="text-xs text-gray-500">
              Current: v{currentVersion}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Versions are automatically created when you make changes.
        </p>
        <div className="space-y-2">
          {sortedVersions.map((version) => {
            const isCurrent = version.version === currentVersion;
            const isCreatedByCurrentUser = version.createdBy === currentUserId;

            return (
              <div
                key={version.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Version {version.version}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  {version.description && (
                    <p className="text-xs text-gray-500 mt-1 wrap-break-word">{version.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-gray-400">
                      {version.createdAt
                        ? new Date(version.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Unknown date"}
                    </p>
                    {version.createdBy && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {isCreatedByCurrentUser ? "You" : (getUserName(version.createdBy) || "Unknown user")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewingVersion(version)}
                    className="h-8"
                    title="Preview this version"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
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
                          Restore
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
              <DialogTitle>Preview Version {previewingVersion.version}</DialogTitle>
              <DialogDescription>
                {previewingVersion.description || "Template preview"}
                {previewingVersion.createdAt && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Created: {new Date(previewingVersion.createdAt).toLocaleString()}
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
            <DialogTitle>Restore Version {versionToRestore}?</DialogTitle>
            <DialogDescription>
              This will replace your current template with version {versionToRestore}. Your current
              changes will be automatically saved as a new version before restoring, so you can
              always revert back if needed.
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
              Cancel
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
                  Restoring...
                </>
              ) : (
                "Restore Version"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

