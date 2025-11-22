import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { WorkflowStepsProps } from "../types";
import { WorkflowStepComponent } from "./workflow-step";

export function WorkflowSteps({ 
  steps, 
  onAddStep, 
  onUpdateStep, 
  onDeleteStep, 
  onAddAction: _onAddAction, 
  onUpdateAction: _onUpdateAction, 
  onDeleteAction: _onDeleteAction 
}: WorkflowStepsProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('workflows.builder.steps.title')}</CardTitle>
            <CardDescription>
              {t('workflows.builder.steps.description')}
            </CardDescription>
          </div>
          <Button onClick={onAddStep}>
            <Plus className="w-4 h-4 mr-2" />
            {t('workflows.builder.steps.addStep')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {steps.map((step, index) => (
          <WorkflowStepComponent
            key={step.id}
            step={step}
            stepIndex={index}
            onUpdateStep={onUpdateStep}
            onDeleteStep={onDeleteStep}
          />
        ))}

        {steps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('workflows.builder.steps.noSteps')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
