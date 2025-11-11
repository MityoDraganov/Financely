import { Palette } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const updateStyling = (updates: Partial<WidgetStyling>) => {
    onStylingChange({ ...styling, ...updates });
  };

  return (
    <AccordionItem value="styling">
      <AccordionTrigger className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        <span>Styling & Appearance</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker
            label="Primary Color"
            value={styling.primaryColor}
            onChange={(color) => updateStyling({ primaryColor: color })}
          />
          <ColorPicker
            label="Secondary Color"
            value={styling.secondaryColor}
            onChange={(color) => updateStyling({ secondaryColor: color })}
          />
          <ColorPicker
            label="Background Color"
            value={styling.backgroundColor}
            onChange={(color) => updateStyling({ backgroundColor: color })}
          />
          <ColorPicker
            label="Text Color"
            value={styling.textColor}
            onChange={(color) => updateStyling({ textColor: color })}
          />
          <ColorPicker
            label="Border Color"
            value={styling.borderColor}
            onChange={(color) => updateStyling({ borderColor: color })}
          />
          <ColorPicker
            label="Error Color"
            value={styling.errorColor}
            onChange={(color) => updateStyling({ errorColor: color })}
          />
          <ColorPicker
            label="Success Color"
            value={styling.successColor}
            onChange={(color) => updateStyling({ successColor: color })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Font Family</Label>
            <Input
              value={styling.fontFamily}
              onChange={(e) => updateStyling({ fontFamily: e.target.value })}
              placeholder="Arial, sans-serif"
            />
          </div>
          <div className="space-y-2">
            <Label>Font Size</Label>
            <Input
              value={styling.fontSize}
              onChange={(e) => updateStyling({ fontSize: e.target.value })}
              placeholder="14px"
            />
          </div>
          <div className="space-y-2">
            <Label>Font Weight</Label>
            <Select
              value={styling.fontWeight}
              onValueChange={(value) => updateStyling({ fontWeight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">Light (300)</SelectItem>
                <SelectItem value="400">Normal (400)</SelectItem>
                <SelectItem value="500">Medium (500)</SelectItem>
                <SelectItem value="600">Semi-bold (600)</SelectItem>
                <SelectItem value="700">Bold (700)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Padding</Label>
            <Input
              value={styling.padding}
              onChange={(e) => updateStyling({ padding: e.target.value })}
              placeholder="12px"
            />
          </div>
          <div className="space-y-2">
            <Label>Gap</Label>
            <Input
              value={styling.gap}
              onChange={(e) => updateStyling({ gap: e.target.value })}
              placeholder="16px"
            />
          </div>
          <div className="space-y-2">
            <Label>Border Radius</Label>
            <Input
              value={styling.borderRadius}
              onChange={(e) => updateStyling({ borderRadius: e.target.value })}
              placeholder="8px"
            />
          </div>
          <div className="space-y-2">
            <Label>Button Padding</Label>
            <Input
              value={styling.buttonPadding}
              onChange={(e) => updateStyling({ buttonPadding: e.target.value })}
              placeholder="12px 24px"
            />
          </div>
          <div className="space-y-2">
            <Label>Button Border Radius</Label>
            <Input
              value={styling.buttonBorderRadius}
              onChange={(e) => updateStyling({ buttonBorderRadius: e.target.value })}
              placeholder="8px"
            />
          </div>
          <div className="space-y-2">
            <Label>Modal Max Width</Label>
            <Input
              value={styling.modalMaxWidth}
              onChange={(e) => updateStyling({ modalMaxWidth: e.target.value })}
              placeholder="500px"
            />
          </div>
          <div className="space-y-2">
            <Label>Shadow</Label>
            <Input
              value={styling.shadow}
              onChange={(e) => updateStyling({ shadow: e.target.value })}
              placeholder="0 4px 12px rgba(0, 0, 0, 0.15)"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

