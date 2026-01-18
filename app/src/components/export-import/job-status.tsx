import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { exportImportService } from "@/services/export-import/export-import-service";
import type { ExportJob, ImportJob } from "@/core/entities/export-import";
import { CheckCircle2, XCircle, Loader2, Download, FileText, AlertCircle } from "lucide-react";

interface JobStatusProps {
  orgId: string;
  jobId: string;
  type: "export" | "import";
  onComplete?: () => void;
}

export function JobStatus({ orgId, jobId, type, onComplete }: JobStatusProps) {
  const [pollingInterval] = useState(2000); // Poll every 2 seconds

  const { data: exportJob } = useQuery<ExportJob>({
    queryKey: ["exportJob", orgId, jobId],
    queryFn: () => exportImportService.getExportJob(orgId, jobId),
    enabled: type === "export",
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "completed" || job?.status === "failed") {
        return false; // Stop polling when done
      }
      return pollingInterval;
    },
  });

  const { data: importJob } = useQuery<ImportJob>({
    queryKey: ["importJob", orgId, jobId],
    queryFn: () => exportImportService.getImportJob(orgId, jobId),
    enabled: type === "import",
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "completed" || job?.status === "failed") {
        return false; // Stop polling when done
      }
      return pollingInterval;
    },
  });

  const job = type === "export" ? exportJob : importJob;

  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      onComplete?.();
    }
  }, [job?.status, onComplete]);

  if (!job) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    switch (job.status) {
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
      case "parsing":
      case "validating":
      case "importing":
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

  const getProgress = () => {
    if (type === "export") {
      const exportJob = job as ExportJob;
      if (exportJob.stats.totalRecords === 0) {
        return 0;
      }
      return (exportJob.stats.exportedRecords / exportJob.stats.totalRecords) * 100;
    } else {
      const importJob = job as ImportJob;
      if (importJob.stats.totalRows === 0) {
        return 0;
      }
      return (importJob.stats.importedRows / importJob.stats.totalRows) * 100;
    }
  };

  const handleDownload = () => {
    if (type === "export") {
      const exportJob = job as ExportJob;
      if (exportJob.fileUrl) {
        window.open(exportJob.fileUrl, "_blank");
      }
    }
  };

  const handleDownloadErrorReport = () => {
    if (type === "import") {
      const importJob = job as ImportJob;
      if (importJob.errorReportUrl) {
        window.open(importJob.errorReportUrl, "_blank");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {type === "export" ? "Export" : "Import"} Job Status
            </CardTitle>
            <CardDescription className="mt-1">
              Job ID: {jobId.substring(0, 8)}...
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        {job.status !== "completed" && job.status !== "failed" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(getProgress())}%</span>
            </div>
            <Progress value={getProgress()} />
          </div>
        )}

        {/* Stats */}
        {type === "export" ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Records</div>
              <div className="font-medium">{(job as ExportJob).stats.totalRecords}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Exported</div>
              <div className="font-medium">{(job as ExportJob).stats.exportedRecords}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Rows</div>
              <div className="font-medium">{(job as ImportJob).stats.totalRows}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Imported</div>
              <div className="font-medium">{(job as ImportJob).stats.importedRows}</div>
            </div>
            {(job as ImportJob).stats.errorRows > 0 && (
              <>
                <div>
                  <div className="text-muted-foreground">Errors</div>
                  <div className="font-medium text-destructive">
                    {(job as ImportJob).stats.errorRows}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Skipped</div>
                  <div className="font-medium">{(job as ImportJob).stats.skippedRows}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error Message */}
        {job.error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {job.error}
          </div>
        )}

        {/* Error Summary */}
        {type === "import" && (job as ImportJob).stats.errorRows > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">
                {(job as ImportJob).stats.errorRows} row(s) had errors
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Download the error report to see detailed information about each error.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {type === "export" && (job as ExportJob).fileUrl && (
            <Button onClick={handleDownload} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download Export
            </Button>
          )}
          {type === "import" && (job as ImportJob).errorReportUrl && (
            <Button onClick={handleDownloadErrorReport} variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Download Error Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
