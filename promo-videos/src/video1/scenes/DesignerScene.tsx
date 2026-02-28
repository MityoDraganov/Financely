/**
 * DesignerScene — mirrors the real Financely Template Designer page.
 * 3-panel layout: left sidebar (element palette + layers) |
 *                 center (canvas header + WYSIWYG canvas) |
 *                 right (properties panel)
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

// ── Layout constants ───────────────────────────────────────────────────────────
const LEFT_W = 258;
const RIGHT_W = 290;
const CANVAS_BG = "#d4d4d8"; // zinc-300 — neutral canvas background

// ── Paper dimensions at 0.68× zoom (A4 = 794×1123 pt) ───────────────────────
const ZOOM = 0.68;
const PAPER_W = Math.round(794 * ZOOM); // 540
const PAPER_H = Math.round(1123 * ZOOM); // 764

// ── Brand / selection colours ─────────────────────────────────────────────────
const ACCENT = "#166534";
const ACCENT_LIGHT = "#dcfce7";
const SEL = "#3b82f6"; // blue selection ring

// ── AnimIn helper ──────────────────────────────────────────────────────────────
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
    dir === "x" ? `translateX(${t}px)` :
    dir === "-x" ? `translateX(${-t}px)` :
    `translateY(${t}px)`;
  return <div style={{ transform, opacity: o, ...style }}>{children}</div>;
};

// ── Resize handle ─────────────────────────────────────────────────────────────
const Handle: React.FC<{ top: number; left: number }> = ({ top, left }) => (
  <div style={{
    position: "absolute",
    top,
    left,
    width: 8,
    height: 8,
    background: SEL,
    border: "1.5px solid #fff",
    borderRadius: 1.5,
    transform: "translate(-50%,-50%)",
    zIndex: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
  }} />
);

// ── Main scene ─────────────────────────────────────────────────────────────────
export const DesignerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  // Pulsing blue selection ring
  const selPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 1.8),
    [-1, 1],
    [0.55, 1]
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
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <LeftPanel />

      {/* ── Centre: canvas header + viewport ──────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AnimIn delay={4}>
          <CanvasHeader />
        </AnimIn>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <AnimIn delay={16} style={{ height: "100%" }}>
            <CanvasViewport selPulse={selPulse} />
          </AnimIn>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <AnimIn delay={10} dir="-x" style={{ width: RIGHT_W, height: "100%", flexShrink: 0 }}>
        <PropertiesPanel />
      </AnimIn>

      <FeatureBadge
        text="Design with precision."
        subtext="Drag, resize & snap — full WYSIWYG canvas"
        delay={65}
        position="bottom-left"
      />
    </AbsoluteFill>
  );
};

// ── LEFT PANEL ─────────────────────────────────────────────────────────────────
const LeftPanel: React.FC = () => (
  <div style={{
    width: LEFT_W,
    height: "100%",
    background: L.BG_SUBTLE,
    borderRight: `1px solid ${L.BORDER}`,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
  }}>
    {/* Header row */}
    <AnimIn delay={3}>
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${L.BORDER}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
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
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${L.BORDER}`,
        padding: "0 6px",
      }}>
        {["Elements", "Layers", "Templates"].map((tab, i) => (
          <div key={tab} style={{
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: i === 1 ? 600 : 400,
            color: i === 1 ? L.PRIMARY : L.TEXT_MUTED,
            borderBottom: i === 1 ? `2px solid ${L.PRIMARY}` : "2px solid transparent",
            cursor: "pointer",
          }}>
            {tab}
          </div>
        ))}
      </div>
    </AnimIn>

    {/* Element palette (compact, 3-col grid) */}
    <AnimIn delay={16}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${L.BORDER}` }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: L.TEXT_DIM, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Add element
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {[
            { icon: TypeIcon, label: "Text" },
            { icon: ImageIcon, label: "Image" },
            { icon: TableIcon, label: "Table" },
            { icon: Square, label: "Box" },
            { icon: Minus, label: "Line" },
            { icon: StickyNote, label: "Icon" },
            { icon: CircleDollarSign, label: "Currency" },
            { icon: AlignLeft, label: "Input" },
            { icon: Square, label: "QR Code" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "7px 4px", borderRadius: 6, border: `1px solid ${L.BORDER}`,
              background: L.BG, cursor: "grab",
            }}>
              <Icon size={13} color={L.TEXT_MUTED} strokeWidth={1.8} />
              <span style={{ fontSize: 9, color: L.TEXT_MUTED, fontWeight: 500 }}>{label}</span>
            </div>
          ))}
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
        { icon: TypeIcon, name: "Company Name", type: "text", selected: false },
        { icon: TypeIcon, name: "INVOICE", type: "text", selected: true },
        { icon: TypeIcon, name: "Invoice Number", type: "text", selected: false },
        { icon: Minus, name: "Separator", type: "line", selected: false },
        { icon: TableIcon, name: "Line Items", type: "table", selected: false },
        { icon: CircleDollarSign, name: "Total", type: "currency", selected: false },
        { icon: TypeIcon, name: "Footer Text", type: "text", selected: false },
      ].map(({ icon: Icon, name, selected }, i) => (
        <AnimIn key={name} delay={22 + i * 5}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            background: selected ? "#eff6ff" : "transparent",
            borderLeft: selected ? `2px solid ${SEL}` : "2px solid transparent",
          }}>
            <GripVertical size={11} color={L.BORDER_STRONG} strokeWidth={2} style={{ flexShrink: 0 }} />
            <Icon size={12} color={selected ? SEL : L.TEXT_MUTED} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontSize: 11.5,
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

