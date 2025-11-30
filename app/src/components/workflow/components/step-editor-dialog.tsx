import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  Trash2,
  Settings,
  Mail,
  GitBranch,
  CheckCircle,
} from "lucide-react";
import { WorkflowStep, WorkflowActionType, WorkflowAction } from "@/core";
import { ConditionalBranchEditor } from "./conditional-branch-editor";
import { EmailRecipientsInput } from "./email-recipients-input";
import { validateUrlForSSRF } from "@/utils/url-validation";

interface StepEditorDialogProps {
  step: WorkflowStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (step: WorkflowStep) => void;
}

const stepTypes = [
  { value: "action", label: "Action", icon: CheckCircle },
  { value: "condition", label: "Condition", icon: GitBranch },
];

const actionTypes: Array<{ value: WorkflowActionType; label: string; icon: typeof Mail }> = [
  { value: "send.email", label: "Send Email", icon: Mail },
  { value: "call.webhook", label: "Call Webhook", icon: Settings },
];

export function StepEditorDialog({
  step,
  open,
  onOpenChange,
  onSave,
}: StepEditorDialogProps) {
  const { t } = useTranslation();
  const [editedStep, setEditedStep] = useState<WorkflowStep | null>(null);

  useEffect(() => {
    if (step) {
      setEditedStep({ ...step });
    }
  }, [step, open]);

  if (!editedStep) return null;

  const handleSave = () => {
    if (!editedStep.name.trim()) {
      return; // Name is required
    }
    onSave(editedStep);
    onOpenChange(false);
  };

  const handleAddAction = (actionType: WorkflowActionType) => {
    if (!editedStep) return;

    let newAction: WorkflowAction;

    switch (actionType) {
      case "send.email":
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
        break;
      case "call.webhook":
      case "http_request":
        newAction = {
          id: `action_${Date.now()}`,
          type: actionType === "http_request" ? "call.webhook" : actionType,
          name: "Call Webhook", // Default name
          config: {
            method: "POST" as const,
            url: "",
          },
        };
        break;
      default: {
        const defaultName = actionType
          .split(".")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

        newAction = {
          id: `action_${Date.now()}`,
          type: actionType,
          name: defaultName,
          config: {
            method: "POST" as const,
            url: "",
          },
        };
        break;
      }
    }

    setEditedStep({
      ...editedStep,
      actions: [...editedStep.actions, newAction],
    });
  };

  const handleUpdateAction = (
    index: number,
    updater: (action: WorkflowAction) => WorkflowAction
  ): void => {
    setEditedStep((prevStep: WorkflowStep | null) => {
      if (!prevStep) {
        return prevStep;
      }

      const updatedActions = [...prevStep.actions];
      updatedActions[index] = updater(updatedActions[index]);

      return { ...prevStep, actions: updatedActions };
    });
  };

  const handleDeleteAction = (index: number) => {
    if (!editedStep) return;
    const updatedActions = editedStep.actions.filter((_: WorkflowAction, i: number) => i !== index);
    setEditedStep({ ...editedStep, actions: updatedActions });
  };

  const handleUpdateConditions = (conditions: typeof editedStep.conditions) => {
    setEditedStep({ ...editedStep, conditions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workflows.builder.stepEditor.title')}</DialogTitle>
          <DialogDescription>
            {t('workflows.builder.stepEditor.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Name */}
          <div className="space-y-2">
            <Label htmlFor="step-name">{t('workflows.builder.stepEditor.stepName')}</Label>
            <Input
              id="step-name"
              value={editedStep.name}
              onChange={(e) =>
                setEditedStep({ ...editedStep, name: e.target.value })
              }
              placeholder={t('workflows.builder.stepEditor.stepNamePlaceholder')}
            />
          </div>

          {/* Step Type */}
          <div className="space-y-2">
            <Label htmlFor="step-type">{t('workflows.builder.stepEditor.stepType')}</Label>
            <Select
              value={editedStep.type}
              onValueChange={(value) =>
                setEditedStep({
                  ...editedStep,
                  type: value as WorkflowStep["type"],
                })
              }
            >
              <SelectTrigger id="step-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stepTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {t(`workflows.builder.stepEditor.stepTypes.${type.value}`)}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Branching */}
          {editedStep.type === "condition" && (
            <ConditionalBranchEditor
              conditions={editedStep.conditions || []}
              onConditionsChange={(conditions) =>
                handleUpdateConditions(conditions)
              }
            />
          )}

          {/* Delay Configuration */}
          {editedStep.type === "delay" && (
            <div className="space-y-2">
              <Label htmlFor="delay-seconds">{t('workflows.builder.stepEditor.delay.label')}</Label>
              <Input
                id="delay-seconds"
                type="number"
                min="0"
                value={editedStep.delaySeconds || 0}
                onChange={(e) =>
                  setEditedStep({
                    ...editedStep,
                    delaySeconds: parseInt(e.target.value, 10) || 0,
                  })
                }
                placeholder={t('workflows.builder.stepEditor.delay.placeholder')}
              />
            </div>
          )}

          {/* Actions Section */}
          {(editedStep.type === "action" || editedStep.type === "condition") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('workflows.builder.stepEditor.actions.label')}</Label>
                <Select
                  onValueChange={(value) =>
                    handleAddAction(value as WorkflowActionType)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t('workflows.builder.stepEditor.actions.addActionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((action: { value: WorkflowActionType; label: string; icon: typeof Mail }) => {
                      const Icon = action.icon;
                      // Convert "send.email" to "sendEmail" (camelCase)
                      const actionKey = action.value.split('.').map((part, index) => 
                        index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
                      ).join('');
                      return (
                        <SelectItem key={action.value} value={action.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {t(`workflows.builder.stepEditor.actions.actionTypes.${actionKey}`)}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {editedStep.actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">{t('workflows.builder.stepEditor.actions.noActions')}</p>
                  <p className="text-xs mt-1">
                    {t('workflows.builder.stepEditor.actions.noActionsDescription')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editedStep.actions.map((action: WorkflowAction, index: number) => (
                    <div
                      key={action.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{action.type}</Badge>
                          <span className="text-sm font-medium">
                            {t('workflows.builder.stepEditor.actions.actionNumber', { number: index + 1 })}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAction(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Action name input */}
                      <div>
                        <Label>{t('workflows.builder.stepEditor.actions.name')}</Label>
                        <Input
                          value={action.name || ""}
                          onChange={(e) =>
                            handleUpdateAction(index, (currentAction) => ({
                              ...currentAction,
                              name: e.target.value,
                            }))
                          }
                          placeholder={t('workflows.builder.stepEditor.actions.namePlaceholder')}
                        />
                      </div>

                      {/* Action-specific configs */}
                      {action.type === "send.email" && "recipients" in action.config && (
                        <div className="space-y-2">
                          <Label>{t('workflows.builder.stepEditor.actions.email.recipients')}</Label>
                          <EmailRecipientsInput
                            value={action.config.recipients || []}
                            onChange={(emails) =>
                              handleUpdateAction(index, (currentAction) => {
                                if (currentAction.type !== "send.email") {
                                  return currentAction;
                                }

                                return {
                                  ...currentAction,
                                config: {
                                    ...currentAction.config,
                                  recipients: emails,
                                  },
                                };
                              })
                            }
                            placeholder={t('workflows.builder.stepEditor.actions.email.recipientsPlaceholder')}
                          />
                          <Label>{t('workflows.builder.stepEditor.actions.email.subject')}</Label>
                          <Input
                            value={action.config.subject || ""}
                            onChange={(e) =>
                              handleUpdateAction(index, (currentAction) => {
                                if (currentAction.type !== "send.email") {
                                  return currentAction;
                                }

                                return {
                                  ...currentAction,
                                config: {
                                    ...currentAction.config,
                                  subject: e.target.value,
                                  },
                                };
                              })
                            }
                            placeholder={t('workflows.builder.stepEditor.actions.email.subjectPlaceholder')}
                          />
                          <Label>{t('workflows.builder.stepEditor.actions.email.body')}</Label>
                          <Textarea
                            value={action.config.body || ""}
                            onChange={(e) =>
                              handleUpdateAction(index, (currentAction) => {
                                if (currentAction.type !== "send.email") {
                                  return currentAction;
                                }

                                return {
                                  ...currentAction,
                                config: {
                                    ...currentAction.config,
                                  body: e.target.value,
                                  },
                                };
                              })
                            }
                            placeholder={t('workflows.builder.stepEditor.actions.email.bodyPlaceholder')}
                            rows={4}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`email-html-${index}`}
                              checked={action.config.isHtml || false}
                              onChange={(e) =>
                                handleUpdateAction(index, (currentAction) => {
                                  if (currentAction.type !== "send.email") {
                                    return currentAction;
                                  }

                                  return {
                                    ...currentAction,
                                  config: {
                                      ...currentAction.config,
                                    isHtml: e.target.checked,
                                    },
                                  };
                                })
                              }
                              className="rounded"
                            />
                            <Label htmlFor={`email-html-${index}`} className="cursor-pointer">
                              {t('workflows.builder.stepEditor.actions.email.isHtml')}
                            </Label>
                          </div>
                        </div>
                      )}

                      {action.type === "call.webhook" && "url" in action.config && (
                        <div className="space-y-2">
                          <Label>{t('workflows.builder.stepEditor.actions.webhook.url')}</Label>
                          <Input
                            value={action.config.url || ""}
                            onChange={(e) => {
                              const url = e.target.value;
                              handleUpdateAction(index, (currentAction) => {
                                if (currentAction.type !== "call.webhook") {
                                  return currentAction;
                                }

                                return {
                                  ...currentAction,
                                config: {
                                  ...currentAction.config,
                                  url,
                                  },
                                };
                              });
                            }}
                            placeholder={t('workflows.builder.stepEditor.actions.webhook.urlPlaceholder')}
                            className={
                              (() => {
                                const validation = validateUrlForSSRF(action.config.url || "");
                                if (validation.errors.length > 0) return "border-red-500";
                                if (validation.warnings.length > 0) return "border-yellow-500";
                                return "";
                              })()
                            }
                          />
                          {(() => {
                            const validation = validateUrlForSSRF(action.config.url || "");
                            if (validation.errors.length > 0) {
                              return (
                                <Alert variant="destructive" className="py-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertDescription className="text-sm">
                                    {validation.errors.map((error, idx) => (
                                      <div key={idx}>{error}</div>
                                    ))}
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                            if (validation.warnings.length > 0) {
                              return (
                                <Alert variant="default" className="py-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                  <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                                    {validation.warnings.map((warning, idx) => (
                                      <div key={idx}>{warning}</div>
                                    ))}
                                    <div className="mt-1 text-xs">
                                      {t('workflows.builder.stepEditor.actions.webhook.urlSecurityNote', { 
                                        defaultValue: "This URL will be blocked when the workflow runs." 
                                      })}
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                            return null;
                          })()}
                          <Label>{t('workflows.builder.stepEditor.actions.webhook.method')}</Label>
                          <Select
                            value={action.config.method || "POST"}
                            onValueChange={(value) =>
                              handleUpdateAction(index, (currentAction) => {
                                if (currentAction.type !== "call.webhook") {
                                  return currentAction;
                                }

                                return {
                                  ...currentAction,
                                config: {
                                    ...currentAction.config,
                                  method: value as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
                                  },
                                };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('workflows.builder.stepEditor.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!editedStep.name.trim()}>
            {t('workflows.builder.stepEditor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

