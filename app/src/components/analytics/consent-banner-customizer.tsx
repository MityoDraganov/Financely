import { useState } from "react";
import { Palette, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConsentBannerStyling } from "@/core/entities/analytics-config";
import { useGenerateConsentBanner } from "@/hooks/service-hooks/use-generate-consent-banner";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { toast } from "sonner";

interface ConsentBannerCustomizerProps {
  styling: ConsentBannerStyling;
  onStylingChange: (styling: ConsentBannerStyling) => void;
}

export function ConsentBannerCustomizer({
  styling,
  onStylingChange,
}: ConsentBannerCustomizerProps) {
  const { data: organization } = useCurrentOrganization();
  const generateConsentBanner = useGenerateConsentBanner();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "professional" | "bold" | "elegant">("modern");
  const [aiContext, setAiContext] = useState("");

  const updateStyling = (updates: Partial<ConsentBannerStyling>) => {
    onStylingChange({ ...styling, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Consent Banner Styling
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the appearance of your GDPR consent banner
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAiDialogOpen(true)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate with AI
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Colors Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Colors</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                label="Button Background"
                value={styling.buttonBackgroundColor}
                onChange={(color) => updateStyling({ buttonBackgroundColor: color })}
              />
              <ColorPicker
                label="Button Text Color"
                value={styling.buttonTextColor}
                onChange={(color) => updateStyling({ buttonTextColor: color })}
              />
              <ColorPicker
                label="Link Color"
                value={styling.linkColor}
                onChange={(color) => updateStyling({ linkColor: color })}
              />
              <ColorPicker
                label="Border Color"
                value={styling.borderColor}
                onChange={(color) => updateStyling({ borderColor: color })}
              />
            </div>
          </div>

          <Separator />

          {/* Typography Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Typography</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Input
                  value={styling.fontFamily}
                  onChange={(e) => updateStyling({ fontFamily: e.target.value })}
                  placeholder="system-ui, -apple-system, sans-serif"
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
            </div>
          </div>

          <Separator />

          {/* Layout Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Layout & Spacing</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={styling.position}
                  onValueChange={(value: "bottom" | "top" | "center") =>
                    updateStyling({ position: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Width</Label>
                <Input
                  value={styling.maxWidth}
                  onChange={(e) => updateStyling({ maxWidth: e.target.value })}
                  placeholder="600px"
                />
              </div>
              <div className="space-y-2">
                <Label>Padding</Label>
                <Input
                  value={styling.padding}
                  onChange={(e) => updateStyling({ padding: e.target.value })}
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
                <Label>Shadow</Label>
                <Input
                  value={styling.shadow}
                  onChange={(e) => updateStyling({ shadow: e.target.value })}
                  placeholder="0 4px 12px rgba(0, 0, 0, 0.15)"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Content Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Content</Label>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={styling.message}
                  onChange={(e) => updateStyling({ message: e.target.value })}
                  placeholder="We use cookies to enhance your browsing experience and analyze site traffic."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accept Button Text</Label>
                  <Input
                    value={styling.acceptButtonText}
                    onChange={(e) => updateStyling({ acceptButtonText: e.target.value })}
                    placeholder="Accept"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reject Button Text</Label>
                  <Input
                    value={styling.rejectButtonText}
                    onChange={(e) => updateStyling({ rejectButtonText: e.target.value })}
                    placeholder="Reject"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Reject Button</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to explicitly reject analytics tracking
                  </p>
                </div>
                <Switch
                  checked={styling.showRejectButton}
                  onCheckedChange={(checked) => updateStyling({ showRejectButton: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Consent Banner with AI</DialogTitle>
            <DialogDescription>
              Generate a beautiful, GDPR-compliant consent banner that matches your organization's branding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={aiStyle} onValueChange={(value: typeof aiStyle) => setAiStyle(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="elegant">Elegant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional Context (Optional)</Label>
              <Textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                placeholder="E.g., 'Use a dark theme' or 'Match our brand colors'"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!organization?.id) {
                  toast.error("Organization not found");
                  return;
                }

                try {
                  const result = await generateConsentBanner.mutateAsync({
                    organizationId: organization.id,
                    options: {
                      style: aiStyle,
                      context: aiContext || undefined,
                      existingStyling: styling,
                    },
                  });

                  onStylingChange(result.styling);
                  toast.success("Consent banner generated successfully!");
                  setAiDialogOpen(false);
                  setAiContext("");
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  toast.error(`Failed to generate consent banner: ${message}`);
                }
              }}
              disabled={generateConsentBanner.isPending || !organization?.id}
            >
              {generateConsentBanner.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Banner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

