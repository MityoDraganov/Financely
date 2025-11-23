import { useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Position,
  Handle,
  NodeProps,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Zap,
  FileText,
  Users,
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Trash2,
  GitBranch,
} from "lucide-react";
import { WorkflowStep, WorkflowTriggerType, WorkflowCondition } from "@/core";
import { cn } from "@/lib/utils";

interface WorkflowVisualFlowReactFlowProps {
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

const getStepTypeIcon = (stepType: WorkflowStep['type']) => {
  switch (stepType) {
    case 'condition': return GitBranch;
    case 'delay': return Clock;
    case 'parallel': return Settings;
    default: return CheckCircle;
  }
};

// Custom Node Components - n8n style
const WorkflowNode = ({ data, selected }: NodeProps<{ step: WorkflowStep; onEdit?: () => void; onDelete?: () => void; errors?: string[]; isExecuting?: boolean }>) => {
  const { step, onEdit, onDelete, errors = [], isExecuting = false } = data;
  const StepTypeIcon = getStepTypeIcon(step.type);

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#1f2937] border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm",
        "min-w-[240px] max-w-[320px] transition-all group",
        "hover:shadow-md",
        selected && "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg border-blue-500 dark:border-blue-400",
        isExecuting && "ring-2 ring-yellow-400 dark:ring-yellow-500 animate-pulse",
        errors.length > 0 && "border-red-500 dark:border-red-400"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800" />
      
      {/* Node Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-100 dark:bg-gray-700 shrink-0">
          <StepTypeIcon className="w-4.5 h-4.5 text-gray-700 dark:text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
            {step.actions.length > 0 
              ? (step.actions[0].name || step.actions[0].type.split('.').pop() || `Step ${step.order + 1}`)
              : (step.name || `Step ${step.order + 1}`)
            }
            {step.actions.length > 1 && (
              <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                +{step.actions.length - 1}
              </span>
            )}
          </h4>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Node Body */}
      <div className="px-4 py-3">
        {errors.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors[0]}</span>
          </div>
        )}
        
        {step.actions.length === 0 && step.type === 'action' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            No actions configured
          </p>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800" />
    </div>
  );
};

