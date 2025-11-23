import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";

const aiSettingsSchema = z.object({
  autoProposalSuggestions: z.boolean(),
});

type AISettingsForm = z.infer<typeof aiSettingsSchema>;

export default function AISettingsPage() {
  const { t } = useTranslation();
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<AISettingsForm>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      autoProposalSuggestions: false,
    },
  });

  const autoProposalSuggestions = watch("autoProposalSuggestions");

  // Watch for changes to detect unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Reset form when organization data loads
  useEffect(() => {
    if (organization) {
      reset({
        autoProposalSuggestions: organization.settings?.ai?.autoProposalSuggestions ?? false,
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: AISettingsForm) => {
    if (!organization) return;

    try {
      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...organization.settings,
            ai: {
              autoProposalSuggestions: data.autoProposalSuggestions,
            },
          },
        },
      });

      toast.success(t('settings.organization.aiSettings.toasts.updated'));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to update AI settings:", error);
      toast.error(t('settings.organization.aiSettings.toasts.updateFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-0.5 pb-3 border-b">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('settings.organization.aiSettings.pageTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.organization.aiSettings.pageDescription')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* Proposal Suggestions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('settings.organization.aiSettings.proposalSuggestions.title')}</CardTitle>
            <CardDescription className="text-sm">
              {t('settings.organization.aiSettings.proposalSuggestions.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="autoProposalSuggestions" className="text-sm font-medium">
                  {t('settings.organization.aiSettings.proposalSuggestions.autoSuggestions')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings.organization.aiSettings.proposalSuggestions.autoSuggestionsDescription')}
                </p>
              </div>
              <Switch
                id="autoProposalSuggestions"
                checked={autoProposalSuggestions}
                onCheckedChange={(checked) => {
                  setValue("autoProposalSuggestions", checked, { shouldDirty: true });
                }}
                className="shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        {hasUnsavedChanges && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t p-4 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium">
                  {t('settings.organization.general.unsavedChanges')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasUnsavedChanges(false);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  {t('settings.organization.general.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganization.isPending}
                  className="flex-1 sm:flex-none"
                >
                  {updateOrganization.isPending ? t('settings.organization.general.saving') : t('settings.organization.general.saveChanges')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

