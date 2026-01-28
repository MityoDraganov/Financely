import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JsonEditor } from "@/components/ui/json-editor";
import { WorkflowAction } from "@/core";
import { validateUrlForSSRF } from "@/utils/ssrf-validation";

interface HttpActionConfigProps {
  action: WorkflowAction;
  onUpdateConfig: (config: any) => void;
}

export function HttpActionConfig({ action, onUpdateConfig }: HttpActionConfigProps) {
  const { t } = useTranslation();
  const config = action.config as any;
  const [urlValidation, setUrlValidation] = useState(validateUrlForSSRF(config.url || ""));

  useEffect(() => {
    setUrlValidation(validateUrlForSSRF(config.url || ""));
  }, [config.url]);

  const updateConfig = (updates: any) => {
    onUpdateConfig({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('workflows.httpAction.url')}</Label>
          <Input
            placeholder={t('workflows.httpAction.urlPlaceholder')}
            value={config.url || ""}
            onChange={(e) => updateConfig({ url: e.target.value })}
            className={urlValidation.errors.length > 0 ? "border-red-500" : urlValidation.warnings.length > 0 ? "border-yellow-500" : ""}
          />
          {urlValidation.errors.length > 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {urlValidation.errors.map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {urlValidation.warnings.length > 0 && urlValidation.errors.length === 0 && (
            <Alert variant="default" className="py-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
                {urlValidation.warnings.map((warning, idx) => (
                  <div key={idx}>{warning}</div>
                ))}
                <div className="mt-1 text-xs">
                  {t('workflows.httpAction.urlSecurityNote', { defaultValue: "This URL will be blocked when the workflow runs." })}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div>
          <Label>{t('workflows.httpAction.method')}</Label>
          <Select
            value={config.method || "POST"}
            onValueChange={(value) => updateConfig({ method: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <JsonEditor
        label={t('workflows.httpAction.headers')}
        placeholder={t('workflows.httpAction.headersPlaceholder')}
        value={config.headers ? JSON.stringify(config.headers, null, 2) : ""}
        onChange={(value) => {
          try {
            const headers = value.trim() ? JSON.parse(value) : undefined;
            updateConfig({ headers });
          } catch {
            // Invalid JSON, keep as is - validation will show error
          }
        }}
        rows={3}
      />

      <JsonEditor
        label={t('workflows.httpAction.body')}
        placeholder={t('workflows.httpAction.bodyPlaceholder')}
        value={config.body ? JSON.stringify(config.body, null, 2) : ""}
        onChange={(value) => {
          try {
            const body = value.trim() ? JSON.parse(value) : undefined;
            updateConfig({ body });
          } catch {
            // Invalid JSON, keep as is - validation will show error
          }
        }}
        rows={4}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>{t('workflows.httpAction.authentication')}</Label>
          <Select
            value={config.auth?.type || "none"}
            onValueChange={(value) => {
              const authType = value as "bearer" | "basic" | "none";
              updateConfig({ 
                auth: authType === "none" ? undefined : { type: authType } 
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('workflows.httpAction.authTypes.none')}</SelectItem>
              <SelectItem value="bearer">{t('workflows.httpAction.authTypes.bearer')}</SelectItem>
              <SelectItem value="basic">{t('workflows.httpAction.authTypes.basic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('workflows.httpAction.timeout')}</Label>
          <Input
            type="number"
            placeholder={t('workflows.httpAction.timeoutPlaceholder')}
            value={config.timeoutMs || ""}
            onChange={(e) => {
              const timeoutMs = parseInt(e.target.value) || undefined;
              updateConfig({ timeoutMs });
            }}
          />
        </div>
      </div>

      {config.auth?.type === "bearer" && (
        <div>
          <Label>{t('workflows.httpAction.token')}</Label>
          <Input
            placeholder={t('workflows.httpAction.tokenPlaceholder')}
            value={config.auth?.token || ""}
            onChange={(e) => updateConfig({ 
              auth: { 
                type: config.auth?.type || "bearer",
                ...config.auth, 
                token: e.target.value 
              }
            })}
          />
        </div>
      )}

      {config.auth?.type === "basic" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t('workflows.httpAction.username')}</Label>
            <Input
              placeholder={t('workflows.httpAction.usernamePlaceholder')}
              value={config.auth?.username || ""}
              onChange={(e) => updateConfig({ 
                auth: { 
                  type: config.auth?.type || "basic",
                  ...config.auth, 
                  username: e.target.value 
                }
              })}
            />
          </div>
          <div>
            <Label>{t('workflows.httpAction.password')}</Label>
            <Input
              type="password"
              placeholder={t('workflows.httpAction.passwordPlaceholder')}
              value={config.auth?.password || ""}
              onChange={(e) => updateConfig({ 
                auth: { 
                  type: config.auth?.type || "basic",
                  ...config.auth, 
                  password: e.target.value 
                }
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
