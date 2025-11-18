import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandSite {
  status?: "pending" | "generating" | "deploying" | "success" | "failed";
  deployedUrl?: string;
  error?: string;
  html?: string;
  pages?: Array<{
    id: string;
    title: string;
    slug: string;
  }>;
}

interface SiteStatusDisplayProps {
  brandSite: BrandSite | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function SiteStatusDisplay({ brandSite, onRetry, isRetrying = false }: SiteStatusDisplayProps) {
  if (!brandSite) return null;

  const status = brandSite.status;
  const statusColors = {
    success: "bg-green-50 border-green-200",
    failed: "bg-red-50 border-red-200",
    default: "bg-blue-50 border-blue-200",
  };

  const statusColor =
    status === "success"
      ? statusColors.success
      : status === "failed"
      ? statusColors.failed
      : statusColors.default;

  return (
    <div className={`p-4 border rounded-lg ${statusColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          {status === "pending" && (
            <>
              <p className="text-sm font-medium text-blue-900">
                Site generation queued...
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Waiting to start generation
              </p>
            </>
          )}
          {status === "generating" && (
            <>
              <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating site with AI...
              </p>
              <p className="text-xs text-blue-700 mt-1">
                This may take 1-2 minutes
              </p>
            </>
          )}
          {status === "deploying" && (
            <>
              <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying site...
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Setting up hosting and DNS
              </p>
            </>
          )}
          {status === "success" && brandSite.deployedUrl && (
            <>
              <p className="text-sm font-medium text-green-900">
                Site Generated Successfully!
              </p>
              <a
                href={brandSite.deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 mt-1"
              >
                {brandSite.deployedUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
          {status === "failed" && (
            <>
              <p className="text-sm font-medium text-red-900">
                Site Generation Failed
              </p>
              <p className="text-xs text-red-700 mt-1">
                {brandSite.error || "Unknown error occurred"}
              </p>
            </>
          )}
        </div>
        {status === "failed" && onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="shrink-0"
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

