import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { exportImportService } from "@/services/export-import/export-import-service";
import type { ExportEntityType, ExportFormat, ExportJob } from "@/core/entities/export-import";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Loader2, CheckCircle2, XCircle, Download } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEntityTypes?: ExportEntityType[];
  onExportComplete?: (jobId: string) => void;
}

type DialogMode = "configure" | "progress";

const ENTITY_TYPES: Array<{ value: ExportEntityType; label: string }> = [
  { value: "products", label: "Products" },
  { value: "contacts", label: "Contacts" },
  { value: "leads", label: "Leads" },
  { value: "proposals", label: "Proposals" },
  { value: "invoices", label: "Invoices" },
  { value: "templates", label: "Templates" },
];

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "xls", label: "Excel (XLS)" },
];

export function ExportDialog({
  open,
  onOpenChange,
  defaultEntityTypes = [],
  onExportComplete,
}: ExportDialogProps) {
  const { data: organization } = useCurrentOrganization();
  const [mode, setMode] = useState<DialogMode>("configure");
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<ExportEntityType[]>(
    defaultEntityTypes.length > 0 ? defaultEntityTypes : ["products"],
  );
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [includeArchived, setIncludeArchived] = useState(false);
  const hasDownloadedRef = useRef(false);

  // Poll for export job status
  const { data: exportJob } = useQuery<ExportJob>({
    queryKey: ["exportJob", organization?.id, jobId],
    queryFn: async () => {
      if (!organization?.id || !jobId) throw new Error("Missing orgId or jobId");
      return exportImportService.getExportJob(organization.id, jobId);
    },
    enabled: !!jobId && !!organization?.id && mode === "progress",
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "completed" || job?.status === "failed") {
        return false; // Stop polling when done
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Auto-download when export completes (if user is still watching)
  useEffect(() => {
    if (exportJob?.status === "completed" && exportJob.fileUrl && !hasDownloadedRef.current) {
      hasDownloadedRef.current = true;

      // Auto-download the file
      const extensionFromUrl = (() => {
        try {
          const pathname = new URL(exportJob.fileUrl).pathname;
          const fileName = pathname.split("/").pop() ?? "";
          const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
          return extension || (format === "csv" ? "csv" : format === "xls" ? "xls" : "xlsx");
        } catch {
          return format === "csv" ? "csv" : format === "xls" ? "xls" : "xlsx";
        }
      })();
      const link = document.createElement("a");
      link.href = exportJob.fileUrl;
      link.download = `export-${jobId}.${extensionFromUrl}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Export completed", {
        description: "Your export file has been downloaded.",
      });

      onExportComplete?.(jobId!);
    }
  }, [exportJob?.status, exportJob?.fileUrl, jobId, format, onExportComplete]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) {
        throw new Error("Organization ID is required");
      }

      return exportImportService.exportData({
        orgId: organization.id,
        entityTypes: selectedEntityTypes,
        format,
        notifyEmail: true,
        options: {
          dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
          includeArchived: includeArchived || undefined,
        },
      });
    },
    onSuccess: (result) => {
      setJobId(result.jobId);
      setMode("progress");
      hasDownloadedRef.current = false;
      toast.success("Export started", {
        description: "Your export is being processed. You can safely close this window. We'll email you when it's ready.",
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to start export", {
        description: error.message,
      });
    },
  });

  const handleEntityTypeToggle = (entityType: ExportEntityType) => {
    setSelectedEntityTypes((prev) =>
      prev.includes(entityType)
        ? prev.filter((t) => t !== entityType)
        : [...prev, entityType],
    );
  };

  const handleExport = () => {
    if (selectedEntityTypes.length === 0) {
      toast.error("Please select at least one entity type");
      return;
    }

    exportMutation.mutate();
  };

  const handleClose = (open: boolean) => {
    if (open === false && mode === "progress" && exportJob?.status !== "completed" && exportJob?.status !== "failed") {
      // Show toast when closing during export (but allow closing)
      toast.info("Export in progress", {
        description: "You'll receive an email when the export is ready.",
      });
    }
    if (open === false) {
      // Reset state when closing
      setMode("configure");
      setJobId(null);
      hasDownloadedRef.current = false;
    }
    onOpenChange(open);
  };

  const getProgress = () => {
    if (!exportJob || exportJob.stats.totalRecords === 0) {
      return 0;
    }
    return (exportJob.stats.exportedRecords / exportJob.stats.totalRecords) * 100;
  };

  const getStatusBadge = () => {
    if (!exportJob) return null;
    
    switch (exportJob.status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Queued
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "configure" ? "Export Data" : "Export in Progress"}
          </DialogTitle>
          <DialogDescription>
            {mode === "configure"
              ? "Select the data you want to export and choose your preferred format."
              : "Your export is being processed. The file will download automatically when ready."}
          </DialogDescription>
        </DialogHeader>

        {mode === "configure" ? (
          <>
            <div className="space-y-6 py-4">
              {/* Entity Types */}
              <div className="space-y-3">
                <Label>Entity Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ENTITY_TYPES.map((entity) => (
                    <div key={entity.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={entity.value}
                        checked={selectedEntityTypes.includes(entity.value)}
                        onCheckedChange={() => handleEntityTypeToggle(entity.value)}
                      />
                      <Label
                        htmlFor={entity.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {entity.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((fmt) => (
                      <SelectItem key={fmt.value} value={fmt.value}>
                        {fmt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range (Optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, start: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                      End Date
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) =>
                        setDateRange((prev) => ({ ...prev, end: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Include Archived */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-archived"
                  checked={includeArchived}
                  onCheckedChange={(checked) => setIncludeArchived(checked === true)}
                />
                <Label htmlFor="include-archived" className="text-sm font-normal cursor-pointer">
                  Include archived records
                </Label>
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exportMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={exportMutation.isPending || selectedEntityTypes.length === 0}>
                {exportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Export
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-6 py-4">
              {/* Status Badge */}
              <div className="flex items-center justify-center">
                {getStatusBadge()}
              </div>

              {/* Progress */}
              {exportJob && exportJob.status !== "completed" && exportJob.status !== "failed" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{Math.round(getProgress())}%</span>
                  </div>
                  <Progress value={getProgress()} />
                </div>
              )}

              {/* Stats */}
              {exportJob && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Records</div>
                    <div className="font-medium">{exportJob.stats.totalRecords}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Exported</div>
                    <div className="font-medium">{exportJob.stats.exportedRecords}</div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {exportJob?.error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {exportJob.error}
                </div>
              )}

              {/* Success Message */}
              {exportJob?.status === "completed" && exportJob.fileUrl && (
                <div className="rounded-md bg-green-50 dark:bg-green-950 p-3 text-sm text-green-800 dark:text-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Export completed! Your file should download automatically.</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              {exportJob?.status === "completed" && exportJob.fileUrl && (
                <Button
                  onClick={() => {
                    window.open(exportJob.fileUrl, "_blank");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Again
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                {exportJob?.status === "completed" || exportJob?.status === "failed" ? "Close" : "Close (export continues)"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
