import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, AlertCircle, Info, AlertTriangle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAdminAuditLogs } from "@/hooks/admin/use-admin-audit-logs";
import { Link } from "react-router-dom";

export function AdminLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs, isLoading, error } = useAdminAuditLogs({
    severity: severityFilter !== "all" ? (severityFilter as any) : undefined,
    action: actionFilter !== "all" ? (actionFilter as any) : undefined,
  });

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!logs || !searchQuery) {
      return logs || [];
    }

    const searchLower = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.user?.name?.toLowerCase().includes(searchLower) ||
        log.user?.email?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower) ||
        log.resource?.type?.toLowerCase().includes(searchLower) ||
        log.organizationId?.toLowerCase().includes(searchLower)
    );
  }, [logs, searchQuery]);

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadgeVariant = (severity?: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "error":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "secondary";
    }
  };

  const getOutcomeBadgeVariant = (status?: string) => {
    switch (status) {
      case "success":
        return "default";
      case "failure":
        return "destructive";
      case "partial":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!logs) {
      return {
        total: 0,
        errors: 0,
        warnings: 0,
        critical: 0,
      };
    }

    return {
      total: logs.length,
      errors: logs.filter((l) => l.severity === "error").length,
      warnings: logs.filter((l) => l.severity === "warning").length,
      critical: logs.filter((l) => l.severity === "critical").length,
    };
  }, [logs]);

  if (error) {
    console.error(error);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs & Monitoring</h1>
          <p className="text-muted-foreground">System audit logs and activity monitoring</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="user.created">User Created</SelectItem>
                <SelectItem value="organization.created">Organization Created</SelectItem>
                <SelectItem value="invoice.created">Invoice Created</SelectItem>
                <SelectItem value="system.error.occurred">System Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.errors}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.warnings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} found
            {searchQuery && ` (filtered from ${stats.total} total)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.slice(0, 100).map((log) => {
                    const timestamp = log.timestamp || log.createdAt;
                    const date = timestamp
                      ? typeof timestamp === "string"
                        ? new Date(timestamp)
                        : timestamp
                      : null;

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          {date ? (
                            <div className="text-sm">
                              <div>{date.toLocaleDateString()}</div>
                              <div className="text-muted-foreground">
                                {date.toLocaleTimeString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(log.severity)}
                            <Badge variant={getSeverityBadgeVariant(log.severity)}>
                              {log.severity || "info"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">{log.action}</div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium">{log.user?.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">
                              {log.user?.email || "—"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.resource ? (
                            <div className="text-sm">
                              <div className="font-medium">{log.resource.type}</div>
                              <div className="text-muted-foreground">{log.resource.id}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/organizations/${log.organizationId}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {log.organizationId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getOutcomeBadgeVariant(log.outcome?.status)}>
                            {log.outcome?.status || "unknown"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <Card>
        <CardHeader>
          <CardTitle>About Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              Audit logs provide a comprehensive record of all activities across the platform.
              Logs are stored per organization and aggregated here for admin viewing. Detailed log
              views and advanced filtering will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

