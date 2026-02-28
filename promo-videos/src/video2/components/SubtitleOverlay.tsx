import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export interface SubtitleEntry {
  from: number; // absolute frame subtitle becomes visible
  to: number;   // absolute frame subtitle disappears
  text: string;
}

const FADE_FRAMES = 8; // frames for fade-in and fade-out

export const SubtitleOverlay: React.FC<{ subtitles: SubtitleEntry[] }> = ({
  subtitles,
}) => {
  const frame = useCurrentFrame();

  const active = subtitles.find(
    (s) => frame >= s.from - FADE_FRAMES && frame <= s.to + FADE_FRAMES,
  );

  if (!active) return null;

  const opacity = interpolate(
    frame,
    [active.from - FADE_FRAMES, active.from, active.to, active.to + FADE_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 999 }}>
      <div
        style={{
          position: "absolute",
          bottom: 64,
          left: "50%",
          transform: "translateX(-50%)",
          opacity,
          width: "88%",
          maxWidth: 1500,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(0, 0, 0, 0.74)",
            borderRadius: 12,
            padding: "14px 36px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 400,
            color: "#ffffff",
            lineHeight: 1.45,
            letterSpacing: "0.015em",
          }}
        >
          {active.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
