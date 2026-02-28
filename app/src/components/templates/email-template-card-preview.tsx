import { Component, ErrorInfo, ReactNode } from "react";
import { Mail } from "lucide-react";
import type { EmailTemplate } from "@/core/entities/email-template";

interface Props {
  template: EmailTemplate;
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class EmailTemplateCardPreviewErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Email template preview error for template:", this.props.template.id, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Mail className="h-16 w-16 text-muted-foreground" />
        </div>
      );
    }

    return this.props.children;
  }
}

interface EmailTemplateCardPreviewProps {
  template: EmailTemplate;
}

export function EmailTemplateCardPreview({ template }: EmailTemplateCardPreviewProps) {
  // Validate template has required properties
  if (!template) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Mail className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  // Extract HTML content
  const htmlContent = template.htmlContent || "";

  // Calculate scale to fit card width (matching invoice template scale)
  const emailWidth = 600; // Standard email width
  const scale = 0.45; // Same scale as invoice templates

  const scaledWidth = emailWidth * scale;
  const scaledHeight = 800 * scale; // Approximate email height

  return (
    <EmailTemplateCardPreviewErrorBoundary template={template}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
          paddingTop: "16px"
        }}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: "relative",
            overflow: "hidden",
            borderRadius: "8px",
            willChange: "transform",
            backfaceVisibility: "hidden",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          <div
            style={{
              width: emailWidth,
              height: 800,
              backgroundColor: "#ffffff",
              position: "relative",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              overflow: "hidden",
              borderRadius: `${8 / scale}px`,
              willChange: "transform",
              backfaceVisibility: "hidden",
              WebkitFontSmoothing: "antialiased",
            }}
            className="bg-white dark:bg-neutral-900"
          >
            <div className="border-b border-border p-3 bg-muted/30">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-muted-foreground">Subject:</span>
                  <span className="text-foreground truncate">
                    {template.subject || "No subject"}
                  </span>
                </div>
                {template.preheader && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-muted-foreground shrink-0">Preview:</span>
                    <span className="text-muted-foreground line-clamp-1">
                      {template.preheader}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 overflow-hidden" style={{ pointerEvents: "none", userSelect: "none" }}>
              {htmlContent ? (
                <div
                  className="text-xs prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                />
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No content
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </EmailTemplateCardPreviewErrorBoundary>
  );
}
