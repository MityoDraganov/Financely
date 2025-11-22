import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Play, Save, Eye } from "lucide-react";
import { WorkflowActionsProps } from "../types";

export function WorkflowActions({ 
  workflow, 
  onSave, 
  onPreview, 
  isSaving 
}: WorkflowActionsProps) {
  const { t } = useTranslation();
  const isPreviewDisabled = !workflow.name || !workflow.trigger || (workflow.steps?.length || 0) === 0;

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline">
        <Play className="w-4 h-4 mr-2" />
        {t('workflows.builder.actions.test')}
      </Button>
      {onPreview && (
        <Button 
          variant="outline" 
          onClick={() => onPreview(workflow)}
          disabled={isPreviewDisabled}
        >
          <Eye className="w-4 h-4 mr-2" />
          {t('workflows.builder.actions.preview')}
        </Button>
      )}
      <Button onClick={onSave} disabled={isSaving}>
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? t('workflows.builder.actions.saving') : t('workflows.builder.actions.save')}
      </Button>
    </div>
  );
}

