import { useState, useEffect } from "react";
import { CreateWorkflowInput, WorkflowActionType } from "@/core";
import { useCreateWorkflow } from "@/hooks/repository-hooks/use-workflows";
import { useOrganizationContext } from "@/contexts/organization-context";
import { toast } from "sonner";
import { WorkflowBuilderProps, WorkflowStep } from "./types";
import { WorkflowHeader } from "./components/workflow-header";
import { WorkflowSteps } from "./components/workflow-steps";
import { WorkflowActions } from "./components/workflow-actions";

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

  const validateWorkflowData = (workflowData: Record<string, unknown>): string[] => {
    const errors: string[] = [];
    
    // Check for undefined values
    const checkForUndefined = (obj: Record<string, unknown>, path: string = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (value === undefined) {
          errors.push(`Undefined value found at ${currentPath}`);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkForUndefined(value as Record<string, unknown>, currentPath);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item === undefined) {
              errors.push(`Undefined value found at ${currentPath}[${index}]`);
            } else if (item && typeof item === 'object') {
              checkForUndefined(item as Record<string, unknown>, `${currentPath}[${index}]`);
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

  const handleUpdateWorkflow = (updates: Partial<CreateWorkflowInput>) => {
    setWorkflow({ ...workflow, ...updates });
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

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    const updatedSteps = (workflow.steps || []).map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    );
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const deleteStep = (stepId: string) => {
    const updatedSteps = (workflow.steps || []).filter(step => step.id !== stepId);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const addAction = (stepId: string, actionType: WorkflowActionType = "http_request") => {
    const step = workflow.steps?.find(s => s.id === stepId);
    if (!step) return;

    const newAction = actionType === "http_request" ? {
      id: `action_${Date.now()}`,
      type: actionType,
      name: "",
      config: {
        method: "POST" as const,
        url: "",
      },
      } : {
      id: `action_${Date.now()}`,
      type: actionType,
      name: "",
      config: {
        recipients: [],
        subject: "",
        body: "",
        isHtml: false,
      },
    };
    
    const updatedStep = {
      ...step,
      actions: [...step.actions, newAction],
    };

    const updatedSteps = (workflow.steps || []).map(s => s.id === stepId ? updatedStep : s);
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const updateAction = (stepId: string, actionIndex: number, updates: Record<string, unknown>) => {
    const updatedSteps = (workflow.steps || []).map(step => {
      if (step.id === stepId) {
        const updatedActions = [...step.actions];
        updatedActions[actionIndex] = { ...updatedActions[actionIndex], ...updates };
        return { ...step, actions: updatedActions };
      }
      return step;
    });
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  const deleteAction = (stepId: string, actionIndex: number) => {
    const updatedSteps = (workflow.steps || []).map(step => {
      if (step.id === stepId) {
        const updatedActions = step.actions.filter((_, idx) => idx !== actionIndex);
        return { ...step, actions: updatedActions };
      }
      return step;
    });
    setWorkflow({ ...workflow, steps: updatedSteps });
  };

  return (
    <div className="space-y-6">
      <WorkflowHeader
        workflow={workflow}
        editingWorkflow={editingWorkflow}
        onUpdateWorkflow={handleUpdateWorkflow}
        onCancelEdit={onCancelEdit}
      />

      <WorkflowSteps
        steps={workflow.steps || []}
        onAddStep={addStep}
        onUpdateStep={updateStep}
        onDeleteStep={deleteStep}
        onAddAction={addAction}
        onUpdateAction={updateAction}
        onDeleteAction={deleteAction}
      />

      <WorkflowActions
        workflow={workflow}
        onSave={handleSaveWorkflow}
        onPreview={onPreview}
        isSaving={createWorkflow.isPending}
      />
    </div>
  );
}