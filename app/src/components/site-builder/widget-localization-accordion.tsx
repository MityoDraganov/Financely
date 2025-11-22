import { useState } from "react";
import { Globe, X, Sparkles, Loader2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useTranslateWidgetText } from "@/hooks/service-hooks/use-translate-widget-text";
import { LanguageSelector } from "./language-selector";
import { getLanguageByCode } from "@/utils/languages";
import type { WidgetLocalization, BuiltInFields, CustomField } from "./widget-types";

interface WidgetLocalizationAccordionProps {
  localization: WidgetLocalization;
  onLocalizationChange: (localization: WidgetLocalization) => void;
  widgetType: "contactForm" | "invoiceRequest" | "quoteRequest";
  config: {
    title: string;
    description?: string;
    submitButtonText: string;
    successMessage: string;
    organizationId: string;
  };
  builtInFields?: BuiltInFields;
  customFields?: CustomField[];
  helpText?: string;
}

/**
 * Extract all translation keys for a widget
 */
function getAllWidgetKeys(
  widgetType: "contactForm" | "invoiceRequest" | "quoteRequest",
  config: { title: string; description?: string; submitButtonText: string; successMessage: string },
  builtInFields?: BuiltInFields,
  customFields?: CustomField[]
): Array<{ key: string; defaultValue: string }> {
  const keys: Array<{ key: string; defaultValue: string }> = [];

  // Widget-specific keys
  if (widgetType === "contactForm") {
    keys.push({ key: "contactUs", defaultValue: config.title });
    if (config.description) {
      keys.push({ key: "description", defaultValue: config.description });
    }
  } else if (widgetType === "invoiceRequest") {
    keys.push({ key: "requestInvoice", defaultValue: config.title });
    if (config.description) {
      keys.push({ key: "description", defaultValue: config.description });
    }
  } else if (widgetType === "quoteRequest") {
    keys.push({ key: "requestQuote", defaultValue: config.title });
    if (config.description) {
      keys.push({ key: "description", defaultValue: config.description });
    }
  }

  keys.push({ key: "submitButton", defaultValue: config.submitButtonText });
  keys.push({ key: "successMessage", defaultValue: config.successMessage });

  // Built-in fields (for contact form)
  if (builtInFields && widgetType === "contactForm") {
    Object.entries(builtInFields).forEach(([fieldKey, fieldConfig]) => {
      if (fieldConfig.enabled) {
        keys.push({ key: `${fieldKey}Label`, defaultValue: fieldConfig.label });
        keys.push({ key: `${fieldKey}Placeholder`, defaultValue: "" });
      }
    });
  } else if (widgetType === "invoiceRequest" || widgetType === "quoteRequest") {
    // Default fields for invoice/quote requests
    keys.push({ key: "name", defaultValue: "Name" });
    keys.push({ key: "email", defaultValue: "Email" });
    keys.push({ key: "message", defaultValue: "Message" });
  }

  // Custom fields
  if (customFields && customFields.length > 0) {
    customFields.forEach((field) => {
      keys.push({ key: `${field.name}Label`, defaultValue: field.label });
      if (field.placeholder) {
        keys.push({ key: `${field.name}Placeholder`, defaultValue: field.placeholder });
      } else {
        keys.push({ key: `${field.name}Placeholder`, defaultValue: "" });
      }
    });
  }

  return keys;
}

