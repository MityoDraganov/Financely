import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { L } from "./UIWindow";

/**
 * GreenShimmer — a soft horizontal green sweep that moves top→bottom.
 * Works on white/light backgrounds (replaces the dark scan beam).
 */
export const GreenShimmer: React.FC<{
  speed?: number; // seconds per full pass
  height?: number;
}> = ({ speed = 4, height = 1080 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = speed * fps;
  const progress = (frame % totalFrames) / totalFrames;
  const y = interpolate(progress, [0, 1], [-100, height + 100]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Wide soft beam */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          height: 120,
          background: `linear-gradient(to bottom,
            transparent 0%,
            ${L.PRIMARY_ACCENT}0a 30%,
            ${L.PRIMARY_ACCENT}14 50%,
            ${L.PRIMARY_ACCENT}0a 70%,
            transparent 100%
          )`,
        }}
      />
      {/* Crisp leading edge */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: y + 56,
          height: 1,
          background: `linear-gradient(to right, transparent, ${L.PRIMARY_ACCENT}40, ${L.PRIMARY_ACCENT}60, ${L.PRIMARY_ACCENT}40, transparent)`,
        }}
      />
    </div>
  );
};

/**
 * Subtle corner glow — small green radial glow at bottom-right.
 * Adds depth to white scenes.
 */
export const CornerAccent: React.FC = () => (
  <div
    style={{
      position: "absolute",
      bottom: -120,
      right: -120,
      width: 400,
      height: 400,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${L.PRIMARY_ACCENT}18 0%, transparent 70%)`,
      pointerEvents: "none",
    }}
  />
);
