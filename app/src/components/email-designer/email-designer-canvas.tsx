import { useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
	EmailTemplateBlock,
	EmailTemplateDesignTokens,
	EmailTypography,
	EmailSpacing,
	EmailBorder,
} from "@/core";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { UserPresence } from "@/services/presence/presence-service";
import { CustomHtmlEditorModal } from "./custom-html-editor-modal";
import { Button } from "@/components/ui/button";
import { Code2, Edit } from "lucide-react";
import { LiveCursor } from "@/components/designer/live-cursor";
import { sanitizeEmailHtml } from "@/utils/html-sanitizer";

// Helper function to calculate aspect ratio CSS value
function getAspectRatioStyle(
	aspectRatio:
		| "auto"
		| "1:1"
		| "16:9"
		| "4:3"
		| "3:2"
		| "21:9"
		| "custom"
		| undefined,
	aspectRatioCustom: number | undefined
): { aspectRatio?: string; height?: string } {
  if (!aspectRatio || aspectRatio === "auto") {
    return {};
  }

  if (aspectRatio === "custom" && aspectRatioCustom) {
    return {
      aspectRatio: `${aspectRatioCustom}`,
    };
  }

  const ratioMap: Record<string, string> = {
    "1:1": "1 / 1",
    "16:9": "16 / 9",
    "4:3": "4 / 3",
    "3:2": "3 / 2",
    "21:9": "21 / 9",
  };

  return {
    aspectRatio: ratioMap[aspectRatio],
  };
}

type CanvasProps = {
  blocks: EmailTemplateBlock[];
  selectedBlockId?: string;
  onSelectBlock: (blockId: string) => void;
  designTokens: EmailTemplateDesignTokens;
	activeUsers?: UserPresence[];
	currentUserId?: string;
	onBlockUpdate?: (blockId: string, updates: Partial<EmailTemplateBlock>) => void;
	onCursorMove?: (point: { x: number; y: number }) => void;
};

// Helper to get a distinct color for each user based on their UID
function getUserColor(uid: string): string {
	const hue = (uid.charCodeAt(0) * 137.5) % 360;
	return `hsl(${hue}, 70%, 50%)`;
}

