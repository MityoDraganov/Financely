import { Loader2, CheckCircle2 } from "lucide-react";
import initializingGif from "@/assets/siteBuilder/initializing.gif";
import analyzingGif from "@/assets/siteBuilder/analyzing.gif";
import generatingGif from "@/assets/siteBuilder/generating.gif";
import deployingGif from "@/assets/siteBuilder/deploying.gif";
import finalizingGif from "@/assets/siteBuilder/finalizing.gif";

export type ProcessingStep =
  | "initializing"
  | "analyzing"
  | "generating"
  | "deploying"
  | "finalizing"
  | "complete";

interface ProcessingStepAnimationProps {
  step: ProcessingStep;
  className?: string;
  size?: number;
}

const stepConfig: Record<
  ProcessingStep,
  {
    gifUrl?: string;
    label: string;
    description: string;
    fallbackIcon?: React.ReactNode;
  }
> = {
  initializing: {
    label: "Initializing",
    description: "Setting up your website...",
    gifUrl: initializingGif,
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  analyzing: {
    label: "Analyzing",
    description: "Understanding your requirements...",
    gifUrl: analyzingGif,
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  generating: {
    label: "Generating",
    description: "Creating your website content...",
    gifUrl: generatingGif,
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  deploying: {
    label: "Deploying",
    description: "Publishing your website...",
    gifUrl: deployingGif,
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  finalizing: {
    label: "Finalizing",
    description: "Adding finishing touches...",
    gifUrl: finalizingGif,
    fallbackIcon: <Loader2 className="animate-spin" />,
  },
  complete: {
    label: "Complete",
    description: "Your website is ready!",
    fallbackIcon: (
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
    ),
  },
};

export function ProcessingStepAnimation({
  step,
  className = "",
  size = 120,
}: ProcessingStepAnimationProps) {
  const config = stepConfig[step];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className="flex items-center justify-center"
        style={{ height: size, width: size }}
      >
        {config.gifUrl ? (
          <img
            src={config.gifUrl}
            alt={config.label}
            className="object-contain"
            style={{ height: size, width: size }}
          />
        ) : (
          config.fallbackIcon || (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          )
        )}
      </div>
      <div className="mt-4 text-center">
        <p className="font-semibold text-sm">{config.label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {config.description}
        </p>
      </div>
    </div>
  );
}

