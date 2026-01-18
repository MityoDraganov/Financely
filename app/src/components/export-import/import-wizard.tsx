import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { useUploadFile } from "@/hooks/service-hooks/use-upload-file";
import { exportImportService } from "@/services/export-import/export-import-service";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import type { ExportEntityType, ImportMode } from "@/core/entities/export-import";
import { Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobStatus } from "./job-status";

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityType?: ExportEntityType;
  onImportComplete?: (jobId: string) => void;
}

const ENTITY_TYPES: Array<{ value: ExportEntityType; label: string }> = [
  { value: "products", label: "Products" },
  { value: "contacts", label: "Contacts" },
  { value: "leads", label: "Leads" },
  { value: "proposals", label: "Proposals" },
  { value: "invoices", label: "Invoices" },
  { value: "templates", label: "Templates" },
];

type Step = "upload" | "configure" | "processing" | "complete";

export function ImportWizard({
  open,
  onOpenChange,
  defaultEntityType = "products",
  onImportComplete,
}: ImportWizardProps) {
  const { data: organization } = useCurrentOrganization();
  const [step, setStep] = useState<Step>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<ExportEntityType>(defaultEntityType);
  const [mode, setMode] = useState<ImportMode>("create-only");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = useUploadFile();

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id || !fileUrl || !selectedFile) {
        throw new Error("Missing required data");
      }

      return exportImportService.importData({
        orgId: organization.id,
        fileUrl,
        fileName: selectedFile.name,
        entityType,
        mode,
      });
    },
    onSuccess: (result) => {
      setJobId(result.jobId);
      setStep("processing");
    },
    onError: (error: Error) => {
      toast.error("Failed to start import", {
        description: error.message,
      });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validExtensions = [".csv", ".xls", ".xlsx"];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    
    if (!validExtensions.includes(extension)) {
      toast.error("Invalid file type", {
        description: "Please upload a CSV, XLS, or XLSX file",
      });
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File too large", {
        description: "File size must be less than 50MB",
      });
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !organization?.id) {
      return;
    }

    try {
      // Convert file to base64
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      // Upload file
      const uploadResult = await uploadFile.mutateAsync({
        organizationId: organization.id,
        fileName: selectedFile.name,
        fileData,
        contentType: selectedFile.type || "application/octet-stream",
        path: `organizations/${organization.id}/imports/${Date.now()}-${selectedFile.name}`,
      });

      setFileUrl(uploadResult.url);
      setStep("configure");
    } catch (error) {
      toast.error("Failed to upload file", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [selectedFile, organization, uploadFile]);

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleComplete = () => {
    if (jobId) {
      onImportComplete?.(jobId);
    }
    onOpenChange(false);
    // Reset state
    setStep("upload");
    setSelectedFile(null);
    setFileUrl(null);
    setJobId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Upload a file to import data into your organization.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="entity-type">Entity Type</Label>
              <Select
                value={entityType}
                onValueChange={(value) => setEntityType(value as ExportEntityType)}
              >
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-md p-8 text-center transition-colors",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted bg-muted/50",
                    uploadFile.isPending && "opacity-50 pointer-events-none",
                  )}
                >
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <Label
                      htmlFor="file-upload"
                      className="cursor-pointer text-sm font-medium"
                    >
                      Click to upload or drag and drop
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      CSV, XLS, or XLSX (max 50MB)
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>

                {selectedFile && (
                  <div className="mt-4 flex items-center justify-between p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === "configure" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <RadioGroup value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create-only" id="create-only" />
                  <Label htmlFor="create-only" className="cursor-pointer">
                    Create Only - Always create new records
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upsert" id="upsert" />
                  <Label htmlFor="upsert" className="cursor-pointer">
                    Upsert - Update existing or create new
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="rounded-md bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Ready to import <strong>{selectedFile?.name}</strong> as{" "}
                <strong>{ENTITY_TYPES.find((t) => t.value === entityType)?.label}</strong>
              </p>
            </div>
          </div>
        )}

        {step === "processing" && jobId && organization?.id && (
          <div className="py-4">
            <JobStatus
              orgId={organization.id}
              jobId={jobId}
              type="import"
              onComplete={() => setStep("complete")}
            />
          </div>
        )}

        {step === "complete" && (
          <div className="py-4 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold">Import Complete</h3>
              <p className="text-sm text-muted-foreground">
                Your data has been imported successfully.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadFile.isPending}
              >
                {uploadFile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload & Continue
              </Button>
            </>
          )}

          {step === "configure" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Start Import
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleComplete}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
