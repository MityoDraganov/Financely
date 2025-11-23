import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  Mail, 
  MessageSquare, 
  Zap, 
  AlertCircle,
  X,
  Settings,
  Eye
} from "lucide-react";
import { Workflow, WorkflowAction } from "@/core";

interface WorkflowPreviewProps {
  workflow: Workflow;
  onClose: () => void;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case "send.email":
    case "send_email":
      return <Mail className="w-4 h-4" />;
    case "send.slack":
      return <MessageSquare className="w-4 h-4" />;
    case "update.invoice.status":
      return <Settings className="w-4 h-4" />;
    case "create.task":
      return <CheckCircle className="w-4 h-4" />;
    case "call.webhook":
    case "http_request":
      return <Zap className="w-4 h-4" />;
    case "notify.user":
      return <AlertCircle className="w-4 h-4" />;
    case "wait.delay":
      return <Clock className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
};

const getActionLabel = (actionType: string, t: (key: string) => string) => {
  switch (actionType) {
    case "send.email":
    case "send_email":
      return t('workflows.preview.actionLabels.sendEmail');
    case "send.slack":
      return t('workflows.preview.actionLabels.sendSlack');
    case "update.invoice.status":
      return t('workflows.preview.actionLabels.updateInvoiceStatus');
    case "create.task":
      return t('workflows.preview.actionLabels.createTask');
    case "call.webhook":
    case "http_request":
      return t('workflows.preview.actionLabels.httpRequest');
    case "notify.user":
      return t('workflows.preview.actionLabels.notifyUser');
    case "wait.delay":
      return t('workflows.preview.actionLabels.waitDelay');
    default:
      return actionType;
  }
};

const getTriggerLabel = (triggerType: string, t: (key: string) => string) => {
  switch (triggerType) {
    case "invoice.created":
      return t('workflows.preview.triggerLabels.invoiceCreated');
    case "invoice.sent":
      return t('workflows.preview.triggerLabels.invoiceSent');
    case "invoice.paid":
      return t('workflows.preview.triggerLabels.invoicePaid');
    case "invoice.overdue":
      return t('workflows.preview.triggerLabels.invoiceOverdue');
    case "proposal.created":
      return t('workflows.preview.triggerLabels.proposalCreated');
    case "proposal.approved":
      return t('workflows.preview.triggerLabels.proposalApproved');
    case "contract.expiring":
      return t('workflows.preview.triggerLabels.contractExpiring');
    case "schedule.cron":
      return t('workflows.preview.triggerLabels.scheduled');
    case "manual.trigger":
      return t('workflows.preview.triggerLabels.manualTrigger');
    default:
      return triggerType;
  }
};

