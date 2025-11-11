import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface WidgetEnableToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function WidgetEnableToggle({ enabled, onToggle }: WidgetEnableToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <Label className="text-base font-semibold">Enable Widgets</Label>
        <p className="text-sm text-gray-500 mt-1">
          Allow widgets to be embedded on external websites
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