export function EmailDesignerCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  designTokens,
	activeUsers = [],
	currentUserId,
	onBlockUpdate,
	onCursorMove,
}: CanvasProps) {
  const { t } = useTranslation();
	const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
	const editingBlock = editingBlockId ? blocks.find(b => b.id === editingBlockId) : null;
	const containerRef = useRef<HTMLDivElement | null>(null);

	// Get other users' selections (exclude current user)
	const otherUsersSelections = useMemo(() => {
		const selections = new Map<string, UserPresence[]>();
		activeUsers
			.filter(
				(user) => user.uid !== currentUserId && user.selectedBlockId
			)
			.forEach((user) => {
				if (user.selectedBlockId) {
					const existing = selections.get(user.selectedBlockId) || [];
					selections.set(user.selectedBlockId, [...existing, user]);
				}
			});
		return selections;
	}, [activeUsers, currentUserId]);

	const handleEditCustomHtml = (blockId: string) => {
		setEditingBlockId(blockId);
	};

	const handleSaveCustomHtml = (html: string) => {
		if (editingBlockId && onBlockUpdate) {
			onBlockUpdate(editingBlockId, {
				html,
			} as Partial<EmailTemplateBlock>);
		}
		setEditingBlockId(null);
	};

	const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
		if (!onCursorMove || !containerRef.current) {
			return;
		}
		const rect = containerRef.current.getBoundingClientRect();
		const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
		const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
		onCursorMove({ x, y });
	};

  return (
		<div className="w-full">
			{editingBlock && editingBlock.type === "rawHtml" && (
				<CustomHtmlEditorModal
					isOpen={true}
					onClose={() => setEditingBlockId(null)}
					html={(editingBlock as Extract<EmailTemplateBlock, { type: "rawHtml" }>).html || ""}
					onSave={handleSaveCustomHtml}
				/>
			)}
            <div
						ref={containerRef}
						className="relative max-w-5xl mx-auto border shadow-sm rounded-xl overflow-hidden"
              style={{
                backgroundColor: designTokens.background,
                fontFamily: designTokens.fontFamily,
              }}
							onMouseMove={handleMouseMove}
            >
							{activeUsers
								.filter((user) => user.uid !== currentUserId && user.cursor)
								.map((user) => (
									<LiveCursor key={user.uid} user={user} zoom={1} />
								))}
              <div className="px-6 py-8" style={{ color: designTokens.text }}>
                {/* Header Section */}
                {(() => {
					const headerBlocks = blocks.filter(
						(b) => (b.section || "body") === "header"
					);
                  return (
                    <div className="mb-6">
                      {headerBlocks.length > 0 && (
                        <div className="relative mb-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/30"></div>
                          </div>
                          <div className="relative flex justify-start">
                            <span className="px-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider bg-background">
                              {t("emailDesigner.sections.header")}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-4">
								{headerBlocks.map((block) => {
									const otherUsers =
										otherUsersSelections.get(block.id) ||
										[];
									const isSelectedByCurrentUser =
										selectedBlockId === block.id;
									const userColors = otherUsers.map((u) =>
										getUserColor(u.uid)
									);

									return (
										<div
                            key={block.id}
											className="relative"
										>
											<button
                            type="button"
                            className={cn(
													"w-full text-left transition-colors relative",
													isSelectedByCurrentUser &&
														"ring-2 ring-primary/50 bg-primary/5 rounded",
													!isSelectedByCurrentUser &&
														otherUsers.length > 0 &&
														"ring-2 rounded"
												)}
												style={{
													...(otherUsers.length > 0 &&
													!isSelectedByCurrentUser
														? {
																borderWidth:
																	"2px",
																borderStyle:
																	"solid",
																borderColor:
																	userColors[0],
																boxShadow: `0 0 0 1px ${userColors[0]}40`,
															}
														: {}),
												}}
												onClick={() =>
													onSelectBlock(block.id)
												}
                          >
												<BlockPreview
													block={block}
													designTokens={designTokens}
													{...(block.type === "rawHtml" ? { onEditCustomHtml: () => handleEditCustomHtml(block.id) } : {})}
												/>
                          </button>
											{otherUsers.length > 0 && (
												<div
													className="absolute -top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm z-10"
													style={{
														backgroundColor:
															userColors[0],
													}}
												>
													{otherUsers[0]
														.displayName ||
														otherUsers[0].email.split(
															"@"
														)[0]}
													{otherUsers.length > 1 &&
														` +${otherUsers.length - 1}`}
												</div>
											)}
										</div>
									);
								})}
                        {headerBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
										{t(
											"emailDesigner.preview.emptySection"
										)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Body Section */}
                {(() => {
					const bodyBlocks = blocks.filter(
						(b) => (b.section || "body") === "body"
					);
                  return (
                    <div className="mb-6">
                      {bodyBlocks.length > 0 && (
                        <div className="relative mb-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/30"></div>
                          </div>
                          <div className="relative flex justify-start">
                            <span className="px-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider bg-background">
                              {t("emailDesigner.sections.body")}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-4">
								{bodyBlocks.map((block) => {
									const otherUsers =
										otherUsersSelections.get(block.id) ||
										[];
									const isSelectedByCurrentUser =
										selectedBlockId === block.id;
									const userColors = otherUsers.map((u) =>
										getUserColor(u.uid)
									);

									return (
										<div
                            key={block.id}
											className="relative"
										>
											<button
                            type="button"
                            className={cn(
													"w-full text-left transition-colors relative",
													isSelectedByCurrentUser &&
														"ring-2 ring-primary/50 bg-primary/5 rounded",
													!isSelectedByCurrentUser &&
														otherUsers.length > 0 &&
														"ring-2 rounded"
												)}
												style={{
													...(otherUsers.length > 0 &&
													!isSelectedByCurrentUser
														? {
																borderWidth:
																	"2px",
																borderStyle:
																	"solid",
																borderColor:
																	userColors[0],
																boxShadow: `0 0 0 1px ${userColors[0]}40`,
															}
														: {}),
												}}
												onClick={() =>
													onSelectBlock(block.id)
												}
                          >
												<BlockPreview
													block={block}
													designTokens={designTokens}
													{...(block.type === "rawHtml" ? { onEditCustomHtml: () => handleEditCustomHtml(block.id) } : {})}
												/>
                          </button>
											{otherUsers.length > 0 && (
												<div
													className="absolute -top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm z-10"
													style={{
														backgroundColor:
															userColors[0],
													}}
												>
													{otherUsers[0]
														.displayName ||
														otherUsers[0].email.split(
															"@"
														)[0]}
													{otherUsers.length > 1 &&
														` +${otherUsers.length - 1}`}
												</div>
											)}
										</div>
									);
								})}
                        {bodyBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
                            {t("emailDesigner.preview.emptySection")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Footer Section */}
                {(() => {
					const footerBlocks = blocks.filter(
						(b) => (b.section || "body") === "footer"
					);
                  return (
                    <div>
                      {footerBlocks.length > 0 && (
                        <div className="relative mb-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border/30"></div>
                          </div>
                          <div className="relative flex justify-start">
                            <span className="px-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider bg-background">
                              {t("emailDesigner.sections.footer")}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-4">
								{footerBlocks.map((block) => {
									const otherUsers =
										otherUsersSelections.get(block.id) ||
										[];
									const isSelectedByCurrentUser =
										selectedBlockId === block.id;
									const userColors = otherUsers.map((u) =>
										getUserColor(u.uid)
									);

									return (
										<div
                            key={block.id}
											className="relative"
										>
											<button
                            type="button"
                            className={cn(
													"w-full text-left transition-colors relative",
													isSelectedByCurrentUser &&
														"ring-2 ring-primary/50 bg-primary/5 rounded",
													!isSelectedByCurrentUser &&
														otherUsers.length > 0 &&
														"ring-2 rounded"
												)}
												style={{
													...(otherUsers.length > 0 &&
													!isSelectedByCurrentUser
														? {
																borderWidth:
																	"2px",
																borderStyle:
																	"solid",
																borderColor:
																	userColors[0],
																boxShadow: `0 0 0 1px ${userColors[0]}40`,
															}
														: {}),
												}}
												onClick={() =>
													onSelectBlock(block.id)
												}
                          >
												<BlockPreview
													block={block}
													designTokens={designTokens}
													{...(block.type === "rawHtml" ? { onEditCustomHtml: () => handleEditCustomHtml(block.id) } : {})}
												/>
                          </button>
											{otherUsers.length > 0 && (
												<div
													className="absolute -top-2 left-2 px-2 py-0.5 rounded text-xs font-medium text-white shadow-sm z-10"
													style={{
														backgroundColor:
															userColors[0],
													}}
												>
													{otherUsers[0]
														.displayName ||
														otherUsers[0].email.split(
															"@"
														)[0]}
													{otherUsers.length > 1 &&
														` +${otherUsers.length - 1}`}
												</div>
											)}
										</div>
									);
								})}
                        {footerBlocks.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-muted rounded-lg">
										{t(
											"emailDesigner.preview.emptySection"
										)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
		</div>
  );
}

function BlockPreview({
  block,
  designTokens,
  onEditCustomHtml,
}: {
  block: EmailTemplateBlock;
  designTokens: EmailTemplateDesignTokens;
  onEditCustomHtml?: () => void;
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
						fontSize: typography.fontSize
							? `${typography.fontSize}px`
							: undefined,
            fontWeight: typography.fontWeight || "600",
            lineHeight: typography.lineHeight || 1.5,
						letterSpacing: typography.letterSpacing
							? `${typography.letterSpacing}px`
							: undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
					{block.content || ""}
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
						fontSize: typography.fontSize
							? `${typography.fontSize}px`
							: undefined,
            fontWeight: typography.fontWeight || "400",
            lineHeight: typography.lineHeight || 1.5,
						letterSpacing: typography.letterSpacing
							? `${typography.letterSpacing}px`
							: undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
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
						fontSize: typography.fontSize
							? `${typography.fontSize}px`
							: undefined,
						fontWeight: block.emphasize
							? "600"
							: typography.fontWeight || "normal",
            lineHeight: typography.lineHeight || 1.5,
						letterSpacing: typography.letterSpacing
							? `${typography.letterSpacing}px`
							: undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
            backgroundColor: block.backgroundColor || "transparent",
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
					{block.content || ""}
        </div>
      );
    }
    case "button": {
      const typography = (block.typography || {}) as EmailTypography;
      const spacing = (block.spacing || {}) as EmailSpacing;
      const border = (block.border || {}) as EmailBorder;
			const bgColor =
				block.backgroundColor ||
				(block.variant === "primary"
					? designTokens.primary
					: block.variant === "secondary"
						? designTokens.surface
						: "transparent");
			const textColor =
				block.variant === "link"
					? typography.color || designTokens.primary
					: typography.color || "#ffffff";
      
      return (
        <div style={{ textAlign: block.align }}>
          <span
            className="inline-flex transition-colors"
            style={{
							width:
								block.buttonWidth === "full" ? "100%" : "auto",
							height: block.buttonHeight
								? `${block.buttonHeight}px`
								: "44px",
              alignItems: "center",
              justifyContent: "center",
							fontSize: typography.fontSize
								? `${typography.fontSize}px`
								: undefined,
              fontWeight: typography.fontWeight || "600",
              lineHeight: typography.lineHeight || 1.5,
							letterSpacing: typography.letterSpacing
								? `${typography.letterSpacing}px`
								: undefined,
              color: textColor,
              fontStyle: typography.fontStyle || "normal",
              textDecoration: typography.textDecoration || "none",
              backgroundColor: bgColor,
							paddingTop: spacing.paddingTop
								? `${spacing.paddingTop}px`
								: "12px",
							paddingRight: spacing.paddingRight
								? `${spacing.paddingRight}px`
								: "24px",
							paddingBottom: spacing.paddingBottom
								? `${spacing.paddingBottom}px`
								: "12px",
							paddingLeft: spacing.paddingLeft
								? `${spacing.paddingLeft}px`
								: "24px",
							marginTop: spacing.marginTop
								? `${spacing.marginTop}px`
								: undefined,
							marginRight: spacing.marginRight
								? `${spacing.marginRight}px`
								: undefined,
							marginBottom: spacing.marginBottom
								? `${spacing.marginBottom}px`
								: undefined,
							marginLeft: spacing.marginLeft
								? `${spacing.marginLeft}px`
								: undefined,
							borderWidth: border.borderWidth
								? `${border.borderWidth}px`
								: undefined,
              borderColor: border.borderColor || "transparent",
              borderStyle: border.borderStyle || "solid",
							borderRadius: border.borderRadius
								? `${border.borderRadius}px`
								: designTokens.borderRadius
									? `${designTokens.borderRadius}px`
									: "8px",
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
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
            textAlign: block.align || "center",
            backgroundColor: block.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
          <div
            style={{
              width: `${dividerWidth}%`,
							marginLeft:
								block.align === "right"
									? "auto"
									: block.align === "center"
										? "auto"
										: "0",
							marginRight:
								block.align === "left"
									? "auto"
									: block.align === "center"
										? "auto"
										: "0",
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
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
          }}
        />
      );
    }
    case "image": {
			const imageBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "image" }
			>;
      const spacing = (imageBlock.spacing || {}) as EmailSpacing;
      const border = (imageBlock.border || {}) as EmailBorder;
      const aspectRatioStyle = getAspectRatioStyle(
        imageBlock.aspectRatio,
				imageBlock.aspectRatioCustom
      );
      
      return (
        <div
          style={{
            textAlign: imageBlock.align,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							imageBlock.backgroundColor || "transparent",
          }}
        >
          <div className="inline-flex items-center justify-center overflow-hidden">
            {imageBlock.src ? (
              <img
                src={imageBlock.src}
                alt={imageBlock.alt || ""}
                style={{
                  maxWidth: `${imageBlock.width}px`,
                  width: "100%",
                  ...aspectRatioStyle,
                  objectFit: "cover",
									borderRadius: imageBlock.borderRadius
										? `${imageBlock.borderRadius}px`
										: undefined,
									borderWidth: border.borderWidth
										? `${border.borderWidth}px`
										: undefined,
									borderColor:
										border.borderColor || "transparent",
                  borderStyle: border.borderStyle || "solid",
                }}
              />
            ) : (
              <div
                className="text-xs text-muted-foreground py-8 px-4 flex items-center justify-center"
                style={{
                  maxWidth: `${imageBlock.width}px`,
                  width: "100%",
                  ...aspectRatioStyle,
									borderRadius: imageBlock.borderRadius
										? `${imageBlock.borderRadius}px`
										: undefined,
									borderWidth: border.borderWidth
										? `${border.borderWidth}px`
										: undefined,
									borderColor:
										border.borderColor || "#e5e7eb",
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
			const logoBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "logo" }
			>;
      const spacing = (logoBlock.spacing || {}) as EmailSpacing;
      const border = (logoBlock.border || {}) as EmailBorder;
      const aspectRatioStyle = getAspectRatioStyle(
        logoBlock.aspectRatio,
				logoBlock.aspectRatioCustom
      );
      
      return (
        <div
          style={{
            textAlign: logoBlock.align,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							logoBlock.backgroundColor || "transparent",
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
                  ...aspectRatioStyle,
                  objectFit: "cover",
									borderRadius: logoBlock.borderRadius
										? `${logoBlock.borderRadius}px`
										: undefined,
									borderWidth: border.borderWidth
										? `${border.borderWidth}px`
										: undefined,
									borderColor:
										border.borderColor || "transparent",
                  borderStyle: border.borderStyle || "solid",
                }}
              />
            ) : (
              <div
                className="text-xs text-muted-foreground py-8 px-4 flex items-center justify-center"
                style={{
                  maxWidth: `${logoBlock.width}px`,
                  width: "100%",
                  ...aspectRatioStyle,
									borderRadius: logoBlock.borderRadius
										? `${logoBlock.borderRadius}px`
										: undefined,
									borderWidth: border.borderWidth
										? `${border.borderWidth}px`
										: undefined,
									borderColor:
										border.borderColor || "#e5e7eb",
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
			const navBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "navigation" }
			>;
      const typography = (navBlock.typography || {}) as EmailTypography;
      const spacing = (navBlock.spacing || {}) as EmailSpacing;
      const border = (navBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: navBlock.align,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							navBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
          <div className="flex flex-wrap gap-2 justify-center">
            {navBlock.links && navBlock.links.length > 0 ? (
							navBlock.links.map(
								(
									link: { label: string; url: string },
									idx: number
								) => (
                <span
                  key={idx}
                  style={{
											fontSize: typography.fontSize
												? `${typography.fontSize}px`
												: undefined,
											fontWeight:
												typography.fontWeight ||
												"normal",
											color:
												typography.color ||
												designTokens.text,
											textDecoration:
												typography.textDecoration ||
												"none",
                  }}
                  className="px-2"
                >
                  {link.label}
                </span>
								)
							)
            ) : (
							<span className="text-xs text-muted-foreground">
								Navigation links
							</span>
            )}
          </div>
        </div>
      );
    }
    case "footerText": {
			const footerBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "footerText" }
			>;
			const typography = (footerBlock.typography ||
				{}) as EmailTypography;
      const spacing = (footerBlock.spacing || {}) as EmailSpacing;
      const border = (footerBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: footerBlock.align,
						fontSize: typography.fontSize
							? `${typography.fontSize}px`
							: undefined,
            fontWeight: typography.fontWeight || "normal",
            lineHeight: typography.lineHeight || 1.5,
						letterSpacing: typography.letterSpacing
							? `${typography.letterSpacing}px`
							: undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
            textDecoration: typography.textDecoration || "none",
						backgroundColor:
							footerBlock.backgroundColor || "transparent",
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
          {...(footerBlock.content && /<[a-z][\s\S]*>/i.test(footerBlock.content)
            ? { dangerouslySetInnerHTML: { __html: sanitizeEmailHtml(footerBlock.content) } }
            : { children: footerBlock.content || "Footer text" }
          )}
        />
      );
    }
    case "socialLinks": {
			const socialBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "socialLinks" }
			>;
      const spacing = (socialBlock.spacing || {}) as EmailSpacing;
      const border = (socialBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: socialBlock.align,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							socialBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
          <div className="flex flex-wrap gap-3 justify-center">
            {socialBlock.links && socialBlock.links.length > 0 ? (
							socialBlock.links.map(
								(
									link: {
										platform: string;
										url: string;
										icon?: string;
									},
									idx: number
								) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"
                  style={{
                    width: `${socialBlock.iconSize}px`,
                    height: `${socialBlock.iconSize}px`,
                  }}
                >
										<span className="text-xs">
											{link.platform[0].toUpperCase()}
										</span>
                </div>
								)
							)
            ) : (
							<span className="text-xs text-muted-foreground">
								Social links
							</span>
            )}
          </div>
        </div>
      );
    }
    case "unsubscribe": {
			const unsubscribeBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "unsubscribe" }
			>;
			const typography = (unsubscribeBlock.typography ||
				{}) as EmailTypography;
      const spacing = (unsubscribeBlock.spacing || {}) as EmailSpacing;
      const border = (unsubscribeBlock.border || {}) as EmailBorder;
      
      return (
        <div
          style={{
            textAlign: unsubscribeBlock.align,
						fontSize: typography.fontSize
							? `${typography.fontSize}px`
							: undefined,
            fontWeight: typography.fontWeight || "normal",
            lineHeight: typography.lineHeight || 1.5,
						letterSpacing: typography.letterSpacing
							? `${typography.letterSpacing}px`
							: undefined,
            color: typography.color || designTokens.text,
            fontStyle: typography.fontStyle || "normal",
						textDecoration:
							typography.textDecoration || "underline",
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							unsubscribeBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
          {unsubscribeBlock.text || "Unsubscribe"}
        </div>
      );
    }
    case "columns": {
			const columnsBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "columns" }
			>;
      const spacing = (columnsBlock.spacing || {}) as EmailSpacing;
      const border = (columnsBlock.border || {}) as EmailBorder;
      const columnCount = parseInt(columnsBlock.columnCount || "2");
      
      return (
        <div
					className={
						columnsBlock.stackOnMobile ? "max-md:grid-cols-1" : ""
					}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap: `${columnsBlock.gap || 16}px`,
            textAlign: columnsBlock.align,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							columnsBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
          {columnsBlock.columns && columnsBlock.columns.length > 0 ? (
            columnsBlock.columns.map((column) => (
              <div
                key={column.id}
								className={
									columnsBlock.stackOnMobile
										? "max-md:col-span-full"
										: ""
								}
                style={{
                  minWidth: 0,
                }}
              >
                {column.blocks && column.blocks.length > 0 ? (
                  <div className="space-y-2">
										{column.blocks.map(
											(
												nestedBlock: EmailTemplateBlock
											) => (
                      <BlockPreview
                        key={nestedBlock.id}
                        block={nestedBlock}
                        designTokens={designTokens}
                      />
											)
										)}
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
			const containerBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "container" }
			>;
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
						marginLeft:
							containerBlock.align === "center"
              ? "auto" 
              : containerBlock.align === "right" 
                ? "auto" 
                : spacing.marginLeft 
                  ? `${spacing.marginLeft}px` 
                  : "0",
						marginRight:
							containerBlock.align === "center"
              ? "auto" 
              : containerBlock.align === "left" 
                ? spacing.marginRight 
                  ? `${spacing.marginRight}px` 
                  : "0"
                : spacing.marginRight 
                  ? `${spacing.marginRight}px` 
                  : undefined,
            padding: `${padding}px`,
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: `${padding}px`,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: `${padding}px`,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: `${padding}px`,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: `${padding}px`,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						backgroundColor:
							containerBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
            borderColor: border.borderColor || "transparent",
            borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
          }}
        >
					{containerBlock.blocks &&
					containerBlock.blocks.length > 0 ? (
            <div className="space-y-4">
							{containerBlock.blocks.map(
								(nestedBlock: EmailTemplateBlock) => (
                <BlockPreview
                  key={nestedBlock.id}
                  block={nestedBlock}
                  designTokens={designTokens}
                />
								)
							)}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 px-4 border border-dashed rounded">
              {t("emailDesigner.preview.emptyContainer")}
            </div>
          )}
        </div>
      );
    }
		case "rawHtml": {
			const rawHtmlBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "rawHtml" }
			>;
			const spacing = (rawHtmlBlock.spacing || {}) as EmailSpacing;
			const border = (rawHtmlBlock.border || {}) as EmailBorder;

			return (
				<div
					className="relative"
					style={{
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							rawHtmlBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
						borderColor: border.borderColor || "transparent",
						borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
					}}
				>
					{/* Render raw HTML - sanitized before rendering to prevent XSS */}
					<div
						className="min-h-[60px] border border-dashed rounded p-4"
						dangerouslySetInnerHTML={{
							__html: sanitizeEmailHtml(rawHtmlBlock.html),
						}}
					/>
					{/* Show indicator and edit button */}
					<div className="flex items-center justify-center gap-2 mt-2">
						<Code2 className="h-3 w-3 text-muted-foreground" />
						<p className="text-xs text-muted-foreground">
							{t("emailDesigner.rawHtmlBlock.customHtml")}
						</p>
						{onEditCustomHtml && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={(e) => {
									e.stopPropagation();
									onEditCustomHtml();
								}}
							>
								<Edit className="h-3 w-3 mr-1" />
								{t("emailDesigner.rawHtmlBlock.edit")}
							</Button>
						)}
					</div>
				</div>
			);
		}
		case "table": {
			const tableBlock = block as Extract<
				EmailTemplateBlock,
				{ type: "table" }
			>;
			const spacing = (tableBlock.spacing || {}) as EmailSpacing;
			const border = (tableBlock.border || {}) as EmailBorder;
			const style = tableBlock.style || {};
			const columns = tableBlock.columns || [];
			const paddingMap = {
				compact: 8,
				comfortable: 12,
				spacious: 16,
			};
			const padding = paddingMap[style.paddingDensity || "comfortable"];

			return (
				<div
					className="relative"
					style={{
						paddingTop: spacing.paddingTop
							? `${spacing.paddingTop}px`
							: undefined,
						paddingRight: spacing.paddingRight
							? `${spacing.paddingRight}px`
							: undefined,
						paddingBottom: spacing.paddingBottom
							? `${spacing.paddingBottom}px`
							: undefined,
						paddingLeft: spacing.paddingLeft
							? `${spacing.paddingLeft}px`
							: undefined,
						marginTop: spacing.marginTop
							? `${spacing.marginTop}px`
							: undefined,
						marginRight: spacing.marginRight
							? `${spacing.marginRight}px`
							: undefined,
						marginBottom: spacing.marginBottom
							? `${spacing.marginBottom}px`
							: undefined,
						marginLeft: spacing.marginLeft
							? `${spacing.marginLeft}px`
							: undefined,
						backgroundColor:
							tableBlock.backgroundColor || "transparent",
						borderWidth: border.borderWidth
							? `${border.borderWidth}px`
							: undefined,
						borderColor: border.borderColor || "transparent",
						borderStyle: border.borderStyle || "solid",
						borderRadius: border.borderRadius
							? `${border.borderRadius}px`
							: undefined,
					}}
				>
					{/* Table Preview */}
					<div className="border border-dashed rounded overflow-hidden">
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: "14px",
								fontFamily: designTokens.fontFamily,
							}}
						>
							{/* Header */}
							{columns.length > 0 && (
								<thead>
									<tr
										style={{
											backgroundColor:
												style.headerBackground ||
												"#f8fafc",
											color:
												style.headerTextColor ||
												designTokens.text,
										}}
									>
										{columns.map((col) => (
											<th
												key={col.id}
												style={{
													padding: `${padding}px`,
													textAlign: col.align,
													borderBottom:
														style.showBorders &&
														style.borderStyle !== "none"
															? `${
																	style.borderStyle ===
																	"strong"
																		? 2
																		: 1
																}px solid ${
																	style.borderColor ||
																	"#e5e7eb"
																}`
															: "none",
													fontWeight: "600",
												}}
											>
												{col.header || "Column"}
											</th>
										))}
									</tr>
								</thead>
							)}
							{/* Body - Show sample data or empty state */}
							<tbody>
								{columns.length === 0 ? (
									<tr>
										<td
											colSpan={1}
											style={{
												padding: `${padding}px`,
												textAlign: "center",
												color: "#9ca3af",
												fontStyle: "italic",
											}}
										>
											No columns defined
										</td>
									</tr>
								) : (
									// Show 2 sample rows
									[1, 2].map((rowIdx) => (
										<tr
											key={rowIdx}
											style={{
												backgroundColor:
													style.alternatingRows &&
													rowIdx % 2 === 0
														? style.alternatingRowBackground ||
															"#f9fafb"
														: "transparent",
											}}
										>
											{columns.map((col) => (
												<td
													key={col.id}
													style={{
														padding: `${padding}px`,
														textAlign: col.align,
														borderBottom:
															style.showBorders &&
															style.borderStyle !==
																"none"
																? `1px solid ${
																		style.borderColor ||
																		"#e5e7eb"
																	}`
																: "none",
													}}
												>
													{col.type === "currency"
														? `$${(
																10.99 * rowIdx
															).toFixed(2)}`
														: col.type === "number"
															? `${rowIdx}`
															: `Sample ${col.header || "data"}`}
												</td>
											))}
										</tr>
									))
								)}
							</tbody>
						</table>
						{/* Data source indicator */}
						{tableBlock.dataSource && (
							<div className="px-2 py-1 bg-muted/50 text-xs text-muted-foreground border-t">
								Data: {tableBlock.dataSource}
							</div>
						)}
					</div>
				</div>
			);
		}
    default:
      return null;
  }
}
