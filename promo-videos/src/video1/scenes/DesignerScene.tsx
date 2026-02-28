/**
 * DesignerScene — mirrors the real Financely Template Designer page.
 * Animation: cursor drags "Text" from the "Add element" palette → canvas,
 * element appears with a bouncy spring, then cursor moves to the properties
 * panel where the fields animate to reflect the new element.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ChevronLeft,
  Eye,
  Info,
  Type as TypeIcon,
  ImageIcon,
  Table as TableIcon,
  Square,
  Minus,
  CircleDollarSign,
  StickyNote,
  GripVertical,
  Sparkles,
  Lock,
  AlignLeft,
} from "lucide-react";
import { L } from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

// ── Layout constants ────────────────────────────────────────────────────────
const LEFT_W = 258;
const RIGHT_W = 290;
const CANVAS_BG = "#d4d4d8";
const ZOOM = 0.68;
const PAPER_W = Math.round(794 * ZOOM); // 540
const PAPER_H = Math.round(1123 * ZOOM); // 764
const ACCENT = "#166534";
const ACCENT_LIGHT = "#dcfce7";
const SEL = "#3b82f6";

// ── Animation phase frames (30 fps) ────────────────────────────────────────
// 0–40:    UI enters
// 42–65:   cursor hovers over "Text" palette tile (tile highlights)
// 65–118:  drag — cursor + ghost move from palette to canvas drop point
// 118–135: drop — element appears with spring, old selection fades
// 132–165: cursor moves to properties panel
// 165+:    properties panel values animate to reflect the new element
const DRAG_HOVER_F   = 42;
const DRAG_LIFT_F    = 65;
const DRAG_DROP_F    = 118;
const PROPS_MOVE_F   = 132;
const PROPS_ARRIVE_F = 165;

// ── Cursor waypoints (scene-absolute, 1920×1080) ────────────────────────────
// Canvas centre-x = 258 (left panel) + (1920-258-290)/2 = 944
// Paper left edge  = 944 - 270 = 674   Paper top edge = 540 - 382 = 158
// "Text" tile: col-0 centre-x ≈ 49, row-0 centre-y ≈ 205
// Drop point (centre of new element):  x = 674+62+65 = 801, y = 158+338+11 = 507
const PAL_X  = 49,   PAL_Y  = 205;
const DROP_X = 801,  DROP_Y = 507;
const PROPS_X = 1720, PROPS_Y = 272;

// ── New element on paper (paper-relative px) ────────────────────────────────
const NEW_ELEM = { t: 338, l: 62, w: 130, h: 22 };

// ── AnimIn helper ───────────────────────────────────────────────────────────
const AnimIn: React.FC<{
  delay: number;
  dir?: "y" | "x" | "-x";
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay, dir = "y", children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 25 });
  const t = interpolate(e, [0, 1], [16, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  const transform =
    dir === "x"  ? `translateX(${t}px)` :
    dir === "-x" ? `translateX(${-t}px)` :
    `translateY(${t}px)`;
  return <div style={{ transform, opacity: o, ...style }}>{children}</div>;
};

// ── Resize handle ───────────────────────────────────────────────────────────
const Handle: React.FC<{ top: number; left: number }> = ({ top, left }) => (
  <div style={{
    position: "absolute", top, left,
    width: 8, height: 8,
    background: SEL, border: "1.5px solid #fff", borderRadius: 1.5,
    transform: "translate(-50%,-50%)",
    zIndex: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  }} />
);

// ── Mouse cursor SVG (arrow pointer, tip at component origin) ───────────────
const MouseCursor: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <div style={{
    position: "absolute",
    left: x, top: y,
    pointerEvents: "none",
    zIndex: 1000,
    opacity,
    filter: "drop-shadow(0px 1.5px 2.5px rgba(0,0,0,0.5))",
  }}>
    <svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 1.5 L2 20.5 L6.5 15.5 L10 23 L12.5 22 L9 14.5 L15.5 14.5 Z"
        fill="white"
        stroke="#1a1a1a"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

// ── Drag ghost — tile floating alongside cursor during drag ─────────────────
const DragGhost: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <div style={{
    position: "absolute",
    left: x - 28, top: y - 22,
    width: 58,
    opacity,
    pointerEvents: "none",
    zIndex: 998,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "7px 10px",
    borderRadius: 6,
    border: `1.5px solid ${SEL}`,
    background: "#eff6ff",
    boxShadow: "0 8px 24px rgba(59,130,246,0.30)",
    transform: "rotate(-3.5deg)",
  }}>
    <TypeIcon size={14} color={SEL} strokeWidth={1.8} />
    <span style={{ fontSize: 9, color: SEL, fontWeight: 600, whiteSpace: "nowrap" }}>Text</span>
  </div>
);

// ── Main scene ──────────────────────────────────────────────────────────────
export const DesignerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // UI entrance
  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  // Cursor fade-in at DRAG_HOVER_F
  const cursorOpacity = interpolate(frame, [DRAG_HOVER_F - 5, DRAG_HOVER_F + 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Cursor position — piecewise linear through all phases
  const cursorX = interpolate(
    frame,
    [DRAG_HOVER_F, DRAG_LIFT_F, DRAG_DROP_F, PROPS_MOVE_F, PROPS_ARRIVE_F],
    [PAL_X,        PAL_X,       DROP_X,      DROP_X,       PROPS_X],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cursorY = interpolate(
    frame,
    [DRAG_HOVER_F, DRAG_LIFT_F, DRAG_DROP_F, PROPS_MOVE_F, PROPS_ARRIVE_F],
    [PAL_Y,        PAL_Y,       DROP_Y,      DROP_Y,       PROPS_Y],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Ghost — visible only during the drag phase
  const ghostOpacity = interpolate(
    frame,
    [DRAG_LIFT_F, DRAG_LIFT_F + 8, DRAG_DROP_F - 5, DRAG_DROP_F + 3],
    [0,           1,               1,                0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Drop ripple — brief expanding ring at the drop point
  const rippleScale = interpolate(frame, [DRAG_DROP_F, DRAG_DROP_F + 20], [0.2, 2.8], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(
    frame,
    [DRAG_DROP_F, DRAG_DROP_F + 3, DRAG_DROP_F + 22],
    [0,           0.6,             0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: L.BG,
        fontFamily: "'Inter', sans-serif",
        opacity,
        transform: `translateX(${tx}px)`,
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* Left panel */}
      <LeftPanel paletteHover={frame >= DRAG_HOVER_F && frame < DRAG_LIFT_F} />

      {/* Centre: canvas header + viewport */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AnimIn delay={4}>
          <CanvasHeader />
        </AnimIn>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <AnimIn delay={16} style={{ height: "100%" }}>
            <CanvasViewport />
          </AnimIn>
        </div>
      </div>

      {/* Right panel */}
      <AnimIn delay={10} dir="-x" style={{ width: RIGHT_W, height: "100%", flexShrink: 0 }}>
        <PropertiesPanel />
      </AnimIn>

      {/* Drop ripple */}
      <div style={{
        position: "absolute",
        left: DROP_X - 22, top: DROP_Y - 22,
        width: 44, height: 44,
        borderRadius: "50%",
        border: `2px solid ${SEL}`,
        opacity: rippleOpacity,
        transform: `scale(${rippleScale})`,
        pointerEvents: "none",
        zIndex: 994,
      }} />

      {/* Drag ghost */}
      <DragGhost x={cursorX} y={cursorY} opacity={ghostOpacity} />

      {/* Mouse cursor — always on top */}
      <MouseCursor x={cursorX} y={cursorY} opacity={cursorOpacity} />

      <FeatureBadge
        text="Design with precision."
        subtext="Drag, resize & snap — full WYSIWYG canvas"
        delay={65}
        position="bottom-left"
      />
    </AbsoluteFill>
  );
};

