import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { WorkflowActionType, WorkflowAction } from "@/core";
import { WorkflowStepProps, ACTION_TYPES } from "../types";
import { WorkflowActionComponent } from "./workflow-action";

export function WorkflowStepComponent({ 
  step, 
  stepIndex, 
  onUpdateStep, 
  onDeleteStep 
}: WorkflowStepProps) {
  const { t } = useTranslation();
  
  const handleUpdateName = (name: string) => {
    onUpdateStep(step.id, { name });
  };

  const handleUpdateAction = (actionIndex: number, updates: Partial<WorkflowAction>) => {
    const updatedActions = [...step.actions];
    updatedActions[actionIndex] = { ...updatedActions[actionIndex], ...updates };
    onUpdateStep(step.id, { actions: updatedActions });
  };

  const handleDeleteAction = (actionIndex: number) => {
    const updatedActions = step.actions.filter((_, idx) => idx !== actionIndex);
    onUpdateStep(step.id, { actions: updatedActions });
  };

  const handleAddAction = (actionType: WorkflowActionType) => {
    // Create action based on type
    let newAction: WorkflowAction;

    // Set default config based on action type
    if (actionType === "http_request" || actionType === "call.webhook") {
      newAction = {
      id: `action_${Date.now()}`,
        type: actionType === "http_request" ? "call.webhook" : actionType,
      name: "Call Webhook", // Default name
      config: {
        method: "POST" as const,
        url: "",
      },
      };
    } else if (actionType === "send.email") {
      newAction = {
      id: `action_${Date.now()}`,
      type: actionType,
      name: "Send Email", // Default name
      config: {
        recipients: [],
        subject: "",
        body: "",
        isHtml: false,
      },
    };
    } else {
      // Generate a default name from the action type
      const defaultName = actionType
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      // For actions that don't match the union type, use HTTP config as a fallback
      // The actual config will be handled by the action editor
      newAction = {
        id: `action_${Date.now()}`,
        type: actionType,
        name: defaultName, // Default name from action type
        config: {
          method: "POST" as const,
          url: "",
        },
      } as WorkflowAction;
    }
    
    const updatedActions = [...step.actions, newAction];
    onUpdateStep(step.id, { actions: updatedActions });
  };

  const getActionTypeLabel = (value: string) => {
    // Try translation first
    const translationKey = `workflows.actions.${value.replace(/\./g, '')}`;
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
    
    // Fallback: format the action value nicely
    return value
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="text-xs">{t('workflows.builder.steps.step', { number: stepIndex + 1 })}</Badge>
              <Input
                placeholder={t('workflows.builder.steps.stepNamePlaceholder', { number: stepIndex + 1 })}
                value={step.name}
                onChange={(e) => handleUpdateName(e.target.value)}
                className="font-semibold border-none shadow-none p-0 h-auto"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onDeleteStep(step.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {step.actions.map((action, actionIndex) => (
            <WorkflowActionComponent
              key={action.id}
              action={action}
              actionIndex={actionIndex}
              stepId={step.id}
              onUpdateAction={(_stepId, actionIndex, updates) => handleUpdateAction(actionIndex, updates)}
              onDeleteAction={(_stepId, actionIndex) => handleDeleteAction(actionIndex)}
            />
          ))}
          
          <div className="flex gap-2">
            <Select onValueChange={(value) => handleAddAction(value as WorkflowActionType)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('workflows.builder.action.selectType')} />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((actionType) => (
                  <SelectItem key={actionType.value} value={actionType.value}>
                    {getActionTypeLabel(actionType.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Default export for backward compatibility
export default WorkflowStepComponent;
