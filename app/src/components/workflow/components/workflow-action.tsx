import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { WorkflowActionProps } from "../types";
import { HttpActionConfig } from "./http-action-config";
import { EmailActionConfig } from "./email-action-config";

export function WorkflowActionComponent({ 
  action, 
  actionIndex, 
  stepId, 
  onUpdateAction, 
  onDeleteAction 
}: WorkflowActionProps) {
  const handleUpdateConfig = (config: any) => {
    onUpdateAction(stepId, actionIndex, { config });
  };

  const handleUpdateName = (name: string) => {
    onUpdateAction(stepId, actionIndex, { name });
  };

  const handleDelete = () => {
    onDeleteAction(stepId, actionIndex);
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{action.type}</Badge>
          <span className="text-sm font-medium">Action {actionIndex + 1}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label>Action Name</Label>
          <Input
            placeholder="Send notification to Slack"
            value={action.name}
            onChange={(e) => handleUpdateName(e.target.value)}
          />
        </div>

        {action.type === "http_request" && (
          <HttpActionConfig action={action} onUpdateConfig={handleUpdateConfig} />
        )}

        {action.type === "send_email" && (
          <EmailActionConfig action={action} onUpdateConfig={handleUpdateConfig} />
        )}
      </div>
    </div>
  );
}
