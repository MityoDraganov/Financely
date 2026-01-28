import { useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFiles, useDeleteFile } from "@/hooks/repository-hooks/use-files";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { toast } from "sonner";
import { FileCard } from "@/components/content/file-card";

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
      if (fileTypeFilter !== "all" && file.fileType !== fileTypeFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const filename = (file.filename || "").toLowerCase();
        return filename.includes(searchLower);
      }

      return true;
    });
  }, [files, fileTypeFilter, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      await deleteFile.mutateAsync(id);
      toast.success("File deleted successfully");
    } catch {
      toast.error("Failed to delete file");
    }
  };


  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="IMAGE">Images</SelectItem>
            <SelectItem value="VIDEO">Videos</SelectItem>
            <SelectItem value="GENERIC">Generic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No files found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 gap-4">
          {filteredFiles.map((file) => (
            <FileCard key={file.id} file={file} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
