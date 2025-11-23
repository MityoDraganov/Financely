import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Zap, 
  Mail, 
  FileText, 
  Users, 
  ShoppingCart,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  Trash2
} from "lucide-react";
import { WorkflowStep, WorkflowTriggerType, WorkflowAction } from "@/core";
import { cn } from "@/lib/utils";

interface WorkflowVisualFlowProps {
  trigger: { type: WorkflowTriggerType };
  steps: WorkflowStep[];
  onAddStep: () => void;
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  onDeleteStep: (stepId: string) => void;
  onStepClick?: (stepId: string) => void;
  selectedStepId?: string;
}

const getTriggerIcon = (type: WorkflowTriggerType) => {
  if (type.startsWith("invoice")) return FileText;
  if (type.startsWith("proposal")) return FileText;
  if (type.startsWith("lead")) return Users;
  if (type.startsWith("contact")) return Users;
  if (type.startsWith("product")) return ShoppingCart;
  if (type.startsWith("contract")) return FileText;
  if (type.startsWith("user")) return Users;
  if (type === "schedule.cron") return Clock;
  if (type === "webhook.external") return Zap;
  return Zap;
};

const getTriggerColor = (type: WorkflowTriggerType) => {
  if (type.startsWith("invoice")) return "bg-blue-500";
  if (type.startsWith("proposal")) return "bg-purple-500";
  if (type.startsWith("lead")) return "bg-green-500";
  if (type.startsWith("contact")) return "bg-teal-500";
  if (type.startsWith("product")) return "bg-orange-500";
  if (type.startsWith("contract")) return "bg-indigo-500";
  if (type.startsWith("user")) return "bg-pink-500";
  if (type === "schedule.cron") return "bg-yellow-500";
  if (type === "webhook.external") return "bg-cyan-500";
  return "bg-gray-500";
};

const getActionIcon = (actionType: string) => {
  if (actionType.includes("email") || actionType === "send.email") return Mail;
  if (actionType.includes("invoice") || actionType === "create.invoice") return FileText;
  if (actionType.includes("proposal") || actionType === "create.proposal") return FileText;
  if (actionType.includes("task") || actionType === "create.task") return CheckCircle;
  if (actionType.includes("delay") || actionType === "wait.delay") return Clock;
  if (actionType.includes("webhook") || actionType === "call.webhook" || actionType === "http_request") return Zap;
  if (actionType.includes("notify") || actionType === "notify.user") return AlertCircle;
  return Settings;
};

export function WorkflowVisualFlow({
  trigger,
  steps,
  onAddStep,
  onDeleteStep,
  onStepClick,
  selectedStepId,
}: WorkflowVisualFlowProps) {
  const { t } = useTranslation();
  
  const TriggerIcon = getTriggerIcon(trigger.type);
  const triggerColor = getTriggerColor(trigger.type);

  return (
    <div className="space-y-6">
      {/* Visual Flow Container */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted/20 border-2">
        <div className="space-y-8">
          {/* Trigger Node */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "relative flex flex-col items-center group",
              "transition-all duration-200"
            )}>
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center",
                "shadow-lg border-2 border-background",
                "transition-all duration-200",
                triggerColor,
                "group-hover:scale-105 group-hover:shadow-xl"
              )}>
                <TriggerIcon className="w-10 h-10 text-white" />
              </div>
              <div className="mt-3 px-4 py-1.5 bg-background/80 backdrop-blur-sm rounded-lg border shadow-sm">
                <p className="text-sm font-semibold text-center whitespace-nowrap">
                  {t(`workflows.triggers.${trigger.type.replace(/\./g, '')}`) || trigger.type}
                </p>
              </div>
            </div>
            
            {/* Connection Line */}
            {steps.length > 0 && (
              <div className="w-0.5 h-8 bg-gradient-to-b from-primary/40 to-primary/20 my-2" />
            )}
          </div>

          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => {
              const isSelected = selectedStepId === step.id;
              const actionCount = step.actions.length;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={cn(
                    "relative w-full max-w-md transition-all duration-200",
                    isSelected && "scale-105"
                  )}>
                    <Card 
                      className={cn(
                        "p-4 cursor-pointer border-2 transition-all duration-200",
                        "hover:shadow-lg hover:border-primary/50",
                        isSelected 
                          ? "border-primary shadow-lg bg-primary/5" 
                          : "border-border bg-card"
                      )}
                      onClick={() => onStepClick?.(step.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Step Number Badge */}
                        <div className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                          "font-bold text-sm shadow-sm",
                          isSelected 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        
                        {/* Step Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className={cn(
                              "font-semibold text-sm truncate",
                              isSelected && "text-primary"
                            )}>
                              {step.name || t('workflows.builder.steps.unnamedStep', { number: index + 1 })}
                            </h4>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteStep(step.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Actions Preview */}
                          {actionCount > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {step.actions.slice(0, 3).map((action: WorkflowAction, actionIndex: number) => {
                                const ActionIcon = getActionIcon(action.type);
                                return (
                                  <Badge
                                    key={actionIndex}
                                    variant="secondary"
                                    className="text-xs flex items-center gap-1 px-2 py-0.5"
                                  >
                                    <ActionIcon className="w-3 h-3" />
                                    <span className="truncate max-w-[80px]">
                                      {action.name || action.type}
                                    </span>
                                  </Badge>
                                );
                              })}
                              {actionCount > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{actionCount - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {actionCount === 0 && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              {t('workflows.builder.steps.noActions')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                  
                  {/* Connection Line */}
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-8 bg-gradient-to-b from-primary/40 to-primary/20 my-2" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Step Button */}
          <div className="flex flex-col items-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={onAddStep}
              className="rounded-full w-14 h-14 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-dashed"
            >
              <Plus className="w-6 h-6" />
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('workflows.builder.steps.addStep')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

