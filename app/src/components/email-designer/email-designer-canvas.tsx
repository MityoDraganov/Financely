import { EmailTemplateBlock, EmailTemplateDesignTokens, EmailTypography, EmailSpacing, EmailBorder } from "@/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";

type CanvasProps = {
  blocks: EmailTemplateBlock[];
  selectedBlockId?: string;
  onSelectBlock: (blockId: string) => void;
  designTokens: EmailTemplateDesignTokens;
};

export function EmailDesignerCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  designTokens,
}: CanvasProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full flex flex-col border border-border/60 bg-background/60 backdrop-blur">
      <CardHeader>
        <div>
          <CardTitle className="text-lg font-semibold">{t("emailDesigner.preview.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("emailDesigner.preview.subtitle")}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="h-full rounded-xl border bg-muted/40 p-4 overflow-hidden">
          <ScrollArea className="h-full">
            <div
              className="max-w-[640px] mx-auto border shadow-sm rounded-xl overflow-hidden"
              style={{
                backgroundColor: designTokens.background,
                fontFamily: designTokens.fontFamily,
              }}
            >
              <div className="px-6 py-8" style={{ color: designTokens.text }}>
                {/* Header Section */}
                {(() => {
                  const headerBlocks = blocks.filter(b => (b.section || "body") === "header");
                  return (
                    <div className="mb-6">
                      <div className="mb-2 px-2 py-1 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("emailDesigner.sections.header")}
                      </div>
                      <div className="space-y-4">
                        {headerBlocks.map((block) => (
                          <button
                            key={block.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg border border-transparent text-left transition-colors",
                              selectedBlockId === block.id && "border-primary/50 bg-primary/5",
                            )}
                            onClick={() => onSelectBlock(block.id)}
                          >
                            <BlockPreview block={block} designTokens={designTokens} />
                          </button>
                        ))}
                        {headerBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
                            {t("emailDesigner.preview.emptySection")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                <Separator className="my-6" />
                
                {/* Body Section */}
                {(() => {
                  const bodyBlocks = blocks.filter(b => (b.section || "body") === "body");
                  return (
                    <div className="mb-6">
                      <div className="mb-2 px-2 py-1 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("emailDesigner.sections.body")}
                      </div>
                      <div className="space-y-4">
                        {bodyBlocks.map((block) => (
                          <button
                            key={block.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg border border-transparent text-left transition-colors",
                              selectedBlockId === block.id && "border-primary/50 bg-primary/5",
                            )}
                            onClick={() => onSelectBlock(block.id)}
                          >
                            <BlockPreview block={block} designTokens={designTokens} />
                          </button>
                        ))}
                        {bodyBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-12">
                            {t("emailDesigner.preview.empty")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                <Separator className="my-6" />
                
                {/* Footer Section */}
                {(() => {
                  const footerBlocks = blocks.filter(b => (b.section || "body") === "footer");
                  return (
                    <div>
                      <div className="mb-2 px-2 py-1 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("emailDesigner.sections.footer")}
                      </div>
                      <div className="space-y-4">
                        {footerBlocks.map((block) => (
                          <button
                            key={block.id}
                            type="button"
                            className={cn(
                              "w-full rounded-lg border border-transparent text-left transition-colors",
                              selectedBlockId === block.id && "border-primary/50 bg-primary/5",
                            )}
                            onClick={() => onSelectBlock(block.id)}
                          >
                            <BlockPreview block={block} designTokens={designTokens} />
                          </button>
                        ))}
                        {footerBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
                            {t("emailDesigner.preview.emptySection")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockPreview({
  block,
  designTokens,
}: {
  block: EmailTemplateBlock;
  designTokens: EmailTemplateDesignTokens;
}) {
  const { t } = useTranslation();
  switch (block.type) {
    case "subject": {
      const typography = (block.typography || {}) as EmailTypography;
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
            fontWeight: typography.fontWeight || "600",
            lineHeight: typography.lineHeight || 1.5,
            letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {block.content || "Email subject"}
        </div>
      );
    }
    case "preheader": {
      const typography = (block.typography || {}) as EmailTypography;
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
            fontWeight: typography.fontWeight || "400",
            lineHeight: typography.lineHeight || 1.5,
            letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {block.content || "Email preheader"}
        </div>
      );
    }
    case "text": {
      const typography = (block.typography || {}) as EmailTypography;
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: block.align,
            fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
            fontWeight: block.emphasize ? "600" : (typography.fontWeight || "normal"),
            lineHeight: typography.lineHeight || 1.5,
            letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {block.content || "Lorem ipsum dolor sit amet"}
        </div>
      );
    }
    case "button": {
      const typography = (block.typography || {}) as EmailTypography;
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      const bgColor = block.backgroundColor || 
        (block.variant === "primary" ? designTokens.primary :
         block.variant === "secondary" ? designTokens.surface : "transparent");
      const textColor = block.variant === "link" 
        ? (typography.color || designTokens.primary)
        : (typography.color || "#ffffff");
      
      return (
        <div style={{ textAlign: block.align }}>
          <span
            className="inline-flex transition-colors"
            style={{
              width: block.buttonWidth === "full" ? "100%" : "auto",
              height: block.buttonHeight ? `${block.buttonHeight}px` : "44px",
              alignItems: "center",
              justifyContent: "center",
              fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
              fontWeight: typography.fontWeight || "600",
              lineHeight: typography.lineHeight || 1.5,
              letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
              color: textColor,
              fontStyle: typography.fontStyle || "normal",
              textDecoration: typography.textDecoration || "none",
              backgroundColor: bgColor,
              paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : "12px",
              paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : "24px",
              paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : "12px",
              paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : "24px",
              marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
              marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
              marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
              marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
              borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
              borderColor: border.borderColor || "transparent",
              borderStyle: border.borderStyle || "solid",
              borderRadius: border.borderRadius ? `${border.borderRadius}px` : (designTokens.borderRadius ? `${designTokens.borderRadius}px` : "8px"),
            }}
          >
            {block.label}
          </span>
        </div>
      );
    }
    case "divider": {
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      const dividerWidth = block.dividerWidth || 100;
      
      return (
        <div
          style={{
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            textAlign: block.align || "center",
            backgroundColor: block.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          <div
            style={{
              width: `${dividerWidth}%`,
              marginLeft: block.align === "right" ? "auto" : block.align === "center" ? "auto" : "0",
              marginRight: block.align === "left" ? "auto" : block.align === "center" ? "auto" : "0",
              borderTopWidth: `${block.width || 1}px`,
              borderTopStyle: block.style || "solid",
              borderTopColor: block.color || "#e5e7eb",
            }}
          />
        </div>
      );
    }
    case "spacer": {
      const spacing = (block.spacing || {}) as EmailSpacing;
      return (
        <div
          style={{
            height: `${block.height}px`,
            backgroundColor: block.backgroundColor || "transparent",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
          }}
        />
      );
    }
    case "image": {
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: block.align,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: block.backgroundColor || "transparent",
          }}
        >
          <div className="inline-flex items-center justify-center overflow-hidden">
            {block.src ? (
              <img
                src={block.src}
                alt={block.alt || ""}
                style={{
                  maxWidth: `${block.width}px`,
                  width: "100%",
                  borderRadius: block.borderRadius ? `${block.borderRadius}px` : undefined,
                  borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
                  borderColor: border.borderColor || "transparent",
                  borderStyle: border.borderStyle || "solid",
                }}
              />
            ) : (
              <div
                className="text-xs text-muted-foreground py-8 px-4"
                style={{
                  maxWidth: `${block.width}px`,
                  width: "100%",
                  borderRadius: block.borderRadius ? `${block.borderRadius}px` : undefined,
                  borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
                  borderColor: border.borderColor || "#e5e7eb",
                  borderStyle: border.borderStyle || "dashed",
                }}
              >
                Placeholder image
              </div>
            )}
          </div>
        </div>
      );
    }
    case "logo": {
      const logoBlock = block as Extract<EmailTemplateBlock, { type: "logo" }>;
      const spacing = (logoBlock.spacing || {}) as EmailSpacing;
      const border = (logoBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: logoBlock.align,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: logoBlock.backgroundColor || "transparent",
          }}
        >
          <div className="inline-flex items-center justify-center overflow-hidden">
            {logoBlock.src ? (
              <img
                src={logoBlock.src}
                alt={logoBlock.alt || "Logo"}
                style={{
                  maxWidth: `${logoBlock.width}px`,
                  width: "100%",
                  borderRadius: logoBlock.borderRadius ? `${logoBlock.borderRadius}px` : undefined,
                  borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
                  borderColor: border.borderColor || "transparent",
                  borderStyle: border.borderStyle || "solid",
                }}
              />
            ) : (
              <div
                className="text-xs text-muted-foreground py-8 px-4"
                style={{
                  maxWidth: `${logoBlock.width}px`,
                  width: "100%",
                  borderRadius: logoBlock.borderRadius ? `${logoBlock.borderRadius}px` : undefined,
                  borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
                  borderColor: border.borderColor || "#e5e7eb",
                  borderStyle: border.borderStyle || "dashed",
                }}
              >
                Logo placeholder
              </div>
            )}
          </div>
        </div>
      );
    }
    case "navigation": {
      const navBlock = block as Extract<EmailTemplateBlock, { type: "navigation" }>;
      const typography = (navBlock.typography || {}) as EmailTypography;
      const spacing = (navBlock.spacing || {}) as EmailSpacing;
      const border = (navBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: navBlock.align,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: navBlock.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {navBlock.links && navBlock.links.length > 0 ? (
              navBlock.links.map((link: { label: string; url: string }, idx: number) => (
                <span
                  key={idx}
                  style={{
                    fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
                    fontWeight: typography.fontWeight || "normal",
                    color: typography.color || designTokens.text,
                    textDecoration: typography.textDecoration || "none",
                  }}
                  className="px-2"
                >
                  {link.label}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Navigation links</span>
            )}
          </div>
        </div>
      );
    }
    case "footerText": {
      const footerBlock = block as Extract<EmailTemplateBlock, { type: "footerText" }>;
      const typography = (footerBlock.typography || {}) as EmailTypography;
      const spacing = (footerBlock.spacing || {}) as EmailSpacing;
      const border = (footerBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: footerBlock.align,
            fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
            fontWeight: typography.fontWeight || "normal",
            lineHeight: typography.lineHeight || 1.5,
            letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: footerBlock.backgroundColor || "transparent",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {footerBlock.content || "Footer text"}
        </div>
      );
    }
    case "socialLinks": {
      const socialBlock = block as Extract<EmailTemplateBlock, { type: "socialLinks" }>;
      const spacing = (socialBlock.spacing || {}) as EmailSpacing;
      const border = (socialBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: socialBlock.align,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: socialBlock.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          <div className="flex flex-wrap gap-3 justify-center">
            {socialBlock.links && socialBlock.links.length > 0 ? (
              socialBlock.links.map((link: { platform: string; url: string; icon?: string }, idx: number) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"
                  style={{
                    width: `${socialBlock.iconSize}px`,
                    height: `${socialBlock.iconSize}px`,
                  }}
                >
                  <span className="text-xs">{link.platform[0].toUpperCase()}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Social links</span>
            )}
          </div>
        </div>
      );
    }
    case "unsubscribe": {
      const unsubscribeBlock = block as Extract<EmailTemplateBlock, { type: "unsubscribe" }>;
      const typography = (unsubscribeBlock.typography || {}) as EmailTypography;
      const spacing = (unsubscribeBlock.spacing || {}) as EmailSpacing;
      const border = (unsubscribeBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: unsubscribeBlock.align,
            fontSize: typography.fontSize ? `${typography.fontSize}px` : undefined,
            fontWeight: typography.fontWeight || "normal",
            lineHeight: typography.lineHeight || 1.5,
            letterSpacing: typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "underline",
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: unsubscribeBlock.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {unsubscribeBlock.text || "Unsubscribe"}
        </div>
      );
    }
    case "columns": {
      const columnsBlock = block as Extract<EmailTemplateBlock, { type: "columns" }>;
      const spacing = (columnsBlock.spacing || {}) as EmailSpacing;
      const border = (columnsBlock.border || {}) as EmailBorder;
      const columnCount = parseInt(columnsBlock.columnCount || "2");
      
      return (
        <div
          className={columnsBlock.stackOnMobile ? "max-md:grid-cols-1" : ""}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap: `${columnsBlock.gap || 16}px`,
            textAlign: columnsBlock.align,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : undefined,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : undefined,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginRight: spacing.marginRight ? `${spacing.marginRight}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            marginLeft: spacing.marginLeft ? `${spacing.marginLeft}px` : undefined,
            backgroundColor: columnsBlock.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {columnsBlock.columns && columnsBlock.columns.length > 0 ? (
            columnsBlock.columns.map((column) => (
              <div
                key={column.id}
                className={columnsBlock.stackOnMobile ? "max-md:col-span-full" : ""}
                style={{
                  minWidth: 0,
                }}
              >
                {column.blocks && column.blocks.length > 0 ? (
                  <div className="space-y-2">
                    {column.blocks.map((nestedBlock: EmailTemplateBlock) => (
                      <BlockPreview
                        key={nestedBlock.id}
                        block={nestedBlock}
                        designTokens={designTokens}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8 px-4 border border-dashed rounded">
                    {t("emailDesigner.preview.emptyColumn")}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 px-4">
              {t("emailDesigner.preview.emptyColumns")}
            </div>
          )}
        </div>
      );
    }
    case "container": {
      const containerBlock = block as Extract<EmailTemplateBlock, { type: "container" }>;
      const spacing = (containerBlock.spacing || {}) as EmailSpacing;
      const border = (containerBlock.border || {}) as EmailBorder;
      const paddingMap = {
        none: 0,
        xs: 8,
        sm: 16,
        md: 24,
        lg: 32,
      };
      const padding = paddingMap[containerBlock.padding || "md"];
      
      return (
        <div
          style={{
            maxWidth: `${containerBlock.maxWidth || 600}px`,
            marginLeft: containerBlock.align === "center" 
              ? "auto" 
              : containerBlock.align === "right" 
                ? "auto" 
                : spacing.marginLeft 
                  ? `${spacing.marginLeft}px` 
                  : "0",
            marginRight: containerBlock.align === "center" 
              ? "auto" 
              : containerBlock.align === "left" 
                ? spacing.marginRight 
                  ? `${spacing.marginRight}px` 
                  : "0"
                : spacing.marginRight 
                  ? `${spacing.marginRight}px` 
                  : undefined,
            padding: `${padding}px`,
            paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : `${padding}px`,
            paddingRight: spacing.paddingRight ? `${spacing.paddingRight}px` : `${padding}px`,
            paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : `${padding}px`,
            paddingLeft: spacing.paddingLeft ? `${spacing.paddingLeft}px` : `${padding}px`,
            marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
            marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
            backgroundColor: containerBlock.backgroundColor || "transparent",
            borderWidth: border.borderWidth ? `${border.borderWidth}px` : undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
            borderRadius: border.borderRadius ? `${border.borderRadius}px` : undefined,
          }}
        >
          {containerBlock.blocks && containerBlock.blocks.length > 0 ? (
            <div className="space-y-4">
              {containerBlock.blocks.map((nestedBlock: EmailTemplateBlock) => (
                <BlockPreview
                  key={nestedBlock.id}
                  block={nestedBlock}
                  designTokens={designTokens}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 px-4 border border-dashed rounded">
              {t("emailDesigner.preview.emptyContainer")}
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}


