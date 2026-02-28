/**
 * IntroScene — Bulgarian version.
 * UI is visually identical to video1/IntroScene; only marketing copy is translated.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FinancelyWordmark, L } from "../../video1/components/UIWindow";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoE = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 40 });
  const logoScale   = interpolate(logoE, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(logoE, [0, 1], [0, 1]);

  const tagE = spring({ frame: frame - 28, fps, config: { damping: 200 }, durationInFrames: 32 });
  const tagY = interpolate(tagE, [0, 1], [20, 0]);
  const tagO = interpolate(tagE, [0, 1], [0, 1]);

  const pillE = spring({ frame: frame - 48, fps, config: { damping: 12, stiffness: 200 }, durationInFrames: 24 });
  const pillS = interpolate(pillE, [0, 1], [0.8, 1]);
  const pillO = interpolate(pillE, [0, 1], [0, 1]);

  const divW = interpolate(logoOpacity, [0, 1], [0, 280]);

  return (
    <AbsoluteFill
      style={{
        background: L.BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${L.BORDER} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${L.PRIMARY_BG} 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.6,
        }}
      />
      <CornerDash top={40} left={60} />
      <CornerDash top={40} right={60} flipX />
      <CornerDash bottom={40} left={60} flipY />
      <CornerDash bottom={40} right={60} flipX flipY />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
          <FinancelyWordmark size={80} />
        </div>

        <div
          style={{
            width: divW,
            height: 1,
            background: `linear-gradient(to right, transparent, ${L.PRIMARY_BORDER}, transparent)`,
          }}
        />

        <div
          style={{
            transform: `translateY(${tagY}px)`,
            opacity: tagO,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 300,
            color: L.TEXT_MUTED,
            letterSpacing: "0.02em",
          }}
        >
          Всичко за твоя бизнес — на едно място
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap" as const,
            justifyContent: "center",
            transform: `scale(${pillS})`,
            opacity: pillO,
          }}
        >
          {["Фактуриране", "CRM", "Дизайнер", "Автоматизация", "Аналитика"].map((label) => (
            <div
              key={label}
              style={{
                background: L.PRIMARY_BG,
                border: `1px solid ${L.PRIMARY_BORDER}`,
                borderRadius: 9999,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 500,
                color: L.PRIMARY,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CornerDash: React.FC<{
  top?: number; bottom?: number; left?: number; right?: number;
  flipX?: boolean; flipY?: boolean;
}> = ({ top, bottom, left, right, flipX, flipY }) => {
  const size = 50;
  const t = 2;
  const c = L.PRIMARY_BORDER;
  return (
    <div
      style={{
        position: "absolute",
        top, bottom, left, right,
        width: size, height: size,
        transform: `scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: size, height: t, background: c }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: t, height: size, background: c }} />
    </div>
  );
};
