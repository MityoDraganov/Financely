import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowStepsProps } from "../types";
import { WorkflowStepComponent } from "./workflow-step";
import { WorkflowVisualFlowReactFlow } from "./workflow-visual-flow-reactflow";
import { Workflow } from "@/core";
import { LayoutGrid, List } from "lucide-react";
import { StepValidationErrors } from "@/utils/workflow-validation";

export function WorkflowSteps({ 
  steps, 
  onAddStep, 
  onUpdateStep, 
  onDeleteStep, 
  onAddAction, 
  onDeleteAction,
  onReorderSteps,
  workflow,
  validationErrors,
  isExecuting,
  executionStepId,
  onStartExecution,
  onStopExecution,
  onEditStep,
  onAddBranchStep,
  onUpdateBranchStep,
  onDeleteBranchStep,
}: WorkflowStepsProps & { 
  workflow?: Partial<Workflow>;
  onReorderSteps?: (fromIndex: number, toIndex: number) => void;
  validationErrors?: StepValidationErrors;
  isExecuting?: boolean;
  executionStepId?: string;
  onStartExecution?: () => void;
  onStopExecution?: () => void;
  onEditStep?: (step: import("../types").WorkflowStep) => void;
}) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"visual" | "list">("visual");
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t('workflows.builder.steps.title')}
            </CardTitle>
            <CardDescription>
              {t('workflows.builder.steps.description')}
            </CardDescription>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "visual" | "list")}>
            <TabsList>
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                {t('workflows.builder.steps.visualView')}
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                {t('workflows.builder.steps.listView')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {viewMode === "visual" ? (
          <WorkflowVisualFlowReactFlow
            trigger={workflow?.trigger || { type: "manual.trigger" }}
            steps={steps}
            onAddStep={onAddStep}
            onUpdateStep={onUpdateStep}
            onDeleteStep={onDeleteStep}
            onReorderSteps={onReorderSteps || (() => {})}
            onAddBranchStep={onAddBranchStep}
            onUpdateBranchStep={onUpdateBranchStep}
            onDeleteBranchStep={onDeleteBranchStep}
            onStepClick={setSelectedStepId}
            selectedStepId={selectedStepId}
            onAddAction={onAddAction ? (stepId: string, actionType?: string) => {
              if (actionType) {
                onAddAction(stepId, actionType as import("@/core").WorkflowActionType);
              }
            } : undefined}
            onEditAction={() => {
              // Action editing is handled by the step editor dialog
            }}
            onDeleteAction={onDeleteAction}
            onEditStep={onEditStep}
            validationErrors={validationErrors}
            isExecuting={isExecuting}
            executionStepId={executionStepId}
            onStartExecution={onStartExecution}
            onStopExecution={onStopExecution}
          />
        ) : (
          <div className="space-y-4">
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
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <List className="w-8 h-8" />
                </div>
                <p className="font-medium">{t('workflows.builder.steps.noSteps')}</p>
                <p className="text-sm mt-1">{t('workflows.builder.steps.addFirstStep')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
