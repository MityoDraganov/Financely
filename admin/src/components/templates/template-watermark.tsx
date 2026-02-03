import React from "react";
import type { Template } from "@/core/entities/template";

type WatermarkProps = {
  watermark: NonNullable<Template["brand"]["watermark"]>;
};

export function renderWatermark({ watermark }: WatermarkProps): React.ReactNode {
  if (!watermark.enabled) return null;

  const watermarkImageUrl = watermark.imageUrl;
  const watermarkText = watermark.text;

  let positionStyle: React.CSSProperties = {};
  if (watermark.x !== undefined && watermark.y !== undefined) {
    positionStyle = {
      left: watermark.x,
      top: watermark.y,
      transform: `translate(0, 0) rotate(${watermark.rotation}deg)`,
    };
  } else {
    const positions: Record<string, React.CSSProperties> = {
      center: {
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) rotate(${watermark.rotation}deg)`,
      },
      "top-left": { left: 0, top: 0, transform: `rotate(${watermark.rotation}deg)` },
      "top-right": { right: 0, top: 0, transform: `rotate(${watermark.rotation}deg)` },
      "bottom-left": { left: 0, bottom: 0, transform: `rotate(${watermark.rotation}deg)` },
      "bottom-right": { right: 0, bottom: 0, transform: `rotate(${watermark.rotation}deg)` },
      "top-center": {
        left: "50%",
        top: 0,
        transform: `translateX(-50%) rotate(${watermark.rotation}deg)`,
      },
      "bottom-center": {
        left: "50%",
        bottom: 0,
        transform: `translateX(-50%) rotate(${watermark.rotation}deg)`,
      },
      "left-center": {
        left: 0,
        top: "50%",
        transform: `translateY(-50%) rotate(${watermark.rotation}deg)`,
      },
      "right-center": {
        right: 0,
        top: "50%",
        transform: `translateY(-50%) rotate(${watermark.rotation}deg)`,
      },
    };
    positionStyle = positions[watermark.position] || positions.center;
  }

  const width = watermark.width || 200;
  const height = watermark.height;
  const opacity = watermark.opacity ?? 0.1;
  const repeat = watermark.repeat || "none";

  if (watermarkImageUrl) {
    if (repeat === "none") {
      return (
        <div
          style={{
            position: "absolute",
            ...positionStyle,
            width,
            height: height || width,
            opacity,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src={watermarkImageUrl}
            alt="Watermark"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      );
    }
    const backgroundSize =
      repeat === "repeat"
        ? `${width}px ${height || width}px`
        : repeat === "repeat-x"
          ? `${width}px auto`
          : `${width}px auto`;
    const cssRepeat: React.CSSProperties["backgroundRepeat"] =
      repeat === "repeat"
        ? "repeat"
        : repeat === "repeat-x"
          ? "repeat-x"
          : repeat === "repeat-y"
            ? "repeat-y"
            : "no-repeat";
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `url(${watermarkImageUrl})`,
          backgroundRepeat: cssRepeat,
          backgroundSize,
          opacity,
          pointerEvents: "none",
          zIndex: 0,
          transform: `rotate(${watermark.rotation || 0}deg)`,
        }}
      />
    );
  }

  if (watermarkText) {
    return (
      <div
        style={{
          position: "absolute",
          ...positionStyle,
          width,
          minWidth: width,
          opacity,
          pointerEvents: "none",
          zIndex: 0,
          fontSize: Math.max(24, width / 10),
          fontWeight: "bold",
          color: "#999999",
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {watermarkText}
      </div>
    );
  }

  return null;
}
