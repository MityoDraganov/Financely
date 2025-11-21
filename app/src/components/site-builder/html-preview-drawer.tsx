import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { ProcessingStepAnimation, type ProcessingStep } from "./processing-step-animation";

interface HtmlPreviewDrawerProps {
  htmlContent: string;
  isStreaming?: boolean;
  processingStep?: ProcessingStep;
  className?: string;
}

/**
 * Expandable drawer component for HTML preview
 * - Collapsed: Shows last 15 lines with radial shadow and ProcessingStepAnimation
 * - Expanded: Shows full HTML content with collapse trigger at bottom
 */
export function HtmlPreviewDrawer({
  htmlContent,
  isStreaming = false,
  processingStep = "generating",
  className = "",
}: HtmlPreviewDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract HTML from markdown code block if present
  let displayHtml = htmlContent;
  if (displayHtml.includes("```html")) {
    const match = displayHtml.match(/```html\n([\s\S]*?)\n```/);
    if (match) {
      displayHtml = match[1];
    } else {
      displayHtml = displayHtml.replace(/^```html\s*/, "").replace(/\s*```$/, "");
    }
  }

  // Get last 15+ lines for collapsed view
  const lines = displayHtml.split("\n");
  const lastLines = lines.slice(-15).join("\n"); // Last 15 lines

  return (
    <div 
      className={`relative w-full ${className}`}
    >
      {/* Collapsed view with window shadow effect */}
      {!isExpanded && (
        <div 
          className="relative overflow-hidden cursor-pointer transition-all duration-200 group"
          onClick={() => setIsExpanded(true)}
          style={{ 
            minHeight: "200px",
            maxHeight: "200px",
            width: "100%",
            // Window effect: shadow on outer edges only (like a frame)
            boxShadow: `
              0 0 0 1px rgba(0,0,0,0.1),
              0 4px 12px rgba(0,0,0,0.3),
              0 8px 24px rgba(0,0,0,0.2),
              inset 0 0 0 0 transparent
            `,
          }}
        >
          {/* Hover darkening effect */}
          <div 
            className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
            style={{
              background: "rgba(0,0,0,0.15)",
            }}
          />
          
          {/* Content - visible code lines */}
          <div className="relative z-0 h-full overflow-hidden">
            <pre className="p-3 text-xs font-mono h-full whitespace-pre-wrap" style={{ margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>
              <code className="text-muted-foreground">
                {lastLines || displayHtml.substring(0, 200)}
              </code>
            </pre>
          </div>

          {/* Processing animation - small, positioned at bottom right corner */}
          {isStreaming && (
            <div className="absolute bottom-2 right-2 z-30 pointer-events-none" style={{ width: "48px", height: "48px" }}>
              <ProcessingStepAnimation step={processingStep} size={48} />
            </div>
          )}
        </div>
      )}

      {/* Expanded view - no card styling, just content */}
      {isExpanded && (
        <div className="relative w-full">
          {/* Top info bar - minimal, no card styling */}
          <div className="p-2 flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isStreaming && (
                <ProcessingStepAnimation step={processingStep} size={28} />
              )}
            </div>
          </div>
          
          {/* Content - no scroll, natural height, word wrap */}
          <div className="w-full">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap" style={{ margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>
              <code>{displayHtml}</code>
            </pre>
          </div>

          {/* Collapse trigger at bottom - centered */}
          <div className="mt-2 flex justify-center items-center w-full">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronUp className="h-3 w-3" />
              <span>Collapse</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

