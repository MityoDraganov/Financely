import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Zap, 
  Mail, 
  FileText, 
  Users, 
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Trash2,
  Play,
  GitBranch,
  Loader2
} from "lucide-react";
import { WorkflowStep, WorkflowTriggerType, WorkflowCondition } from "@/core";
import { cn } from "@/lib/utils";
import { AlertCircle as AlertCircleIcon } from "lucide-react";

interface WorkflowVisualFlowEnhancedProps {
  trigger: { type: WorkflowTriggerType };
  steps: WorkflowStep[];
  onAddStep: () => void;
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteStep: (stepId: string) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onAddBranchStep?: (conditionStepId: string, branch: "true" | "false") => void;
  onUpdateBranchStep?: (conditionStepId: string, branch: "true" | "false", branchStepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteBranchStep?: (conditionStepId: string, branch: "true" | "false", branchStepId: string) => void;
  onStepClick?: (stepId: string) => void;
  selectedStepId?: string;
  onAddAction?: (stepId: string, actionType?: string) => void;
  onEditAction?: (stepId: string, actionIndex: number) => void;
  onDeleteAction?: (stepId: string, actionIndex: number) => void;
  onEditStep?: (step: WorkflowStep) => void;
  validationErrors?: Record<string, string[]>;
  isExecuting?: boolean;
  executionStepId?: string;
  onStartExecution?: () => void;
  onStopExecution?: () => void;
}

const getTriggerIcon = (type: WorkflowTriggerType) => {
  if (type.startsWith("invoice")) return FileText;
  if (type.startsWith("proposal")) return FileText;
  if (type.startsWith("lead")) return Users;
  if (type.startsWith("contact")) return Users;
  if (type.startsWith("product")) return ShoppingCart;
  if (type.startsWith("contract")) return FileText;
  if (type.startsWith("user")) return Users;
  if (type === "schedule.cron") return Clock;
  if (type === "webhook.external") return Zap;
  return Zap;
};

const getActionIcon = (actionType: string) => {
  if (actionType.includes("email") || actionType === "send.email") return Mail;
  if (actionType.includes("invoice") || actionType === "create.invoice") return FileText;
  if (actionType.includes("proposal") || actionType === "create.proposal") return FileText;
  if (actionType.includes("task") || actionType === "create.task") return CheckCircle;
  if (actionType.includes("delay") || actionType === "wait.delay") return Clock;
  if (actionType.includes("webhook") || actionType === "call.webhook" || actionType === "http_request") return Zap;
  if (actionType.includes("notify") || actionType === "notify.user") return AlertCircle;
  return Settings;
};

const getStepTypeIcon = (stepType: WorkflowStep['type']) => {
  switch (stepType) {
    case 'condition': return GitBranch;
    case 'delay': return Clock;
    case 'parallel': return Settings;
    default: return CheckCircle;
  }
};

const renderStepCard = (
  step: WorkflowStep,
  index: number,
  isSelected: boolean,
  _isDragging: boolean,
  isExecutingStep: boolean,
  stepErrors: string[],
  StepTypeIcon: React.ComponentType<{ className?: string }>,
  actionCount: number,
  t: (key: string, options?: Record<string, unknown>) => string,
  getActionIcon: (actionType: string) => React.ComponentType<{ className?: string }>,
  isBranchStep = false,
  branchColor: "green" | "red" = "green",
  onStepClick?: (stepId: string) => void,
  onEditStep?: (step: WorkflowStep) => void,
  onDeleteStep?: (stepId: string) => void,
  onEditAction?: (stepId: string, actionIndex: number) => void
) => {
  return (
    <div 
      className={cn(
        "relative bg-white dark:bg-[#1f2937] border border-gray-300 dark:border-gray-600 rounded-lg",
        "shadow-sm hover:shadow-md transition-all duration-200",
        "cursor-pointer min-w-[200px] max-w-[280px]",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg",
        isExecutingStep && "ring-2 ring-yellow-400 dark:ring-yellow-500 animate-pulse",
        stepErrors.length > 0 && "border-red-500 dark:border-red-400",
        isBranchStep && branchColor === "green" && "border-l-4 border-l-green-500",
        isBranchStep && branchColor === "red" && "border-l-4 border-l-red-500"
      )}
      onClick={() => onStepClick?.(step.id)}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div className={cn(
          "w-7 h-7 rounded flex items-center justify-center shrink-0",
          "bg-gray-100 dark:bg-gray-700"
        )}>
          <StepTypeIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {step.name || t('workflows.builder.steps.unnamedStep', { number: index + 1 })}
          </h4>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onEditStep?.(step);
            }}
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteStep?.(step.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Node Body */}
      <div className="px-3 py-2">
        {/* Validation Errors */}
        {stepErrors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-2">
            <AlertCircle className="w-3 h-3" />
            <span>{stepErrors[0]}</span>
          </div>
        )}
        
        {/* Actions Preview */}
        {actionCount > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {step.actions.slice(0, 2).map((action: import("@/core").WorkflowAction, actionIndex: number) => {
              const ActionIcon = getActionIcon(action.type);
              return (
                <div
                  key={actionIndex}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAction?.(step.id, actionIndex);
                  }}
                >
                  <ActionIcon className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">
                    {action.name || action.type.split('.').pop()}
                  </span>
                </div>
              );
            })}
            {actionCount > 2 && (
              <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 dark:text-gray-400">
                +{actionCount - 2}
              </div>
            )}
          </div>
        )}
        
        {actionCount === 0 && step.type === 'action' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            {t('workflows.builder.steps.noActions')}
          </p>
        )}
      </div>
    </div>
  );
};

