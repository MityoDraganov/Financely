import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { WorkflowActionsProps } from "../types";

export function WorkflowActions({ 
  workflow, 
  onSave, 
  isSaving,
  isValid = true
}: WorkflowActionsProps & { isValid?: boolean }) {
  const { t } = useTranslation();
  const isPreviewDisabled = !workflow.name || !workflow.trigger || (workflow.steps?.length || 0) === 0;
  const isSaveDisabled = isSaving || !isValid || isPreviewDisabled;

  return (
    <div className="flex justify-end gap-2">
      <Button onClick={onSave} disabled={isSaveDisabled}>
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? t('workflows.builder.actions.saving') : t('workflows.builder.actions.save')}
      </Button>
    </div>
  );
}

