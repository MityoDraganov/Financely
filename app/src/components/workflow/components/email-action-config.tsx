import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { WorkflowAction } from "@/core";

interface EmailActionConfigProps {
  action: WorkflowAction;
  onUpdateConfig: (config: any) => void;
}

export function EmailActionConfig({ action, onUpdateConfig }: EmailActionConfigProps) {
  const { t } = useTranslation();
  const config = action.config as any;

  const updateConfig = (updates: any) => {
    onUpdateConfig({ ...config, ...updates });
  };

  const updateRecipients = (recipients: string[]) => {
    updateConfig({ recipients });
  };

  const updateCc = (cc: string[]) => {
    updateConfig({ cc });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{t('workflows.emailAction.recipients')}</Label>
        <div className="space-y-2">
          {config.recipients?.map((email: string, emailIndex: number) => (
            <div key={emailIndex} className="flex gap-2">
              <Input
                placeholder={t('workflows.emailAction.recipientPlaceholder')}
                value={email}
                onChange={(e) => {
                  const updatedRecipients = [...(config.recipients || [])];
                  updatedRecipients[emailIndex] = e.target.value;
                  updateRecipients(updatedRecipients);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updatedRecipients = config.recipients?.filter((_: any, idx: number) => idx !== emailIndex) || [];
                  updateRecipients(updatedRecipients);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const updatedRecipients = [...(config.recipients || []), ""];
              updateRecipients(updatedRecipients);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('workflows.emailAction.addRecipient')}
          </Button>
        </div>
      </div>

      <div>
        <Label>{t('workflows.emailAction.subject')}</Label>
        <Input
          placeholder={t('workflows.emailAction.subjectPlaceholder')}
          value={config.subject || ""}
          onChange={(e) => updateConfig({ subject: e.target.value })}
        />
      </div>

      <div>
        <Label>{t('workflows.emailAction.body')}</Label>
        <Textarea
          placeholder={t('workflows.emailAction.bodyPlaceholder')}
          value={config.body || ""}
          onChange={(e) => updateConfig({ body: e.target.value })}
          rows={6}
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={`html-${action.id}`}
          checked={config.isHtml || false}
          onChange={(e) => updateConfig({ isHtml: e.target.checked })}
        />
        <Label htmlFor={`html-${action.id}`}>{t('workflows.emailAction.htmlEmail')}</Label>
      </div>

      <div>
        <Label>{t('workflows.emailAction.cc')}</Label>
        <div className="space-y-2">
          {config.cc?.map((email: string, emailIndex: number) => (
            <div key={emailIndex} className="flex gap-2">
              <Input
                placeholder={t('workflows.emailAction.ccPlaceholder')}
                value={email}
                onChange={(e) => {
                  const updatedCc = [...(config.cc || [])];
                  updatedCc[emailIndex] = e.target.value;
                  updateCc(updatedCc);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const updatedCc = config.cc?.filter((_: any, idx: number) => idx !== emailIndex) || [];
                  updateCc(updatedCc);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const updatedCc = [...(config.cc || []), ""];
              updateCc(updatedCc);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('workflows.emailAction.addCc')}
          </Button>
        </div>
      </div>

      <div>
        <Label>{t('workflows.emailAction.replyTo')}</Label>
        <Input
          placeholder={t('workflows.emailAction.replyToPlaceholder')}
          value={config.replyTo || ""}
          onChange={(e) => updateConfig({ replyTo: e.target.value })}
        />
      </div>
    </div>
  );
}