export default function WorkflowPreview({ workflow, onClose }: WorkflowPreviewProps) {
  const { t } = useTranslation();
  const [simulationStep, setSimulationStep] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationStep(0);
    setSimulationError(null);
    
    try {
      // Validate workflow has steps
      if (!workflow.steps || workflow.steps.length === 0) {
        throw new Error(t('workflows.preview.error.noSteps'));
      }
      
      // Simulate workflow execution step by step
      for (let i = 0; i < workflow.steps.length; i++) {
        setSimulationStep(i);
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay between steps
        
        // Check if simulation was stopped
        if (!isSimulating) {
          return;
        }
      }
      
      // Mark all steps as completed
      setSimulationStep(workflow.steps.length);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationError(error instanceof Error ? error.message : t('workflows.preview.error.title'));
    } finally {
      setIsSimulating(false);
    }
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setSimulationStep(null);
    setSimulationError(null);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimulationStep(null);
    setSimulationError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="w-8 h-8" />
            {t('workflows.preview.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('workflows.preview.description', { name: workflow.name })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSimulate} disabled={isSimulating}>
            <Play className="w-4 h-4 mr-2" />
            {isSimulating ? t('workflows.preview.simulating') : t('workflows.preview.simulateExecution')}
          </Button>
          {isSimulating && (
            <Button variant="outline" onClick={stopSimulation}>
              <Pause className="w-4 h-4 mr-2" />
              {t('workflows.preview.stop')}
            </Button>
          )}
          {simulationStep !== null && !isSimulating && (
            <Button variant="outline" onClick={resetSimulation}>
              <X className="w-4 h-4 mr-2" />
              {t('workflows.preview.reset')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            {t('workflows.preview.closePreview')}
          </Button>
        </div>
      </div>

      {/* Workflow Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {workflow.name}
            <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
              {workflow.status}
            </Badge>
          </CardTitle>
          <CardDescription>{workflow.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">{t('workflows.preview.overview.trigger')}</h4>
              <p className="text-sm">{getTriggerLabel(workflow.trigger.type, t)}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">{t('workflows.preview.overview.steps')}</h4>
              <p className="text-sm">{t('workflows.preview.overview.stepsCount', { count: workflow.steps.length, defaultValue: workflow.steps.length === 1 ? '{{count}} step' : '{{count}} steps' })}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">{t('workflows.preview.overview.version')}</h4>
              <p className="text-sm">v{workflow.version}</p>
            </div>
          </div>
          
          {workflow.tags.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('workflows.preview.overview.tags')}</h4>
              <div className="flex flex-wrap gap-1">
                {workflow.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Flow */}
      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.preview.executionFlow.title')}</CardTitle>
          <CardDescription>
            {t('workflows.preview.executionFlow.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Trigger */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <Zap className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">{t('workflows.preview.executionFlow.trigger')}</h4>
                  <p className="text-sm text-blue-700">{getTriggerLabel(workflow.trigger.type, t)}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Steps */}
            {workflow.steps.map((step, stepIndex) => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 p-3 rounded-lg border-2 ${
                    simulationStep !== null && simulationStep > stepIndex
                      ? 'bg-green-50 border-green-200'
                      : simulationStep === stepIndex
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        simulationStep !== null && simulationStep > stepIndex
                          ? 'bg-green-500 text-white'
                          : simulationStep === stepIndex
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {simulationStep !== null && simulationStep > stepIndex ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          stepIndex + 1
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{step.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {t('workflows.preview.executionFlow.actionsCount', { count: step.actions.length, defaultValue: step.actions.length === 1 ? '{{count}} action' : '{{count}} actions' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>

                {/* Actions in this step */}
                <div className="ml-8 space-y-2">
                  {step.actions.map((action: WorkflowAction, actionIndex: number) => (
                    <div key={actionIndex} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      {getActionIcon(action.type)}
                      <span className="text-sm font-medium">{getActionLabel(action.type, t)}</span>
                      {action.config && Object.keys(action.config).length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {t('workflows.preview.executionFlow.configured')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Completion Indicator */}
            {simulationStep === workflow.steps.length && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-900">{t('workflows.preview.completed.title')}</h4>
                    <p className="text-sm text-green-700">{t('workflows.preview.completed.description')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Indicator */}
            {simulationError && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border-2 border-red-200">
                  <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-red-900">{t('workflows.preview.error.title')}</h4>
                    <p className="text-sm text-red-700">{simulationError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('workflows.preview.configDetails.title')}</CardTitle>
          <CardDescription>
            {t('workflows.preview.configDetails.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('workflows.preview.configDetails.settings')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('workflows.preview.configDetails.maxRetries')}</span>
                  <span>{workflow.settings.maxRetries}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('workflows.preview.configDetails.timeout')}</span>
                  <span>{workflow.settings.timeoutSeconds}s</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('workflows.preview.configDetails.maxConcurrent')}</span>
                  <span>{workflow.settings.maxConcurrentExecutions}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">{t('workflows.preview.configDetails.notifications')}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t('workflows.preview.configDetails.notifyOnFailure')}</span>
                  <span>{workflow.settings.notifyOnFailure ? t('workflows.preview.configDetails.yes') : t('workflows.preview.configDetails.no')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('workflows.preview.configDetails.notifyOnSuccess')}</span>
                  <span>{workflow.settings.notifyOnSuccess ? t('workflows.preview.configDetails.yes') : t('workflows.preview.configDetails.no')}</span>
                </div>
              </div>
            </div>
          </div>

          {workflow.n8nEnabled && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{t('workflows.preview.configDetails.n8nEnabled')}</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                {t('workflows.preview.configDetails.n8nDescription')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
