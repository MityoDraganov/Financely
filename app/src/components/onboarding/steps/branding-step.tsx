import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";

interface BrandingData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface BrandingStepProps {
  brandingData: BrandingData;
  setBrandingData: (data: Partial<BrandingData>) => void;
  setStoreBrandingData?: (data: Partial<BrandingData>) => void;
  onSkip: () => void;
  onSave: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

const PRESET_COLORS = [
  "#2563eb", // Blue
  "#166534", // Forest green
  "#7c3aed", // Purple
  "#dc2626", // Red
  "#ea580c", // Orange
  "#0891b2", // Cyan
  "#374151", // Dark gray
  "#831843", // Pink
];

export function BrandingStep({
  brandingData,
  setBrandingData,
  setStoreBrandingData,
  onSave,
  onBack,
}: BrandingStepProps) {
  const handleColorChange = (color: string) => {
    const newData = { primaryColor: color };
    setBrandingData(newData);
    if (setStoreBrandingData) {
      setStoreBrandingData(newData);
    }
  };

  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Step 4 of 5</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Apply your branding
        </h2>
        <p className="text-muted-foreground text-base max-w-md">
          Choose your brand color. It will be applied to your invoices, proposals, and workspace.
          You can refine this anytime in settings.
        </p>
      </div>

      <div className="space-y-6 max-w-sm">
        {/* Color preview */}
        <div
          className="w-full h-16 rounded-2xl transition-colors duration-300 flex items-center px-5 gap-3 shadow-md"
          style={{ backgroundColor: brandingData.primaryColor }}
        >
          <div className="w-8 h-8 rounded bg-white/20" />
          <div className="space-y-1.5">
            <div className="h-2 w-20 rounded-full bg-white/70" />
            <div className="h-1.5 w-12 rounded-full bg-white/40" />
          </div>
          <span className="ml-auto text-white/80 text-xs font-mono">
            {brandingData.primaryColor}
          </span>
        </div>

        {/* Preset swatches */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Quick presets</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(color)}
                className={cn(
                  "w-8 h-8 rounded-lg border-2 transition-all duration-150",
                  "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  brandingData.primaryColor === color
                    ? "border-foreground scale-110 shadow-md"
                    : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Custom color picker */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Custom color</Label>
          <ColorPicker
            label=""
            value={brandingData.primaryColor}
            onChange={handleColorChange}
          />
        </div>

        {/* Microcopy */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          Applied to preview as you pick · You can always change this later
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            size="lg"
            className="rounded-xl gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        )}
        <Button
          onClick={onSave}
          size="lg"
          className="rounded-xl px-8 gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}
