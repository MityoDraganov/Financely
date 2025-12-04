import { useCallback, useState } from "react";
import { useUploadInvoiceFile } from "@/hooks/service-hooks/use-invoice-extraction";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvoiceFileUploadProps {
  onUploadSuccess?: (jobId: string) => void;
  onUploadError?: (error: Error) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

export function InvoiceFileUpload({
  onUploadSuccess,
  onUploadError,
  maxSizeMB = 20,
  acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"],
}: InvoiceFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadMutation = useUploadInvoiceFile();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    []
  );

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      const error = new Error(
        `Invalid file type. Accepted types: ${acceptedTypes.join(", ")}`
      );
      onUploadError?.(error);
      return;
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const error = new Error(
        `File size exceeds ${maxSizeMB}MB limit`
      );
      onUploadError?.(error);
      return;
    }

    setSelectedFile(file);
  }, [acceptedTypes, maxSizeMB, onUploadError]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = useCallback(() => {
    if (!selectedFile) return;

    uploadMutation.mutate(selectedFile, {
      onSuccess: (result) => {
        setSelectedFile(null);
        onUploadSuccess?.(result.jobId);
      },
      onError: (error) => {
        onUploadError?.(error as Error);
      },
    });
  }, [selectedFile, uploadMutation, onUploadSuccess, onUploadError]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted bg-muted/50",
              uploadMutation.isPending && "opacity-50 pointer-events-none"
            )}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    disabled={uploadMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Invoice
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium mb-1">
                    Drag and drop your invoice file here
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, JPEG, PNG, WebP (max {maxSizeMB}MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept={acceptedTypes.join(",")}
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="invoice-file-input"
                  disabled={uploadMutation.isPending}
                />
                <label htmlFor="invoice-file-input">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={uploadMutation.isPending}
                  >
                    <span>Select File</span>
                  </Button>
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

