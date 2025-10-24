import { Plus, Play, Pause, Archive, MoreHorizontal, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkflowsByOrg, useActivateWorkflow, usePauseWorkflow, useArchiveWorkflow, useCreateWorkflowFunction } from "@/hooks";
import { useOrganizationContext } from "@/contexts/organization-context";

export default function WorkflowsPage() {
  const { currentOrganization } = useOrganizationContext();

  // Fetch workflows using repository hook
  const { data: workflows = [], isLoading, error } = useWorkflowsByOrg(currentOrganization?.id);
  console.log(error);
  // Workflow management mutations using repository hooks
  const activateWorkflow = useActivateWorkflow();
  const pauseWorkflow = usePauseWorkflow();
  const archiveWorkflow = useArchiveWorkflow();
  
  // Create workflow mutation using service hook
  const createWorkflow = useCreateWorkflowFunction();

  const handleCreateWorkflow = () => {
    if (!currentOrganization?.id) return;
    
    // Create a simple example workflow
    const workflowData = {
      orgId: currentOrganization.id,
      name: "New Workflow",
      description: "A new workflow created from the UI",
      trigger: {
        type: "manual.trigger" as const,
      },
      steps: [
        {
          id: "step1",
          name: "Initial Step",
          type: "action" as const,
          actions: [
            {
              type: "notify.user" as const,
              config: {
                message: "Workflow executed successfully",
              },
            },
          ],
          order: 0,
        },
      ],
      status: "draft" as const,
      version: 1,
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      tags: ["example"],
      category: "general",
      n8nEnabled: false,
    };

    createWorkflow.mutate(workflowData);
  };

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
        <div className="text-muted-foreground">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Automate your business processes with custom workflows
          </p>
        </div>
        <Button onClick={handleCreateWorkflow} disabled={createWorkflow.isPending}>
          <Plus className="w-4 h-4 mr-2" />
          {createWorkflow.isPending ? "Creating..." : "Create Workflow"}
        </Button>
      </div>

      {/* Workflows Grid */}
      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Settings className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No workflows yet</h3>
                <p className="text-muted-foreground">
                  Create your first workflow to automate your business processes
                </p>
              </div>
              <Button onClick={handleCreateWorkflow} disabled={createWorkflow.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                {createWorkflow.isPending ? "Creating..." : "Create Your First Workflow"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {workflow.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => console.log("Edit workflow:", workflow.id)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {workflow.status === "active" ? (
                        <DropdownMenuItem
                          onClick={() => pauseWorkflow.mutate(workflow.id)}
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => activateWorkflow.mutate(workflow.id)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => archiveWorkflow.mutate(workflow.id)}
                        className="text-red-600"
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(workflow.status)}
                  <div className="text-sm text-muted-foreground">
                    v{workflow.version}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trigger:</span>
                    <span className="font-medium">
                      {getTriggerTypeLabel(workflow.trigger.type)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Steps:</span>
                    <span className="font-medium">{workflow.steps.length}</span>
                  </div>
                  {workflow.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {workflow.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {workflow.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{workflow.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Created {workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString() : "Unknown"}
                  </div>
                  <div className="flex items-center gap-2">
                    {workflow.n8nEnabled && (
                      <Badge variant="outline" className="text-xs">
                        n8n
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