// ── LEFT PANEL ──────────────────────────────────────────────────────────────
const LeftPanel: React.FC<{ paletteHover: boolean }> = ({ paletteHover }) => {
  const ELEMENTS = [
    { icon: TypeIcon,         label: "Text" },
    { icon: ImageIcon,        label: "Image" },
    { icon: TableIcon,        label: "Table" },
    { icon: Square,           label: "Box" },
    { icon: Minus,            label: "Line" },
    { icon: StickyNote,       label: "Icon" },
    { icon: CircleDollarSign, label: "Currency" },
    { icon: AlignLeft,        label: "Input" },
    { icon: Square,           label: "QR Code" },
  ];

  return (
    <div style={{
      width: LEFT_W, height: "100%",
      background: L.BG_SUBTLE,
      borderRight: `1px solid ${L.BORDER}`,
      display: "flex", flexDirection: "column",
      flexShrink: 0, overflow: "hidden",
    }}>
      {/* Header */}
      <AnimIn delay={3}>
        <div style={{
          padding: "12px 14px", borderBottom: `1px solid ${L.BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: L.TEXT_MUTED, fontSize: 12 }}>
            <ChevronLeft size={13} strokeWidth={2} />
            <span style={{ fontWeight: 500 }}>Template Designer</span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 9px", borderRadius: 5,
            border: `1px solid ${L.BORDER}`, fontSize: 11, fontWeight: 500, color: L.TEXT_MUTED,
          }}>
            <Sparkles size={10} />AI Build
          </div>
        </div>
      </AnimIn>

      {/* Template selector */}
      <AnimIn delay={8}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${L.BORDER}` }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: L.BG, border: `1px solid ${L.BORDER}`, borderRadius: 6,
            padding: "7px 10px", fontSize: 12, fontWeight: 500, color: L.TEXT,
          }}>
            <span>Modern Pro</span>
            <span style={{ color: L.TEXT_DIM, fontSize: 10 }}>▾</span>
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.PRIMARY_ACCENT }} />
            <span style={{ fontSize: 10, color: L.PRIMARY, fontWeight: 500 }}>Saved</span>
          </div>
        </div>
      </AnimIn>

      {/* Tabs */}
      <AnimIn delay={12}>
        <div style={{ display: "flex", borderBottom: `1px solid ${L.BORDER}`, padding: "0 6px" }}>
          {["Elements", "Layers", "Templates"].map((tab, i) => (
            <div key={tab} style={{
              padding: "8px 10px", fontSize: 11,
              fontWeight: i === 1 ? 600 : 400,
              color: i === 1 ? L.PRIMARY : L.TEXT_MUTED,
              borderBottom: i === 1 ? `2px solid ${L.PRIMARY}` : "2px solid transparent",
            }}>
              {tab}
            </div>
          ))}
        </div>
      </AnimIn>

      {/* Element palette */}
      <AnimIn delay={16}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${L.BORDER}` }}>
          <div style={{
            fontSize: 9, fontWeight: 600, color: L.TEXT_DIM,
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8,
          }}>
            Add element
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {ELEMENTS.map(({ icon: Icon, label }) => {
              const hovered = paletteHover && label === "Text";
              return (
                <div key={label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "7px 4px", borderRadius: 6,
                  border: hovered ? `1.5px solid ${SEL}` : `1px solid ${L.BORDER}`,
                  background: hovered ? "#eff6ff" : L.BG,
                  boxShadow: hovered ? `0 0 0 3px ${SEL}18` : "none",
                  cursor: "grab",
                }}>
                  <Icon size={13} color={hovered ? SEL : L.TEXT_MUTED} strokeWidth={1.8} />
                  <span style={{
                    fontSize: 9,
                    color: hovered ? SEL : L.TEXT_MUTED,
                    fontWeight: hovered ? 600 : 500,
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AnimIn>

      {/* Layers list */}
      <div style={{ flex: 1, overflowY: "hidden", padding: "8px 0" }}>
        <div style={{
          fontSize: 9, fontWeight: 600, color: L.TEXT_DIM,
          letterSpacing: "0.07em", textTransform: "uppercase",
          padding: "0 14px", marginBottom: 6,
        }}>
          Layers
        </div>
        {[
          { icon: TypeIcon,         name: "Company Name",   selected: false },
          { icon: TypeIcon,         name: "INVOICE",        selected: true  },
          { icon: TypeIcon,         name: "Invoice Number", selected: false },
          { icon: Minus,            name: "Separator",      selected: false },
          { icon: TableIcon,        name: "Line Items",     selected: false },
          { icon: CircleDollarSign, name: "Total",          selected: false },
          { icon: TypeIcon,         name: "Footer Text",    selected: false },
        ].map(({ icon: Icon, name, selected }, i) => (
          <AnimIn key={name} delay={22 + i * 5}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 14px",
              background: selected ? "#eff6ff" : "transparent",
              borderLeft: selected ? `2px solid ${SEL}` : "2px solid transparent",
            }}>
              <GripVertical size={11} color={L.BORDER_STRONG} strokeWidth={2} style={{ flexShrink: 0 }} />
              <Icon size={12} color={selected ? SEL : L.TEXT_MUTED} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: 11.5,
                fontWeight: selected ? 600 : 400,
                color: selected ? "#1d4ed8" : L.TEXT,
              }}>
                {name}
              </span>
              <Lock size={10} color={L.BORDER_STRONG} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            </div>
          </AnimIn>
        ))}
      </div>
    </div>
  );
};

// ── CANVAS HEADER ───────────────────────────────────────────────────────────
const CanvasHeader: React.FC = () => (
  <div style={{
    height: 46, background: L.BG, borderBottom: `1px solid ${L.BORDER}`,
    display: "flex", alignItems: "center", padding: "0 14px", gap: 10, flexShrink: 0,
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: L.BG, border: `1px solid ${L.BORDER}`, borderRadius: 6,
      padding: "5px 10px", fontSize: 12, fontWeight: 500, color: L.TEXT, minWidth: 200,
    }}>
      Modern Pro
      <span style={{ marginLeft: "auto", color: L.TEXT_DIM, fontSize: 10 }}>▾</span>
    </div>
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: L.PRIMARY_BG, border: `1px solid ${L.PRIMARY_BORDER}`,
      borderRadius: 5, padding: "4px 9px", fontSize: 10.5, fontWeight: 500, color: L.PRIMARY,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.PRIMARY_ACCENT }} />
      Live
    </div>
    <div style={{
      width: 26, height: 26, borderRadius: "50%",
      background: "#6d28d9", border: "2px solid white",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "#fff",
    }}>
      MO
    </div>
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 6, border: `1px solid ${L.BORDER}`,
        fontSize: 12, fontWeight: 500, color: L.TEXT, background: L.BG,
      }}>
        <Eye size={12} strokeWidth={1.8} />Preview
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 6, border: `1px solid ${L.BORDER}`,
        fontSize: 12, fontWeight: 500, color: L.TEXT, background: L.BG, minWidth: 72,
      }}>
        68%<span style={{ color: L.TEXT_DIM, fontSize: 10, marginLeft: 4 }}>▾</span>
      </div>
      <div style={{
        width: 30, height: 30, borderRadius: 6, border: `1px solid ${L.BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Info size={13} color={L.TEXT_MUTED} strokeWidth={1.8} />
      </div>
    </div>
  </div>
);

