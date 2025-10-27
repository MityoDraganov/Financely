import { WorkflowTriggerType, WorkflowActionType, WorkflowAction } from "@/core";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "action" | "condition" | "delay" | "parallel";
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  order: number;
}

export interface WorkflowCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
  value: string | number | boolean;
}

export interface TriggerGroup {
  id: string;
  label: string;
  triggers: { value: WorkflowTriggerType; label: string }[];
}

export const TRIGGER_GROUPS: TriggerGroup[] = [
  {
    id: "invoice",
    label: "Invoice",
    triggers: [
      { value: "invoice.created", label: "Created" },
      { value: "invoice.paid", label: "Paid" },
    ],
  },
  {
    id: "manual",
    label: "Manual",
    triggers: [
      { value: "manual.trigger", label: "Manual Trigger" },
    ],
  },
];

export const ACTION_TYPES = [
  { value: "http_request", label: "HTTP Request" },
  { value: "send_email", label: "Send Email" },
] as const;

export interface WorkflowBuilderProps {
  editingWorkflow?: any | null;
  onCancelEdit?: () => void;
  onPreview?: (workflow: any) => void;
}

export interface WorkflowStepProps {
  step: WorkflowStep;
  stepIndex: number;
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteStep: (stepId: string) => void;
}

export interface WorkflowActionProps {
  action: WorkflowAction;
  actionIndex: number;
  stepId: string;
  onUpdateAction: (stepId: string, actionIndex: number, updates: Partial<WorkflowAction>) => void;
  onDeleteAction: (stepId: string, actionIndex: number) => void;
}

export interface WorkflowHeaderProps {
  workflow: any;
  editingWorkflow?: any | null;
  onUpdateWorkflow: (updates: any) => void;
  onCancelEdit?: () => void;
}

export interface WorkflowStepsProps {
  steps: WorkflowStep[];
  onAddStep: () => void;
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteStep: (stepId: string) => void;
  onAddAction: (stepId: string, actionType: WorkflowActionType) => void;
  onUpdateAction: (stepId: string, actionIndex: number, updates: Partial<WorkflowAction>) => void;
  onDeleteAction: (stepId: string, actionIndex: number) => void;
}

export interface WorkflowActionsProps {
  workflow: any;
  onSave: () => void;
  onPreview?: (workflow: any) => void;
  isSaving: boolean;
}

