import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Eye, Zap, ArrowRight, CheckCircle, Clock, Mail, MessageSquare, FileText, Settings, AlertCircle, X } from "lucide-react";
import { workflowTemplatesService } from "@/services/workflow/workflow-templates-service";
import { useCreateWorkflow } from "@/hooks/repository-hooks/use-workflows";
import { useOrganizationContext } from "@/contexts/organization-context";
import { toast } from "sonner";
import { WorkflowTemplate } from "@/core";

// Extended template type for preview with optional estimatedTime
interface ExtendedWorkflowTemplate extends WorkflowTemplate {
  estimatedTime?: string;
}

export default function WorkflowTemplates() {
  const { currentOrganization } = useOrganizationContext();
  const createWorkflow = useCreateWorkflow();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<ExtendedWorkflowTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  const templates = workflowTemplatesService.getTemplates();
  
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];

  const handleUseTemplate = async (templateId: string) => {
    if (!currentOrganization?.id) {
      toast.error("No organization selected");
      return;
    }

    try {
      const workflowData = workflowTemplatesService.createWorkflowFromTemplate(
        templateId,
        currentOrganization.id
      );

      await createWorkflow.mutateAsync(workflowData);
      toast.success("Workflow created from template!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to create workflow: ${errorMessage}`);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      finance: "bg-green-100 text-green-800",
      onboarding: "bg-blue-100 text-blue-800",
      approval: "bg-purple-100 text-purple-800",
      contracts: "bg-orange-100 text-orange-800",
      general: "bg-gray-100 text-gray-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const handlePreviewTemplate = (template: WorkflowTemplate) => {
    setPreviewTemplate(template as ExtendedWorkflowTemplate);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setPreviewTemplate(null);
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Workflow Templates</h2>
        <p className="text-muted-foreground">
          Get started quickly with pre-built workflow templates
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
        {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === "all" ? "All Categories" : category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </div>
                <Badge className={getCategoryColor(template.category)}>
                  {template.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Trigger Info */}
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Trigger:</span>
                <span className="text-sm font-medium">
                  {template.trigger.type.replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>

              {/* Steps Info */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted rounded" />
                <span className="text-sm text-muted-foreground">Steps:</span>
                <span className="text-sm font-medium">{template.steps.length}</span>
              </div>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{template.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handlePreviewTemplate(template)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button 
                  size="sm"
                  className="flex-1"
                  onClick={() => handleUseTemplate(template.id)}
                  disabled={createWorkflow.isPending}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {createWorkflow.isPending ? "Creating..." : "Use Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
              </div>
          <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
                </p>
              </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Template Preview: {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Preview how this template will work before using it
            </DialogDescription>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="space-y-6">
              {/* Template Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {previewTemplate.name}
                    <Badge className={getCategoryColor(previewTemplate.category)}>
                      {previewTemplate.category}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{previewTemplate.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Trigger</h4>
                      <p className="text-sm">{getTriggerLabel(previewTemplate.trigger.type)}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Steps</h4>
                      <p className="text-sm">{previewTemplate.steps.length} step{previewTemplate.steps.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Category</h4>
                      <p className="text-sm capitalize">{previewTemplate.category}</p>
                    </div>
                  </div>
                  
                  {previewTemplate.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {previewTemplate.tags.map((tag) => (
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
                    Visual representation of how this template will execute
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
                          <p className="text-sm text-blue-700">{getTriggerLabel(previewTemplate.trigger.type)}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    {/* Steps */}
                    {previewTemplate.steps.map((step, stepIndex) => (
                      <div key={step.id} className="space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-medium">
                                {stepIndex + 1}
                              </div>
                              <div>
                                <h4 className="font-medium">{step.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {step.actions.length} action{step.actions.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          </div>
                          {stepIndex < previewTemplate.steps.length - 1 && (
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

              {/* Template Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Template Details</CardTitle>
                  <CardDescription>
                    Additional information about this template
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Use Cases</h4>
                      <p className="text-sm">{previewTemplate.description}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Complexity</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`w-3 h-3 rounded-full mr-1 ${
                                level <= (previewTemplate.steps.length > 3 ? 4 : 2) 
                                  ? 'bg-blue-500' 
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {previewTemplate.steps.length > 3 ? 'Advanced' : 'Simple'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {previewTemplate.estimatedTime && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Estimated Setup Time</span>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">
                        {previewTemplate.estimatedTime}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClosePreview}>
                  <X className="w-4 h-4 mr-2" />
                  Close Preview
                </Button>
                <Button 
                  onClick={() => {
                    handleClosePreview();
                    handleUseTemplate(previewTemplate.id);
                  }}
                  disabled={createWorkflow.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createWorkflow.isPending ? "Creating..." : "Use This Template"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}