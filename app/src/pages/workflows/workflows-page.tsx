import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Play, Pause, Archive, MoreHorizontal, Settings, History, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent} from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkflowsByOrg, useActivateWorkflow, usePauseWorkflow, useArchiveWorkflow, useCreateWorkflowFunction, useDeleteWorkflow } from "@/hooks";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import WorkflowBuilderWrapper from "@/components/workflow/workflow-builder-wrapper";
import WorkflowExecutionHistory from "@/components/workflow/workflow-execution-history";
import WorkflowPreview from "@/components/workflow/workflow-preview";
import { Workflow as WorkflowType, CreateWorkflowInput } from "@/core";
import { useDateFormatting } from "@/hooks/use-date-formatting";

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const { formatDateTable, formatDateTime } = useDateFormatting();
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
      name: t('workflows.builder.create'),
      description: t('workflows.builder.description.create'),
      trigger: {
        type: "manual.trigger" as const,
      },
      steps: [
        {
          id: "step1",
          name: t('workflows.builder.steps.step', { number: 1 }),
          type: "action" as const,
          actions: [
            {
              type: "send.email" as const,
              id: "action1",
              name: "",
              config: {
                mode: "manual",
                recipients: [],
                subject: "",
                body: "",
                isHtml: false,
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
      tags: [],
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
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('workflows.status.active')}</Badge>;
      case "paused":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('workflows.status.paused')}</Badge>;
      case "draft":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">{t('workflows.status.draft')}</Badge>;
      case "archived":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">{t('workflows.status.archived')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerTypeLabel = (triggerType: string) => {
    const triggerMap: Record<string, string> = {
      "invoice.created": t('workflows.triggers.invoiceCreated'),
      "invoice.sent": t('workflows.triggers.invoiceSent'),
      "invoice.paid": t('workflows.triggers.invoicePaid'),
      "invoice.overdue": t('workflows.triggers.invoiceOverdue'),
      "proposal.created": t('workflows.triggers.proposalCreated'),
      "proposal.approved": t('workflows.triggers.proposalApproved'),
      "contract.expiring": t('workflows.triggers.contractExpiring'),
      "contract.expired": t('workflows.triggers.contractExpired'),
      "user.joined": t('workflows.triggers.userJoined'),
      "schedule.cron": t('workflows.triggers.scheduled'),
      "webhook.external": t('workflows.triggers.webhook'),
      "manual.trigger": t('workflows.triggers.manual'),
    };
    return triggerMap[triggerType] || triggerType;
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return '';
    return formatDateTable(timestamp);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('workflows.loading')}</div>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-6 pr-4 sm:pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('workflows.title')}</h1>
          <p className="text-muted-foreground">
            {t('workflows.subtitle')}
          </p>
        </div>
        <Button onClick={handleCreateWorkflow} disabled={createWorkflow.isPending}>
          <Plus className="w-4 h-4 mr-2" />
          {createWorkflow.isPending ? t('workflows.creating') : t('workflows.create')}
        </Button>
      </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

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
                    <h3 className="text-lg font-semibold text-foreground">{t('workflows.noWorkflows.title')}</h3>
                    <p className="text-muted-foreground">
                      {t('workflows.noWorkflows.description')}
                    </p>
                  </div>
                  <Button onClick={handleCreateWorkflow} disabled={createWorkflow.isPending}>
                    <Plus className="w-4 h-4 mr-2" />
                    {createWorkflow.isPending ? t('workflows.creating') : t('workflows.noWorkflows.createFirst')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workflows.map((workflow) => (
                    <Card 
                      key={workflow.id} 
                      className={cn(
                        "hover:shadow-lg transition-all duration-200 border-2",
                        "hover:border-primary/50",
                        editingWorkflow?.id === workflow.id 
                          ? 'ring-2 ring-primary shadow-lg bg-primary/5 border-primary' 
                          : 'border-border'
                      )}
                    >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{workflow.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {workflow.description || t('workflows.details.noDescription')}
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
                                {t('workflows.actions.preview')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditWorkflow(workflow)}
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                {t('workflows.actions.edit')}
                              </DropdownMenuItem>
                          {workflow.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => pauseWorkflow.mutate(workflow.id)}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              {t('workflows.actions.pause')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => activateWorkflow.mutate(workflow.id)}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {t('workflows.actions.activate')}
                            </DropdownMenuItem>
                          )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => archiveWorkflow.mutate(workflow.id)}
                                className="text-orange-600 hover:bg-orange-50"
                              >
                                <Archive className="w-4 h-4 mr-2" />
                                {t('workflows.actions.archive')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteWorkflow(workflow)}
                                className="text-red-600 hover:bg-red-50 focus:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {t('workflows.actions.delete')}
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
                              {t('workflows.status.editing')}
                            </Badge>
                          )}
                        </div>
                          <div className="text-sm text-muted-foreground">
                            v{workflow.version}
                          </div>
                        </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('workflows.details.trigger')}</span>
                        <span className="font-medium">
                          {getTriggerTypeLabel(workflow.trigger.type)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('workflows.details.steps')}</span>
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
                              {t('workflows.details.moreTags', { count: workflow.tags.length - 3 })}
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
                                {t('workflows.details.created', { time: formatTimestamp(workflow.createdAt) })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{workflow.createdAt ? formatDateTime(workflow.createdAt) : ''}</p>
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
                                {t('workflows.details.updated', { time: formatTimestamp(workflow.updatedAt) || '' })}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatDateTime(workflow.updatedAt)}</p>
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
                        {t('workflows.actions.preview')}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditWorkflow(workflow)}
                        className="flex-1"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        {t('workflows.actions.edit')}
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
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{t('workflows.preview.noSelection.title')}</h3>
                  <p className="text-muted-foreground">
                    {t('workflows.preview.noSelection.description')}
                  </p>
                </div>
              )}
            </TabsContent>

        <TabsContent value="history">
          {workflows.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{t('workflows.history.selectWorkflow')}</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <h4 className="font-medium">{workflow.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {workflow.description || t('workflows.details.noDescription')}
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
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('workflows.history.noWorkflows.title')}</h3>
              <p className="text-muted-foreground">
                {t('workflows.history.noWorkflows.description')}
              </p>
            </div>
          )}
        </TabsContent>
          </Tabs>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!workflowToDelete} onOpenChange={() => setWorkflowToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('workflows.delete.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('workflows.delete.description', { name: workflowToDelete?.name || '' })}
                  <br />
                  <br />
                  <strong>{t('workflows.delete.willRemove')}</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>{t('workflows.delete.willRemoveList.workflow')}</li>
                    <li>{t('workflows.delete.willRemoveList.history')}</li>
                    <li>{t('workflows.delete.willRemoveList.data')}</li>
                  </ul>
                  <br />
                  <span className="text-orange-600 font-medium">
                    {t('workflows.delete.considerArchive')}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDeleteWorkflow}>
                  {t('workflows.delete.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteWorkflow}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteWorkflow.isPending}
                >
                  {deleteWorkflow.isPending ? t('workflows.delete.deleting') : t('workflows.delete.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }
