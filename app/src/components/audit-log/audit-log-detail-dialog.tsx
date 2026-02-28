import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AuditLog } from "@/core";
import { getSeverityColor, getStatusIcon } from "./audit-log-table";

interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatTimestamp: (timestamp?: string) => string;
}

interface DetailRowProps {
  label: string;
  children: React.ReactNode;
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground font-medium pt-0.5">{label}</span>
      <div className="text-xs">{children}</div>
    </div>
  );
}

interface DetailSectionProps {
  title: string;
  children: React.ReactNode;
}

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border/60">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export function AuditLogDetailDialog({
  log,
  open,
  onOpenChange,
  formatTimestamp,
}: AuditLogDetailDialogProps) {
  const { t } = useTranslation();

  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto gap-4">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t("settings.security.auditLog.detailDialog.title", "Event Details")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t(
              "settings.security.auditLog.detailDialog.description",
              "Full details for this audit log entry."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Basic Information */}
          <DetailSection
            title={t(
              "settings.security.auditLog.detailDialog.basicInformation.title",
              "Basic Information"
            )}
          >
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.basicInformation.action",
                "Action"
              )}
            >
              <span className="font-medium font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                {log.action}
              </span>
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.basicInformation.timestamp",
                "Timestamp"
              )}
            >
              <span className="font-mono">{formatTimestamp(log.timestamp)}</span>
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.basicInformation.severity",
                "Severity"
              )}
            >
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
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.basicInformation.status",
                "Status"
              )}
            >
              <div className="flex items-center gap-1.5">
                {getStatusIcon(log.outcome?.status ?? "success")}
                <span className="capitalize">
                  {t(
                    `settings.security.auditLog.status.${log.outcome?.status ?? "success"}`,
                    log.outcome?.status ?? "success"
                  )}
                </span>
              </div>
            </DetailRow>
          </DetailSection>

          {/* User Information */}
          <DetailSection
            title={t(
              "settings.security.auditLog.detailDialog.userInformation.title",
              "User Information"
            )}
          >
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.userInformation.name",
                "Name"
              )}
            >
              <span className="font-medium">{log.user?.name ?? "—"}</span>
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.userInformation.email",
                "Email"
              )}
            >
              {log.user?.email ?? "—"}
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.userInformation.role",
                "Role"
              )}
            >
              <span className="capitalize">{log.user?.role ?? "—"}</span>
            </DetailRow>
            <DetailRow
              label={t(
                "settings.security.auditLog.detailDialog.userInformation.ipAddress",
                "IP Address"
              )}
            >
              <span className="font-mono text-[11px]">{log.user?.ipAddress ?? "—"}</span>
            </DetailRow>
            {log.user?.deviceInfo && (
              <DetailRow label={t("settings.security.auditLog.detailDialog.userInformation.device", "Device")}>
                <span className="text-muted-foreground">
                  {[log.user.deviceInfo.browser, log.user.deviceInfo.os, log.user.deviceInfo.type]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </DetailRow>
            )}
          </DetailSection>

          {/* Resource Information */}
          {log.resource && (
            <DetailSection
              title={t(
                "settings.security.auditLog.detailDialog.resourceInformation.title",
                "Resource"
              )}
            >
              <DetailRow
                label={t(
                  "settings.security.auditLog.detailDialog.resourceInformation.type",
                  "Type"
                )}
              >
                <span className="capitalize">{log.resource.type}</span>
              </DetailRow>
              <DetailRow
                label={t(
                  "settings.security.auditLog.detailDialog.resourceInformation.id",
                  "ID"
                )}
              >
                <span className="font-mono text-[11px] break-all">{log.resource.id}</span>
              </DetailRow>
              {log.resource.name && (
                <DetailRow
                  label={t(
                    "settings.security.auditLog.detailDialog.resourceInformation.name",
                    "Name"
                  )}
                >
                  <span className="font-medium">{log.resource.name}</span>
                </DetailRow>
              )}
            </DetailSection>
          )}

          {/* Changes */}
          {log.changes && log.changes.length > 0 && (
            <DetailSection
              title={t(
                "settings.security.auditLog.detailDialog.changes.title",
                "Changes"
              )}
            >
              <div className="py-2 space-y-2">
                {log.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border/50 overflow-hidden"
                  >
                    <div className="bg-muted/30 px-3 py-1.5">
                      <span className="text-[11px] font-semibold font-mono">{change.field}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/50">
                      <div className="px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {t(
                            "settings.security.auditLog.detailDialog.changes.oldValue",
                            "Before"
                          )}
                        </p>
                        <pre className="text-[11px] font-mono text-muted-foreground break-all whitespace-pre-wrap">
                          {change.oldValue !== undefined
                            ? JSON.stringify(change.oldValue, null, 2)
                            : "—"}
                        </pre>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {t(
                            "settings.security.auditLog.detailDialog.changes.newValue",
                            "After"
                          )}
                        </p>
                        <pre className="text-[11px] font-mono break-all whitespace-pre-wrap">
                          {change.newValue !== undefined
                            ? JSON.stringify(change.newValue, null, 2)
                            : "—"}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Outcome */}
          {log.outcome && (log.outcome.message || log.outcome.errorMessage || log.outcome.durationMs) && (
            <DetailSection
              title={t("settings.security.auditLog.detailDialog.outcome.title", "Outcome")}
            >
              {log.outcome.message && (
                <DetailRow
                  label={t(
                    "settings.security.auditLog.detailDialog.outcome.message",
                    "Message"
                  )}
                >
                  {log.outcome.message}
                </DetailRow>
              )}
              {log.outcome.errorMessage && (
                <DetailRow
                  label={t(
                    "settings.security.auditLog.detailDialog.outcome.error",
                    "Error"
                  )}
                >
                  <span className="font-mono text-[11px] text-destructive break-all">
                    {log.outcome.errorMessage}
                  </span>
                </DetailRow>
              )}
              {log.outcome.durationMs && (
                <DetailRow
                  label={t(
                    "settings.security.auditLog.detailDialog.outcome.duration",
                    "Duration"
                  )}
                >
                  <span className="font-mono">{log.outcome.durationMs}ms</span>
                </DetailRow>
              )}
            </DetailSection>
          )}

          {/* Metadata */}
          {log.metadata && (
            <DetailSection
              title={t(
                "settings.security.auditLog.detailDialog.metadata.title",
                "Metadata"
              )}
            >
              <div className="py-2">
                <pre className="text-[11px] bg-muted/40 p-3 rounded-md overflow-x-auto font-mono text-muted-foreground">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            </DetailSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
