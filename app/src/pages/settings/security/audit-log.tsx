import { useState } from "react";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import {
  AuditLogSeverity,
  AuditLogQueryFilters,
  AuditLog,
} from "@/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  RefreshCw,
  Eye,
  User,
  CheckCircle,
  XCircle,
  Info,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function AuditLogPage() {
  const [filters] = useState<AuditLogQueryFilters>({});
  const [searchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [dateRange] = useState<{
    start?: string;
    end?: string;
  }>({});

  const { data, isLoading, isFetching, error, refetch } = useAuditLogs({
    filters: {
      ...filters,
      ...(searchQuery && { search: searchQuery }),
      ...(dateRange.start && { startDate: dateRange.start }),
      ...(dateRange.end && { endDate: dateRange.end }),
    },
    limit: 100,
    orderBy: { field: "timestamp", direction: "desc" },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  const getSeverityColor = (severity: AuditLogSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "error":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failure":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatAction = (action: string) => {
    return action
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "N/A";
    try {
      return format(new Date(timestamp), "MMM dd, yyyy HH:mm:ss");
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-600 mt-2">
          Track and monitor all activities and changes in your organization
        </p>
      </div>

      {/* Results Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Activity Log</CardTitle>
              <CardDescription>
                {total} total entries found
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-gray-600"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Failed to load audit logs. Please try again.
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="space-y-4">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    No audit logs found
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    {Object.keys(filters).length > 0 || searchQuery || dateRange.start || dateRange.end
                      ? "Try adjusting your filters to see more results."
                      : "Create a product or invoice to generate audit logs."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{log.user?.name}</div>
                            <div className="text-xs text-gray-500">
                              {log.user?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatAction(log.action)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.resource ? (
                          <div>
                            <div className="font-medium">{log.resource.type}</div>
                            <div className="text-xs text-gray-500">
                              {log.resource.id.slice(0, 8)}...
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border",
                            getSeverityColor(log.severity || "info")
                          )}
                        >
                          {log.severity || "info"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.outcome?.status || "success")}
                          <span className="text-sm">
                            {log.outcome?.status || "success"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setIsDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500">Action</div>
                      <div className="font-medium">{formatAction(selectedLog.action)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Timestamp</div>
                      <div className="font-medium">
                        {formatTimestamp(selectedLog.timestamp)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Severity</div>
                      <Badge
                        className={cn(
                          "border mt-1",
                          getSeverityColor(selectedLog.severity || "info")
                        )}
                      >
                        {selectedLog.severity || "info"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-gray-500">Status</div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(selectedLog.outcome?.status || "success")}
                        <span>{selectedLog.outcome?.status || "success"}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500">Name</div>
                      <div className="font-medium">{selectedLog.user?.name}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Email</div>
                      <div className="font-medium">{selectedLog.user?.email}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Role</div>
                      <div className="font-medium">
                        {selectedLog.user?.role || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">IP Address</div>
                      <div className="font-mono text-xs">
                        {selectedLog.user?.ipAddress || "—"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resource Info */}
              {selectedLog.resource && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resource Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">Type</div>
                        <div className="font-medium">{selectedLog.resource.type}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">ID</div>
                        <div className="font-mono text-xs">
                          {selectedLog.resource.id}
                        </div>
                      </div>
                      {selectedLog.resource.name && (
                        <div className="col-span-2">
                          <div className="text-gray-500">Name</div>
                          <div className="font-medium">
                            {selectedLog.resource.name}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Changes */}
              {selectedLog.changes && selectedLog.changes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedLog.changes?.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm">{change.field}</div>
                            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                              <div>
                                <div className="text-gray-500">Old Value</div>
                                <div className="font-mono break-all">
                                  {change.oldValue !== undefined
                                    ? JSON.stringify(change.oldValue, null, 2)
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-500">New Value</div>
                                <div className="font-mono break-all">
                                  {change.newValue !== undefined
                                    ? JSON.stringify(change.newValue, null, 2)
                                    : "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Outcome */}
              {selectedLog.outcome && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Outcome</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedLog.outcome.message && (
                      <div>
                        <div className="text-gray-500">Message</div>
                        <div className="font-medium">
                          {selectedLog.outcome.message}
                        </div>
                      </div>
                    )}
                    {selectedLog.outcome.errorMessage && (
                      <div>
                        <div className="text-gray-500">Error</div>
                        <div className="font-mono text-xs text-red-600 break-all">
                          {selectedLog.outcome.errorMessage}
                        </div>
                      </div>
                    )}
                    {selectedLog.outcome.durationMs && (
                      <div>
                        <div className="text-gray-500">Duration</div>
                        <div className="font-medium">
                          {selectedLog.outcome.durationMs}ms
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

