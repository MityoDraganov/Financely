import { useState, useMemo } from "react";
import { Search, FileText, ImageIcon, Video, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiles, useDeleteFile } from "@/hooks/repository-hooks/use-files";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { toast } from "sonner";
import { FileCard } from "@/components/content/file-card";

const FILE_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Videos" },
  { value: "GENERIC", label: "Generic" },
];

export default function FilesPage() {
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  const { data: files = [], isLoading, error } = useFiles(currentOrganization?.id, {
    fileType: fileTypeFilter !== "all" ? fileTypeFilter : undefined,
  });
  if (error) {
    console.error(error);
  }
  const deleteFile = useDeleteFile();

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteFile.mutateAsync(id);
      toast.success("File deleted successfully");
    } catch {
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls row */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search files…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
          <SelectTrigger className="w-[130px] sm:w-[150px] h-8 text-sm">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isLoading && (
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums hidden sm:block">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

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
              {searchTerm || fileTypeFilter !== "all" ? "No files found" : "No files uploaded yet"}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {searchTerm || fileTypeFilter !== "all"
                ? "Try adjusting your search or filter"
                : "Uploaded files will appear here"}
            </p>
          </div>
        </div>
      ) : (
        /* File grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
