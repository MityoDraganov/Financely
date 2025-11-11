import { Copy, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface EmbedScriptSectionProps {
  script: string;
  copied: boolean;
  onCopy: () => void;
}

export function EmbedScriptSection({ script, copied, onCopy }: EmbedScriptSectionProps) {
  return (
    <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Embed Script</Label>
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Script
            </>
          )}
        </Button>
      </div>
      <p className="text-sm text-gray-600">
        Copy this script and paste it into your website's HTML to embed the widgets.
      </p>
      <div className="relative">
        <Textarea
          value={script}
          readOnly
          className="font-mono text-xs bg-white"
          rows={3}
        />
      </div>
      <p className="text-xs text-gray-500">
        The script will automatically load your widget configuration. No need to update it when you make changes.
      </p>
    </div>
  );
}
