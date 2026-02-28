import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { L } from "../components/UIWindow";
import { FinancelyLogo } from "../components/FinancelyLogo";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoEntrance = spring({
    frame: frame - 5,
    fps,
    config: { damping: 200 },
    durationInFrames: 40,
  });
  const logoScale = interpolate(logoEntrance, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(logoEntrance, [0, 1], [0, 1]);

  // Divider
  const dividerEntrance = spring({
    frame: frame - 18,
    fps,
    config: { damping: 200 },
    durationInFrames: 25,
  });
  const dividerW = interpolate(dividerEntrance, [0, 1], [0, 200]);
  const dividerOpacity = interpolate(dividerEntrance, [0, 1], [0, 1]);

  // Tagline
  const taglineEntrance = spring({
    frame: frame - 25,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });
  const taglineY = interpolate(taglineEntrance, [0, 1], [24, 0]);
  const taglineOpacity = interpolate(taglineEntrance, [0, 1], [0, 1]);

  // CTA button
  const ctaEntrance = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 200 },
    durationInFrames: 25,
  });
  const ctaScale = interpolate(ctaEntrance, [0, 1], [0.7, 1]);
  const ctaOpacity = interpolate(ctaEntrance, [0, 1], [0, 1]);

  // URL text
  const urlEntrance = spring({
    frame: frame - 65,
    fps,
    config: { damping: 200 },
    durationInFrames: 20,
  });
  const urlOpacity = interpolate(urlEntrance, [0, 1], [0, 1]);

  // Ambient glow pulse (subtle)
  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 0.8),
    [-1, 1],
    [0.08, 0.18]
  );

  // CTA glow pulse
  const ctaGlow = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.15, 0.35]
  );

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
      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${L.BORDER_STRONG} 1.2px, transparent 1.2px)`,
          backgroundSize: "40px 40px",
          opacity: 0.7,
        }}
      />

      {/* Center ambient glow — green, very subtle on white */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${L.PRIMARY_ACCENT}${Math.round(glowPulse * 255).toString(16).padStart(2, "00")} 0%, transparent 65%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Bottom accent gradient */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(to top, ${L.PRIMARY_BG}, transparent)`,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        >
          <FinancelyLogo size={80} color={L.TEXT} dotColor={L.PRIMARY_ACCENT} />
        </div>

        {/* Animated green divider */}
        <div
          style={{
            opacity: dividerOpacity,
            width: dividerW,
            height: 2,
            background: `linear-gradient(to right, transparent, ${L.PRIMARY_ACCENT}, transparent)`,
            borderRadius: 1,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            transform: `translateY(${taglineY}px)`,
            opacity: taglineOpacity,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 32,
              fontWeight: 300,
              color: L.TEXT_MUTED,
              letterSpacing: "0.01em",
              lineHeight: 1.4,
            }}
          >
            The modern invoicing &amp; ops workspace
          </div>
        </div>

        {/* Feature pills */}
        <OutroFeaturePills delay={35} />

        {/* CTA */}
        <div
          style={{
            transform: `scale(${ctaScale})`,
            opacity: ctaOpacity,
          }}
        >
          <div
            style={{
              background: L.PRIMARY_ACCENT,
              borderRadius: 50,
              padding: "16px 40px",
              fontFamily: "'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.2px",
              boxShadow: `0 0 32px ${L.PRIMARY_ACCENT}${Math.round(ctaGlow * 255).toString(16).padStart(2, "00")}, 0 4px 16px rgba(34,197,94,0.25)`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            Get started free
            <span style={{ fontSize: 20 }}>→</span>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            opacity: urlOpacity,
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            color: L.TEXT_DIM,
            letterSpacing: "0.08em",
          }}
        >
          financely.io
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroFeaturePills: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: 25,
  });
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [12, 0]);

  const features = [
    "Smart Invoicing",
    "Template Designer",
    "CRM & Leads",
    "Workflow Automation",
    "Analytics",
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: 700,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {features.map((f) => (
        <div
          key={f}
          style={{
            background: L.PRIMARY_BG,
            border: `1px solid ${L.PRIMARY_BORDER}`,
            borderRadius: 30,
            padding: "7px 16px",
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: L.PRIMARY,
          }}
        >
          {f}
        </div>
      ))}
    </div>
  );
};