// ── CANVAS HEADER ──────────────────────────────────────────────────────────────
const CanvasHeader: React.FC = () => (
  <div style={{
    height: 46,
    background: L.BG,
    borderBottom: `1px solid ${L.BORDER}`,
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    gap: 10,
    flexShrink: 0,
  }}>
    {/* Template dropdown */}
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: L.BG, border: `1px solid ${L.BORDER}`, borderRadius: 6,
      padding: "5px 10px", fontSize: 12, fontWeight: 500, color: L.TEXT, minWidth: 200,
    }}>
      Modern Pro
      <span style={{ marginLeft: "auto", color: L.TEXT_DIM, fontSize: 10 }}>▾</span>
    </div>

    {/* Live badge */}
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: L.PRIMARY_BG,
      border: `1px solid ${L.PRIMARY_BORDER}`,
      borderRadius: 5, padding: "4px 9px", fontSize: 10.5, fontWeight: 500, color: L.PRIMARY,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.PRIMARY_ACCENT }} />
      Live
    </div>

    {/* User avatar */}
    <div style={{
      width: 26, height: 26, borderRadius: "50%",
      background: "#6d28d9", border: "2px solid white",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, color: "#fff",
    }}>
      MO
    </div>

    {/* Right controls */}
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
      {/* Preview button */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 11px", borderRadius: 6, border: `1px solid ${L.BORDER}`,
        fontSize: 12, fontWeight: 500, color: L.TEXT, background: L.BG,
      }}>
        <Eye size={12} strokeWidth={1.8} />Preview
      </div>
      {/* Zoom */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 6, border: `1px solid ${L.BORDER}`,
        fontSize: 12, fontWeight: 500, color: L.TEXT, background: L.BG, minWidth: 72,
      }}>
        68%<span style={{ color: L.TEXT_DIM, fontSize: 10, marginLeft: 4 }}>▾</span>
      </div>
      {/* Info */}
      <div style={{
        width: 30, height: 30, borderRadius: 6, border: `1px solid ${L.BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Info size={13} color={L.TEXT_MUTED} strokeWidth={1.8} />
      </div>
    </div>
  </div>
);

// ── CANVAS VIEWPORT ────────────────────────────────────────────────────────────
const CanvasViewport: React.FC<{ selPulse: number }> = ({ selPulse }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cursor blink — hovers near selected element, suggesting interaction
  const cursorOpacity = interpolate(
    Math.sin((frame / fps) * Math.PI * 2.5),
    [-1, 1],
    [0.3, 0.9]
  );

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: CANVAS_BG,
      position: "relative",
      overflow: "hidden",
      // Dot grid
      backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    }}>
      {/* Snap guides */}
      {/* Vertical guide at right col x=360 on paper (paper left edge in canvas) */}
      <div style={{
        position: "absolute",
        left: `calc(50% - ${PAPER_W / 2}px + 360px)`,
        top: 0,
        bottom: 0,
        width: 1,
        background: `${SEL}60`,
        zIndex: 5,
        pointerEvents: "none",
      }} />
      {/* Horizontal guide at table top y=185 */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: `calc(50% - ${PAPER_H / 2}px + 185px)`,
        height: 1,
        background: `${SEL}60`,
        zIndex: 5,
        pointerEvents: "none",
      }} />

      {/* A4 Paper — centered in viewport */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: PAPER_W,
        height: PAPER_H,
        background: "#ffffff",
        boxShadow: "0 6px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)",
        borderRadius: 2,
        overflow: "hidden",
      }}>
        <InvoiceTemplate selPulse={selPulse} />
      </div>

      {/* Cursor dot (interaction hint near selected element) */}
      <div style={{
        position: "absolute",
        // Selected element (INVOICE label): paper center X + 442px, paper center Y + 30px
        top: `calc(50% - ${PAPER_H / 2}px + 30px)`,
        left: `calc(50% - ${PAPER_W / 2}px + 442px)`,
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: SEL,
        opacity: cursorOpacity,
        boxShadow: `0 0 0 4px ${SEL}30`,
        zIndex: 20,
        pointerEvents: "none",
      }} />
    </div>
  );
};

// ── INVOICE TEMPLATE (on the paper) ───────────────────────────────────────────
const InvoiceTemplate: React.FC<{ selPulse: number }> = ({ selPulse }) => {
  // Grid pattern on paper
  const gridPattern = `
    linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px)
  `;
  const gridSize = `${Math.round(8 * ZOOM)}px ${Math.round(8 * ZOOM)}px`;

  // Selected element: INVOICE label
  const SEL_ELEM = { t: 16, l: 360, w: 165, h: 28 };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Paper grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: gridPattern,
        backgroundSize: gridSize,
        opacity: 1,
        pointerEvents: "none",
      }} />

      {/* ── Template elements ───────────────────────────────────────────── */}

      {/* Accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, width: PAPER_W, height: 5, background: ACCENT }} />

      {/* Company name (left) */}
      <div style={{ position: "absolute", top: 18, left: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: ACCENT, letterSpacing: "-0.4px" }}>
          Acme Corp
          <span style={{ color: L.PRIMARY_ACCENT }}>.</span>
        </div>
        <div style={{ fontSize: 7, color: L.TEXT_DIM, marginTop: 2 }}>123 Business Ave, New York</div>
        <div style={{ fontSize: 7, color: L.TEXT_DIM }}>contact@acmecorp.com</div>
      </div>

      {/* INVOICE label (right) — SELECTED */}
      <div style={{
        position: "absolute",
        top: SEL_ELEM.t,
        left: SEL_ELEM.l,
        width: SEL_ELEM.w,
        height: SEL_ELEM.h,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, letterSpacing: "0.02em", lineHeight: 1 }}>
          INVOICE
        </div>
        <div style={{ fontSize: 8, color: L.TEXT_DIM, marginTop: 3 }}>#INV-2025-042</div>

        {/* Selection ring */}
        <div style={{
          position: "absolute",
          inset: -3,
          border: `1.5px dashed ${SEL}`,
          borderRadius: 2,
          opacity: selPulse,
          pointerEvents: "none",
        }} />

        {/* Resize handles (8 points) */}
        {[
          [0, 0], [50, 0], [100, 0],
          [0, 50],           [100, 50],
          [0, 100],[50, 100],[100, 100],
        ].map(([px, py], i) => (
          <Handle
            key={i}
            top={-3 + (SEL_ELEM.h + 6) * py / 100}
            left={-3 + (SEL_ELEM.w + 6) * px / 100}
          />
        ))}
      </div>

      {/* Thin horizontal separator */}
      <div style={{ position: "absolute", top: 74, left: 0, width: PAPER_W, height: 1, background: L.BORDER }} />

      {/* Bill to section */}
      <div style={{ position: "absolute", top: 88, left: 18 }}>
        <div style={{ fontSize: 6, fontWeight: 700, color: L.TEXT_MUTED, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Bill To</div>
        {["Client Company Ltd.", "John Smith", "456 Client Street"].map((line, i) => (
          <div key={i} style={{ height: 4, width: [145, 110, 100][i], background: L.BORDER_STRONG, borderRadius: 2, marginBottom: 4 }} />
        ))}
      </div>

      {/* Dates section */}
      <div style={{ position: "absolute", top: 88, left: 352, textAlign: "right" }}>
        {[["Date Issued", L.BORDER_STRONG], ["Due Date", `${ACCENT}50`]].map(([label, barColor], i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 6, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
            <div style={{ height: 5, width: 60, background: barColor as string, borderRadius: 2, marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      {/* Line items table */}
      {/* Table header */}
      <div style={{
        position: "absolute", top: 185, left: 14, width: PAPER_W - 28, height: 26,
        background: ACCENT_LIGHT, borderRadius: "4px 4px 0 0",
        display: "flex", alignItems: "center", padding: "0 10px",
        justifyContent: "space-between",
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
          display: "flex", alignItems: "center", padding: "0 10px",
          justifyContent: "space-between",
        }}>
          {[40, 12, 15, 15].map((wPct, j) => (
            <div key={j} style={{ height: 4, width: `${wPct}%`, background: L.BORDER_STRONG, borderRadius: 2 }} />
          ))}
        </div>
      ))}

      {/* Subtotal / separator */}
      <div style={{ position: "absolute", top: 263, left: 14, width: PAPER_W - 28, height: 1, background: L.BORDER_STRONG }} />

      {/* Total box */}
      <div style={{
        position: "absolute", top: 278, left: 356,
        width: 170, height: 34,
        background: ACCENT, borderRadius: 5,
        display: "flex", alignItems: "center", padding: "0 12px",
        justifyContent: "space-between",
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
    </div>
  );
};

// ── RIGHT PROPERTIES PANEL ────────────────────────────────────────────────────
const PropertiesPanel: React.FC = () => (
  <div style={{
    width: RIGHT_W,
    height: "100%",
    background: L.BG,
    borderLeft: `1px solid ${L.BORDER}`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  }}>
    {/* Tabs */}
    <AnimIn delay={8}>
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${L.BORDER}`,
        padding: "0 6px",
        flexShrink: 0,
        height: 38,
        alignItems: "flex-end",
      }}>
        {["Element", "Page", "Compliance", "History"].map((tab, i) => (
          <div key={tab} style={{
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? L.PRIMARY : L.TEXT_MUTED,
            borderBottom: i === 0 ? `2px solid ${L.PRIMARY}` : "2px solid transparent",
          }}>
            {tab}
          </div>
        ))}
      </div>
    </AnimIn>

    {/* Content */}
    <div style={{ flex: 1, padding: "14px 16px", overflowY: "hidden", display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Selected element badge */}
      <AnimIn delay={14}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px",
          background: "#eff6ff",
          border: `1px solid #bfdbfe`,
          borderRadius: 6,
        }}>
          <TypeIcon size={13} color={SEL} strokeWidth={1.8} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8" }}>INVOICE — Text</span>
        </div>
      </AnimIn>

      {/* Position & Size */}
      <AnimIn delay={18}>
        <PropSection label="Position & Size">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["X", "360"], ["Y", "16"], ["W", "165"], ["H", "28"]].map(([label, val]) => (
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
          {/* Font family */}
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
          {/* Size + Weight */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[["Size", "24"], ["Weight", "800"]].map(([label, val]) => (
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
          {/* Color */}
          <div>
            <div style={{ fontSize: 9.5, color: L.TEXT_DIM, marginBottom: 3 }}>Color</div>
            <div style={{
              border: `1px solid ${L.BORDER}`, borderRadius: 5,
              padding: "5px 8px", fontSize: 11.5, color: L.TEXT,
              background: L.BG, display: "flex", alignItems: "center", gap: 7,
            }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: ACCENT, flexShrink: 0 }} />
              {ACCENT}
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

      {/* Compliance indicator */}
      <AnimIn delay={36}>
        <div style={{
          padding: "9px 11px",
          background: L.PRIMARY_BG,
          border: `1px solid ${L.PRIMARY_BORDER}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: L.PRIMARY_ACCENT, flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, color: L.PRIMARY, fontWeight: 500 }}>EU compliance — All required fields present</span>
        </div>
      </AnimIn>
    </div>
  </div>
);

// ── Properties section wrapper ─────────────────────────────────────────────────
const PropSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{
      fontSize: 9.5,
      fontWeight: 700,
      color: L.TEXT_DIM,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      marginBottom: 9,
      paddingBottom: 6,
      borderBottom: `1px solid ${L.BORDER}`,
    }}>
      {label}
    </div>
    {children}
  </div>
);
