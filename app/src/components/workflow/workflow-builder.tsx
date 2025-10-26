import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Play, Save, Settings, X, Eye } from "lucide-react";
import { WorkflowTriggerType, WorkflowActionType, CreateWorkflowInput, Workflow } from "@/core";
import { useCreateWorkflow } from "@/hooks/repository-hooks/use-workflows";
import { useOrganizationContext } from "@/contexts/organization-context";
import { toast } from "sonner";

interface WorkflowStep {
  id: string;
  name: string;
  type: "action" | "condition" | "delay" | "parallel";
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  order: number;
}

interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

interface WorkflowCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
  value: string | number | boolean;
}

const TRIGGER_TYPES: { value: WorkflowTriggerType; label: string }[] = [
  { value: "invoice.created", label: "Invoice Created" },
  { value: "invoice.sent", label: "Invoice Sent" },
  { value: "invoice.paid", label: "Invoice Paid" },
  { value: "invoice.overdue", label: "Invoice Overdue" },
  { value: "proposal.created", label: "Proposal Created" },
  { value: "proposal.approved", label: "Proposal Approved" },
  { value: "proposal.rejected", label: "Proposal Rejected" },
  { value: "contract.expiring", label: "Contract Expiring" },
  { value: "contract.expired", label: "Contract Expired" },
  { value: "user.joined", label: "User Joined" },
  { value: "manual.trigger", label: "Manual Trigger" },
];

const ACTION_TYPES: { value: WorkflowActionType; label: string }[] = [
  { value: "send.email", label: "Send Email" },
  { value: "send.slack", label: "Send Slack Message" },
  { value: "create.invoice", label: "Create Invoice" },
  { value: "update.invoice.status", label: "Update Invoice Status" },
  { value: "create.task", label: "Create Task" },
  { value: "assign.task", label: "Assign Task" },
  { value: "generate.pdf", label: "Generate PDF" },
  { value: "call.webhook", label: "Call Webhook" },
  { value: "create.stripe.invoice", label: "Create Stripe Invoice" },
  { value: "wait.delay", label: "Wait/Delay" },
  { value: "notify.user", label: "Notify User" },
  { value: "archive.record", label: "Archive Record" },
  { value: "update.field", label: "Update Field" },
];

// Condition operators for future use
// const CONDITION_OPERATORS = [
//   { value: "equals", label: "Equals" },
//   { value: "not_equals", label: "Not Equals" },
//   { value: "greater_than", label: "Greater Than" },
//   { value: "less_than", label: "Less Than" },
//   { value: "contains", label: "Contains" },
//   { value: "not_contains", label: "Not Contains" },
//   { value: "is_empty", label: "Is Empty" },
//   { value: "is_not_empty", label: "Is Not Empty" },
// ];

interface WorkflowBuilderProps {
  editingWorkflow?: Workflow | null;
  onCancelEdit?: () => void;
  onPreview?: (workflow: Partial<CreateWorkflowInput>) => void;
}

