import { useState } from "react";
import { Plus, Trash2, Play, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Workflow, WorkflowStep, WorkflowAction, WorkflowTrigger } from "@/core";

interface WorkflowBuilderProps {
  workflow?: Workflow;
  onSave: (workflow: Partial<Workflow>) => void;
  onCancel: () => void;
}

export function WorkflowBuilder({ workflow, onSave, onCancel }: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [trigger, setTrigger] = useState<WorkflowTrigger>(workflow?.trigger || {
    type: "manual.trigger",
    config: {},
  });
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps || []);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      type: "action",
      actions: [],
      order: steps.length,
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const deleteStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId));
    if (selectedStep === stepId) {
      setSelectedStep(null);
    }
  };

  const addAction = (stepId: string) => {
    const newAction: WorkflowAction = {
      type: "send.email",
      config: {},
    };
    
    updateStep(stepId, {
      actions: [...(steps.find(s => s.id === stepId)?.actions || []), newAction]
    });
  };

  const updateAction = (stepId: string, actionIndex: number, updates: Partial<WorkflowAction>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const updatedActions = [...step.actions];
    updatedActions[actionIndex] = { ...updatedActions[actionIndex], ...updates };
    
    updateStep(stepId, { actions: updatedActions });
  };

  const deleteAction = (stepId: string, actionIndex: number) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const updatedActions = step.actions.filter((_, index) => index !== actionIndex);
    updateStep(stepId, { actions: updatedActions });
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a workflow name");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      trigger,
      steps: steps.sort((a, b) => a.order - b.order),
    });
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "send.email":
        return "Send Email";
      case "send.slack":
        return "Send Slack Message";
      case "create.invoice":
        return "Create Invoice";
      case "update.invoice.status":
        return "Update Invoice Status";
      case "wait.delay":
        return "Wait/Delay";
      case "call.webhook":
        return "Call Webhook";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {workflow ? "Edit Workflow" : "Create Workflow"}
          </h2>
          <p className="text-muted-foreground">
            Design your automation workflow step by step
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter workflow name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this workflow does"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trigger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="trigger-type">Trigger Type</Label>
                <Select
                  value={trigger.type}
                  onValueChange={(value) => setTrigger({ ...trigger, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual.trigger">Manual Trigger</SelectItem>
                    <SelectItem value="invoice.created">Invoice Created</SelectItem>
                    <SelectItem value="invoice.sent">Invoice Sent</SelectItem>
                    <SelectItem value="invoice.paid">Invoice Paid</SelectItem>
                    <SelectItem value="invoice.overdue">Invoice Overdue</SelectItem>
                    <SelectItem value="proposal.created">Proposal Created</SelectItem>
                    <SelectItem value="proposal.approved">Proposal Approved</SelectItem>
                    <SelectItem value="contract.expiring">Contract Expiring</SelectItem>
                    <SelectItem value="schedule.cron">Scheduled (Cron)</SelectItem>
                    <SelectItem value="webhook.external">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {trigger.type === "schedule.cron" && (
                <div>
                  <Label htmlFor="cron">Cron Expression</Label>
                  <Input
                    id="cron"
                    value={trigger.cronExpression || ""}
                    onChange={(e) => setTrigger({ ...trigger, cronExpression: e.target.value })}
                    placeholder="0 9 * * * (9 AM daily)"
                  />
                </div>
              )}
              {trigger.type === "webhook.external" && (
                <div>
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    value={trigger.webhookUrl || ""}
                    onChange={(e) => setTrigger({ ...trigger, webhookUrl: e.target.value })}
                    placeholder="https://your-webhook-url.com"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Workflow Steps */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Workflow Steps</h3>
            <Button onClick={addStep} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">No steps yet</h4>
                    <p className="text-muted-foreground">
                      Add steps to define what happens when this workflow runs
                    </p>
                  </div>
                  <Button onClick={addStep}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <Card key={step.id} className={selectedStep === step.id ? "ring-2 ring-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Step {index + 1}</Badge>
                        <CardTitle className="text-lg">{step.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStep(step.id)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteStep(step.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Step Name</Label>
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(step.id, { name: e.target.value })}
                        placeholder="Enter step name"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Actions</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAction(step.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Action
                        </Button>
                      </div>
                      
                      {step.actions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No actions yet. Add an action to define what this step does.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {step.actions.map((action, actionIndex) => (
                            <div key={actionIndex} className="flex items-center gap-2 p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">
                                    {getActionTypeLabel(action.type)}
                                  </Badge>
                                  <Select
                                    value={action.type}
                                    onValueChange={(value) => updateAction(step.id, actionIndex, { type: value as any })}
                                  >
                                    <SelectTrigger className="w-48">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="send.email">Send Email</SelectItem>
                                      <SelectItem value="send.slack">Send Slack Message</SelectItem>
                                      <SelectItem value="create.invoice">Create Invoice</SelectItem>
                                      <SelectItem value="update.invoice.status">Update Invoice Status</SelectItem>
                                      <SelectItem value="wait.delay">Wait/Delay</SelectItem>
                                      <SelectItem value="call.webhook">Call Webhook</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {action.type === "send.email" && (
                                  <div className="mt-2 space-y-2">
                                    <Input
                                      placeholder="Recipient email"
                                      value={action.recipient || ""}
                                      onChange={(e) => updateAction(step.id, actionIndex, { recipient: e.target.value })}
                                    />
                                    <Input
                                      placeholder="Email subject"
                                      value={action.subject || ""}
                                      onChange={(e) => updateAction(step.id, actionIndex, { subject: e.target.value })}
                                    />
                                  </div>
                                )}
                                {action.type === "wait.delay" && (
                                  <div className="mt-2">
                                    <Input
                                      type="number"
                                      placeholder="Delay in seconds"
                                      value={action.delaySeconds || ""}
                                      onChange={(e) => updateAction(step.id, actionIndex, { delaySeconds: parseInt(e.target.value) || 0 })}
                                    />
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAction(step.id, actionIndex)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
