import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Play, Save, X, Eye } from "lucide-react";
import { JsonEditor } from "@/components/ui/json-editor";
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
  id: string;
  type: WorkflowActionType;
  name: string;
  config: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    auth?: {
      type: "bearer" | "basic" | "none";
      token?: string;
      username?: string;
      password?: string;
    };
    timeoutMs?: number;
  };
}

interface WorkflowCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
  value: string | number | boolean;
}

interface TriggerGroup {
  id: string;
  label: string;
  triggers: { value: WorkflowTriggerType; label: string }[];
}

const TRIGGER_GROUPS: TriggerGroup[] = [
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


  const [workflow, setWorkflow] = useState<Partial<CreateWorkflowInput>>({
    name: "",
    description: "",
    trigger: { type: "manual.trigger" },
    steps: [],
    status: "active",
    tags: [],
    category: "general",
  });


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
        status: "active",
        tags: [],
        category: "general",
        n8nEnabled: false,
      });
    }
  }, [editingWorkflow]);

  const validateWorkflowData = (workflowData: any): string[] => {
    const errors: string[] = [];
    
    // Check for undefined values
    const checkForUndefined = (obj: any, path: string = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (value === undefined) {
          errors.push(`Undefined value found at ${currentPath}`);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkForUndefined(value, currentPath);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item === undefined) {
              errors.push(`Undefined value found at ${currentPath}[${index}]`);
            } else if (item && typeof item === 'object') {
              checkForUndefined(item, `${currentPath}[${index}]`);
            }
          });
        }
      }
    };
    
    checkForUndefined(workflowData);
    return errors;
  };

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

        // Validate for undefined values
        const validationErrors = validateWorkflowData(workflowData);
        if (validationErrors.length > 0) {
          console.error("Validation errors:", validationErrors);
          toast.error(`Validation failed: ${validationErrors.join(", ")}`);
          return;
        }

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
          status: "active" as const,
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

        console.log("Sending workflow data:", JSON.stringify(workflowData, null, 2));
        await createWorkflow.mutateAsync(workflowData);
        toast.success("Workflow created successfully!");
        
        // Reset form
        setWorkflow({
          name: "",
          description: "",
          trigger: { type: "manual.trigger" },
          steps: [],
          status: "active",
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
    
    const updatedSteps = [...(workflow.steps || []), newStep];
    setWorkflow({ ...workflow, steps: updatedSteps });
  };


  const deleteStep = (stepId: string) => {
    const updatedSteps = (workflow.steps || []).filter(step => step.id !== stepId);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const addAction = (stepId: string) => {
    const step = workflow.steps?.find(s => s.id === stepId);
    if (!step) return;

    const newAction: WorkflowAction = {
      id: `action_${Date.now()}`,
      type: "http_request",
      name: "",
      config: {
        method: "POST",
        url: "",
        // auth field is optional, so we don't include it by default
      },
    };
    
    const updatedStep = {
      ...step,
      actions: [...step.actions, newAction],
    };

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
                {TRIGGER_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                      {group.label}
                    </div>
                    {group.triggers.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value} className="pl-6">
                    {trigger.label}
                  </SelectItem>
                    ))}
                  </div>
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
        <CardContent className="space-y-6">
          {workflow.steps?.map((step, index) => (
            <Card key={step.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="text-xs">Step {index + 1}</Badge>
                      <Input
                        placeholder={`Step ${index + 1} name`}
                        value={step.name}
                        onChange={(e) => {
                          const updatedSteps = [...(workflow.steps || [])];
                          const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                          if (stepIndex >= 0) {
                            updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], name: e.target.value };
                            setWorkflow({ ...workflow, steps: updatedSteps });
                          }
                        }}
                        className="font-semibold border-none shadow-none p-0 h-auto"
                      />
                    </div>
                      </div>
                        <Button
                      variant="outline"
                          size="sm"
                          onClick={() => deleteStep(step.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {step.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                      <Badge variant="secondary">{action.type}</Badge>
                          <span className="text-sm font-medium">Action {actionIndex + 1}</span>
                    </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updatedSteps = [...(workflow.steps || [])];
                            const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                            if (stepIndex >= 0) {
                              const updatedActions = step.actions.filter((_, idx) => idx !== actionIndex);
                              updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                              setWorkflow({ ...workflow, steps: updatedSteps });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Action Configuration */}
                      <div className="space-y-4">
                          <div>
                          <Label>Action Name</Label>
                            <Input
                            placeholder="Send notification to Slack"
                            value={action.name}
                            onChange={(e) => {
                              const updatedSteps = [...(workflow.steps || [])];
                              const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                              if (stepIndex >= 0) {
                                const updatedActions = [...step.actions];
                                updatedActions[actionIndex] = { ...action, name: e.target.value };
                                updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                setWorkflow({ ...workflow, steps: updatedSteps });
                              }
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>URL *</Label>
                            <Input
                              placeholder="https://api.stripe.com/v1/customers/{customerId}"
                              value={action.config.url}
                              onChange={(e) => {
                                const updatedSteps = [...(workflow.steps || [])];
                                const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                if (stepIndex >= 0) {
                                  const updatedActions = [...step.actions];
                                  updatedActions[actionIndex] = { 
                                ...action,
                                config: { ...action.config, url: e.target.value }
                                  };
                                  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                  setWorkflow({ ...workflow, steps: updatedSteps });
                                }
                              }}
                            />
                          </div>
                          <div>
                            <Label>Method</Label>
                            <Select
                              value={action.config.method}
                              onValueChange={(value) => {
                                const updatedSteps = [...(workflow.steps || [])];
                                const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                if (stepIndex >= 0) {
                                  const updatedActions = [...step.actions];
                                  updatedActions[actionIndex] = { 
                                ...action,
                                    config: { ...action.config, method: value as "GET" | "POST" | "PUT" | "DELETE" | "PATCH" } 
                                  };
                                  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                  setWorkflow({ ...workflow, steps: updatedSteps });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="PATCH">PATCH</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <JsonEditor
                          label="Headers (JSON)"
                          placeholder='{"Content-Type": "application/json", "Authorization": "Bearer {token}"}'
                          value={action.config.headers ? JSON.stringify(action.config.headers, null, 2) : ""}
                          onChange={(value) => {
                            try {
                              const headers = value.trim() ? JSON.parse(value) : undefined;
                              const updatedSteps = [...(workflow.steps || [])];
                              const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                              if (stepIndex >= 0) {
                                const updatedActions = [...step.actions];
                                updatedActions[actionIndex] = { 
                                  ...action, 
                                  config: { ...action.config, headers } 
                                };
                                updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                setWorkflow({ ...workflow, steps: updatedSteps });
                              }
                            } catch {
                              // Invalid JSON, keep as is - validation will show error
                            }
                          }}
                          rows={3}
                        />

                        <JsonEditor
                          label="Body (JSON)"
                          placeholder='{"name": "John Doe", "email": "john@example.com"}'
                          value={action.config.body ? JSON.stringify(action.config.body, null, 2) : ""}
                          onChange={(value) => {
                            try {
                              const body = value.trim() ? JSON.parse(value) : undefined;
                              const updatedSteps = [...(workflow.steps || [])];
                              const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                              if (stepIndex >= 0) {
                                const updatedActions = [...step.actions];
                                updatedActions[actionIndex] = { 
                                  ...action, 
                                  config: { ...action.config, body } 
                                };
                                updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                setWorkflow({ ...workflow, steps: updatedSteps });
                              }
                            } catch {
                              // Invalid JSON, keep as is - validation will show error
                            }
                          }}
                          rows={4}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Authentication</Label>
                            <Select
                              value={action.config.auth?.type || "none"}
                              onValueChange={(value) => {
                                const authType = value as "bearer" | "basic" | "none";
                                const updatedSteps = [...(workflow.steps || [])];
                                const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                if (stepIndex >= 0) {
                                  const updatedActions = [...step.actions];
                                  updatedActions[actionIndex] = { 
                                    ...action,
                                    config: { 
                                      ...action.config, 
                                      auth: authType === "none" ? undefined : { type: authType } 
                                    } 
                                  };
                                  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                  setWorkflow({ ...workflow, steps: updatedSteps });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="bearer">Bearer Token</SelectItem>
                                <SelectItem value="basic">Basic Auth</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Timeout (milliseconds)</Label>
                                    <Input
                                      type="number"
                              placeholder="30000"
                              value={action.config.timeoutMs || ""}
                              onChange={(e) => {
                                const timeoutMs = parseInt(e.target.value) || undefined;
                                const updatedSteps = [...(workflow.steps || [])];
                                const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                if (stepIndex >= 0) {
                                  const updatedActions = [...step.actions];
                                  updatedActions[actionIndex] = { 
                                ...action,
                                    config: { ...action.config, timeoutMs } 
                                  };
                                  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                  setWorkflow({ ...workflow, steps: updatedSteps });
                                }
                              }}
                            />
                          </div>
                        </div>

                        {action.config.auth?.type === "bearer" && (
                          <div>
                            <Label>Bearer Token</Label>
                            <Input
                              placeholder="{secret.bearer_token}"
                              value={action.config.auth.token || ""}
                              onChange={(e) => {
                                const updatedSteps = [...(workflow.steps || [])];
                                const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                if (stepIndex >= 0) {
                                  const updatedActions = [...step.actions];
                                  updatedActions[actionIndex] = { 
                                    ...action, 
                                    config: { 
                                      ...action.config, 
                                      auth: { 
                                        type: action.config.auth?.type || "bearer",
                                        ...action.config.auth, 
                                        token: e.target.value 
                                      } 
                                    } 
                                  };
                                  updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                  setWorkflow({ ...workflow, steps: updatedSteps });
                                }
                              }}
                            />
                          </div>
                        )}

                        {action.config.auth?.type === "basic" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Username</Label>
                              <Input
                                placeholder="{secret.username}"
                                value={action.config.auth.username || ""}
                                onChange={(e) => {
                                  const updatedSteps = [...(workflow.steps || [])];
                                  const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                  if (stepIndex >= 0) {
                                    const updatedActions = [...step.actions];
                                    updatedActions[actionIndex] = { 
                                      ...action, 
                                      config: { 
                                        ...action.config, 
                                        auth: { 
                                          type: action.config.auth?.type || "basic",
                                          ...action.config.auth, 
                                          username: e.target.value 
                                        } 
                                      } 
                                    };
                                    updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                    setWorkflow({ ...workflow, steps: updatedSteps });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <Label>Password</Label>
                              <Input
                                type="password"
                                placeholder="{secret.password}"
                                value={action.config.auth.password || ""}
                                onChange={(e) => {
                                  const updatedSteps = [...(workflow.steps || [])];
                                  const stepIndex = updatedSteps.findIndex(s => s.id === step.id);
                                  if (stepIndex >= 0) {
                                    const updatedActions = [...step.actions];
                                    updatedActions[actionIndex] = { 
                                      ...action, 
                                      config: { 
                                        ...action.config, 
                                        auth: { 
                                          type: action.config.auth?.type || "basic",
                                          ...action.config.auth, 
                                          password: e.target.value 
                                        } 
                                      } 
                                    };
                                    updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], actions: updatedActions };
                                    setWorkflow({ ...workflow, steps: updatedSteps });
                                  }
                                }}
                                    />
                                  </div>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                  
                  <Button
                    variant="outline"
                    onClick={() => addAction(step.id)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
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