export default function WorkflowBuilder(props: WorkflowBuilderProps = {}) {
  const { editingWorkflow, onCancelEdit, onPreview } = props;
  const { currentOrganization } = useOrganizationContext();
  const createWorkflow = useCreateWorkflow();

  // Helper function to safely get config values
  const getConfigValue = (config: Record<string, unknown>, key: string, defaultValue: string = ""): string => {
    return (config[key] as string) || defaultValue;
  };

  const [workflow, setWorkflow] = useState<Partial<CreateWorkflowInput>>({
    name: "",
    description: "",
    trigger: { type: "manual.trigger" },
    steps: [],
    status: "draft",
    tags: [],
    category: "general",
  });

  const [currentStep, setCurrentStep] = useState<WorkflowStep | null>(null);
  const [isEditingStep, setIsEditingStep] = useState(false);

  // Populate form when editing a workflow
  useEffect(() => {
    if (editingWorkflow) {
      setWorkflow({
        name: editingWorkflow.name,
        description: editingWorkflow.description,
        trigger: editingWorkflow.trigger,
        steps: editingWorkflow.steps,
        tags: editingWorkflow.tags,
        n8nEnabled: editingWorkflow.n8nEnabled,
        status: editingWorkflow.status,
        category: editingWorkflow.category,
      });
    } else {
      // Reset form when not editing
      setWorkflow({
        name: "",
        description: "",
        trigger: { type: "manual.trigger" },
        steps: [],
        status: "draft",
        tags: [],
        category: "general",
        n8nEnabled: false,
      });
    }
  }, [editingWorkflow]);

  const handleSaveWorkflow = async () => {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    if (!workflow.name || !workflow.trigger || workflow.steps?.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingWorkflow) {
        // Update existing workflow
        const workflowData = {
          orgId: currentOrganization.id,
          name: workflow.name,
          description: workflow.description || "",
          trigger: workflow.trigger,
          steps: workflow.steps || [],
          status: workflow.status || "draft",
          tags: workflow.tags || [],
          category: workflow.category || "general",
          version: editingWorkflow.version ?? 1,
          settings: {
            maxRetries: 3,
            timeoutSeconds: 300,
            notifyOnFailure: true,
            notifyOnSuccess: false,
            maxConcurrentExecutions: 10,
          },
          n8nEnabled: workflow.n8nEnabled || false,
        };

        // TODO: Implement update workflow - for now, create a new one
        await createWorkflow.mutateAsync(workflowData);
        toast.success("Workflow updated successfully!");
        
        // Reset form and exit edit mode
        setWorkflow({
          name: "",
          description: "",
          trigger: { type: "manual.trigger" },
          steps: [],
          status: "draft",
          tags: [],
          category: "general",
          n8nEnabled: false,
        });
        
        if (onCancelEdit) {
          onCancelEdit();
        }
      } else {
        // Create new workflow
        const workflowData = {
          orgId: currentOrganization.id,
          name: workflow.name,
          description: workflow.description || "",
          trigger: workflow.trigger,
          steps: workflow.steps || [],
          status: "draft" as const,
          tags: workflow.tags || [],
          category: workflow.category || "general",
          version: 1,
          settings: {
            maxRetries: 3,
            timeoutSeconds: 300,
            notifyOnFailure: true,
            notifyOnSuccess: false,
            maxConcurrentExecutions: 10,
          },
          n8nEnabled: workflow.n8nEnabled || false,
        };

        await createWorkflow.mutateAsync(workflowData);
        toast.success("Workflow created successfully!");
        
        // Reset form
        setWorkflow({
          name: "",
          description: "",
          trigger: { type: "manual.trigger" },
          steps: [],
          status: "draft",
          tags: [],
          category: "general",
          n8nEnabled: false,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to ${editingWorkflow ? 'update' : 'create'} workflow: ${errorMessage}`);
    }
  };

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: "",
      type: "action",
      actions: [],
      order: (workflow.steps?.length || 0),
    };
    
    setCurrentStep(newStep);
    setIsEditingStep(true);
  };

  const saveStep = () => {
    if (!currentStep) return;

    const updatedSteps = [...(workflow.steps || [])];
    const existingIndex = updatedSteps.findIndex(step => step.id === currentStep.id);
    
    if (existingIndex >= 0) {
      updatedSteps[existingIndex] = currentStep;
    } else {
      updatedSteps.push(currentStep);
    }

    setWorkflow({ ...workflow, steps: updatedSteps });
    setCurrentStep(null);
    setIsEditingStep(false);
  };

  const deleteStep = (stepId: string) => {
    const updatedSteps = (workflow.steps || []).filter(step => step.id !== stepId);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const addAction = (stepId: string) => {
    const step = workflow.steps?.find(s => s.id === stepId);
    if (!step) return;

    const newAction: WorkflowAction = {
      type: "send.email",
      config: {},
    };
    
    const updatedStep = {
      ...step,
      actions: [...step.actions, newAction],
    };

    const updatedSteps = (workflow.steps || []).map(s => s.id === stepId ? updatedStep : s);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const updateAction = (stepId: string, actionIndex: number, action: WorkflowAction) => {
    const step = workflow.steps?.find(s => s.id === stepId);
    if (!step) return;

    const updatedActions = [...step.actions];
    updatedActions[actionIndex] = action;
    
    const updatedStep = { ...step, actions: updatedActions };
    const updatedSteps = (workflow.steps || []).map(s => s.id === stepId ? updatedStep : s);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const deleteAction = (stepId: string, actionIndex: number) => {
    const step = workflow.steps?.find(s => s.id === stepId);
    if (!step) return;

    const updatedActions = step.actions.filter((_, index) => index !== actionIndex);
    const updatedStep = { ...step, actions: updatedActions };
    const updatedSteps = (workflow.steps || []).map(s => s.id === stepId ? updatedStep : s);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {editingWorkflow ? `Edit Workflow: ${editingWorkflow.name}` : "Create New Workflow"}
                    {editingWorkflow && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Editing
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {editingWorkflow 
                      ? "Modify your existing workflow automation. Changes will be saved when you click Save."
                      : "Build automated workflows to streamline your business processes"
                    }
                  </CardDescription>
                </div>
                {editingWorkflow && onCancelEdit && (
                  <Button variant="outline" onClick={onCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <Label htmlFor="name">Workflow Name *</Label>
                <Input
                  id="name"
                value={workflow.name || ""}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                  placeholder="Enter workflow name"
                />
              </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={workflow.category || "general"}
                onValueChange={(value) => setWorkflow({ ...workflow, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="contracts">Contracts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
              value={workflow.description || ""}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                  placeholder="Describe what this workflow does"
                  rows={3}
                />
              </div>

              <div>
            <Label htmlFor="trigger">Trigger *</Label>
                <Select
              value={workflow.trigger?.type || "manual.trigger"}
              onValueChange={(value) => setWorkflow({ 
                ...workflow, 
                trigger: { type: value as WorkflowTriggerType } 
              })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                {TRIGGER_TYPES.map((trigger) => (
                  <SelectItem key={trigger.value} value={trigger.value}>
                    {trigger.label}
                  </SelectItem>
                ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

        {/* Workflow Steps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Steps</CardTitle>
              <CardDescription>
                Define the actions and conditions for your workflow
              </CardDescription>
            </div>
            <Button onClick={addStep}>
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflow.steps?.map((step, index) => (
            <Card key={step.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{step.name || `Step ${index + 1}`}</h4>
                    <p className="text-sm text-muted-foreground">
                      {step.actions.length} action(s)
                    </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                      variant="outline"
                          size="sm"
                      onClick={() => {
                        setCurrentStep(step);
                        setIsEditingStep(true);
                      }}
                        >
                      <Settings className="w-4 h-4 mr-1" />
                      Edit
                        </Button>
                        <Button
                      variant="outline"
                          size="sm"
                          onClick={() => deleteStep(step.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {step.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <Badge variant="secondary">{action.type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {ACTION_TYPES.find(a => a.value === action.type)?.label}
                      </span>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addAction(step.id)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Action
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {workflow.steps?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No steps added yet. Click "Add Step" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Editor Modal */}
      {isEditingStep && currentStep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Edit Step</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                <Label htmlFor="stepName">Step Name</Label>
                      <Input
                  id="stepName"
                  value={currentStep.name}
                  onChange={(e) => setCurrentStep({ ...currentStep, name: e.target.value })}
                        placeholder="Enter step name"
                      />
                    </div>

                    <div>
                <Label>Actions</Label>
                <div className="space-y-2">
                  {currentStep.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Select
                          value={action.type}
                          onValueChange={(value) => {
                            const updatedAction = { ...action, type: value as WorkflowActionType };
                            updateAction(currentStep.id, actionIndex, updatedAction);
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map((actionType) => (
                              <SelectItem key={actionType.value} value={actionType.value}>
                                {actionType.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAction(currentStep.id, actionIndex)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Action-specific configuration */}
                      {action.type === "send.email" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Recipient Email</Label>
                            <Input
                              placeholder="customer@example.com"
                              value={getConfigValue(action.config, "recipient")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, recipient: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Subject</Label>
                            <Input
                              placeholder="Invoice Reminder"
                              value={getConfigValue(action.config, "subject")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, subject: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Template ID (Optional)</Label>
                            <Input
                              placeholder="invoice-reminder-template"
                              value={getConfigValue(action.config, "templateId")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, templateId: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === "send.slack" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://hooks.slack.com/services/..."
                              value={getConfigValue(action.config, "webhookUrl")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, webhookUrl: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Channel</Label>
                            <Input
                              placeholder="#general"
                              value={getConfigValue(action.config, "channel")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, channel: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Message</Label>
                            <Textarea
                              placeholder="Invoice {{invoice.number}} is overdue"
                              value={getConfigValue(action.config, "message")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, message: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === "create.invoice" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Customer ID</Label>
                            <Input
                              placeholder="{{invoice.customerId}}"
                              value={getConfigValue(action.config, "customerId")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, customerId: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Amount</Label>
                            <Input
                              placeholder="{{invoice.amount}}"
                              value={getConfigValue(action.config, "amount")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, amount: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Input
                              placeholder="Monthly service fee"
                              value={getConfigValue(action.config, "description")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, description: e.target.value }
                              })}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === "update.invoice.status" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Invoice ID</Label>
                            <Input
                              placeholder="{{invoice.id}}"
                              value={getConfigValue(action.config, "invoiceId")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, invoiceId: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Status</Label>
                            <Select
                              value={getConfigValue(action.config, "status")}
                              onValueChange={(value) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, status: value }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {action.type === "create.task" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Task Title</Label>
                            <Input
                              placeholder="Review Proposal"
                              value={getConfigValue(action.config, "title")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, title: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              placeholder="Please review the proposal and provide feedback"
                              value={getConfigValue(action.config, "description")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, description: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Assignee ID</Label>
                            <Input
                              placeholder="{{user.id}}"
                              value={getConfigValue(action.config, "assigneeId")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, assigneeId: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Priority</Label>
                                  <Select
                              value={getConfigValue(action.config, "priority", "medium")}
                              onValueChange={(value) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, priority: value }
                              })}
                            >
                              <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                        </div>
                      )}

                      {action.type === "call.webhook" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Webhook URL</Label>
                                    <Input
                              placeholder="https://api.example.com/webhook"
                              value={getConfigValue(action.config, "url")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, url: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Method</Label>
                            <Select
                              value={getConfigValue(action.config, "method", "POST")}
                              onValueChange={(value) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, method: value }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Headers (JSON)</Label>
                            <Textarea
                              placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token"}'
                              value={action.config.headers ? JSON.stringify(action.config.headers, null, 2) : ""}
                              onChange={(e) => {
                                try {
                                  const headers = JSON.parse(e.target.value);
                                  updateAction(currentStep.id, actionIndex, {
                                    ...action,
                                    config: { ...action.config, headers }
                                  });
                                } catch {
                                  // Invalid JSON, keep as is
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {action.type === "notify.user" && (
                        <div className="space-y-2">
                          <div>
                            <Label>User ID</Label>
                                    <Input
                              placeholder="{{user.id}}"
                              value={getConfigValue(action.config, "userId")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, userId: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Message</Label>
                            <Textarea
                              placeholder="Invoice {{invoice.number}} has been approved"
                              value={getConfigValue(action.config, "message")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, message: e.target.value }
                              })}
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select
                              value={getConfigValue(action.config, "type", "info")}
                              onValueChange={(value) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, type: value }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                                <SelectItem value="success">Success</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                                  </div>
                                )}

                                {action.type === "wait.delay" && (
                        <div className="space-y-2">
                          <div>
                            <Label>Delay (seconds)</Label>
                                    <Input
                                      type="number"
                              placeholder="300"
                              value={getConfigValue(action.config, "delaySeconds")}
                              onChange={(e) => updateAction(currentStep.id, actionIndex, {
                                ...action,
                                config: { ...action.config, delaySeconds: parseInt(e.target.value) || 0 }
                              })}
                                    />
                                  </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newAction: WorkflowAction = {
                        type: "send.email",
                        config: {},
                      };
                      setCurrentStep({
                        ...currentStep,
                        actions: [...currentStep.actions, newAction]
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Action
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditingStep(false)}>
                  Cancel
                </Button>
                <Button onClick={saveStep}>
                  Save Step
                </Button>
                    </div>
                  </CardContent>
                </Card>
        </div>
      )}

      {/* Save Workflow */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">
          <Play className="w-4 h-4 mr-2" />
          Test Workflow
        </Button>
        {onPreview && (
          <Button 
            variant="outline" 
            onClick={() => onPreview(workflow)}
            disabled={!workflow.name || !workflow.trigger || (workflow.steps?.length || 0) === 0}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        )}
        <Button onClick={handleSaveWorkflow} disabled={createWorkflow.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {createWorkflow.isPending 
            ? (editingWorkflow ? "Updating..." : "Creating...") 
            : (editingWorkflow ? "Update Workflow" : "Save Workflow")
          }
        </Button>
      </div>
    </div>
  );
}