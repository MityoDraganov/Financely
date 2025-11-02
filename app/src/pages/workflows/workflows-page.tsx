import { useState } from "react";
import { Plus, Play, Pause, Archive, MoreHorizontal, Settings, Workflow, FileText, History, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkflowsByOrg, useActivateWorkflow, usePauseWorkflow, useArchiveWorkflow, useCreateWorkflowFunction, useDeleteWorkflow } from "@/hooks";
import { useOrganizationContext } from "@/contexts/organization-context";
import WorkflowBuilderWrapper from "@/components/workflow/workflow-builder-wrapper";
import WorkflowExecutionHistory from "@/components/workflow/workflow-execution-history";
import WorkflowPreview from "@/components/workflow/workflow-preview";
import { Workflow as WorkflowType, CreateWorkflowInput } from "@/core";

export default function WorkflowsPage() {
  const { currentOrganization } = useOrganizationContext();
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowType | null>(null);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowType | null>(null);
  const [previewingWorkflow, setPreviewingWorkflow] = useState<WorkflowType | null>(null);
  const [activeTab, setActiveTab] = useState("workflows");

  // Fetch workflows using repository hook
  const { data: workflows = [], isLoading, error } = useWorkflowsByOrg(currentOrganization?.id);
  console.log(error);
  // Workflow management mutations using repository hooks
  const activateWorkflow = useActivateWorkflow();
  const pauseWorkflow = usePauseWorkflow();
  const archiveWorkflow = useArchiveWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  
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

  const handleEditWorkflow = (workflow: WorkflowType) => {
    setEditingWorkflow(workflow);
    setActiveTab("builder"); // Switch to builder tab when editing
  };

  const handleCancelEdit = () => {
    setEditingWorkflow(null);
    setActiveTab("workflows"); // Switch back to workflows tab when canceling edit
  };

  const handleDeleteWorkflow = (workflow: WorkflowType) => {
    setWorkflowToDelete(workflow);
  };

  const confirmDeleteWorkflow = () => {
    if (workflowToDelete) {
      deleteWorkflow.mutate(workflowToDelete.id);
      setWorkflowToDelete(null);
    }
  };

  const cancelDeleteWorkflow = () => {
    setWorkflowToDelete(null);
  };

  const handlePreviewWorkflow = (workflow: WorkflowType) => {
    setPreviewingWorkflow(workflow);
    setActiveTab("preview");
  };

  const handleClosePreview = () => {
    setPreviewingWorkflow(null);
    setActiveTab("workflows");
  };

  const handlePreviewFromBuilder = (workflowData: Partial<CreateWorkflowInput>) => {
    // Convert builder data to preview format
    const previewWorkflow: WorkflowType = {
      id: "preview-" + Date.now(),
      name: workflowData.name || "Untitled Workflow",
      description: workflowData.description || "",
      trigger: workflowData.trigger || { type: "manual.trigger" },
      steps: workflowData.steps || [],
      status: "draft",
      version: 1,
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      tags: workflowData.tags || [],
      category: workflowData.category || "general",
      n8nEnabled: workflowData.n8nEnabled || false,
      orgId: currentOrganization?.id || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setPreviewingWorkflow(previewWorkflow);
    setActiveTab("preview");
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

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "Unknown";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6">
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
                    <Card 
                      key={workflow.id} 
                      className={`hover:shadow-md transition-shadow ${
                        editingWorkflow?.id === workflow.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                    >
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
                                onClick={() => handlePreviewWorkflow(workflow)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditWorkflow(workflow)}
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => archiveWorkflow.mutate(workflow.id)}
                                className="text-orange-600 hover:bg-orange-50"
                              >
                                <Archive className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteWorkflow(workflow)}
                                className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Permanently
                              </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(workflow.status)}
                          {editingWorkflow?.id === workflow.id && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Editing
                            </Badge>
                          )}
                        </div>
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

                    <div className="pt-2 border-t space-y-1">
                      <div className="flex items-center justify-between">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground cursor-help">
                                Created {formatTimestamp(workflow.createdAt)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{workflow.createdAt ? new Date(workflow.createdAt).toLocaleString() : "Unknown"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className="flex items-center gap-2">
                          {workflow.n8nEnabled && (
                            <Badge variant="outline" className="text-xs">
                              n8n
                            </Badge>
                          )}
                        </div>
                      </div>
                      {workflow.updatedAt && workflow.updatedAt !== workflow.createdAt && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xs text-muted-foreground cursor-help">
                                Updated {formatTimestamp(workflow.updatedAt)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{new Date(workflow.updatedAt).toLocaleString()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePreviewWorkflow(workflow)}
                        className="flex-1"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditWorkflow(workflow)}
                        className="flex-1"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

            <TabsContent value="builder">
              <WorkflowBuilderWrapper 
                editingWorkflow={editingWorkflow}
                onCancelEdit={handleCancelEdit}
                onPreview={handlePreviewFromBuilder}
              />
            </TabsContent>

            <TabsContent value="preview">
              {previewingWorkflow ? (
                <WorkflowPreview 
                  workflow={previewingWorkflow}
                  onClose={handleClosePreview}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Eye className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No workflow selected for preview</h3>
                  <p className="text-muted-foreground">
                    Select a workflow from the list to preview its structure and execution flow
                  </p>
                </div>
              )}
            </TabsContent>

        <TabsContent value="history">
          {workflows.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select a workflow to view execution history</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <h4 className="font-medium">{workflow.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {workflow.description || "No description"}
                      </p>
                      <div className="mt-2">
                        <WorkflowExecutionHistory workflowId={workflow.id} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No workflows to view history</h3>
              <p className="text-muted-foreground">
                Create a workflow first to see its execution history
              </p>
            </div>
          )}
        </TabsContent>
          </Tabs>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!workflowToDelete} onOpenChange={() => setWorkflowToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{workflowToDelete?.name}"? This action cannot be undone.
                  <br />
                  <br />
                  <strong>This will permanently remove:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>The workflow and all its steps</li>
                    <li>All execution history</li>
                    <li>All associated data</li>
                  </ul>
                  <br />
                  <span className="text-orange-600 font-medium">
                    Consider archiving instead if you want to keep the data for historical reference.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDeleteWorkflow}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteWorkflow}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteWorkflow.isPending}
                >
                  {deleteWorkflow.isPending ? "Deleting..." : "Delete Permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }
