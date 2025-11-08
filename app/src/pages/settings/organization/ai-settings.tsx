import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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

      toast.success("AI settings updated successfully");
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to update AI settings:", error);
      toast.error("Failed to update AI settings");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Settings</h1>
        </div>
        <p className="text-gray-600 ml-11">
          Configure AI-powered features and automation for your organization.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Proposal Suggestions */}
        <Card className="shadow-sm border-gray-200/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              Proposal Suggestions
            </CardTitle>
            <CardDescription className="ml-11">
              Automatically generate proposal suggestions when new leads are created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="autoProposalSuggestions" className="text-base font-medium">
                  Automatic Proposal Suggestions
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, AI will automatically generate proposal suggestions for new leads.
                  You can also manually request suggestions from the leads page.
                </p>
              </div>
              <Switch
                id="autoProposalSuggestions"
                checked={autoProposalSuggestions}
                onCheckedChange={(checked) => {
                  setValue("autoProposalSuggestions", checked, { shouldDirty: true });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        {hasUnsavedChanges && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/50 p-6 -mx-8 -mb-8 mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium text-gray-700">
                  You have unsaved changes
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasUnsavedChanges(false);
                  }}
                  className="shadow-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganization.isPending}
                  className="shadow-sm bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                >
                  {updateOrganization.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

