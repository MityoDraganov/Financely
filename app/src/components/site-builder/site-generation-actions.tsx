import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteGenerationActionsProps {
  hasExistingSite: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  isRegenerating: boolean;
  isProcessing: boolean; // true if site is generating or deploying
}

export function SiteGenerationActions({
  hasExistingSite,
  onGenerate,
  onRegenerate,
  isGenerating,
  isRegenerating,
  isProcessing,
}: SiteGenerationActionsProps) {
  if (!hasExistingSite) {
    return (
      <Button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full shadow-sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Website
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onRegenerate}
        disabled={isRegenerating || isProcessing}
        className="flex-1 shadow-sm"
      >
        {isRegenerating || isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Site
          </>
        )}
      </Button>
    </div>
  );
}

