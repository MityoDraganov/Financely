import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";

import { useAuditLogs } from "@/hooks/use-audit-logs";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AuditLogFilterBar,
  AuditLogFiltersState,
  DEFAULT_FILTERS,
  getDateRangeFromFilters,
  OrganizationMemberOption,
} from "@/components/audit-log/audit-log-filters";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";
import { AuditLogDetailDialog } from "@/components/audit-log/audit-log-detail-dialog";
import { AuditLog } from "@/core";

export default function AuditLogPage() {
  const { t } = useTranslation();
  const { formatDateTime } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();

  const [filters, setFilters] = useState<AuditLogFiltersState>(DEFAULT_FILTERS);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: membersData } = useOrganizationMembers(currentOrganization?.id);

  const members: OrganizationMemberOption[] = useMemo(
    () =>
      (membersData ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
      })),
    [membersData]
  );

  const dateRange = useMemo(() => getDateRangeFromFilters(filters), [filters]);

  const queryFilters = useMemo(
    () => ({
      ...(filters.memberIds.length === 1 ? { userId: filters.memberIds[0] } : {}),
      ...(filters.actionTypes.length === 1 ? { action: filters.actionTypes[0] } : {}),
      ...(dateRange.startDate ? { startDate: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { endDate: dateRange.endDate } : {}),
    }),
    [filters.memberIds, filters.actionTypes, dateRange]
  );

  const { data, isLoading, isFetching, error, refetch } = useAuditLogs({
    filters: queryFilters,
    limit: 200,
    orderBy: { field: "timestamp", direction: "desc" },
  });

  // Client-side filtering for multi-select member and action type filters
  const logs = useMemo(() => {
    let result = data?.logs ?? [];

    if (filters.memberIds.length > 1) {
      result = result.filter((log) =>
        log.user?.userId ? filters.memberIds.includes(log.user.userId) : false
      );
    }

    if (filters.actionTypes.length > 1) {
      result = result.filter((log) => filters.actionTypes.includes(log.action));
    }

    return result;
  }, [data?.logs, filters.memberIds, filters.actionTypes]);

  const total = data?.total ?? 0;

  const hasActiveFilters =
    filters.duration !== DEFAULT_FILTERS.duration ||
    filters.memberIds.length > 0 ||
    filters.actionTypes.length > 0;

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "N/A";
    try {
      return formatDateTime(new Date(timestamp));
    } catch {
      return timestamp;
    }
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("settings.security.auditLog.pageTitle", "Audit Log")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t(
                "settings.security.auditLog.pageDescription",
                "Track all actions and changes made within your organization."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {t("settings.security.auditLog.refresh", "Refresh")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t("settings.security.auditLog.export", "Export")}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <AuditLogFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          members={members}
        />
      </div>

      {/* Results */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Table Header with count */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("settings.security.auditLog.activityLog.title", "Activity")}
            </p>
            {!isLoading && !isFetching && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {logs.length !== total && hasActiveFilters
                  ? t(
                      "settings.security.auditLog.activityLog.filteredDescription",
                      "Showing {{shown}} of {{total}} events",
                      { shown: logs.length, total }
                    )
                  : t(
                      "settings.security.auditLog.activityLog.description",
                      "{{total}} events total",
                      { total }
                    )}
              </p>
            )}
          </div>
        </div>

        <AuditLogTable
          logs={logs}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          hasActiveFilters={hasActiveFilters}
          formatTimestamp={formatTimestamp}
          onViewDetail={handleViewDetail}
        />
      </div>

      {/* Detail Dialog */}
      <AuditLogDetailDialog
        log={selectedLog}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        formatTimestamp={formatTimestamp}
      />
    </div>
  );
}
