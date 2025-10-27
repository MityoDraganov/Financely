import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Calendar,
  Activity
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
  const { executions, isLoading, error } = useWorkflowExecutions(workflowId);
  console.log(error);
  console.log("isLoading", isLoading);
  console.log("executions", executions);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowExecutionStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Helper function to safely extract error message
  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'Unknown error occurred';
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
    if (!execution.completedAt) return "Running...";
    
    const start = new Date(execution.startedAt);
    const end = new Date(execution.completedAt);
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return "< 1s";
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
    return `${Math.round(duration / 3600000)}h`;
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
        <div className="text-muted-foreground">Loading execution history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error loading execution history: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Execution History</h2>
        <p className="text-muted-foreground">
          View and monitor workflow execution history
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search executions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WorkflowExecutionStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "newest" | "oldest")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Executions List */}
      <div className="space-y-4">
        {filteredExecutions.map((execution) => {
          const summary = getExecutionSummary(execution);
          const duration = getDuration(execution);
          
          return (
            <Card key={execution.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Execution {execution.id.slice(-8)}</h4>
                      <Badge className={STATUS_COLORS[execution.status]}>
                        <div className="flex items-center gap-1">
                          {STATUS_ICONS[execution.status]}
                          {execution.status}
                        </div>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Triggered by: {execution.triggerType?.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(execution.startedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {duration}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Execution Summary */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">{summary.totalSteps}</div>
                    <div className="text-muted-foreground">Total Steps</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600">{summary.completedSteps}</div>
                    <div className="text-muted-foreground">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">{summary.failedSteps}</div>
                    <div className="text-muted-foreground">Failed</div>
                  </div>
                </div>

                {/* Progress Bar */}
                {execution.status === "running" && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(summary.completedSteps / summary.totalSteps) * 100}%` }}
                    />
                  </div>
                )}

                {/* Error Message */}
                {execution.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2 text-red-800">
                      <XCircle className="w-4 h-4" />
                      <span className="font-medium">Error:</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">
                      {getErrorMessage(execution.error)}
                    </p>
                  </div>
                )}

                {/* Execution Logs */}
                {execution.logs && execution.logs.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm">Execution Logs</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {execution.logs.slice(-5).map((log, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <Badge 
                            variant={log.status === "completed" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {log.status}
                          </Badge>
                          <span className="text-muted-foreground">{log.actionType}</span>
                          {log.message && (
                            <span className="text-muted-foreground">
                              - {getErrorMessage(log.message)}
                            </span>
                          )}
                        </div>
                      ))}
                      {execution.logs.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {execution.logs.length - 5} more logs
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm">
                    <Activity className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  {execution.status === "failed" && (
                    <Button variant="outline" size="sm">
                      <Play className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredExecutions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No executions found</h3>
          <p className="text-muted-foreground">
            {executions.length === 0 
              ? "This workflow hasn't been executed yet."
              : "Try adjusting your search or filter criteria."
            }
          </p>
        </div>
      )}
    </div>
  );
}