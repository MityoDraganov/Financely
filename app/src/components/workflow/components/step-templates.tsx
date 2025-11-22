import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  FileText, 
  Clock, 
  CheckCircle, 
  Zap,
  Users,
  ShoppingCart,
  GitBranch
} from "lucide-react";
import { WorkflowStep, WorkflowActionType } from "@/core";
import { cn } from "@/lib/utils";

export interface StepTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "communication" | "automation" | "data" | "conditional";
  step: Omit<WorkflowStep, "id" | "order">;
}

const stepTemplates: StepTemplate[] = [
  {
    id: "send-email",
    name: "Send Email",
    description: "Send an email notification",
    icon: Mail,
    category: "communication",
    step: {
      name: "Send Email",
      type: "action",
      actions: [{
        id: "action_1",
        type: "send.email" as WorkflowActionType,
        name: "Send Email",
        config: {
          recipients: [],
          subject: "",
          body: "",
          isHtml: false,
        },
      }],
    },
  },
  {
    id: "delay",
    name: "Wait/Delay",
    description: "Wait for a specified duration",
    icon: Clock,
    category: "automation",
    step: {
      name: "Wait",
      type: "delay",
      actions: [],
      delaySeconds: 60,
    },
  },
  {
    id: "conditional-branch",
    name: "Conditional Branch",
    description: "Execute different actions based on conditions",
    icon: GitBranch,
    category: "conditional",
    step: {
      name: "Conditional Branch",
      type: "condition",
      actions: [],
      conditions: [{
        field: "",
        operator: "equals",
        value: "",
      }],
    },
  },
  {
    id: "webhook-call",
    name: "Call Webhook",
    description: "Make an HTTP request to an external API",
    icon: Zap,
    category: "automation",
    step: {
      name: "Call Webhook",
      type: "action",
      actions: [{
        id: "action_1",
        type: "call.webhook" as WorkflowActionType,
        name: "Call Webhook",
        config: {
          method: "POST",
          url: "",
        },
      }],
    },
  },
  {
    id: "create-proposal",
    name: "Create Proposal",
    description: "Generate a new proposal",
    icon: FileText,
    category: "automation",
    step: {
      name: "Create Proposal",
      type: "action",
      actions: [{
        id: "action_1",
        type: "create.proposal" as WorkflowActionType,
        name: "Create Proposal",
        config: {
          clientId: "",
          items: [],
        },
      }],
    },
  },
];

interface StepTemplatesProps {
  onSelectTemplate: (template: StepTemplate) => void;
  className?: string;
}

export function StepTemplates({ onSelectTemplate, className }: StepTemplatesProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: "all", label: "All Templates" },
    { id: "communication", label: "Communication" },
    { id: "automation", label: "Automation" },
    { id: "conditional", label: "Conditional" },
  ];

  const filteredTemplates = selectedCategory === "all" || !selectedCategory
    ? stepTemplates
    : stepTemplates.filter(t => t.category === selectedCategory);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Step Templates</CardTitle>
        <CardDescription>
          Quick-add common step patterns to your workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id === "all" ? null : category.id)}
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTemplates.map(template => {
            const Icon = template.icon;
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => onSelectTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{template.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

