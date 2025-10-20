import { useState } from "react";
import { Check, Zap, Mail, Clock, DollarSign, FileText, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkflowTemplate } from "@/core";

interface WorkflowTemplatesProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

const builtInTemplates: WorkflowTemplate[] = [
  {
    id: "invoice-follow-up",
    name: "Invoice Follow-up",
    description: "Automatically send follow-up emails for unpaid invoices",
    category: "Invoicing",
    trigger: {
      type: "invoice.sent",
      config: {},
    },
    steps: [
      {
        id: "step-1",
        name: "Wait 3 days",
        type: "action",
        actions: [
          {
            type: "wait.delay",
            config: {},
            delaySeconds: 259200, // 3 days
          },
        ],
        order: 0,
      },
      {
        id: "step-2", 
        name: "Send reminder",
        type: "action",
        actions: [
          {
            type: "send.email",
            config: {
              template: "invoice-reminder",
              recipient: "{{invoice.buyer.email}}",
              subject: "Reminder: Invoice {{invoice.invoiceNumber}} is due",
            },
            recipient: "{{invoice.buyer.email}}",
            subject: "Reminder: Invoice {{invoice.invoiceNumber}} is due",
          },
        ],
        order: 1,
      },
    ],
    tags: ["invoicing", "automation", "follow-up"],
    isBuiltIn: true,
  },
  {
    id: "proposal-approval",
    name: "Proposal Approval Workflow",
    description: "Automate the proposal review and approval process",
    category: "Sales",
    trigger: {
      type: "proposal.created",
      config: {},
    },
    steps: [
      {
        id: "step-1",
        name: "Notify manager",
        type: "action",
        actions: [
          {
            type: "send.slack",
            config: {
              channel: "#sales",
              message: "New proposal created: {{proposal.title}}",
            },
          },
        ],
        order: 0,
      },
      {
        id: "step-2",
        name: "Create review task",
        type: "action", 
        actions: [
          {
            type: "create.task",
            config: {
              title: "Review proposal: {{proposal.title}}",
              assignee: "{{proposal.managerId}}",
              dueDate: "{{proposal.createdAt + 2 days}}",
            },
            assigneeId: "{{proposal.managerId}}",
            title: "Review proposal: {{proposal.title}}",
            description: "Please review and approve this proposal",
          },
        ],
        order: 1,
      },
    ],
    tags: ["sales", "approval", "automation"],
    isBuiltIn: true,
  },
  {
    id: "contract-renewal",
    name: "Contract Renewal Reminder",
    description: "Send reminders for expiring contracts",
    category: "Contracts",
    trigger: {
      type: "schedule.cron",
      config: {},
      cronExpression: "0 9 * * *", // Daily at 9 AM
    },
    steps: [
      {
        id: "step-1",
        name: "Check expiring contracts",
        type: "action",
        actions: [
          {
            type: "call.webhook",
            config: {
              url: "{{api.baseUrl}}/contracts/expiring",
              method: "GET",
            },
            url: "{{api.baseUrl}}/contracts/expiring",
            method: "GET",
          },
        ],
        order: 0,
      },
      {
        id: "step-2",
        name: "Send renewal reminders",
        type: "action",
        actions: [
          {
            type: "send.email",
            config: {
              template: "contract-renewal",
              recipient: "{{contract.clientEmail}}",
              subject: "Contract Renewal: {{contract.name}}",
            },
            recipient: "{{contract.clientEmail}}",
            subject: "Contract Renewal: {{contract.name}}",
          },
        ],
        order: 1,
      },
    ],
    tags: ["contracts", "renewal", "scheduled"],
    isBuiltIn: true,
  },
  {
    id: "payment-received",
    name: "Payment Received Notification",
    description: "Notify team when payments are received",
    category: "Payments",
    trigger: {
      type: "invoice.paid",
      config: {},
    },
    steps: [
      {
        id: "step-1",
        name: "Update invoice status",
        type: "action",
        actions: [
          {
            type: "update.invoice.status",
            config: {
              status: "paid",
              paidAt: "{{now}}",
            },
          },
        ],
        order: 0,
      },
      {
        id: "step-2",
        name: "Notify team",
        type: "action",
        actions: [
          {
            type: "send.slack",
            config: {
              channel: "#finance",
              message: "💰 Payment received for invoice {{invoice.invoiceNumber}} - ${{invoice.total}}",
            },
          },
        ],
        order: 1,
      },
      {
        id: "step-3",
        name: "Send receipt",
        type: "action",
        actions: [
          {
            type: "send.email",
            config: {
              template: "payment-receipt",
              recipient: "{{invoice.buyer.email}}",
              subject: "Payment Received - Invoice {{invoice.invoiceNumber}}",
            },
            recipient: "{{invoice.buyer.email}}",
            subject: "Payment Received - Invoice {{invoice.invoiceNumber}}",
          },
        ],
        order: 2,
      },
    ],
    tags: ["payments", "notifications", "automation"],
    isBuiltIn: true,
  },
];

export function WorkflowTemplates({ onSelectTemplate }: WorkflowTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = ["all", ...Array.from(new Set(builtInTemplates.map(t => t.category)))];
  
  const filteredTemplates = selectedCategory === "all" 
    ? builtInTemplates 
    : builtInTemplates.filter(t => t.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Invoicing":
        return <DollarSign className="w-5 h-5" />;
      case "Sales":
        return <Users className="w-5 h-5" />;
      case "Contracts":
        return <FileText className="w-5 h-5" />;
      case "Payments":
        return <Check className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case "invoice.sent":
      case "invoice.paid":
        return <Mail className="w-4 h-4" />;
      case "schedule.cron":
        return <Clock className="w-4 h-4" />;
      case "proposal.created":
        return <FileText className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Workflow Templates</h2>
        <p className="text-muted-foreground">
          Choose from pre-built workflow templates to get started quickly
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="capitalize"
          >
            {category === "all" ? "All Templates" : category}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(template.category)}
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Template
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {getTriggerIcon(template.trigger.type)}
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="font-medium">
                    {template.trigger.type.replace(".", " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4" />
                  <span className="text-muted-foreground">Steps:</span>
                  <span className="font-medium">{template.steps.length}</span>
                </div>
              </div>

              {template.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
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

              <div className="pt-2 border-t">
                <Button 
                  className="w-full" 
                  onClick={() => onSelectTemplate(template)}
                >
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No templates found</h3>
                <p className="text-muted-foreground">
                  Try selecting a different category or create a custom workflow
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
