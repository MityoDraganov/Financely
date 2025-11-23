import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Activity,
  ChevronDown,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { WorkflowExecution, WorkflowExecutionStatus } from "@/core";
import { useWorkflowExecutions } from "@/hooks/use-workflows";

interface WorkflowExecutionHistoryProps {
  workflowId: string;
}

const STATUS_COLORS: Record<WorkflowExecutionStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const STATUS_ICONS: Record<WorkflowExecutionStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  running: <Activity className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  cancelled: <Pause className="w-4 h-4" />,
};

export default function WorkflowExecutionHistory({ workflowId }: WorkflowExecutionHistoryProps) {
  const { t } = useTranslation();
  const { executions, isLoading, error } = useWorkflowExecutions(workflowId);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowExecutionStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);

  // Helper function to safely extract error message
  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'Unknown error occurred';
  };

  // Helper function to get execution title
  const getExecutionTitle = (execution: WorkflowExecution): string => {
    if (execution.status === 'running') return t('workflows.executionHistory.titles.running');
    if (execution.status === 'failed') return t('workflows.executionHistory.titles.failed');
    if (execution.status === 'completed') return t('workflows.executionHistory.titles.completed');
    if (execution.status === 'pending') return t('workflows.executionHistory.titles.pending');
    return t('workflows.executionHistory.titles.execution');
  };

  // Helper function to format trigger type for display
  const formatTriggerType = (triggerType?: string): string => {
    if (!triggerType) return t('workflows.executionHistory.triggerTypes.manual');
    const triggerMap: Record<string, string> = {
      'invoice.created': t('workflows.executionHistory.triggerTypes.invoiceCreated'),
      'invoice.paid': t('workflows.executionHistory.triggerTypes.invoicePaid'),
      'user.registered': t('workflows.executionHistory.triggerTypes.userRegistered'),
      'webhook': t('workflows.executionHistory.triggerTypes.webhook'),
      'schedule': t('workflows.executionHistory.triggerTypes.scheduled'),
      'manual': t('workflows.executionHistory.triggerTypes.manual')
    };
    return triggerMap[triggerType] || triggerType.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return t('workflows.executionHistory.time.justNow');
    if (diffMinutes < 60) return t('workflows.executionHistory.time.minutesAgo', { minutes: diffMinutes });
    if (diffHours < 24) return t('workflows.executionHistory.time.hoursAgo', { hours: diffHours });
    if (diffDays < 7) return t('workflows.executionHistory.time.daysAgo', { days: diffDays });
    return date.toLocaleDateString();
  };

  const filteredExecutions = executions
    .filter(execution => {
      const matchesSearch = execution.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           execution.triggerType?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || execution.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.startedAt);
      const dateB = new Date(b.startedAt);
      return sortBy === "newest" ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
    });

  const getDuration = (execution: WorkflowExecution) => {
    if (!execution.completedAt) return t('workflows.executionHistory.duration.running');
    
    const start = new Date(execution.startedAt);
    const end = new Date(execution.completedAt);
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return t('workflows.executionHistory.duration.lessThanSecond');
    if (duration < 60000) return t('workflows.executionHistory.duration.seconds', { seconds: Math.round(duration / 1000) });
    if (duration < 3600000) return t('workflows.executionHistory.duration.minutes', { minutes: Math.round(duration / 60000) });
    return t('workflows.executionHistory.duration.hours', { hours: Math.round(duration / 3600000) });
  };

  const getExecutionSummary = (execution: WorkflowExecution) => {
    const logs = execution.logs || [];
    const totalLogs = logs.length;
    const completedLogs = logs.filter(log => log.status === "completed").length;
    const failedLogs = logs.filter(log => log.status === "failed").length;
    
    return {
      totalSteps: totalLogs,
      completedSteps: completedLogs,
      failedSteps: failedLogs,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('workflows.executionHistory.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">{t('workflows.executionHistory.error', { message: error.message })}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">{t('workflows.executionHistory.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('workflows.executionHistory.count', { filtered: filteredExecutions.length, total: executions.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('workflows.executionHistory.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('workflows.executionHistory.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WorkflowExecutionStatus | "all")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('workflows.executionHistory.statusFilters.all')}</SelectItem>
              <SelectItem value="pending">{t('workflows.executionHistory.statusFilters.pending')}</SelectItem>
              <SelectItem value="running">{t('workflows.executionHistory.statusFilters.running')}</SelectItem>
              <SelectItem value="completed">{t('workflows.executionHistory.statusFilters.completed')}</SelectItem>
              <SelectItem value="failed">{t('workflows.executionHistory.statusFilters.failed')}</SelectItem>
              <SelectItem value="cancelled">{t('workflows.executionHistory.statusFilters.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as "newest" | "oldest")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('workflows.executionHistory.sort.newest')}</SelectItem>
              <SelectItem value="oldest">{t('workflows.executionHistory.sort.oldest')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Executions List */}
      <div className="space-y-3">
        {filteredExecutions.map((execution) => {
          const summary = getExecutionSummary(execution);
          const duration = getDuration(execution);
          const isExpanded = expandedExecution === execution.id;
          
          return (
            <Card key={execution.id} className="hover:shadow-sm transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge className={`${STATUS_COLORS[execution.status]} shrink-0`}>
                      <div className="flex items-center gap-1">
                        {STATUS_ICONS[execution.status]}
                        <span className="hidden sm:inline">{execution.status}</span>
                      </div>
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm sm:text-base">
                        {getExecutionTitle(execution)}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{t('workflows.executionHistory.triggeredBy', { trigger: formatTriggerType(execution.triggerType) })}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(execution.startedAt)}</span>
                        {execution.status === 'running' && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 font-medium">{duration}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {execution.status === 'failed' && (
                      <Button variant="outline" size="sm" className="text-xs">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        {t('workflows.executionHistory.retry')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedExecution(isExpanded ? null : execution.id)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Error Message - Most Important */}
                  {execution.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center gap-2 text-red-800">
                        <XCircle className="w-4 h-4" />
                        <span className="font-medium">{t('workflows.executionHistory.errorDetails')}</span>
                      </div>
                      <p className="text-red-700 text-sm mt-1 wrap-break-word">
                        {getErrorMessage(execution.error)}
                      </p>
                    </div>
                  )}

                  {/* Progress for Running Executions */}
                  {execution.status === "running" && summary.totalSteps > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('workflows.executionHistory.progress')}</span>
                        <span>{t('workflows.executionHistory.progressSteps', { completed: summary.completedSteps, total: summary.totalSteps })}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(summary.completedSteps / summary.totalSteps) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Recent Logs - Only if there are logs */}
                  {execution.logs && execution.logs.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">{t('workflows.executionHistory.recentActivity')}</h5>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {execution.logs.slice(-3).map((log, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded">
                            <Badge 
                              variant={log.status === "completed" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                              className="text-xs shrink-0"
                            >
                              {log.status}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium">{log.actionType}</div>
                              {log.message && (
                                <div className="text-muted-foreground wrap-break-word">
                                  {getErrorMessage(log.message)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {execution.logs.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            {t('workflows.executionHistory.moreLogs', { count: execution.logs.length - 3 })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {t('workflows.executionHistory.viewDetails')}
                    </Button>
                    {execution.status === "failed" && (
                      <Button variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-1" />
                        {t('workflows.executionHistory.retryExecution')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredExecutions.length === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <Activity className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('workflows.executionHistory.emptyState.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {executions.length === 0 
              ? t('workflows.executionHistory.emptyState.noExecutions')
              : t('workflows.executionHistory.emptyState.noResults')
            }
          </p>
        </div>
      )}
    </div>
  );
}