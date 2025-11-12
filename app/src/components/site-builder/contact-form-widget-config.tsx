import { Sparkles, FileText, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WidgetStylingAccordion } from "./widget-styling-accordion";
import { WidgetLocalizationAccordion } from "./widget-localization-accordion";
import type {
  ContactFormConfig,
  WidgetStyling,
  WidgetLocalization,
  BuiltInFields,
  CustomField,
  WidgetPosition,
  WidgetDisplayMode,
  WidgetFieldType,
} from "./widget-types";

interface ContactFormWidgetConfigProps {
  config: ContactFormConfig;
  onConfigChange: (config: ContactFormConfig) => void;
  styling: WidgetStyling;
  onStylingChange: (styling: WidgetStyling) => void;
  localization: WidgetLocalization;
  onLocalizationChange: (localization: WidgetLocalization) => void;
  builtInFields: BuiltInFields;
  onBuiltInFieldsChange: (fields: BuiltInFields) => void;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onAddCustomField: () => void;
  onRemoveCustomField: (id: string) => void;
  onUpdateCustomField: (id: string, updates: Partial<CustomField>) => void;
  onOpenAiBuilder: () => void;
  organizationId: string;
}

export function ContactFormWidgetConfig({
  config,
  onConfigChange,
  styling,
  onStylingChange,
  localization,
  onLocalizationChange,
  builtInFields,
  onBuiltInFieldsChange,
  customFields,
  onCustomFieldsChange,
  onAddCustomField,
  onRemoveCustomField,
  onUpdateCustomField,
  onOpenAiBuilder,
  organizationId,
}: ContactFormWidgetConfigProps) {
  const updateConfig = (updates: Partial<ContactFormConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const updateBuiltInField = (fieldKey: keyof BuiltInFields, updates: Partial<BuiltInFields[keyof BuiltInFields]>) => {
    onBuiltInFieldsChange({
      ...builtInFields,
      [fieldKey]: { ...builtInFields[fieldKey], ...updates },
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Label className="text-base font-semibold">Contact Form Widget</Label>
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
            Allow visitors to submit contact information
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
            <div className="space-y-2">
              <Label>Display Mode</Label>
              <Select
                value={config.displayMode}
                onValueChange={(value: WidgetDisplayMode) => updateConfig({ displayMode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="floating">Floating Button</SelectItem>
                  <SelectItem value="inline">Inline Form</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {config.displayMode === "floating"
                  ? "Shows a floating button that opens a modal form"
                  : "Renders the form directly in the page where a placeholder element exists"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Button Text</Label>
                <Input
                  value={config.submitButtonText}
                  onChange={(e) => updateConfig({ submitButtonText: e.target.value })}
                />
              </div>
              {config.displayMode === "floating" && (
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
              )}
            </div>
            {config.displayMode === "inline" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Inline Form Usage:</strong> Add a placeholder element in your HTML where you want the form to appear:
                </p>
                <code className="text-xs text-blue-700 mt-2 block">
                  {`<div data-financely-widget="contactForm"></div>`}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label>Success Message</Label>
              <Input
                value={config.successMessage}
                onChange={(e) => updateConfig({ successMessage: e.target.value })}
              />
            </div>
          </div>

          {/* Widget-Specific Styling, Localization, and Fields */}
          <Accordion type="multiple" className="w-full">
            <WidgetStylingAccordion
              styling={styling}
              onStylingChange={onStylingChange}
            />
            <WidgetLocalizationAccordion
              localization={localization}
              onLocalizationChange={onLocalizationChange}
              widgetType="contactForm"
              config={{
                title: config.title,
                description: config.description,
                submitButtonText: config.submitButtonText,
                successMessage: config.successMessage,
                organizationId: organizationId,
              }}
              builtInFields={builtInFields}
              customFields={customFields}
              helpText='Add custom translations for widget text. Use keys like "contactUs", "sendMessage", etc.'
            />
            <AccordionItem value="contactForm-fields">
              <AccordionTrigger className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Field Configuration</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {/* Built-in Fields */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Built-in Fields</Label>
                  {Object.entries(builtInFields).map(([fieldKey, fieldConfig]) => (
                    <div key={fieldKey} className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={fieldConfig.enabled}
                            onCheckedChange={(checked) =>
                              updateBuiltInField(fieldKey as keyof BuiltInFields, { enabled: checked as boolean })
                            }
                          />
                          <Label className="font-medium capitalize">{fieldKey}</Label>
                        </div>
                      </div>
                      {fieldConfig.enabled && (
                        <div className="grid grid-cols-2 gap-3 pl-6">
                          <div className="space-y-2">
                            <Label>Label</Label>
                            <Input
                              value={fieldConfig.label}
                              onChange={(e) =>
                                updateBuiltInField(fieldKey as keyof BuiltInFields, { label: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                              checked={fieldConfig.required}
                              onCheckedChange={(checked) =>
                                updateBuiltInField(fieldKey as keyof BuiltInFields, { required: checked as boolean })
                              }
                            />
                            <Label>Required</Label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom Fields */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Custom Fields</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddCustomField}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Custom Field
                    </Button>
                  </div>
                  {customFields.map((field) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Field Name (ID)</Label>
                          <Input
                            value={field.name}
                            onChange={(e) => onUpdateCustomField(field.id, { name: e.target.value })}
                            placeholder="field_name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Field Label</Label>
                          <Input
                            value={field.label}
                            onChange={(e) => onUpdateCustomField(field.id, { label: e.target.value })}
                            placeholder="Field Label"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Field Type</Label>
                          <Select
                            value={field.type}
                            onValueChange={(value) => onUpdateCustomField(field.id, { type: value as WidgetFieldType })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="tel">Phone</SelectItem>
                              <SelectItem value="textarea">Textarea</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                              <SelectItem value="checkbox">Checkbox</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(checked) => onUpdateCustomField(field.id, { required: checked as boolean })}
                          />
                          <Label>Required</Label>
                        </div>
                      </div>
                      {field.type === "select" && (
                        <div className="space-y-2">
                          <Label>Options (one per line)</Label>
                          <Textarea
                            value={field.options?.join("\n") || ""}
                            onChange={(e) =>
                              onUpdateCustomField(field.id, {
                                options: e.target.value.split("\n").filter((o) => o.trim()),
                              })
                            }
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            rows={3}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Placeholder (Optional)</Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) => onUpdateCustomField(field.id, { placeholder: e.target.value })}
                          placeholder="Enter placeholder text"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveCustomField(field.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Field
                      </Button>
                    </div>
                  ))}
                  {customFields.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No custom fields added. Click "Add Custom Field" to create one.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}