export function WidgetLocalizationAccordion({
  localization,
  onLocalizationChange,
  widgetType,
  config,
  builtInFields,
  customFields,
  helpText,
}: WidgetLocalizationAccordionProps) {
  const { t } = useTranslation();
  const [autoTranslateDialogOpen, setAutoTranslateDialogOpen] = useState(false);
  const [autoTranslateLanguage, setAutoTranslateLanguage] = useState<string>("");
  const translateWidgetText = useTranslateWidgetText();

  // Ensure localization has the correct structure
  const normalizedLocalization: WidgetLocalization = {
    defaultLanguage: "en",
    languages: localization.languages || {},
  };

  const allKeys = getAllWidgetKeys(widgetType, config, builtInFields, customFields);
  const availableLanguages = Object.keys(normalizedLocalization.languages);

  const addLanguage = (languageCode: string) => {
    if (normalizedLocalization.languages[languageCode]) {
      toast.error(t('siteBuilder.widgets.localization.toasts.languageAlreadyAdded'));
      return;
    }

    onLocalizationChange({
      ...normalizedLocalization,
      languages: {
        ...normalizedLocalization.languages,
        [languageCode]: {},
      },
    });
  };

  const removeLanguage = (languageCode: string) => {
    const newLanguages = { ...normalizedLocalization.languages };
    delete newLanguages[languageCode];
    onLocalizationChange({
      ...normalizedLocalization,
      languages: newLanguages,
    });
  };

  const updateTranslation = (languageCode: string, key: string, value: string) => {
    onLocalizationChange({
      ...normalizedLocalization,
      languages: {
        ...normalizedLocalization.languages,
        [languageCode]: {
          ...normalizedLocalization.languages[languageCode],
          [key]: value,
        },
      },
    });
  };

  const handleAutoTranslate = async () => {
    if (!autoTranslateLanguage) return;

    const languageInfo = getLanguageByCode(autoTranslateLanguage);
    const languageName = languageInfo?.name || autoTranslateLanguage;

    // Find empty translations that need to be filled
    const currentTranslations = normalizedLocalization.languages[autoTranslateLanguage] || {};
    const emptyKeys = allKeys.filter(({ key }) => !currentTranslations[key] || currentTranslations[key].trim() === "");

    if (emptyKeys.length === 0) {
      toast.info(t('siteBuilder.widgets.localization.toasts.allTranslationsFilled'));
      setAutoTranslateDialogOpen(false);
      return;
    }

    // Build translations array for backend
    const translationsToTranslate = emptyKeys.map(({ key, defaultValue }) => ({
      key,
      english: defaultValue,
    }));

    // Get organization ID from context (we'll need to pass it as a prop)
    // For now, we'll need to get it from the parent component
    // This is a limitation - we need organizationId
    if (!config.organizationId) {
      toast.error(t('siteBuilder.widgets.localization.toasts.organizationIdRequired'));
      return;
    }

    try {
      const result = await translateWidgetText.mutateAsync({
        organizationId: config.organizationId,
        languageCode: autoTranslateLanguage,
        languageName: languageName,
        translations: translationsToTranslate,
      });

      // Update only empty translations
      const updatedTranslations = { ...currentTranslations };
      Object.entries(result.translations).forEach(([key, value]) => {
        updatedTranslations[key] = value;
      });

      onLocalizationChange({
        ...normalizedLocalization,
        languages: {
          ...normalizedLocalization.languages,
          [autoTranslateLanguage]: updatedTranslations,
        },
      });

      toast.success(t('siteBuilder.widgets.localization.toasts.translated', {
        count: result.translatedCount,
        plural: result.translatedCount !== 1 ? 'а' : '',
        language: languageName
      }));
      setAutoTranslateDialogOpen(false);
      setAutoTranslateLanguage("");
    } catch (error) {
      console.error("Translation error:", error);
      toast.error(error instanceof Error ? error.message : t('siteBuilder.widgets.localization.toasts.translationFailed'));
    }
  };

  const openAutoTranslateDialog = (languageCode: string) => {
    setAutoTranslateLanguage(languageCode);
    setAutoTranslateDialogOpen(true);
  };

  return (
    <>
      <AccordionItem value="localization">
        <AccordionTrigger className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span>{t('siteBuilder.widgets.localization.title')}</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.localization.defaultLanguage')}</Label>
            <div className="p-3 bg-gray-50 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t('siteBuilder.widgets.localization.english')}</span>
                <span className="text-xs text-gray-500">{t('siteBuilder.widgets.localization.readOnly')}</span>
              </div>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {allKeys.map(({ key, defaultValue }) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <div className="flex-1 font-mono text-xs text-gray-600">{key}</div>
                    <div className="flex-1 text-gray-800">{defaultValue || t('siteBuilder.widgets.localization.empty')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label>{t('siteBuilder.widgets.localization.additionalLanguages')}</Label>
              <div className="flex-1 max-w-xs">
                <LanguageSelector
                  value=""
                  onValueChange={(value) => {
                    if (value) {
                      addLanguage(value);
                    }
                  }}
                  excludedLanguages={["en", ...availableLanguages]}
                  placeholder={t('siteBuilder.widgets.localization.addLanguage')}
                />
              </div>
            </div>

            {availableLanguages.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">{t('siteBuilder.widgets.localization.noLanguages')}</p>
            )}

            {availableLanguages.map((languageCode) => {
              const languageInfo = getLanguageByCode(languageCode);
              const languageName = languageInfo?.name || languageCode;
              const languageNativeName = languageInfo?.nativeName || "";
              const languageFlag = languageInfo?.flag || "";
              const translations = normalizedLocalization.languages[languageCode] || {};

              return (
                <div key={languageCode} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {languageFlag && <span className="text-xl">{languageFlag}</span>}
                      <span className="font-medium">{languageName}</span>
                      {languageNativeName && (
                        <span className="text-sm text-gray-500">({languageNativeName})</span>
                      )}
                      <span className="text-xs text-gray-400">({languageCode})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAutoTranslateDialog(languageCode)}
                        disabled={translateWidgetText.isPending}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {t('siteBuilder.widgets.localization.autoTranslate')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLanguage(languageCode)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {/* Left column: Keys (readonly) */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">{t('siteBuilder.widgets.localization.translationKeys')}</Label>
                      <div className="space-y-2">
                        {allKeys.map(({ key, defaultValue }) => (
                          <div key={key} className="p-2 bg-gray-50 rounded border min-h-[60px] flex flex-col justify-center">
                            <div className="text-xs font-mono text-gray-600 mb-1">{key}</div>
                            <div className="text-sm text-gray-800">{defaultValue || t('siteBuilder.widgets.localization.empty')}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right column: Translations (editable) */}
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">{t('siteBuilder.widgets.localization.translations')}</Label>
                      <div className="space-y-2">
                        {allKeys.map(({ key, defaultValue }) => (
                          <div key={key} className="min-h-[60px] flex items-center">
                            <Input
                              value={translations[key] || ""}
                              onChange={(e) => updateTranslation(languageCode, key, e.target.value)}
                              placeholder={t('siteBuilder.widgets.localization.translationPlaceholder', { value: defaultValue })}
                              className="text-sm w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {helpText && <p className="text-xs text-gray-500 mt-2">{helpText}</p>}
        </AccordionContent>
      </AccordionItem>

      {/* Auto Translate Confirmation Dialog */}
      <Dialog open={autoTranslateDialogOpen} onOpenChange={setAutoTranslateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('siteBuilder.widgets.localization.autoTranslateDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('siteBuilder.widgets.localization.autoTranslateDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>{t('siteBuilder.widgets.localization.autoTranslateDialog.important')}</strong>
              </p>
              <ul className="text-sm text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                <li>{t('siteBuilder.widgets.localization.autoTranslateDialog.warning1')}</li>
                <li>{t('siteBuilder.widgets.localization.autoTranslateDialog.warning2')}</li>
                <li>{t('siteBuilder.widgets.localization.autoTranslateDialog.warning3')}</li>
                <li>{t('siteBuilder.widgets.localization.autoTranslateDialog.warning4')}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>{t('siteBuilder.widgets.localization.autoTranslateDialog.targetLanguage')}</Label>
              <div className="p-2 bg-gray-50 rounded border flex items-center gap-2">
                {(() => {
                  const lang = getLanguageByCode(autoTranslateLanguage);
                  return lang ? (
                    <>
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.name}</span>
                      <span className="text-sm text-gray-500">({lang.nativeName})</span>
                    </>
                  ) : (
                    autoTranslateLanguage
                  );
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAutoTranslateDialogOpen(false);
                setAutoTranslateLanguage("");
              }}
              disabled={translateWidgetText.isPending}
            >
              {t('siteBuilder.widgets.localization.autoTranslateDialog.cancel')}
            </Button>
            <Button onClick={handleAutoTranslate} disabled={translateWidgetText.isPending}>
              {translateWidgetText.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('siteBuilder.widgets.localization.autoTranslateDialog.translating')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('siteBuilder.widgets.localization.autoTranslateDialog.translate')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
