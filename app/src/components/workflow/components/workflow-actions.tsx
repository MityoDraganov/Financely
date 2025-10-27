import { Button } from "@/components/ui/button";
import { Play, Save, Eye } from "lucide-react";
import { WorkflowActionsProps } from "../types";

export function WorkflowActions({ 
  workflow, 
  onSave, 
  onPreview, 
  isSaving 
}: WorkflowActionsProps) {
  const isPreviewDisabled = !workflow.name || !workflow.trigger || (workflow.steps?.length || 0) === 0;

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline">
        <Play className="w-4 h-4 mr-2" />
        Test Workflow
      </Button>
      {onPreview && (
        <Button 
          variant="outline" 
          onClick={() => onPreview(workflow)}
          disabled={isPreviewDisabled}
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
      )}
      <Button onClick={onSave} disabled={isSaving}>
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? "Saving..." : "Save Workflow"}
      </Button>
    </div>
  );
}

