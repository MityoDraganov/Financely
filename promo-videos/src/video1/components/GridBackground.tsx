import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

type GridBackgroundProps = {
  color?: string;
  opacity?: number;
  animated?: boolean;
};

export const GridBackground: React.FC<GridBackgroundProps> = ({
  color = "#22c55e",
  opacity = 0.06,
  animated = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = animated
    ? interpolate(Math.sin((frame / fps) * Math.PI * 0.4), [-1, 1], [0.6, 1])
    : 1;

  const gridSize = 60;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: opacity * pulse,
        backgroundImage: `
          linear-gradient(${color}22 1px, transparent 1px),
          linear-gradient(90deg, ${color}22 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    />
  );
};

export const DotGrid: React.FC<{
  color?: string;
  opacity?: number;
  size?: number;
}> = ({ color = "#22c55e", opacity = 0.12, size = 40 }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
};
