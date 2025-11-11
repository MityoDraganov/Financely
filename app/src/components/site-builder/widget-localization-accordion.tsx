import { Globe, Plus, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { WidgetLocalization } from "./widget-types";

interface WidgetLocalizationAccordionProps {
  localization: WidgetLocalization;
  onLocalizationChange: (localization: WidgetLocalization) => void;
  helpText?: string;
}

export function WidgetLocalizationAccordion({
  localization,
  onLocalizationChange,
  helpText,
}: WidgetLocalizationAccordionProps) {
  const updateLanguage = (language: string) => {
    onLocalizationChange({ ...localization, language });
  };

  const updateTranslation = (key: string, value: string) => {
    onLocalizationChange({
      ...localization,
      translations: { ...localization.translations, [key]: value },
    });
  };

  const removeTranslation = (key: string) => {
    const newTranslations = { ...localization.translations };
    delete newTranslations[key];
    onLocalizationChange({ ...localization, translations: newTranslations });
  };

  const renameTranslationKey = (oldKey: string, newKey: string) => {
    const newTranslations = { ...localization.translations };
    const value = newTranslations[oldKey];
    delete newTranslations[oldKey];
    newTranslations[newKey] = value;
    onLocalizationChange({ ...localization, translations: newTranslations });
  };

  const addTranslation = () => {
    const newKey = `key_${Object.keys(localization.translations).length + 1}`;
    updateTranslation(newKey, "");
  };

  return (
    <AccordionItem value="localization">
      <AccordionTrigger className="flex items-center gap-2">
        <Globe className="h-4 w-4" />
        <span>Localization & Translations</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label>Default Language</Label>
          <Select value={localization.language} onValueChange={updateLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="it">Italian</SelectItem>
              <SelectItem value="pt">Portuguese</SelectItem>
              <SelectItem value="ru">Russian</SelectItem>
              <SelectItem value="zh">Chinese</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
              <SelectItem value="ko">Korean</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Custom Translations</Label>
          {helpText && (
            <p className="text-xs text-gray-500 mb-2">{helpText}</p>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
            {Object.entries(localization.translations).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <Input
                  value={key}
                  onChange={(e) => renameTranslationKey(key, e.target.value)}
                  placeholder="Translation key"
                  className="flex-1"
                />
                <Input
                  value={value}
                  onChange={(e) => updateTranslation(key, e.target.value)}
                  placeholder="Translated text"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTranslation(key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addTranslation}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Translation
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

