import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { WorkflowData } from "@/core";
import { cn } from "@/lib/utils";

interface ExecutionPreviewProps {
  workflow: Partial<WorkflowData>;
  onClose?: () => void;
  className?: string;
}

type ExecutionStatus = "idle" | "running" | "completed" | "failed" | "stopped";

interface ExecutionState {
  status: ExecutionStatus;
  currentStepId: string | null;
  completedSteps: string[];
  failedSteps: string[];
  logs: Array<{
    stepId: string;
    actionId: string;
    status: "started" | "completed" | "failed";
    message: string;
    timestamp: Date;
  }>;
  error?: string;
}

export function ExecutionPreview({
  workflow,
  onClose,
  className,
}: ExecutionPreviewProps) {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: "idle",
    currentStepId: null,
    completedSteps: [],
    failedSteps: [],
    logs: [],
  });

  const [simulationSpeed] = useState(1000); // ms per step

  useEffect(() => {
    if (executionState.status === "running") {
      const timer = setTimeout(() => {
        simulateNextStep();
      }, simulationSpeed);
      return () => clearTimeout(timer);
    }
  }, [executionState.status, executionState.currentStepId]);

  const simulateNextStep = () => {
    if (!workflow.steps || workflow.steps.length === 0) {
      setExecutionState((prev) => ({
        ...prev,
        status: "failed",
        error: "No steps to execute",
      }));
      return;
    }

    const currentIndex = executionState.currentStepId
      ? workflow.steps.findIndex((s) => s.id === executionState.currentStepId)
      : -1;

    const nextIndex = currentIndex + 1;

    if (nextIndex >= workflow.steps.length) {
      // All steps completed
      setExecutionState((prev) => ({
        ...prev,
        status: "completed",
        currentStepId: null,
      }));
      return;
    }

    const nextStep = workflow.steps[nextIndex];

    // Simulate step execution
    setExecutionState((prev) => {
      const newLogs = [
        ...prev.logs,
        {
          stepId: nextStep.id,
          actionId: nextStep.actions[0]?.id || "unknown",
          status: "started" as const,
          message: `Executing step: ${nextStep.name}`,
          timestamp: new Date(),
        },
      ];

      // Simulate action execution
      nextStep.actions.forEach((action: any) => {
        newLogs.push({
          stepId: nextStep.id,
          actionId: action.id,
          status: "completed" as const,
          message: `Action "${action.name || action.type}" completed`,
          timestamp: new Date(),
        });
      });

      // Simulate step completion
      newLogs.push({
        stepId: nextStep.id,
        actionId: nextStep.actions[0]?.id || "unknown",
        status: "completed" as const,
        message: `Step "${nextStep.name}" completed`,
        timestamp: new Date(),
      });

      return {
        ...prev,
        currentStepId: nextStep.id,
        completedSteps: [...prev.completedSteps, nextStep.id],
        logs: newLogs,
      };
    });
  };

  const startExecution = () => {
    setExecutionState({
      status: "running",
      currentStepId: null,
      completedSteps: [],
      failedSteps: [],
      logs: [
        {
          stepId: "trigger",
          actionId: "trigger",
          status: "started",
          message: `Workflow triggered: ${workflow.trigger?.type || "unknown"}`,
          timestamp: new Date(),
        },
      ],
    });
  };

  const stopExecution = () => {
    setExecutionState((prev) => ({
      ...prev,
      status: "stopped",
      currentStepId: null,
    }));
  };

  const resetExecution = () => {
    setExecutionState({
      status: "idle",
      currentStepId: null,
      completedSteps: [],
      failedSteps: [],
      logs: [],
    });
  };

  const getStepStatus = (stepId: string): "pending" | "running" | "completed" | "failed" => {
    if (executionState.completedSteps.includes(stepId)) return "completed";
    if (executionState.failedSteps.includes(stepId)) return "failed";
    if (executionState.currentStepId === stepId) return "running";
    return "pending";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Execution Preview</CardTitle>
            <CardDescription>
              Simulate workflow execution in real-time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {executionState.status === "idle" && (
              <Button size="sm" onClick={startExecution} className="gap-2">
                <Play className="w-4 h-4" />
                Start
              </Button>
            )}
            {executionState.status === "running" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={stopExecution}
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
            {(executionState.status === "completed" ||
              executionState.status === "failed" ||
              executionState.status === "stopped") && (
              <Button size="sm" variant="outline" onClick={resetExecution} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            )}
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge
            variant={
              executionState.status === "completed"
                ? "default"
                : executionState.status === "failed" || executionState.status === "stopped"
                ? "destructive"
                : executionState.status === "running"
                ? "secondary"
                : "outline"
            }
          >
            {executionState.status === "idle" && "Idle"}
            {executionState.status === "running" && (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Running
              </>
            )}
            {executionState.status === "completed" && "Completed"}
            {executionState.status === "failed" && "Failed"}
            {executionState.status === "stopped" && "Stopped"}
          </Badge>
        </div>

        {/* Error Alert */}
        {executionState.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{executionState.error}</AlertDescription>
          </Alert>
        )}

        {/* Steps Execution Status */}
        {workflow.steps && workflow.steps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Steps:</h4>
            {workflow.steps.map((step, index) => {
              const status = getStepStatus(step.id);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    status === "running" && "bg-primary/10 border-primary",
                    status === "completed" && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                    status === "failed" && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                    status === "pending" && "bg-muted"
                  )}
                >
                  <div className="flex-shrink-0">
                    {status === "running" && (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    )}
                    {status === "completed" && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                    {status === "failed" && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    {status === "pending" && (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{step.name || `Step ${index + 1}`}</span>
                      <Badge variant="outline" className="text-xs">
                        {step.actions.length} action{step.actions.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Execution Logs */}
        {executionState.logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Execution Logs:</h4>
            <div className="max-h-64 overflow-y-auto space-y-1 p-3 bg-muted rounded-lg">
              {executionState.logs.map((log, index) => (
                <div
                  key={index}
                  className="text-xs font-mono flex items-start gap-2"
                >
                  <span className="text-muted-foreground">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      log.status === "completed" && "text-green-600",
                      log.status === "failed" && "text-red-600",
                      log.status === "started" && "text-blue-600"
                    )}
                  >
                    [{log.status.toUpperCase()}]
                  </span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

