import React from "react";
import WorkflowBuilder from "./workflow-builder";
import { Workflow, CreateWorkflowInput } from "@/core";

interface WorkflowBuilderWrapperProps {
  editingWorkflow?: Workflow | null;
  onCancelEdit?: () => void;
  onPreview?: (workflow: Partial<CreateWorkflowInput>) => void;
}

export default function WorkflowBuilderWrapper({ editingWorkflow, onCancelEdit, onPreview }: WorkflowBuilderWrapperProps) {
  return (
    <WorkflowBuilder 
      editingWorkflow={editingWorkflow}
      onCancelEdit={onCancelEdit}
      onPreview={onPreview}
    />
  );
}