// ── CANVAS VIEWPORT ─────────────────────────────────────────────────────────
const CanvasViewport: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isDropped = frame >= DRAG_DROP_F;

  // Bouncy spring entrance for the dropped element
  const droppedScale = isDropped
    ? spring({ frame: frame - DRAG_DROP_F, fps, config: { damping: 14, stiffness: 200 } })
    : 0;

  // Shared pulse for selection rings
  const selPulse = interpolate(Math.sin((frame / fps) * Math.PI * 1.8), [-1, 1], [0.55, 1]);

  // INVOICE selection: pulses before drop, fades to 0 after
  const invoiceSelOpacity = isDropped
    ? interpolate(frame, [DRAG_DROP_F, DRAG_DROP_F + 14], [1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : selPulse;

  // New element selection: builds in after drop, then pulses
  const newSelFactor = isDropped
    ? interpolate(frame, [DRAG_DROP_F + 10, DRAG_DROP_F + 22], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;
  const newElemSelOpacity = newSelFactor * selPulse;

  return (
    <div style={{
      width: "100%", height: "100%",
      background: CANVAS_BG,
      position: "relative",
      overflow: "hidden",
      backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    }}>
      {/* Snap guides */}
      <div style={{
        position: "absolute",
        left: `calc(50% - ${PAPER_W / 2}px + 360px)`,
        top: 0, bottom: 0, width: 1,
        background: `${SEL}60`, zIndex: 5, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        top: `calc(50% - ${PAPER_H / 2}px + 185px)`,
        height: 1,
        background: `${SEL}60`, zIndex: 5, pointerEvents: "none",
      }} />

      {/* A4 paper */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: PAPER_W, height: PAPER_H,
        background: "#ffffff",
        boxShadow: "0 6px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <InvoiceTemplate
          invoiceSelOpacity={invoiceSelOpacity}
          newElemScale={droppedScale}
          newElemSelOpacity={newElemSelOpacity}
        />
      </div>
    </div>
  );
};

// ── INVOICE TEMPLATE ────────────────────────────────────────────────────────
const InvoiceTemplate: React.FC<{
  invoiceSelOpacity: number;
  newElemScale: number;
  newElemSelOpacity: number;
}> = ({ invoiceSelOpacity, newElemScale, newElemSelOpacity }) => {
  const gridPattern = `
    linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px)
  `;
  const gridSize = `${Math.round(8 * ZOOM)}px ${Math.round(8 * ZOOM)}px`;
  const SEL_ELEM = { t: 16, l: 360, w: 165, h: 28 };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Paper grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: gridPattern,
        backgroundSize: gridSize,
        pointerEvents: "none",
      }} />

      {/* Accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, width: PAPER_W, height: 5, background: ACCENT }} />

      {/* Company name */}
      <div style={{ position: "absolute", top: 18, left: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: ACCENT, letterSpacing: "-0.4px" }}>
          Acme Corp<span style={{ color: L.PRIMARY_ACCENT }}>.</span>
        </div>
        <div style={{ fontSize: 7, color: L.TEXT_DIM, marginTop: 2 }}>123 Business Ave, New York</div>
        <div style={{ fontSize: 7, color: L.TEXT_DIM }}>contact@acmecorp.com</div>
      </div>

      {/* INVOICE label — selected element */}
      <div style={{
        position: "absolute",
        top: SEL_ELEM.t, left: SEL_ELEM.l,
        width: SEL_ELEM.w, height: SEL_ELEM.h,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, letterSpacing: "0.02em", lineHeight: 1 }}>
          INVOICE
        </div>
        <div style={{ fontSize: 8, color: L.TEXT_DIM, marginTop: 3 }}>#INV-2025-042</div>
        {/* Selection ring */}
        <div style={{
          position: "absolute", inset: -3,
          border: `1.5px dashed ${SEL}`, borderRadius: 2,
          opacity: invoiceSelOpacity, pointerEvents: "none",
        }} />
        {/* Resize handles */}
        {invoiceSelOpacity > 0.08 && [
          [0, 0], [50, 0], [100, 0],
          [0, 50],          [100, 50],
          [0, 100],[50, 100],[100, 100],
        ].map(([px, py], i) => (
          <Handle
            key={i}
            top={-3 + (SEL_ELEM.h + 6) * py / 100}
            left={-3 + (SEL_ELEM.w + 6) * px / 100}
          />
        ))}
      </div>

      {/* Thin separator */}
      <div style={{ position: "absolute", top: 74, left: 0, width: PAPER_W, height: 1, background: L.BORDER }} />

      {/* Bill to */}
      <div style={{ position: "absolute", top: 88, left: 18 }}>
        <div style={{
          fontSize: 6, fontWeight: 700, color: L.TEXT_MUTED,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5,
        }}>Bill To</div>
        {[145, 110, 100].map((w, i) => (
          <div key={i} style={{ height: 4, width: w, background: L.BORDER_STRONG, borderRadius: 2, marginBottom: 4 }} />
        ))}
      </div>

      {/* Dates */}
      <div style={{ position: "absolute", top: 88, left: 352, textAlign: "right" }}>
        {[["Date Issued", L.BORDER_STRONG], ["Due Date", `${ACCENT}50`]].map(([label, barColor], i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 6, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
            <div style={{ height: 5, width: 60, background: barColor as string, borderRadius: 2, marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        position: "absolute", top: 185, left: 14,
        width: PAPER_W - 28, height: 26,
        background: ACCENT_LIGHT, borderRadius: "4px 4px 0 0",
        display: "flex", alignItems: "center", padding: "0 10px", justifyContent: "space-between",
      }}>
        {["Description", "Qty", "Rate", "Total"].map(h => (
          <span key={h} style={{ fontSize: 6, fontWeight: 700, color: ACCENT, letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</span>
        ))}
      </div>

      {/* Table rows */}
      {[0, 1].map(i => (
        <div key={i} style={{
          position: "absolute",
          top: 211 + i * 26, left: 14,
          width: PAPER_W - 28, height: 26,
          borderBottom: `1px solid ${L.BORDER}`,
          background: i % 2 === 0 ? "#fff" : "#fafafa",
          display: "flex", alignItems: "center", padding: "0 10px", justifyContent: "space-between",
        }}>
          {[40, 12, 15, 15].map((wPct, j) => (
            <div key={j} style={{ height: 4, width: `${wPct}%`, background: L.BORDER_STRONG, borderRadius: 2 }} />
          ))}
        </div>
      ))}

      {/* Subtotal line */}
      <div style={{ position: "absolute", top: 263, left: 14, width: PAPER_W - 28, height: 1, background: L.BORDER_STRONG }} />

      {/* Total box */}
      <div style={{
        position: "absolute", top: 278, left: 356,
        width: 170, height: 34,
        background: ACCENT, borderRadius: 5,
        display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>TOTAL</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>$3,200.00</span>
      </div>

      {/* Footer bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: PAPER_W, height: 16,
        background: ACCENT,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ height: 3, width: 180, background: "rgba(255,255,255,0.25)", borderRadius: 2 }} />
      </div>

      {/* ── Newly dropped Text element ── */}
      {newElemScale > 0.01 && (
        <div style={{
          position: "absolute",
          top: NEW_ELEM.t, left: NEW_ELEM.l,
          width: NEW_ELEM.w, height: NEW_ELEM.h,
          transform: `scale(${newElemScale})`,
          transformOrigin: "top left",
          opacity: newElemScale,
        }}>
          {/* Placeholder text */}
          <div style={{
            fontSize: 10, fontWeight: 400,
            color: "#374151",
            lineHeight: `${NEW_ELEM.h}px`,
            paddingLeft: 3,
            fontStyle: "italic",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}>
            Text Block
          </div>
          {/* Selection ring */}
          <div style={{
            position: "absolute", inset: -3,
            border: `1.5px dashed ${SEL}`, borderRadius: 2,
            opacity: newElemSelOpacity,
            pointerEvents: "none",
          }} />
          {/* Resize handles */}
          {newElemSelOpacity > 0.15 && [
            [0, 0], [50, 0], [100, 0],
            [0, 50],          [100, 50],
            [0, 100],[50, 100],[100, 100],
          ].map(([px, py], i) => (
            <Handle
              key={i}
              top={-3 + (NEW_ELEM.h + 6) * py / 100}
              left={-3 + (NEW_ELEM.w + 6) * px / 100}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── PROPERTIES PANEL ────────────────────────────────────────────────────────
const PropertiesPanel: React.FC = () => {
  const frame = useCurrentFrame();

  // After drop, smoothly transition field values to the new element
  const transP = interpolate(
    frame,
    [DRAG_DROP_F + 10, DRAG_DROP_F + 28],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Numeric values animate between INVOICE and new Text Block
  const xVal      = Math.round(interpolate(transP, [0, 1], [360, 62]));
  const yVal      = Math.round(interpolate(transP, [0, 1], [16,  338]));
  const wVal      = Math.round(interpolate(transP, [0, 1], [165, 130]));
  const hVal      = Math.round(interpolate(transP, [0, 1], [28,  22]));
  const sizeVal   = Math.round(interpolate(transP, [0, 1], [24,  12]));
  const weightVal = Math.round(interpolate(transP, [0, 1], [800, 400]));

  // Badge cross-fade: old fades 0→0.5, new fades in 0.5→1
  const oldBadgeOp = interpolate(transP, [0, 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const newBadgeOp = interpolate(transP, [0.5, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Color swatch flips at the midpoint
  const elemColor = transP > 0.5 ? "#374151" : ACCENT;

  return (
    <div style={{
      width: RIGHT_W, height: "100%",
      background: L.BG, borderLeft: `1px solid ${L.BORDER}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Tabs */}
      <AnimIn delay={8}>
        <div style={{
          display: "flex", borderBottom: `1px solid ${L.BORDER}`,
          padding: "0 6px", flexShrink: 0, height: 38, alignItems: "flex-end",
        }}>
          {["Element", "Page", "Compliance", "History"].map((tab, i) => (
            <div key={tab} style={{
              padding: "8px 10px", fontSize: 11,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? L.PRIMARY : L.TEXT_MUTED,
              borderBottom: i === 0 ? `2px solid ${L.PRIMARY}` : "2px solid transparent",
            }}>
              {tab}
            </div>
          ))}
        </div>
      </AnimIn>

      <div style={{ flex: 1, padding: "14px 16px", overflowY: "hidden", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Selected element badge — cross-fades between INVOICE and Text Block */}
        <AnimIn delay={14}>
          <div style={{ position: "relative", height: 36 }}>
            {/* Old: INVOICE */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", gap: 8, padding: "0 10px",
              background: "#eff6ff", border: `1px solid #bfdbfe`, borderRadius: 6,
              opacity: oldBadgeOp,
            }}>
              <TypeIcon size={13} color={SEL} strokeWidth={1.8} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8" }}>INVOICE — Text</span>
            </div>
            {/* New: Text Block */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", gap: 8, padding: "0 10px",
              background: "#eff6ff", border: `1px solid #bfdbfe`, borderRadius: 6,
              opacity: newBadgeOp,
            }}>
              <TypeIcon size={13} color={SEL} strokeWidth={1.8} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8" }}>Text Block — Text</span>
            </div>
          </div>
        </AnimIn>

        {/* Position & Size */}
        <AnimIn delay={18}>
          <PropSection label="Position & Size">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([["X", xVal], ["Y", yVal], ["W", wVal], ["H", hVal]] as [string, number][]).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
                  <div style={{
                    border: `1px solid ${L.BORDER}`, borderRadius: 5,
                    padding: "5px 8px", fontSize: 11.5, color: L.TEXT,
                    background: L.BG, fontVariantNumeric: "tabular-nums",
                  }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </PropSection>
        </AnimIn>

        {/* Typography */}
        <AnimIn delay={24}>
          <PropSection label="Typography">
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>Font</div>
              <div style={{
                border: `1px solid ${L.BORDER}`, borderRadius: 5,
                padding: "5px 8px", fontSize: 11.5, color: L.TEXT,
                background: L.BG, display: "flex", justifyContent: "space-between",
              }}>
                Inter <span style={{ color: L.TEXT_DIM, fontSize: 10 }}>▾</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              {([["Size", sizeVal], ["Weight", weightVal]] as [string, number][]).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
                  <div style={{
                    border: `1px solid ${L.BORDER}`, borderRadius: 5,
                    padding: "5px 8px", fontSize: 11.5, color: L.TEXT, background: L.BG,
                  }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>Color</div>
              <div style={{
                border: `1px solid ${L.BORDER}`, borderRadius: 5,
                padding: "5px 8px", fontSize: 11.5, color: L.TEXT,
                background: L.BG, display: "flex", alignItems: "center", gap: 7,
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: elemColor, flexShrink: 0 }} />
                {elemColor}
              </div>
            </div>
          </PropSection>
        </AnimIn>

        {/* Style */}
        <AnimIn delay={30}>
          <PropSection label="Style">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["Background", "transparent"], ["Opacity", "100%"], ["Letter spacing", "0.02em"], ["Line height", "1.0"]].map(([label, val]) => (
                <div key={label as string}>
                  <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
                  <div style={{
                    border: `1px solid ${L.BORDER}`, borderRadius: 5,
                    padding: "5px 8px", fontSize: 11, color: L.TEXT_MUTED, background: L.BG,
                  }}>
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </PropSection>
        </AnimIn>

        {/* Compliance */}
        <AnimIn delay={36}>
          <div style={{
            padding: "9px 11px",
            background: L.PRIMARY_BG, border: `1px solid ${L.PRIMARY_BORDER}`, borderRadius: 6,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: L.PRIMARY_ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: L.PRIMARY, fontWeight: 500 }}>EU compliance — All required fields present</span>
          </div>
        </AnimIn>
      </div>
    </div>
  );
};

// ── PropSection wrapper ─────────────────────────────────────────────────────
const PropSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{
      fontSize: 9.5, fontWeight: 700, color: L.TEXT_DIM,
      letterSpacing: "0.07em", textTransform: "uppercase",
      marginBottom: 9, paddingBottom: 6, borderBottom: `1px solid ${L.BORDER}`,
    }}>
      {label}
    </div>
    {children}
  </div>
);
