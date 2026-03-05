import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { WorkflowTriggerType, CreateWorkflowInput, Workflow } from "@/core";

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

interface WorkflowHeaderProps {
  workflow: Partial<CreateWorkflowInput>;
  editingWorkflow?: Workflow | null;
  onCancelEdit?: () => void;
  onWorkflowChange: (workflow: Partial<CreateWorkflowInput>) => void;
}

export default function WorkflowHeader({ 
  workflow, 
  editingWorkflow, 
  onCancelEdit, 
  onWorkflowChange 
}: WorkflowHeaderProps) {
  return (
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Workflow Name *</Label>
            <Input
              id="name"
              value={workflow.name || ""}
              onChange={(e) => onWorkflowChange({ ...workflow, name: e.target.value })}
              placeholder="Enter workflow name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={workflow.category || "general"}
              onValueChange={(value) => onWorkflowChange({ ...workflow, category: value })}
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
        
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={workflow.description || ""}
            onChange={(e) => onWorkflowChange({ ...workflow, description: e.target.value })}
            placeholder="Describe what this workflow does"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-2 w-fit">
          <Label htmlFor="trigger">Trigger *</Label>
          <Select
            value={workflow.trigger?.type || "manual.trigger"}
            onValueChange={(value) => onWorkflowChange({ 
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
  );
}




