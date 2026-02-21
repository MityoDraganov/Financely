import { WorkflowTriggerType, WorkflowActionType, WorkflowAction, Workflow, UpdateWorkflowInput } from "@/core";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "action" | "condition" | "delay" | "parallel";
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  parallelSteps?: string[];
  delaySeconds?: number;
  trueBranchSteps?: WorkflowStep[];
  falseBranchSteps?: WorkflowStep[];
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
      { value: "invoice.created", label: "Invoice Created" },
      { value: "invoice.sent", label: "Invoice Sent" },
      { value: "invoice.paid", label: "Invoice Paid" },
      { value: "invoice.overdue", label: "Invoice Overdue" },
    ],
  },
  {
    id: "proposal",
    label: "Proposal",
    triggers: [
      { value: "proposal.created", label: "Proposal Created" },
      { value: "proposal.sent", label: "Proposal Sent" },
      { value: "proposal.approved", label: "Proposal Approved" },
      { value: "proposal.rejected", label: "Proposal Rejected" },
      { value: "proposal.converted_to_invoice", label: "Proposal Converted to Invoice" },
    ],
  },
  {
    id: "lead",
    label: "Lead",
    triggers: [
      { value: "lead.created", label: "Lead Created" },
      { value: "lead.converted", label: "Lead Converted" },
      { value: "lead.qualified", label: "Lead Qualified" },
    ],
  },
  {
    id: "contact",
    label: "Contact",
    triggers: [
      { value: "contact.created", label: "Contact Created" },
      { value: "contact.updated", label: "Contact Updated" },
    ],
  },
  {
    id: "product",
    label: "Product",
    triggers: [
      { value: "product.created", label: "Product Created" },
      { value: "product.low_stock", label: "Product Low Stock" },
    ],
  },
  {
    id: "contract",
    label: "Contract",
    triggers: [
      { value: "contract.expiring", label: "Contract Expiring" },
      { value: "contract.expired", label: "Contract Expired" },
    ],
  },
  {
    id: "user",
    label: "User",
    triggers: [
      { value: "user.joined", label: "User Joined" },
    ],
  },
  {
    id: "system",
    label: "System",
    triggers: [
      { value: "schedule.cron", label: "Scheduled (Cron)" },
      { value: "webhook.external", label: "Webhook" },
      { value: "manual.trigger", label: "Manual Trigger" },
    ],
  },
];

export const ACTION_TYPES = [
  // Communication
  { value: "send.email", label: "Send Email" },
  { value: "send.slack", label: "Send Slack Message" },
  // Invoice
  { value: "update.invoice.status", label: "Update Invoice Status" },
  { value: "generate.pdf", label: "Generate PDF" },
  // Proposal
  { value: "create.proposal", label: "Create Proposal" },
  { value: "send.proposal", label: "Send Proposal" },
  { value: "convert.proposal_to_invoice", label: "Convert Proposal to Invoice" },
  // Lead
  { value: "create.lead", label: "Create Lead" },
  { value: "update.lead.status", label: "Update Lead Status" },
  { value: "convert.lead_to_contact", label: "Convert Lead to Contact" },
  // Contact
  { value: "create.contact", label: "Create Contact" },
  { value: "update.contact", label: "Update Contact" },
  // Product
  { value: "add.product_to_proposal", label: "Add Product to Proposal" },
  // Task
  // Integration
  { value: "call.webhook", label: "Call Webhook" },
  { value: "http_request", label: "HTTP Request" },
  { value: "create.stripe.invoice", label: "Create Stripe Invoice" },
  // System
  { value: "wait.delay", label: "Wait/Delay" },
  { value: "archive.record", label: "Archive Record" },
  { value: "update.field", label: "Update Field" },
] as const;

export interface WorkflowBuilderProps {
  editingWorkflow?: Workflow | null;
  onCancelEdit?: () => void;
  onPreview?: (workflow: Workflow) => void;
}

export interface WorkflowStepProps {
  step: WorkflowStep;
  stepIndex: number;
  workflowTriggerType?: WorkflowTriggerType;
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteStep: (stepId: string) => void;
}

export interface WorkflowActionProps {
  action: WorkflowAction;
  actionIndex: number;
  stepId: string;
  workflowTriggerType?: WorkflowTriggerType;
  onUpdateAction: (stepId: string, actionIndex: number, updates: Partial<WorkflowAction>) => void;
  onDeleteAction: (stepId: string, actionIndex: number) => void;
}

export interface WorkflowHeaderProps {
  workflow: Workflow;
  editingWorkflow?: Workflow | null;
  onUpdateWorkflow: (updates: UpdateWorkflowInput) => void;
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
  onEditStep?: (step: WorkflowStep) => void;
  onAddBranchStep?: (conditionStepId: string, branch: "true" | "false") => void;
  onUpdateBranchStep?: (conditionStepId: string, branch: "true" | "false", branchStepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteBranchStep?: (conditionStepId: string, branch: "true" | "false", branchStepId: string) => void;
}

export interface WorkflowActionsProps {
  workflow: Workflow;
  onSave: () => void;
  onPreview?: (workflow: Workflow) => void;
  isSaving: boolean;
}
