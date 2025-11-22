import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Mail, 
  Users, 
  ShoppingCart,
  Zap,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { WorkflowData, WorkflowTriggerType, WorkflowActionType } from "@/core";
import { cn } from "@/lib/utils";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "invoice" | "lead" | "proposal" | "onboarding" | "notification";
  icon: React.ComponentType<{ className?: string }>;
  workflow: Omit<WorkflowData, "id" | "orgId" | "createdAt" | "updatedAt" | "version">;
}

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "invoice-reminder",
    name: "Invoice Reminder",
    description: "Automatically send reminder emails for overdue invoices",
    category: "invoice",
    icon: FileText,
    workflow: {
      name: "Invoice Reminder",
      description: "Sends reminder emails when invoices become overdue",
      trigger: {
        type: "invoice.overdue" as WorkflowTriggerType,
      },
      steps: [
        {
          id: "step_1",
          name: "Send Reminder Email",
          type: "action",
          order: 0,
          actions: [
            {
              id: "action_1",
              type: "send.email" as WorkflowActionType,
              name: "Send Reminder",
              config: {
                recipients: ["{{invoice.client.email}}"],
                subject: "Reminder: Invoice {{invoice.number}} is Overdue",
                body: "Dear {{invoice.client.name}},\n\nThis is a reminder that invoice {{invoice.number}} is overdue.\n\nAmount: {{invoice.total}}\n\nPlease make payment at your earliest convenience.\n\nThank you.",
                isHtml: false,
              },
            },
          ],
        },
      ],
      status: "draft",
      tags: ["invoice", "reminder", "email"],
      category: "finance",
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
    },
  },
  {
    id: "lead-welcome",
    name: "Lead Welcome",
    description: "Welcome new leads with an automated email sequence",
    category: "lead",
    icon: Users,
    workflow: {
      name: "Lead Welcome",
      description: "Sends welcome email to new leads",
      trigger: {
        type: "lead.created" as WorkflowTriggerType,
      },
      steps: [
        {
          id: "step_1",
          name: "Send Welcome Email",
          type: "action",
          order: 0,
          actions: [
            {
              id: "action_1",
              type: "send.email" as WorkflowActionType,
              name: "Welcome Email",
              config: {
                recipients: ["{{lead.email}}"],
                subject: "Welcome to {{organization.name}}!",
                body: "Hi {{lead.name}},\n\nThank you for your interest! We're excited to help you.\n\nBest regards,\n{{organization.name}}",
                isHtml: false,
              },
            },
          ],
        },
        {
          id: "step_2",
          name: "Create Contact",
          type: "action",
          order: 1,
          actions: [
            {
              id: "action_1",
              type: "convert.lead_to_contact" as WorkflowActionType,
              name: "Convert to Contact",
              config: {},
            },
          ],
        },
      ],
      status: "draft",
      tags: ["lead", "welcome", "onboarding"],
      category: "onboarding",
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
    },
  },
  {
    id: "proposal-to-invoice",
    name: "Proposal to Invoice",
    description: "Automatically convert approved proposals to invoices",
    category: "proposal",
    icon: FileText,
    workflow: {
      name: "Proposal to Invoice",
      description: "Converts approved proposals into invoices",
      trigger: {
        type: "proposal.approved" as WorkflowTriggerType,
      },
      steps: [
        {
          id: "step_1",
          name: "Convert to Invoice",
          type: "action",
          order: 0,
          actions: [
            {
              id: "action_1",
              type: "convert.proposal_to_invoice" as WorkflowActionType,
              name: "Convert Proposal",
              config: {},
            },
          ],
        },
        {
          id: "step_2",
          name: "Send Invoice",
          type: "action",
          order: 1,
          actions: [
            {
              id: "action_1",
              type: "send.email" as WorkflowActionType,
              name: "Send Invoice Email",
              config: {
                recipients: ["{{proposal.client.email}}"],
                subject: "Invoice {{invoice.number}}",
                body: "Dear {{proposal.client.name}},\n\nPlease find attached invoice {{invoice.number}}.\n\nThank you for your business!",
                isHtml: false,
              },
            },
          ],
        },
      ],
      status: "draft",
      tags: ["proposal", "invoice", "conversion"],
      category: "finance",
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
    },
  },
  {
    id: "new-user-notification",
    name: "New User Notification",
    description: "Notify team when a new user joins",
    category: "notification",
    icon: Users,
    workflow: {
      name: "New User Notification",
      description: "Sends notification when a new user joins the organization",
      trigger: {
        type: "user.joined" as WorkflowTriggerType,
      },
      steps: [
        {
          id: "step_1",
          name: "Notify Team",
          type: "action",
          order: 0,
          actions: [
            {
              id: "action_1",
              type: "send.email" as WorkflowActionType,
              name: "Notify Admins",
              config: {
                userId: "{{admin.id}}",
                message: "New user {{user.name}} joined the organization",
              },
            },
          ],
        },
      ],
      status: "draft",
      tags: ["user", "notification"],
      category: "general",
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
    },
  },
  {
    id: "low-stock-alert",
    name: "Low Stock Alert",
    description: "Alert when product stock is low",
    category: "notification",
    icon: ShoppingCart,
    workflow: {
      name: "Low Stock Alert",
      description: "Sends alert when product stock falls below threshold",
      trigger: {
        type: "product.low_stock" as WorkflowTriggerType,
      },
      steps: [
        {
          id: "step_1",
          name: "Send Alert",
          type: "action",
          order: 0,
          actions: [
            {
              id: "action_1",
              type: "send.email" as WorkflowActionType,
              name: "Low Stock Alert",
              config: {
                recipients: ["{{admin.email}}"],
                subject: "Low Stock Alert: {{product.name}}",
                body: "Product {{product.name}} is running low on stock.\n\nCurrent stock: {{product.stock}}\nThreshold: {{product.lowStockThreshold}}",
                isHtml: false,
              },
            },
          ],
        },
      ],
      status: "draft",
      tags: ["product", "alert", "inventory"],
      category: "general",
      settings: {
        maxRetries: 3,
        timeoutSeconds: 300,
        notifyOnFailure: true,
        notifyOnSuccess: false,
        maxConcurrentExecutions: 10,
      },
      n8nEnabled: false,
    },
  },
];

interface WorkflowTemplatesProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  className?: string;
}

export function WorkflowTemplates({ onSelectTemplate, className }: WorkflowTemplatesProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: "all", label: "All Templates" },
    { id: "invoice", label: "Invoice" },
    { id: "lead", label: "Lead" },
    { id: "proposal", label: "Proposal" },
    { id: "notification", label: "Notification" },
  ];

  const filteredTemplates = selectedCategory === "all" || !selectedCategory
    ? workflowTemplates
    : workflowTemplates.filter(t => t.category === selectedCategory);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Workflow Templates</CardTitle>
        <CardDescription>
          Start with pre-built workflows for common scenarios
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(template => {
            const Icon = template.icon;
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                onClick={() => onSelectTemplate(template)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-semibold">{template.name}</h4>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{template.workflow.steps.length} step{template.workflow.steps.length !== 1 ? 's' : ''}</span>
                        <ArrowRight className="w-3 h-3" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTemplate(template);
                          }}
                        >
                          Use Template
                        </Button>
                      </div>
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

