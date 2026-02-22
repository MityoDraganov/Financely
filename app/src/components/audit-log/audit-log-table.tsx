import { useTranslation } from "react-i18next";
import { Eye, User, CheckCircle, XCircle, Info, FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AuditLog, AuditLogSeverity } from "@/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getSeverityColor(severity: AuditLogSeverity) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
    case "error":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800";
    case "warning":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800";
    default:
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
    case "failure":
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    default:
      return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function formatAction(action: string) {
  return action
    .split(".")
    .map((word) => word.replace(/_/g, " "))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" › ");
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface AuditLogEmptyStateProps {
  hasActiveFilters: boolean;
}

export function AuditLogEmptyState({ hasActiveFilters }: AuditLogEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="rounded-full bg-muted p-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="font-medium text-sm text-foreground">
          {t("settings.security.auditLog.noLogs.title", "No activity found")}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {hasActiveFilters
            ? t(
                "settings.security.auditLog.noLogs.adjustFilters",
                "Try adjusting your filters to see more results."
              )
            : t(
                "settings.security.auditLog.noLogs.createContent",
                "Activity will appear here as your team uses the platform."
              )}
        </p>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasActiveFilters: boolean;
  formatTimestamp: (timestamp?: string) => string;
  onViewDetail: (log: AuditLog) => void;
}

export function AuditLogTable({
  logs,
  isLoading,
  isFetching,
  error,
  hasActiveFilters,
  formatTimestamp,
  onViewDetail,
}: AuditLogTableProps) {
  const { t } = useTranslation();

  if (isLoading || isFetching) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">
          {t("settings.security.auditLog.error", "Failed to load audit logs.")}
        </p>
      </div>
    );
  }

  if (logs.length === 0) {
    return <AuditLogEmptyState hasActiveFilters={hasActiveFilters} />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border/60">
            <TableHead className="text-xs font-semibold text-muted-foreground w-44">
              {t("settings.security.auditLog.table.timestamp", "Time")}
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">
              {t("settings.security.auditLog.table.user", "User")}
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">
              {t("settings.security.auditLog.table.action", "Action")}
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">
              {t("settings.security.auditLog.table.resource", "Resource")}
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground w-24">
              {t("settings.security.auditLog.table.severity", "Severity")}
            </TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground w-28">
              {t("settings.security.auditLog.table.status", "Status")}
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow
              key={log.id}
              className="hover:bg-muted/40 border-border/40 cursor-default"
            >
              <TableCell className="font-mono text-xs text-muted-foreground py-3">
                {formatTimestamp(log.timestamp)}
              </TableCell>

              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate max-w-[140px]">
                      {log.user?.name ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {log.user?.email}
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="py-3">
                <span className="text-xs font-medium">{formatAction(log.action)}</span>
              </TableCell>

              <TableCell className="py-3">
                {log.resource ? (
                  <div>
                    <p className="text-xs font-medium capitalize">{log.resource.type}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {log.resource.id.slice(0, 8)}…
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>

              <TableCell className="py-3">
                <Badge
                  className={cn(
                    "border text-[10px] font-medium px-1.5 py-0",
                    getSeverityColor(log.severity ?? "info")
                  )}
                >
                  {t(
                    `settings.security.auditLog.severity.${log.severity ?? "info"}`,
                    log.severity ?? "info"
                  )}
                </Badge>
              </TableCell>

              <TableCell className="py-3">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(log.outcome?.status ?? "success")}
                  <span className="text-xs capitalize">
                    {t(
                      `settings.security.auditLog.status.${log.outcome?.status ?? "success"}`,
                      log.outcome?.status ?? "success"
                    )}
                  </span>
                </div>
              </TableCell>

              <TableCell className="py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => onViewDetail(log)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
