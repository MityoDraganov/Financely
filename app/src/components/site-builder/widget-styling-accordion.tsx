import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import type { WidgetStyling } from "./widget-types";

interface WidgetStylingAccordionProps {
  styling: WidgetStyling;
  onStylingChange: (styling: WidgetStyling) => void;
}

export function WidgetStylingAccordion({
  styling,
  onStylingChange,
}: WidgetStylingAccordionProps) {
  const { t } = useTranslation();
  const updateStyling = (updates: Partial<WidgetStyling>) => {
    onStylingChange({ ...styling, ...updates });
  };

  return (
    <AccordionItem value="styling">
      <AccordionTrigger className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        <span>{t('siteBuilder.widgets.styling.title')}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker
            label={t('siteBuilder.widgets.styling.primaryColor')}
            value={styling.primaryColor}
            onChange={(color) => updateStyling({ primaryColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.secondaryColor')}
            value={styling.secondaryColor}
            onChange={(color) => updateStyling({ secondaryColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.backgroundColor')}
            value={styling.backgroundColor}
            onChange={(color) => updateStyling({ backgroundColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.textColor')}
            value={styling.textColor}
            onChange={(color) => updateStyling({ textColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.borderColor')}
            value={styling.borderColor}
            onChange={(color) => updateStyling({ borderColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.errorColor')}
            value={styling.errorColor}
            onChange={(color) => updateStyling({ errorColor: color })}
          />
          <ColorPicker
            label={t('siteBuilder.widgets.styling.successColor')}
            value={styling.successColor}
            onChange={(color) => updateStyling({ successColor: color })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.fontFamily')}</Label>
            <Input
              value={styling.fontFamily}
              onChange={(e) => updateStyling({ fontFamily: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.fontFamilyPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.fontSize')}</Label>
            <Input
              value={styling.fontSize}
              onChange={(e) => updateStyling({ fontSize: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.fontSizePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.fontWeight')}</Label>
            <Select
              value={styling.fontWeight}
              onValueChange={(value) => updateStyling({ fontWeight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">{t('siteBuilder.widgets.styling.fontWeightLight')}</SelectItem>
                <SelectItem value="400">{t('siteBuilder.widgets.styling.fontWeightNormal')}</SelectItem>
                <SelectItem value="500">{t('siteBuilder.widgets.styling.fontWeightMedium')}</SelectItem>
                <SelectItem value="600">{t('siteBuilder.widgets.styling.fontWeightSemiBold')}</SelectItem>
                <SelectItem value="700">{t('siteBuilder.widgets.styling.fontWeightBold')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.padding')}</Label>
            <Input
              value={styling.padding}
              onChange={(e) => updateStyling({ padding: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.paddingPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.gap')}</Label>
            <Input
              value={styling.gap}
              onChange={(e) => updateStyling({ gap: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.gapPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.borderRadius')}</Label>
            <Input
              value={styling.borderRadius}
              onChange={(e) => updateStyling({ borderRadius: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.borderRadiusPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.buttonPadding')}</Label>
            <Input
              value={styling.buttonPadding}
              onChange={(e) => updateStyling({ buttonPadding: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.buttonPaddingPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.buttonBorderRadius')}</Label>
            <Input
              value={styling.buttonBorderRadius}
              onChange={(e) => updateStyling({ buttonBorderRadius: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.buttonBorderRadiusPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.modalMaxWidth')}</Label>
            <Input
              value={styling.modalMaxWidth}
              onChange={(e) => updateStyling({ modalMaxWidth: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.modalMaxWidthPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.widgets.styling.shadow')}</Label>
            <Input
              value={styling.shadow}
              onChange={(e) => updateStyling({ shadow: e.target.value })}
              placeholder={t('siteBuilder.widgets.styling.shadowPlaceholder')}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

