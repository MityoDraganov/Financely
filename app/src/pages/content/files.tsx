import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, FileText, Plus, Trash2, Download, Image as ImageIcon, Video, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFiles, useDeleteFile } from "@/hooks/repository-hooks/use-files";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { toast } from "sonner";

export default function FilesPage() {
  const { t } = useTranslation();
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
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "IMAGE":
        return ImageIcon;
      case "VIDEO":
      case "EXTERNAL_VIDEO":
        return Video;
      default:
        return File;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const FileIcon = getFileIcon(file.fileType);
            return (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {file.fileType === "IMAGE" && file.url ? (
                    <div className="aspect-square bg-muted relative">
                      <img
                        src={file.url}
                        alt={file.alt || file.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <FileIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm truncate flex-1" title={file.filename}>
                        {file.filename}
                      </h3>
                      <div className="flex space-x-1 ml-2">
                        {file.url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {file.fileSize && (
                      <p className="text-xs text-muted-foreground">
                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                    {file.fileStatus && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {file.fileStatus}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
