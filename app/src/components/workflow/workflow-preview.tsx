import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  Mail, 
  MessageSquare, 
  FileText, 
  Zap, 
  AlertCircle,
  X,
  Settings,
  Eye
} from "lucide-react";
import { Workflow } from "@/core";

interface WorkflowPreviewProps {
  workflow: Workflow;
  onClose: () => void;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case "send.email":
      return <Mail className="w-4 h-4" />;
    case "send.slack":
      return <MessageSquare className="w-4 h-4" />;
    case "create.invoice":
      return <FileText className="w-4 h-4" />;
    case "update.invoice.status":
      return <Settings className="w-4 h-4" />;
    case "create.task":
      return <CheckCircle className="w-4 h-4" />;
    case "call.webhook":
      return <Zap className="w-4 h-4" />;
    case "notify.user":
      return <AlertCircle className="w-4 h-4" />;
    case "wait.delay":
      return <Clock className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
};

const getActionLabel = (actionType: string) => {
  switch (actionType) {
    case "send.email":
      return "Send Email";
    case "send.slack":
      return "Send Slack Message";
    case "create.invoice":
      return "Create Invoice";
    case "update.invoice.status":
      return "Update Invoice Status";
    case "create.task":
      return "Create Task";
    case "call.webhook":
      return "Call Webhook";
    case "notify.user":
      return "Notify User";
    case "wait.delay":
      return "Wait/Delay";
    default:
      return actionType;
  }
};

const getTriggerLabel = (triggerType: string) => {
  switch (triggerType) {
    case "invoice.created":
      return "Invoice Created";
    case "invoice.sent":
      return "Invoice Sent";
    case "invoice.paid":
      return "Invoice Paid";
    case "invoice.overdue":
      return "Invoice Overdue";
    case "proposal.created":
      return "Proposal Created";
    case "proposal.approved":
      return "Proposal Approved";
    case "contract.expiring":
      return "Contract Expiring";
    case "schedule.cron":
      return "Scheduled";
    case "manual.trigger":
      return "Manual Trigger";
    default:
      return triggerType;
  }
};

export default function WorkflowPreview({ workflow, onClose }: WorkflowPreviewProps) {
  const [simulationStep, setSimulationStep] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationStep(0);
    
    // Simulate workflow execution step by step
    for (let i = 0; i <= workflow.steps.length; i++) {
      setSimulationStep(i);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between steps
    }
    
    setIsSimulating(false);
    setSimulationStep(null);
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setSimulationStep(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="w-8 h-8" />
            Workflow Preview
          </h1>
          <p className="text-muted-foreground">
            Preview how "{workflow.name}" will execute
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSimulate} disabled={isSimulating}>
            <Play className="w-4 h-4 mr-2" />
            {isSimulating ? "Simulating..." : "Simulate Execution"}
          </Button>
          {isSimulating && (
            <Button variant="outline" onClick={stopSimulation}>
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close Preview
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
              <h4 className="font-medium text-sm text-muted-foreground">Trigger</h4>
              <p className="text-sm">{getTriggerLabel(workflow.trigger.type)}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Steps</h4>
              <p className="text-sm">{workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-muted-foreground">Version</h4>
              <p className="text-sm">v{workflow.version}</p>
            </div>
          </div>
          
          {workflow.tags.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Tags</h4>
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
          <CardTitle>Execution Flow</CardTitle>
          <CardDescription>
            Visual representation of how this workflow will execute
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Trigger */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <Zap className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">Trigger</h4>
                  <p className="text-sm text-blue-700">{getTriggerLabel(workflow.trigger.type)}</p>
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
                          {step.actions.length} action{step.actions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  {stepIndex < workflow.steps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Actions in this step */}
                <div className="ml-8 space-y-2">
                  {step.actions.map((action, actionIndex) => (
                    <div key={actionIndex} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      {getActionIcon(action.type)}
                      <span className="text-sm font-medium">{getActionLabel(action.type)}</span>
                      {action.config && Object.keys(action.config).length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Configured
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Details</CardTitle>
          <CardDescription>
            Detailed view of workflow settings and parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Settings</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Max Retries:</span>
                  <span>{workflow.settings.maxRetries}</span>
                </div>
                <div className="flex justify-between">
                  <span>Timeout:</span>
                  <span>{workflow.settings.timeoutSeconds}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Concurrent:</span>
                  <span>{workflow.settings.maxConcurrentExecutions}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Notifications</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Notify on Failure:</span>
                  <span>{workflow.settings.notifyOnFailure ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Notify on Success:</span>
                  <span>{workflow.settings.notifyOnSuccess ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>

          {workflow.n8nEnabled && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">n8n Integration Enabled</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                This workflow is integrated with n8n for advanced automation capabilities.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
