/**
 * IntegrationWidgetsCard Component
 * 
 * This is a large component that handles all widget configuration UI.
 * It contains:
 * - Widget enable toggle
 * - Contact Form Widget configuration (with styling, localization, fields)
 * - Invoice Request Widget configuration (with styling, localization)
 * - Quote Request Widget configuration (with styling, localization)
 * - Save button and version history
 * - Embed script section
 * 
 * Note: This component is intentionally large to keep all widget-related UI
 * in one place. Future refactoring could break it into smaller sub-components
 * for each widget type (ContactFormWidgetConfig, InvoiceRequestWidgetConfig, etc.)
 */

import { Settings2, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WidgetEnableToggle } from "./widget-enable-toggle";
import { WidgetVersionHistory } from "./widget-version-history";
import { EmbedScriptSection } from "./embed-script-section";
import type {
  WidgetPosition,
  WidgetStyling,
  WidgetLocalization,
  BuiltInFields,
  CustomField,
  ContactFormConfig,
  InvoiceRequestConfig,
  QuoteRequestConfig,
} from "./widget-types";

interface WidgetVersion {
  version: number;
  widgetType: "contactForm" | "invoiceRequest" | "quoteRequest" | "all";
  widgets: Record<string, unknown>;
  createdAt?: string;
  description?: string;
}

interface IntegrationWidgetsCardProps {
  // Enable toggle
  widgetsEnabled: boolean;
  onWidgetsEnabledChange: (enabled: boolean) => void;

  // Contact Form Widget
  contactFormConfig: ContactFormConfig;
  onContactFormConfigChange: (config: ContactFormConfig) => void;
  contactFormStyling: WidgetStyling;
  onContactFormStylingChange: (styling: WidgetStyling) => void;
  contactFormLocalization: WidgetLocalization;
  onContactFormLocalizationChange: (localization: WidgetLocalization) => void;
  builtInFields: BuiltInFields;
  onBuiltInFieldsChange: (fields: BuiltInFields) => void;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onAddCustomField: () => void;
  onRemoveCustomField: (id: string) => void;
  onUpdateCustomField: (id: string, updates: Partial<CustomField>) => void;

  // Invoice Request Widget
  invoiceRequestConfig: InvoiceRequestConfig;
  onInvoiceRequestConfigChange: (config: InvoiceRequestConfig) => void;
  invoiceRequestStyling: WidgetStyling;
  onInvoiceRequestStylingChange: (styling: WidgetStyling) => void;
  invoiceRequestLocalization: WidgetLocalization;
  onInvoiceRequestLocalizationChange: (localization: WidgetLocalization) => void;

  // Quote Request Widget
  quoteRequestConfig: QuoteRequestConfig;
  onQuoteRequestConfigChange: (config: QuoteRequestConfig) => void;
  quoteRequestStyling: WidgetStyling;
  onQuoteRequestStylingChange: (styling: WidgetStyling) => void;
  quoteRequestLocalization: WidgetLocalization;
  onQuoteRequestLocalizationChange: (localization: WidgetLocalization) => void;

  // AI Widget Builder
  onOpenAiWidgetDialog: (type: "contactForm" | "invoiceRequest" | "quoteRequest") => void;

  // Save and version history
  onSaveWidgets: () => void;
  isSaving: boolean;
  widgetVersions: WidgetVersion[];
  currentWidgetVersion: number | null;
  onPreviewWidgetVersion: (version: WidgetVersion) => void;
  onRestoreWidgetVersion: (version: number) => void;
  isRestoringWidgetVersion: boolean;

  // Embed script
  embedScript: string;
  copiedScript: boolean;
  onCopyScript: () => void;

  // Render functions for widget configs (to keep this component manageable)
  renderContactFormConfig: () => React.ReactNode;
  renderInvoiceRequestConfig: () => React.ReactNode;
  renderQuoteRequestConfig: () => React.ReactNode;
}

export function IntegrationWidgetsCard({
  widgetsEnabled,
  onWidgetsEnabledChange,
  onSaveWidgets,
  isSaving,
  widgetVersions,
  currentWidgetVersion,
  onPreviewWidgetVersion,
  onRestoreWidgetVersion,
  isRestoringWidgetVersion,
  embedScript,
  copiedScript,
  onCopyScript,
  renderContactFormConfig,
  renderInvoiceRequestConfig,
  renderQuoteRequestConfig,
}: IntegrationWidgetsCardProps) {
  return (
    <Card className="shadow-sm border-gray-200/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Settings2 className="h-4 w-4 text-blue-600" />
          </div>
          Integration Widgets
        </CardTitle>
        <CardDescription className="ml-11">
          Create embeddable widgets for your website. Copy and paste the script into any website.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <WidgetEnableToggle
          enabled={widgetsEnabled}
          onToggle={onWidgetsEnabledChange}
        />

        {widgetsEnabled && (
          <>
            {renderContactFormConfig()}
            {renderInvoiceRequestConfig()}
            {renderQuoteRequestConfig()}

            {/* Save Button and Version History */}
            <div className="space-y-3">
              <Button
                onClick={onSaveWidgets}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Widget Configuration"
                )}
              </Button>

              {widgetVersions.length > 0 && (
                <WidgetVersionHistory
                  versions={widgetVersions}
                  currentVersion={currentWidgetVersion}
                  onPreviewVersion={onPreviewWidgetVersion}
                  onRestoreVersion={onRestoreWidgetVersion}
                  isRestoring={isRestoringWidgetVersion}
                />
              )}
            </div>

            {/* Embed Script */}
            <EmbedScriptSection
              script={embedScript}
              copied={copiedScript}
              onCopy={onCopyScript}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

