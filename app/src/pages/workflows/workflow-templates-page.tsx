import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WorkflowBuilder from "@/components/workflow/workflow-builder";
import { WorkflowTemplate } from "@/core";

export default function WorkflowTemplatesPage() {
  const navigate = useNavigate();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const handleCreateCustom = () => {
    setSelectedTemplate(null);
    setShowBuilder(true);
  };

  if (showBuilder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setShowBuilder(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {selectedTemplate ? "Create from Template" : "Create Custom Workflow"}
            </h1>
            <p className="text-muted-foreground">
              {selectedTemplate 
                ? `Customize the "${selectedTemplate.name}" template`
                : "Build your workflow from scratch"
              }
            </p>
          </div>
        </div>

        <WorkflowBuilder
          editingWorkflow={selectedTemplate ? {
            id: "",
            name: selectedTemplate.name,
            description: selectedTemplate.description,
            trigger: selectedTemplate.trigger,
            steps: selectedTemplate.steps,
            orgId: "",
            status: "draft",
            version: 1,
            settings: {
              maxRetries: 3,
              timeoutSeconds: 300,
              notifyOnFailure: true,
              notifyOnSuccess: false,
              maxConcurrentExecutions: 10,
            },
            tags: selectedTemplate.tags,
            category: selectedTemplate.category,
            createdAt: "",
            updatedAt: "",
          } as any : null}
          onCancelEdit={() => setShowBuilder(false)}
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
            <h1 className="text-3xl font-bold">Workflow Templates</h1>
            <p className="text-muted-foreground">
              Choose from pre-built templates or create a custom workflow
            </p>
          </div>
        </div>
        <Button onClick={handleCreateCustom}>
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Workflow
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">12</div>
                <div className="text-sm text-muted-foreground">Available Templates</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">4</div>
                <div className="text-sm text-muted-foreground">Categories</div>
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
                <div className="text-2xl font-bold">∞</div>
                <div className="text-sm text-muted-foreground">Custom Workflows</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Workflow templates coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
