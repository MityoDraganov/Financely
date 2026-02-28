import { Trash2, Download, Image as ImageIcon, Video, File } from "lucide-react";
import { getBlob, ref } from "@firebase/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { File as FileType } from "@/core";
import { toast } from "sonner";
import { firebase } from "@/infrastructure";

interface FileCardProps {
  file: FileType;
  onDelete: (id: string) => void;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case "IMAGE":
      return ImageIcon;
    case "VIDEO":
    case "EXTERNAL_VIDEO":
      return Video;
    default:
      return File;
  }
}

export function FileCard({ file, onDelete }: FileCardProps) {
  const FileIcon = getFileIcon(file.fileType);
  const downloadFilename = file.originalFilename || file.filename || "file";
  const storagePath =
    typeof file.metadata?.storagePath === "string" ? file.metadata.storagePath : null;

  const handleDownload = async () => {
    if (!file.url) return;

    try {
      const fileRef = storagePath
        ? ref(firebase.storage, storagePath)
        : ref(firebase.storage, file.url);
      const blob = await getBlob(fileRef);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handleDeleteClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete(file.id);
  };

  return (
    <Card className="overflow-hidden pt-0 rounded-sm">
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
                <Button variant="ghost" size="icon" type="button" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={handleDeleteClick}
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
}
