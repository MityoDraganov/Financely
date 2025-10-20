import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, AlertCircle, Eye, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { workflowService } from "@/services/workflow/workflow-service";
import { WorkflowExecution, WorkflowExecutionLog } from "@/core";

interface WorkflowExecutionHistoryProps {
  workflowId: string;
}

export function WorkflowExecutionHistory({ workflowId }: WorkflowExecutionHistoryProps) {
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);

  // Fetch workflow executions
  const { data: executions = [], isLoading, refetch } = useQuery({
    queryKey: ["workflow-executions", workflowId],
    queryFn: () => workflowService.listExecutions(workflowId, { limit: 50 }),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "running":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "cancelled":
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "running":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Running</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-100 text-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-100 text-red-800">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = end.getTime() - start.getTime();
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    if (duration < 3600000) return `${Math.round(duration / 60000)}m`;
    return `${Math.round(duration / 3600000)}h`;
  };

  const formatLogEntry = (log: WorkflowExecutionLog) => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const duration = log.duration ? `${log.duration}ms` : "";
    
    return {
      timestamp,
      duration,
      message: log.message || `${log.actionType} ${log.status}`,
      error: log.error,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading execution history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Execution History</h3>
          <p className="text-sm text-muted-foreground">
            View past workflow executions and their results
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {executions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h4 className="text-lg font-semibold">No executions yet</h4>
                <p className="text-muted-foreground">
                  This workflow hasn't been executed yet. Trigger it to see execution history.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Executions List */}
          <div className="space-y-4">
            <h4 className="font-medium">Recent Executions</h4>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {executions.map((execution) => (
                  <Card 
                    key={execution.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedExecution?.id === execution.id ? "ring-2 ring-primary" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <span className="font-medium text-sm">
                            {new Date(execution.startedAt).toLocaleString()}
                          </span>
                        </div>
                        {getStatusBadge(execution.status)}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Duration:</span>
                          <span className="font-medium">
                            {formatDuration(execution.startedAt, execution.completedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Steps:</span>
                          <span className="font-medium">{execution.logs.length}</span>
                        </div>
                        {execution.error && (
                          <div className="text-red-600 text-xs">
                            Error: {execution.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Execution Details */}
          <div className="space-y-4">
            <h4 className="font-medium">Execution Details</h4>
            {selectedExecution ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Execution {selectedExecution.id.slice(-8)}
                    </CardTitle>
                    {getStatusBadge(selectedExecution.status)}
                  </div>
                  <CardDescription>
                    Started {new Date(selectedExecution.startedAt).toLocaleString()}
                    {selectedExecution.completedAt && (
                      <span>
                        {" • "}Completed {new Date(selectedExecution.completedAt).toLocaleString()}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <div className="font-medium">
                        {formatDuration(selectedExecution.startedAt, selectedExecution.completedAt)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Steps:</span>
                      <div className="font-medium">{selectedExecution.logs.length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trigger:</span>
                      <div className="font-medium">{selectedExecution.triggerType}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="font-medium">{selectedExecution.status}</div>
                    </div>
                  </div>

                  {selectedExecution.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-red-800 font-medium text-sm mb-1">Error</div>
                      <div className="text-red-700 text-sm">{selectedExecution.error}</div>
                    </div>
                  )}

                  <div>
                    <h5 className="font-medium mb-2">Execution Log</h5>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {selectedExecution.logs.map((log, index) => {
                          const formatted = formatLogEntry(log);
                          return (
                            <div key={index} className="p-2 bg-muted/50 rounded-lg text-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{formatted.message}</span>
                                <span className="text-muted-foreground text-xs">
                                  {formatted.timestamp}
                                </span>
                              </div>
                              {formatted.duration && (
                                <div className="text-xs text-muted-foreground">
                                  Duration: {formatted.duration}
                                </div>
                              )}
                              {formatted.error && (
                                <div className="text-red-600 text-xs mt-1">
                                  {formatted.error}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <Eye className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">Select an execution</h4>
                      <p className="text-muted-foreground">
                        Choose an execution from the list to view its details
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
