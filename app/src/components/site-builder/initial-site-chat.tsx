import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { ProcessingStepAnimation, type ProcessingStep } from "./processing-step-animation";
import { StreamingText } from "./streaming-text";

interface InitialSiteChatProps {
  onGenerate: (description: string) => void;
  isGenerating: boolean;
  brandSiteStatus?: "pending" | "generating" | "deploying" | "success" | "failed";
  error?: string;
  onSiteCreated?: (brandSiteId: string) => void; // Callback when site is successfully created
}

export function InitialSiteChat({
  onGenerate,
  isGenerating,
  brandSiteStatus,
  error,
  onSiteCreated,
}: InitialSiteChatProps) {
  const [description, setDescription] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  // When site is successfully created, notify parent to switch to AIChatBuilder
  useEffect(() => {
    if (brandSiteStatus === "success" && hasSubmitted && onSiteCreated) {
      // Small delay to show completion message
      const timer = setTimeout(() => {
        // onSiteCreated will be called by parent when brandSiteId is available
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [brandSiteStatus, hasSubmitted, onSiteCreated]);

  // Determine processing step based on status
  const getProcessingStep = (): ProcessingStep => {
    if (!brandSiteStatus || brandSiteStatus === "pending") {
      return "initializing";
    }
    if (brandSiteStatus === "generating") {
      return "generating";
    }
    if (brandSiteStatus === "deploying") {
      return "deploying";
    }
    if (brandSiteStatus === "success") {
      return "complete";
    }
    return "initializing";
  };

  const handleSubmit = () => {
    if (!description.trim() || isGenerating) return;
    setHasSubmitted(true);
    onGenerate(description.trim());
  };

  // Show chat interface after submission
  if (hasSubmitted || isGenerating) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="shrink-0 border-b">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Creating Your Website
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-12 space-y-6">
          {/* User message */}
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-lg p-3 bg-primary text-primary-foreground">
                <div className="whitespace-pre-wrap">{description}</div>
              </div>
            </div>

            {/* AI response with animation */}
            <div className="flex justify-start">
              <div className="w-[80%] max-w-[80%] min-w-[80%] rounded-lg p-3 bg-muted space-y-4">
                {error ? (
                  <div className="text-destructive">
                    <p className="font-semibold mb-2">Error occurred:</p>
                    <p>{error}</p>
                  </div>
                ) : (
                  <>
                    {/* Processing animation */}
                    <div className="flex justify-center py-4">
                      <ProcessingStepAnimation
                        step={getProcessingStep()}
                        size={100}
                      />
                    </div>

                    {/* Streaming response */}
                    <div className="mt-4">
                      <StreamingText
                        text={
                          brandSiteStatus === "success"
                            ? "Great! I've created your website. It's being deployed now and will be ready in a few moments. You can start customizing it once it's live!"
                            : brandSiteStatus === "generating"
                            ? "I'm analyzing your requirements and creating a beautiful, branded website tailored to your needs. This may take a minute or two..."
                            : "I'm setting everything up for your new website. Please wait while I initialize the system..."
                        }
                        speed={3}
                        interval={20}
                        className="text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Initial input screen
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0 border-b">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Create Your First Website
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6">
        {/* Welcome message */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl space-y-6">
            {/* AI welcome message */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-4 bg-muted">
                <p className="text-sm">
                  Hello! I'm your AI website builder. 👋
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  Tell me about your website - what kind of business are you,
                  what pages you need, and any specific features. I'll create a
                  beautiful, branded website for you!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="border-t pt-4 space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your website... (e.g., 'I need a website for my consulting business with a home page, about page, services page, and contact form')"
            className="min-h-[100px] resize-none"
            disabled={isGenerating}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!description.trim() || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Create Website
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