export function WorkflowVisualFlowEnhanced({
  trigger,
  steps,
  onAddStep,
  onDeleteStep,
  onReorderSteps,
  onAddBranchStep,
  onUpdateBranchStep,
  onDeleteBranchStep,
  onStepClick,
  selectedStepId,
  onEditAction,
  onEditStep,
  validationErrors = {},
  isExecuting = false,
  executionStepId,
  onStartExecution,
  onStopExecution,
}: WorkflowVisualFlowEnhancedProps) {
  const { t } = useTranslation();
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const TriggerIcon = getTriggerIcon(trigger.type);

  const handleDragStart = (e: React.DragEvent, stepId: string, index: number) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", stepId);
    e.dataTransfer.setData("application/json", JSON.stringify({ stepId, index }));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    
    if (!data) return;
    
    try {
      const { index: dragIndex } = JSON.parse(data);
      if (dragIndex !== dropIndex && dragIndex !== dropIndex - 1) {
        onReorderSteps(dragIndex, dropIndex);
      }
    } catch (error) {
      console.error("Error parsing drag data:", error);
    }
    
    setDraggedStepId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedStepId(null);
    setDragOverIndex(null);
  };

  // Update step orders after reordering
  const reorderedSteps = steps.map((step, index) => ({
    ...step,
    order: index,
  }));

  return (
    <div className="space-y-6">
      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {Object.entries(validationErrors).map(([key, errors]) => (
                <div key={key}>
                  <strong>{key}:</strong> {errors.join(", ")}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Execution Controls */}
      {onStartExecution && (
        <div className="flex items-center justify-end gap-2">
          {isExecuting ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopExecution}
              className="gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('workflows.preview.stop')}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onStartExecution}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {t('workflows.preview.simulateExecution')}
            </Button>
          )}
        </div>
      )}

      {/* Visual Flow Container - n8n style */}
      <div className="p-8 bg-gray-50 dark:bg-[#111827] rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="space-y-4">
          {/* Trigger Node - n8n style */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className={cn(
                "bg-white dark:bg-[#1f2937] border border-gray-300 dark:border-gray-600 rounded-lg",
                "shadow-sm hover:shadow-md transition-all duration-200",
                "min-w-[200px] max-w-[280px]"
              )}>
                <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-7 h-7 rounded flex items-center justify-center bg-gray-100 dark:bg-gray-700 shrink-0">
                    <TriggerIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                    {t(`workflows.triggers.${trigger.type.replace(/\./g, '')}`) || trigger.type}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Connection Line - n8n style curved */}
            {steps.length > 0 && (
              <svg className="w-full h-16 my-1" style={{ overflow: 'visible' }} viewBox="0 0 100 60" preserveAspectRatio="none">
                <defs>
                  <marker id="arrowhead-trigger" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                    <polygon points="0 0, 8 3, 0 6" fill="#6b7280" className="dark:fill-gray-500" />
                  </marker>
                </defs>
                <path
                  d="M 50 0 Q 50 20, 50 40"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  className="dark:stroke-gray-600"
                  markerEnd="url(#arrowhead-trigger)"
                />
              </svg>
            )}
          </div>

          {/* Steps with Drag and Drop */}
          <div className="space-y-6">
            {reorderedSteps.map((step, index) => {
              const isSelected = selectedStepId === step.id;
              const isDragging = draggedStepId === step.id;
              const isDragOver = dragOverIndex === index;
              const isExecutingStep = isExecuting && executionStepId === step.id;
              const actionCount = step.actions.length;
              const stepErrors = validationErrors[step.id] || [];
              const StepTypeIcon = getStepTypeIcon(step.type);
              const isConditionStep = step.type === "condition";
              
              return (
                <div key={step.id}>
                  {isConditionStep ? (
                    // Conditional Branching Visualization
                    <div className="relative w-full">
                      {/* Condition Step (Diamond Shape) */}
                      <div 
                        className="flex flex-col items-center mb-6"
                        draggable
                        onDragStart={(e) => handleDragStart(e, step.id, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        {/* Drop Indicator */}
                        {isDragOver && !isDragging && (
                          <div className="w-full h-1 bg-primary rounded-full mb-2 animate-pulse" />
                        )}

                        <div className={cn(
                          "relative transition-all duration-200",
                          isSelected && "scale-105",
                          isDragging && "opacity-50",
                          isExecutingStep && "ring-2 ring-primary ring-offset-2"
                        )}>
                          {/* Diamond-shaped condition card - n8n style */}
                          <div 
                            className={cn(
                              "cursor-pointer border-2 transition-all duration-200",
                              "hover:shadow-lg",
                              "relative w-44 h-44 flex items-center justify-center",
                              "bg-white dark:bg-gray-800",
                              isSelected 
                                ? "border-blue-500 dark:border-blue-400 shadow-lg ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2" 
                                : "border-purple-400 dark:border-purple-500 shadow-md",
                              isExecutingStep && "border-yellow-400 dark:border-yellow-500 animate-pulse",
                              stepErrors.length > 0 && "border-red-500 dark:border-red-400"
                            )}
                            onClick={() => onStepClick?.(step.id)}
                            style={{
                              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                            }}
                          >
                            <div className="text-center px-3 py-2 w-full transform -rotate-45">
                              <div className="transform rotate-45">
                                <GitBranch className="w-4 h-4 mx-auto mb-1.5 text-purple-600 dark:text-purple-400" />
                                <p className="text-[10px] font-medium text-gray-900 dark:text-gray-100 mb-1.5 line-clamp-1">
                                  {step.name || "Condition"}
                                </p>
                                {/* Conditions inside rhombus */}
                                {step.conditions && step.conditions.length > 0 && (
                                  <div className="space-y-0.5 max-h-16 overflow-y-auto">
                                    {step.conditions.map((condition: WorkflowCondition, condIndex: number) => (
                                      <div key={condIndex} className="text-[8px] text-gray-700 dark:text-gray-300 leading-tight px-1">
                                        <span className="font-medium">{condition.field}</span>{" "}
                                        <span className="text-purple-600 dark:text-purple-400">
                                          {condition.operator.replace(/_/g, " ")}
                                        </span>{" "}
                                        <span className="font-medium">{String(condition.value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Edit/Delete buttons */}
                            <div className="absolute top-0 right-0 flex gap-1 transform translate-x-1/2 -translate-y-1/2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 bg-background/90 hover:bg-background border shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditStep?.(step);
                                }}
                              >
                                <Settings className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 bg-background/90 hover:bg-background border shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteStep(step.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Branching Paths - Visual Split */}
                      <div className="relative w-full mt-8" style={{ minHeight: '240px' }}>
                        {/* Curved SVG Paths Container - n8n style */}
                        <svg className="absolute top-0 left-0 w-full pointer-events-none" style={{ height: '240px', zIndex: 0 }} viewBox="0 0 100 240" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id={`greenGradient-${step.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.4" />
                            </linearGradient>
                            <linearGradient id={`redGradient-${step.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" />
                              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                            </linearGradient>
                            <marker id={`arrowhead-green-${step.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                              <polygon points="0 0, 10 3, 0 6" fill="#22c55e" />
                            </marker>
                            <marker id={`arrowhead-red-${step.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                              <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
                            </marker>
                          </defs>
                          {/* True Branch Curve (Left) - n8n style cubic Bezier */}
                          <path
                            d="M 50 40 C 35 90, 25 140, 20 190"
                            stroke={`url(#greenGradient-${step.id})`}
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            markerEnd={`url(#arrowhead-green-${step.id})`}
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(34, 197, 94, 0.3))' }}
                          />
                          {/* False Branch Curve (Right) - n8n style cubic Bezier */}
                          <path
                            d="M 50 40 C 65 90, 75 140, 80 190"
                            stroke={`url(#redGradient-${step.id})`}
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            markerEnd={`url(#arrowhead-red-${step.id})`}
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(239, 68, 68, 0.3))' }}
                          />
                        </svg>
                        
                        {/* Branching Lines Container */}
                        <div className="relative flex justify-between items-start px-4 md:px-12 mt-8 gap-8">
                          {/* True Branch (Left Path) */}
                          <div className="flex-1 flex flex-col items-center relative min-w-0">
                            {/* Branch Label */}
                            <div className="flex items-center gap-2 mb-3 mt-24 relative z-10">
                              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 text-xs font-semibold whitespace-nowrap shadow-sm">
                                ✓ True
                              </Badge>
                            </div>
                            
                            {/* Vertical Line */}
                            <div className="w-0.5 h-8 bg-gradient-to-b from-green-500/80 via-green-500/50 to-green-500/30 dark:from-green-600/80 dark:via-green-600/50 dark:to-green-600/30 mt-2"></div>
                            
                            {/* Connection Point Indicator */}
                            <div className="w-3 h-3 rounded-full bg-green-500 dark:bg-green-600 border-2 border-background shadow-md mt-2"></div>
                            
                            {/* True Branch Steps */}
                            <div className="mt-4 w-full space-y-4">
                              {step.trueBranchSteps && step.trueBranchSteps.length > 0 ? (
                                step.trueBranchSteps.map((branchStep: WorkflowStep, branchIndex: number) => (
                                  <div key={branchStep.id} className="relative">
                                    {/* Connection Line */}
                                    {branchIndex > 0 && (
                                      <div className="w-0.5 h-4 bg-green-500/50 dark:bg-green-600/50 mx-auto mb-2"></div>
                                    )}
                                    {renderStepCard(
                                      branchStep,
                                      branchIndex,
                                      selectedStepId === branchStep.id,
                                      false,
                                      false,
                                      validationErrors[branchStep.id] || [],
                                      getStepTypeIcon(branchStep.type),
                                      branchStep.actions.length,
                                      t,
                                      getActionIcon,
                                      true,
                                      "green",
                                      onStepClick,
                                      onUpdateBranchStep ? (s: WorkflowStep) => onUpdateBranchStep(step.id, "true", s.id, s) : undefined,
                                      onDeleteBranchStep ? (stepId: string) => onDeleteBranchStep(step.id, "true", stepId) : undefined,
                                      onEditAction
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 bg-green-50/30 dark:bg-green-950/10 border border-dashed border-green-300 dark:border-green-700 rounded-lg text-center">
                                  <p className="text-xs text-green-700 dark:text-green-300 mb-2">No steps in true branch</p>
                                  {onAddBranchStep && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/20"
                                      onClick={() => onAddBranchStep(step.id, "true")}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add Step
                                    </Button>
                                  )}
                                </div>
                              )}
                              {/* Add Step Button for True Branch - Outlined Plus Circle */}
                              {onAddBranchStep && (
                                <div className="flex flex-col items-center pt-2">
                                  {/* Connection Line */}
                                  {(step.trueBranchSteps?.length || 0) > 0 && (
                                    <div className="w-0.5 h-4 bg-green-500/50 dark:bg-green-600/50 mb-2"></div>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => onAddBranchStep(step.id, "true")}
                                    className="rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/10 hover:bg-green-100 dark:hover:bg-green-900/20"
                                  >
                                    <Plus className="w-5 h-5 text-green-700 dark:text-green-300" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* False Branch (Right Path) */}
                          <div className="flex-1 flex flex-col items-center relative min-w-0">
                            {/* Branch Label */}
                            <div className="flex items-center gap-2 mb-3 mt-24 relative z-10">
                              <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs font-semibold whitespace-nowrap shadow-sm">
                                ✗ False
                              </Badge>
                            </div>
                            
                            {/* Vertical Line */}
                            <div className="w-0.5 h-8 bg-gradient-to-b from-red-500/80 via-red-500/50 to-red-500/30 dark:from-red-600/80 dark:via-red-600/50 dark:to-red-600/30 mt-2"></div>
                            
                            {/* Connection Point Indicator */}
                            <div className="w-3 h-3 rounded-full bg-red-500 dark:bg-red-600 border-2 border-background shadow-md mt-2"></div>
                            
                            {/* False Branch Steps */}
                            <div className="mt-4 w-full space-y-4">
                              {step.falseBranchSteps && step.falseBranchSteps.length > 0 ? (
                                step.falseBranchSteps.map((branchStep: WorkflowStep, branchIndex: number) => (
                                  <div key={branchStep.id} className="relative">
                                    {/* Connection Line */}
                                    {branchIndex > 0 && (
                                      <div className="w-0.5 h-4 bg-red-500/50 dark:bg-red-600/50 mx-auto mb-2"></div>
                                    )}
                                    {renderStepCard(
                                      branchStep,
                                      branchIndex,
                                      selectedStepId === branchStep.id,
                                      false,
                                      false,
                                      validationErrors[branchStep.id] || [],
                                      getStepTypeIcon(branchStep.type),
                                      branchStep.actions.length,
                                      t,
                                      getActionIcon,
                                      true,
                                      "red",
                                      onStepClick,
                                      onUpdateBranchStep ? (s) => onUpdateBranchStep(step.id, "false", s.id, s) : undefined,
                                      onDeleteBranchStep ? (stepId) => onDeleteBranchStep(step.id, "false", stepId) : undefined,
                                      onEditAction
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 bg-red-50/30 dark:bg-red-950/10 border border-dashed border-red-300 dark:border-red-700 rounded-lg text-center">
                                  <p className="text-xs text-red-700 dark:text-red-300 mb-2">No steps in false branch</p>
                                  {onAddBranchStep && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
                                      onClick={() => onAddBranchStep(step.id, "false")}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Add Step
                                    </Button>
                                  )}
                                </div>
                              )}
                              {/* Add Step Button for False Branch - Outlined Plus Circle */}
                              {onAddBranchStep && (
                                <div className="flex flex-col items-center pt-2">
                                  {/* Connection Line */}
                                  {(step.falseBranchSteps?.length || 0) > 0 && (
                                    <div className="w-0.5 h-4 bg-red-500/50 dark:bg-red-600/50 mb-2"></div>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => onAddBranchStep(step.id, "false")}
                                    className="rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-900/20"
                                  >
                                    <Plus className="w-5 h-5 text-red-700 dark:text-red-300" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Regular Step (Non-Conditional)
                    <div 
                      className="flex flex-col items-center"
                      draggable
                      onDragStart={(e) => handleDragStart(e, step.id, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      {/* Drop Indicator */}
                      {isDragOver && !isDragging && (
                        <div className="w-full h-1 bg-primary rounded-full mb-2 animate-pulse" />
                      )}

                      <div className={cn(
                        "relative w-full max-w-md transition-all duration-200",
                        isSelected && "scale-105",
                        isDragging && "opacity-50",
                        isExecutingStep && "ring-2 ring-primary ring-offset-2"
                      )}>
                        {renderStepCard(
                          step,
                          index,
                          isSelected,
                          isDragging,
                          isExecutingStep,
                          stepErrors,
                          StepTypeIcon,
                          actionCount,
                          t,
                          getActionIcon,
                          false,
                          "green",
                          onStepClick,
                          onEditStep,
                          onDeleteStep,
                          onEditAction
                        )}
                      </div>
                      
                      {/* Connection Line */}
                      {index < steps.length - 1 && (
                        <div className={cn(
                          "w-0.5 h-8 my-2 transition-colors",
                          isExecutingStep 
                            ? "bg-primary animate-pulse" 
                            : "bg-gradient-to-b from-primary/40 to-primary/20"
                        )} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Step Button - Only show if no condition step exists */}
          {!steps.some(s => s.type === "condition") && (
            <div className="flex flex-col items-center pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={onAddStep}
                className="rounded-full w-14 h-14 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed"
              >
                <Plus className="w-6 h-6" />
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('workflows.builder.steps.addStep')}
              </p>
            </div>
          )}
        </div>
    </div>
    </div>
  );
}
