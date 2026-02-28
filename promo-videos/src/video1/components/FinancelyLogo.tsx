import React from "react";

type LogoProps = {
  size?: number;
  color?: string;
  dotColor?: string;
};

export const FinancelyLogo: React.FC<LogoProps> = ({
  size = 56,
  color = "#ffffff",
  dotColor = "#22c55e",
}) => {
  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: size,
        fontWeight: 900,
        letterSpacing: "-2px",
        color,
        display: "flex",
        alignItems: "baseline",
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      Financely
      <span style={{ color: dotColor }}>.</span>
    </div>
  );
};