const ConditionNode = ({ data, selected }: NodeProps<{ step: WorkflowStep; onEdit?: () => void; onDelete?: () => void; errors?: string[]; isExecuting?: boolean; onAddBranchStep?: (branch: "true" | "false") => void }>) => {
  const { step, onEdit, onDelete, errors = [], isExecuting = false } = data;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800" />
      
      {/* Diamond Shape */}
      <div
        className={cn(
          "cursor-pointer border-2 transition-all duration-200",
          "relative w-48 h-48 flex items-center justify-center",
          "bg-white dark:bg-[#1f2937]",
          selected
            ? "border-blue-500 dark:border-blue-400 shadow-lg ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2"
            : "border-purple-400 dark:border-purple-500 shadow-md hover:shadow-lg",
          isExecuting && "border-yellow-400 dark:border-yellow-500 animate-pulse",
          errors.length > 0 && "border-red-500 dark:border-red-400"
        )}
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
        <div className="absolute top-0 right-0 flex gap-1 transform translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border shadow-sm relative z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Settings className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border shadow-sm relative z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* True Branch Handle */}
      <Handle
        type="source"
        id="true"
        position={Position.Bottom}
        style={{ left: '30%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-gray-800"
      />
      
      {/* False Branch Handle */}
      <Handle
        type="source"
        id="false"
        position={Position.Bottom}
        style={{ left: '70%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-800"
      />
    </div>
  );
};

const TriggerNode = ({ data }: NodeProps<{ trigger: { type: WorkflowTriggerType }; label: string }>) => {
  const { label } = data;
  const TriggerIcon = getTriggerIcon(data.trigger.type);

  return (
    <div className="bg-white dark:bg-[#1f2937] border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm min-w-[240px] max-w-[320px] hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-100 dark:bg-gray-700 shrink-0">
          <TriggerIcon className="w-4.5 h-4.5 text-gray-700 dark:text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1 leading-tight">
          {label}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white dark:!border-gray-800" />
    </div>
  );
};

const AddStepButtonNode = ({ data }: NodeProps<{ conditionStepId: string; branch: "true" | "false"; onAddBranchStep?: (conditionStepId: string, branch: "true" | "false") => void }>) => {
  const { conditionStepId, branch, onAddBranchStep } = data;
  const branchColor = branch === "true" ? "green" : "red";

  return (
    <div className="flex flex-col items-center">
      <Handle type="target" position={Position.Top} className={cn(branchColor === "green" ? "!bg-green-500" : "!bg-red-500", "!w-3 !h-3 !border-2 !border-white dark:!border-gray-800")} />
      <Button
        variant="outline"
        size="lg"
        onClick={() => onAddBranchStep?.(conditionStepId, branch)}
        className={cn(
          "rounded-full w-12 h-12 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed",
          branchColor === "green"
            ? "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/10 hover:bg-green-100 dark:hover:bg-green-900/20"
            : "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-900/20"
        )}
      >
        <Plus className={cn("w-5 h-5", branchColor === "green" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")} />
      </Button>
    </div>
  );
};

const BranchStepNode = ({ data, selected }: NodeProps<{ step: WorkflowStep; branch: "true" | "false"; onEdit?: () => void; onDelete?: () => void; errors?: string[]; isExecuting?: boolean }>) => {
  const { step, branch, onEdit, onDelete, errors = [], isExecuting = false } = data;
  const StepTypeIcon = getStepTypeIcon(step.type);
  const branchColor = branch === "true" ? "green" : "red";

  return (
    <div
      className={cn(
        "bg-white dark:bg-[#1f2937] border rounded-lg shadow-sm min-w-[200px] max-w-[280px] transition-all",
        branchColor === "green" ? "border-l-4 border-l-green-500 border-gray-300 dark:border-gray-600" : "border-l-4 border-l-red-500 border-gray-300 dark:border-gray-600",
        selected && "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg",
        isExecuting && "ring-2 ring-yellow-400 dark:ring-yellow-500 animate-pulse"
      )}
    >
      <Handle type="target" position={Position.Top} className={cn(branchColor === "green" ? "!bg-green-500" : "!bg-red-500", "!w-3 !h-3 !border-2 !border-white dark:!border-gray-800")} />
      
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <div className="w-7 h-7 rounded flex items-center justify-center bg-gray-100 dark:bg-gray-700 shrink-0">
          <StepTypeIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {step.actions.length > 0 
              ? (step.actions[0].name || step.actions[0].type.split('.').pop() || `Step ${step.order + 1}`)
              : (step.name || `Step ${step.order + 1}`)
            }
            {step.actions.length > 1 && (
              <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                +{step.actions.length - 1}
              </span>
            )}
          </h4>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      <div className="px-3 py-2">
        {errors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>{errors[0]}</span>
          </div>
        )}
        
        {step.actions.length === 0 && step.type === 'action' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            No actions configured
          </p>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className={cn(branchColor === "green" ? "!bg-green-500" : "!bg-red-500", "!w-3 !h-3 !border-2 !border-white dark:!border-gray-800")} />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  workflow: WorkflowNode,
  condition: ConditionNode,
  branchStep: BranchStepNode,
  addStepButton: AddStepButtonNode,
};

export function WorkflowVisualFlowReactFlow({
  trigger,
  steps,
  onAddStep,
  onDeleteStep,
  onAddBranchStep,
  onDeleteBranchStep,
  onStepClick,
  selectedStepId,
  onEditStep,
  validationErrors = {},
  isExecuting = false,
  executionStepId,
}: WorkflowVisualFlowReactFlowProps) {
  const { t } = useTranslation();

  // Convert workflow steps to React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Trigger node
    flowNodes.push({
      id: "trigger",
      type: "trigger",
      position: { x: 400, y: 0 },
      data: {
        trigger,
        label: t(`workflows.triggers.${trigger.type.replace(/\./g, '')}`) || trigger.type,
      },
    });

    let yPosition = 120;
    const xPosition = 400;

    steps.forEach((step, index) => {
      if (step.type === "condition") {
        // Condition node
        const conditionNode: Node = {
          id: step.id,
          type: "condition",
          position: { x: xPosition - 88, y: yPosition },
          data: {
            step,
            onEdit: () => onEditStep?.(step),
            onDelete: () => onDeleteStep(step.id),
            errors: validationErrors[step.id] || [],
            isExecuting: isExecuting && executionStepId === step.id,
            onAddBranchStep: onAddBranchStep ? (branch: "true" | "false") => onAddBranchStep(step.id, branch) : undefined,
          },
          selected: selectedStepId === step.id,
        };
        flowNodes.push(conditionNode);

        // Edge from trigger or previous step
        const sourceId = index === 0 ? "trigger" : steps[index - 1].id;
        flowEdges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
          target: step.id,
          type: "bezier",
          animated: isExecuting && executionStepId === step.id,
          style: { stroke: "#9ca3af", strokeWidth: 2 },
        });

        // True branch steps
        const trueBranchLastY = step.trueBranchSteps && step.trueBranchSteps.length > 0
          ? yPosition + 200 + ((step.trueBranchSteps.length - 1) * 120)
          : yPosition + 200;

        if (step.trueBranchSteps && step.trueBranchSteps.length > 0) {
          step.trueBranchSteps.forEach((branchStep: any, branchIndex: number) => {
            const branchNode: Node = {
              id: `${step.id}-true-${branchStep.id}`,
              type: "workflow", // Use workflow type for identical styling
              position: {
                x: xPosition - 300,
                y: yPosition + 200 + branchIndex * 120,
              },
              data: {
                step: branchStep,
                onEdit: () => onEditStep?.(branchStep),
                onDelete: () => onDeleteBranchStep?.(step.id, "true", branchStep.id),
                errors: validationErrors[branchStep.id] || [],
                isExecuting: isExecuting && executionStepId === branchStep.id,
              },
              selected: selectedStepId === branchStep.id,
            };
            flowNodes.push(branchNode);

            // Edge from condition to first branch step, or from previous branch step
            if (branchIndex === 0) {
              flowEdges.push({
                id: `${step.id}-true-${branchStep.id}`,
                source: step.id,
                target: `${step.id}-true-${branchStep.id}`,
                sourceHandle: "true",
                type: "bezier",
                animated: isExecuting && executionStepId === branchStep.id,
                style: { stroke: "#22c55e", strokeWidth: 2.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
              });
            } else if (step.trueBranchSteps && step.trueBranchSteps[branchIndex - 1]) {
              flowEdges.push({
                id: `${step.id}-true-${step.trueBranchSteps[branchIndex - 1].id}-${branchStep.id}`,
                source: `${step.id}-true-${step.trueBranchSteps[branchIndex - 1].id}`,
                target: `${step.id}-true-${branchStep.id}`,
                type: "bezier",
                style: { stroke: "#22c55e", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
              });
            }
          });
        }

        // Add "Add Step" button node for true branch
        if (onAddBranchStep) {
          const addButtonNode: Node = {
            id: `${step.id}-add-true`,
            type: "addStepButton",
            position: {
              x: xPosition - 300,
              y: trueBranchLastY + 120,
            },
            data: {
              conditionStepId: step.id,
              branch: "true" as const,
              onAddBranchStep,
            },
            draggable: false,
          };
          flowNodes.push(addButtonNode);

          // Connect last branch step (or condition) to add button
          const lastTrueStepId = (step.trueBranchSteps && step.trueBranchSteps.length > 0)
            ? `${step.id}-true-${step.trueBranchSteps[step.trueBranchSteps.length - 1]?.id ?? ''}`
            : step.id;
          flowEdges.push({
            id: `${lastTrueStepId}-add-true`,
            source: lastTrueStepId,
            target: `${step.id}-add-true`,
            sourceHandle: lastTrueStepId === step.id ? "true" : undefined,
            type: "bezier",
            style: { stroke: "#22c55e", strokeWidth: 2, strokeDasharray: "5,5" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
          });
        }

        // False branch steps
        const falseBranchLastY = (step.falseBranchSteps && step.falseBranchSteps.length > 0)
          ? yPosition + 200 + ((step.falseBranchSteps.length - 1) * 120)
          : yPosition + 200;

        if (step.falseBranchSteps && step.falseBranchSteps.length > 0) {
          step.falseBranchSteps.forEach((branchStep: any, branchIndex: number) => {
            const branchNode: Node = {
              id: `${step.id}-false-${branchStep.id}`,
              type: "workflow", // Use workflow type instead of branchStep for identical styling
              position: {
                x: xPosition + 300,
                y: yPosition + 200 + branchIndex * 120,
              },
              data: {
                step: branchStep,
                onEdit: () => onEditStep?.(branchStep),
                onDelete: () => onDeleteBranchStep?.(step.id, "false", branchStep.id),
                errors: validationErrors[branchStep.id] || [],
                isExecuting: isExecuting && executionStepId === branchStep.id,
              },
              selected: selectedStepId === branchStep.id,
            };
            flowNodes.push(branchNode);

            // Edge from condition to first branch step, or from previous branch step
            if (branchIndex === 0) {
              flowEdges.push({
                id: `${step.id}-false-${branchStep.id}`,
                source: step.id,
                target: `${step.id}-false-${branchStep.id}`,
                sourceHandle: "false",
                type: "bezier",
                animated: isExecuting && executionStepId === branchStep.id,
                style: { stroke: "#ef4444", strokeWidth: 2.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
              });
            } else if (step.falseBranchSteps && step.falseBranchSteps[branchIndex - 1]) {
              flowEdges.push({
                id: `${step.id}-false-${step.falseBranchSteps[branchIndex - 1].id}-${branchStep.id}`,
                source: `${step.id}-false-${step.falseBranchSteps[branchIndex - 1].id}`,
                target: `${step.id}-false-${branchStep.id}`,
                type: "bezier",
                style: { stroke: "#ef4444", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
              });
            }
          });
        }

        // Add "Add Step" button node for false branch
        if (onAddBranchStep) {
          const addButtonNode: Node = {
            id: `${step.id}-add-false`,
            type: "addStepButton",
            position: {
              x: xPosition + 300,
              y: falseBranchLastY + 120,
            },
            data: {
              conditionStepId: step.id,
              branch: "false" as const,
              onAddBranchStep,
            },
            draggable: false,
          };
          flowNodes.push(addButtonNode);

          // Connect last branch step (or condition) to add button
          const lastFalseStepId = (step.falseBranchSteps && step.falseBranchSteps.length > 0)
            ? `${step.id}-false-${step.falseBranchSteps[step.falseBranchSteps.length - 1]?.id ?? ''}`
            : step.id;
          flowEdges.push({
            id: `${lastFalseStepId}-add-false`,
            source: lastFalseStepId,
            target: `${step.id}-add-false`,
            sourceHandle: lastFalseStepId === step.id ? "false" : undefined,
            type: "bezier",
            style: { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5,5" },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#ef4444" },
          });
        }

        yPosition += 400;
      } else {
        // Regular workflow node
        const workflowNode: Node = {
          id: step.id,
          type: "workflow",
          position: { x: xPosition - 100, y: yPosition },
          data: {
            step,
            onEdit: () => onEditStep?.(step),
            onDelete: () => onDeleteStep(step.id),
            errors: validationErrors[step.id] || [],
            isExecuting: isExecuting && executionStepId === step.id,
          },
          selected: selectedStepId === step.id,
        };
        flowNodes.push(workflowNode);

        // Edge from trigger or previous step
        const sourceId = index === 0 ? "trigger" : steps[index - 1].id;
        flowEdges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
          target: step.id,
          type: "bezier",
          animated: isExecuting && executionStepId === step.id,
          style: { stroke: "#9ca3af", strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280" },
        });

        yPosition += 120;
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [trigger, steps, selectedStepId, validationErrors, isExecuting, executionStepId, onEditStep, onDeleteStep, onDeleteBranchStep, onAddBranchStep, t]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update nodes and edges when props change
  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Don't trigger node click if clicking on a button or interactive element
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        return;
      }
      onStepClick?.(node.id);
    },
    [onStepClick]
  );

  return (
    <ReactFlowProvider>
      <div className="w-full h-[600px] bg-gray-50 dark:bg-[#111827] rounded-lg border border-gray-200 dark:border-gray-800 relative">
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.3,
            maxZoom: 1,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          className="bg-gray-50 dark:bg-[#111827]"
          connectionLineStyle={{ stroke: "#9ca3af", strokeWidth: 2 }}
          defaultEdgeOptions={{
            type: "bezier",
            animated: false,
            style: { strokeWidth: 2 },
          }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" className="dark:!opacity-20" />
          <Controls className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" />
        </ReactFlow>
        
        {/* Add Step Button */}
        {!steps.some(s => s.type === "condition") && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <Button
              variant="outline"
              size="lg"
              onClick={onAddStep}
              className="rounded-full w-14 h-14 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed bg-white dark:bg-gray-800"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}

