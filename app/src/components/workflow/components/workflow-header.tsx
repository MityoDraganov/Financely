import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { WorkflowTriggerType } from "@/core";
import { WorkflowHeaderProps, TRIGGER_GROUPS } from "../types";

export function WorkflowHeader({ 
  workflow, 
  editingWorkflow, 
  onUpdateWorkflow, 
  onCancelEdit 
}: WorkflowHeaderProps) {
  const { t } = useTranslation();
  
  const getTriggerGroupLabel = (groupId: string) => {
    return t(`workflows.builder.triggerGroups.${groupId}`) || groupId;
  };
  
  const getTriggerLabel = (triggerValue: string) => {
    // Try translation first, fallback to formatted label
    const translationKey = `workflows.triggers.${triggerValue.replace(/\./g, '')}`;
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
    
    // Fallback: format the trigger value nicely
    return triggerValue
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {editingWorkflow ? t('workflows.builder.edit', { name: editingWorkflow.name }) : t('workflows.builder.create')}
              {editingWorkflow && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {t('workflows.builder.editing')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {editingWorkflow 
                ? t('workflows.builder.description.edit')
                : t('workflows.builder.description.create')
              }
            </CardDescription>
          </div>
          {editingWorkflow && onCancelEdit && (
            <Button variant="outline" onClick={onCancelEdit}>
              <X className="w-4 h-4 mr-2" />
              {t('workflows.builder.cancelEdit')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[320px] flex-[2_1_24rem] flex-col gap-2">
            <Label htmlFor="name">{t('workflows.builder.fields.name')}</Label>
            <Input
              id="name"
              value={workflow.name || ""}
              onChange={(e) => onUpdateWorkflow({ name: e.target.value })}
              placeholder={t('workflows.builder.fields.namePlaceholder')}
            />
          </div>

          <div className="flex min-w-[220px] flex-[1_1_16rem] flex-col gap-2">
            <Label htmlFor="trigger">{t('workflows.builder.fields.trigger')}</Label>
            <Select
              value={workflow.trigger?.type || "manual.trigger"}
              onValueChange={(value) => onUpdateWorkflow({ 
                trigger: { type: value as WorkflowTriggerType } 
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                      {getTriggerGroupLabel(group.id)}
                    </div>
                    {group.triggers.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value} className="pl-6">
                        {getTriggerLabel(trigger.value)}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[220px] flex-[1_1_16rem] flex-col gap-2">
            <Label htmlFor="category">{t('workflows.builder.fields.category')}</Label>
            <Select
              value={workflow.category || "general"}
              onValueChange={(value) => onUpdateWorkflow({ category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{t('workflows.builder.categories.general')}</SelectItem>
                <SelectItem value="finance">{t('workflows.builder.categories.finance')}</SelectItem>
                <SelectItem value="onboarding">{t('workflows.builder.categories.onboarding')}</SelectItem>
                <SelectItem value="approval">{t('workflows.builder.categories.approval')}</SelectItem>
                <SelectItem value="contracts">{t('workflows.builder.categories.contracts')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t('workflows.builder.fields.description')}</Label>
          <Textarea
            id="description"
            value={workflow.description || ""}
            onChange={(e) => onUpdateWorkflow({ description: e.target.value })}
            placeholder={t('workflows.builder.fields.descriptionPlaceholder')}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
