import { useExtractionJob } from "@/hooks/service-hooks/use-invoice-extraction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExtractionJobStatusProps {
  jobId: string;
  showDetails?: boolean;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    variant: "secondary" as const,
    color: "text-muted-foreground",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    variant: "default" as const,
    color: "text-primary",
    animate: true,
  },
  extracted: {
    label: "Extracted",
    icon: CheckCircle2,
    variant: "default" as const,
    color: "text-green-600",
  },
  validated: {
    label: "Validated",
    icon: CheckCircle2,
    variant: "default" as const,
    color: "text-green-600",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    variant: "default" as const,
    color: "text-green-600",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    variant: "destructive" as const,
    color: "text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    variant: "secondary" as const,
    color: "text-muted-foreground",
  },
} as const;

export function ExtractionJobStatus({ jobId, showDetails = true }: ExtractionJobStatusProps) {
  const { data: job, isLoading, isFetching } = useExtractionJob(jobId);

  // Only show loading spinner if we have no data at all (initial load)
  if (isLoading && !job) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading job status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Job not found</p>
        </CardContent>
      </Card>
    );
  }

  const config = statusConfig[job.status];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Extraction Job Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Icon
            className={cn(
              "h-5 w-5",
              config.color,
              config.animate && "animate-spin"
            )}
          />
          <Badge variant={config.variant}>{config.label}</Badge>
          {isFetching && job.status !== "extracted" && job.status !== "failed" && job.status !== "completed" && (
            <span className="text-xs text-muted-foreground ml-auto">Updating...</span>
          )}
        </div>

        {showDetails && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">File:</span>
              <span className="font-medium">{job.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="font-medium">{job.fileType}</span>
            </div>
            {job.processingDurationMs && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Time:</span>
                <span className="font-medium">
                  {(job.processingDurationMs / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {job.extractedData && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fields Extracted:</span>
                <span className="font-medium">
                  {Object.keys(job.extractedData).length}
                </span>
              </div>
            )}
            {job.errorMessage && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-sm">
                <p className="text-sm text-destructive font-medium">Error:</p>
                <p className="text-sm text-destructive/80 mt-1">
                  {job.errorMessage}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

