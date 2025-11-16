import { Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import { WidgetStylingAccordion } from "./widget-styling-accordion";
import { WidgetLocalizationAccordion } from "./widget-localization-accordion";
import type { InvoiceRequestConfig, WidgetStyling, WidgetLocalization, WidgetPosition } from "./widget-types";

interface InvoiceRequestWidgetConfigProps {
  config: InvoiceRequestConfig;
  onConfigChange: (config: InvoiceRequestConfig) => void;
  styling: WidgetStyling;
  onStylingChange: (styling: WidgetStyling) => void;
  localization: WidgetLocalization;
  onLocalizationChange: (localization: WidgetLocalization) => void;
  onOpenAiBuilder: () => void;
  organizationId: string;
}

export function InvoiceRequestWidgetConfig({
  config,
  onConfigChange,
  styling,
  onStylingChange,
  localization,
  onLocalizationChange,
  onOpenAiBuilder,
  organizationId,
}: InvoiceRequestWidgetConfigProps) {
  const updateConfig = (updates: Partial<InvoiceRequestConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Label className="text-base font-semibold">Invoice Request Widget</Label>
            {config.enabled && (
              <Button
                type="button"
                onClick={onOpenAiBuilder}
                className="bg-gradient-to-r from-purple-600 via-purple-600 to-purple-700 hover:from-purple-700 hover:via-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] h-8 px-3 text-xs"
                size="sm"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                AI Builder
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Allow customers to request invoices
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => updateConfig({ enabled })}
        />
      </div>
      {config.enabled && (
        <div className="space-y-4 mt-4 pl-4 border-l-2">
          {/* Basic Configuration */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={config.title}
                onChange={(e) => updateConfig({ title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={config.description}
                onChange={(e) => updateConfig({ description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Button Text</Label>
                <Input
                  value={config.submitButtonText}
                  onChange={(e) => updateConfig({ submitButtonText: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={config.position}
                  onValueChange={(value: WidgetPosition) => updateConfig({ position: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Success Message</Label>
              <Input
                value={config.successMessage}
                onChange={(e) => updateConfig({ successMessage: e.target.value })}
              />
            </div>
          </div>

          {/* Widget-Specific Styling & Localization */}
          <Accordion type="multiple" className="w-full">
            <WidgetStylingAccordion
              styling={styling}
              onStylingChange={onStylingChange}
            />
            <WidgetLocalizationAccordion
              localization={localization}
              onLocalizationChange={onLocalizationChange}
              widgetType="invoiceRequest"
              config={{
                title: config.title,
                description: config.description,
                submitButtonText: config.submitButtonText,
                successMessage: config.successMessage,
                organizationId: organizationId,
              }}
              helpText='Add custom translations for widget text. Use keys like "requestInvoice", "submitButton", etc.'
            />
          </Accordion>
        </div>
      )}
    </div>
  );
}

