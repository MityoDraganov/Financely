import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, Archive, Settings, History, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workflowService } from "@/services/workflow/workflow-service";
import WorkflowExecutionHistory from "@/components/workflow/workflow-execution-history";
import WorkflowBuilder from "@/components/workflow/workflow-builder";
import { Workflow } from "@/core";

export default function WorkflowExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [showBuilder, setShowBuilder] = useState(false);

  // Fetch workflow
  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowService.getWorkflow(id || ""),
    enabled: !!id,
  });

  // Activate workflow mutation
  const activateWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.activateWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Pause workflow mutation
  const pauseWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.pauseWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
    },
  });

  // Archive workflow mutation
  const archiveWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.archiveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      navigate("/workflows");
    },
  });

  // Execute workflow mutation
  const executeWorkflow = useMutation({
    mutationFn: (id: string) => workflowService.executeWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", id] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case "paused":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Draft</Badge>;
      case "archived":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerTypeLabel = (triggerType: string) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Workflow not found</h2>
          <p className="text-muted-foreground">
            The workflow you're looking for doesn't exist or has been deleted.
          </p>
        </div>
        <Button onClick={() => navigate("/workflows")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workflows
        </Button>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setShowBuilder(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workflow
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Workflow</h1>
            <p className="text-muted-foreground">
              Modify your workflow configuration
            </p>
          </div>
        </div>

        <WorkflowBuilder
          workflow={workflow}
          onSave={(data) => {
            // TODO: Update workflow
            console.log("Updating workflow:", data);
            setShowBuilder(false);
          }}
          onCancel={() => setShowBuilder(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/workflows")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workflows
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <p className="text-muted-foreground">
              {workflow.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workflow.status === "active" ? (
            <Button
              variant="outline"
              onClick={() => pauseWorkflow.mutate(workflow.id)}
              disabled={pauseWorkflow.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={() => activateWorkflow.mutate(workflow.id)}
              disabled={activateWorkflow.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Activate
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowBuilder(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => executeWorkflow.mutate(workflow.id)}
            disabled={executeWorkflow.isPending}
          >
            <Zap className="w-4 h-4 mr-2" />
            Test Run
          </Button>
        </div>
      </div>

      {/* Workflow Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{workflow.steps.length}</div>
                <div className="text-sm text-muted-foreground">Steps</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">v{workflow.version}</div>
                <div className="text-sm text-muted-foreground">Version</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {getTriggerTypeLabel(workflow.trigger.type)}
                </div>
                <div className="text-sm text-muted-foreground">Trigger</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <History className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Executions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="execution">Execution History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workflow Details */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge(workflow.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="font-medium">
                    {getTriggerTypeLabel(workflow.trigger.type)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Steps:</span>
                  <span className="font-medium">{workflow.steps.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {new Date(workflow.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {workflow.tags.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Tags:</span>
                    <div className="flex items-center gap-1 flex-wrap mt-2">
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

            {/* Workflow Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Workflow Steps</CardTitle>
                <CardDescription>
                  The sequence of actions in this workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workflow.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{step.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {step.actions.length} action{step.actions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {step.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="execution">
          <WorkflowExecutionHistory workflowId={workflow.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
              <CardDescription>
                Configure execution settings and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Retries</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.maxRetries}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Timeout (seconds)</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.timeoutSeconds}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Max Concurrent</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.maxConcurrentExecutions}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Notify on Failure</label>
                  <div className="text-sm text-muted-foreground">
                    {workflow.settings.notifyOnFailure ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => archiveWorkflow.mutate(workflow.id)}
                disabled={archiveWorkflow.isPending}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Workflow
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
