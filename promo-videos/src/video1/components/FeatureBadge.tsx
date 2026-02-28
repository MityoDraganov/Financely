import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { L } from "./UIWindow";

type FeatureBadgeProps = {
  text: string;
  subtext?: string;
  delay?: number;
  position?: "bottom-left" | "bottom-right";
};

/**
 * FeatureBadge — white card with green left-accent border.
 * Matches the light theme of the real app.
 */
export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  text,
  subtext,
  delay = 20,
  position = "bottom-left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });

  const translateY = interpolate(entrance, [0, 1], [24, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  const posStyle: React.CSSProperties =
    position === "bottom-right"
      ? { bottom: 48, right: 72 }
      : { bottom: 48, left: 72 };

  return (
    <div
      style={{
        position: "absolute",
        ...posStyle,
        transform: `translateY(${translateY}px)`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: L.CARD,
          borderRadius: 8,
          border: `1px solid ${L.BORDER}`,
          borderLeft: `3px solid ${L.PRIMARY}`,
          padding: "12px 20px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: L.TEXT,
            letterSpacing: "-0.2px",
          }}
        >
          {text}
        </div>
        {subtext && (
          <div style={{ fontSize: 12, color: L.TEXT_MUTED, marginTop: 3 }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
