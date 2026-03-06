import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationStorageFiles, useDeleteOrganizationStorageFile } from "@/hooks/repository-hooks/use-files";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { toast } from "sonner";
import { FileCard } from "@/components/content/file-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FilesPage() {
  const { t } = useTranslation();
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [pendingDeleteFileId, setPendingDeleteFileId] = useState<string | null>(null);
  const fileTypeOptions = [
    { value: "all", label: t("contentPages.files.filters.allTypes", "All types") },
    { value: "IMAGE", label: t("contentPages.files.filters.images", "Images") },
    { value: "VIDEO", label: t("contentPages.files.filters.videos", "Videos") },
    { value: "GENERIC", label: t("contentPages.files.filters.generic", "Generic") },
  ];

  const { data: files = [], isLoading, error } = useOrganizationStorageFiles(currentOrganization?.id);
  if (error) {
    console.error(error);
  }
  const deleteFile = useDeleteOrganizationStorageFile();

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      if (fileTypeFilter !== "all" && file.fileType !== fileTypeFilter) return false;
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const filename = (file.filename || "").toLowerCase();
        return filename.includes(searchLower);
      }
      return true;
    });
  }, [files, fileTypeFilter, searchTerm]);

  const pendingDeleteFile = useMemo(
    () => files.find((file) => file.id === pendingDeleteFileId),
    [files, pendingDeleteFileId],
  );

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteFileId(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteFileId) return;

    try {
      await deleteFile.mutateAsync(pendingDeleteFileId);
      toast.success(t("contentPages.files.toasts.deleteSuccess", "File deleted successfully"));
      setPendingDeleteFileId(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("contentPages.files.toasts.deleteFailed", "Failed to delete file");
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls row */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("contentPages.files.searchPlaceholder", "Search files…")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
          <SelectTrigger className="w-[130px] sm:w-[150px] h-8 text-sm">
            <SelectValue placeholder={t("contentPages.files.filters.filterByType", "Filter by type")} />
          </SelectTrigger>
          <SelectContent>
            {fileTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isLoading && (
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums hidden sm:block">
            {filteredFiles.length === 1
              ? t("contentPages.files.count.fileSingular", "{{count}} file", { count: filteredFiles.length })
              : t("contentPages.files.count.filePlural", "{{count}} files", { count: filteredFiles.length })}
          </span>
        )}
      </div>

      <AlertDialog
        open={!!pendingDeleteFileId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFileId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contentPages.files.deleteDialog.title", "Delete file?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteFile
                ? t(
                    "contentPages.files.deleteDialog.descriptionWithFilename",
                    'This will permanently delete "{{filename}}" from storage.',
                    { filename: pendingDeleteFile.filename },
                  )
                : t(
                    "contentPages.files.deleteDialog.descriptionWithoutFilename",
                    "This will permanently delete this file from storage.",
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFile.isPending}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteFile.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFile.isPending
                ? t("contentPages.files.deleteDialog.deleting", "Deleting...")
                : t("contentPages.files.deleteDialog.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-2.5 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-14 sm:py-20 text-center px-6">
            <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchTerm || fileTypeFilter !== "all"
                ? t("contentPages.files.empty.noFilesFound", "No files found")
                : t("contentPages.files.empty.noFilesUploaded", "No files uploaded yet")}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {searchTerm || fileTypeFilter !== "all"
                ? t("contentPages.files.empty.adjustSearch", "Try adjusting your search or filter")
                : t("contentPages.files.empty.uploadedAppear", "Uploaded files will appear here")}
            </p>
          </div>
        </div>
      ) : (
        /* File grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} onDelete={handleDeleteRequest} />
          ))}
        </div>
      )}
    </div>
  );
}
