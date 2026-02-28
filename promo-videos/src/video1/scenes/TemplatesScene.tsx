import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Plus, FileText, Store, Download, Upload, Calendar, Mail } from "lucide-react";
import {
  AppShell, L, PrimaryButton, OutlineButton,
} from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

// ── Template data ──────────────────────────────────────────────────────────────
type TemplateData = {
  name: string;
  description: string;
  status: "published" | "draft";
  region: string | null;
  date: string;
  accentColor: string;
  accentBg: string;
};

const TEMPLATES: TemplateData[] = [
  {
    name: "Modern Pro",
    description: "Clean, professional invoice with branded header section",
    status: "published",
    region: "EU",
    date: "Jan 15",
    accentColor: "#166534",
    accentBg: "#dcfce7",
  },
  {
    name: "Clean Minimal",
    description: "Minimalist layout with high white space and subtle accents",
    status: "published",
    region: "US",
    date: "Feb 3",
    accentColor: "#1d4ed8",
    accentBg: "#dbeafe",
  },
  {
    name: "Bold Studio",
    description: "Vibrant, agency-style invoice for creative businesses",
    status: "draft",
    region: null,
    date: "Mar 10",
    accentColor: "#6d28d9",
    accentBg: "#ede9fe",
  },
  {
    name: "Corporate Classic",
    description: "Formal enterprise-ready layout for professional services",
    status: "published",
    region: "UK",
    date: "Dec 20",
    accentColor: "#0f172a",
    accentBg: "#f1f5f9",
  },
];

// ── AnimIn helper ──────────────────────────────────────────────────────────────
const AnimIn: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 28 });
  const t = interpolate(e, [0, 1], [18, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  return <div style={{ transform: `translateY(${t}px)`, opacity: o }}>{children}</div>;
};

// ── Scene ──────────────────────────────────────────────────────────────────────
export const TemplatesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{ background: L.BG, fontFamily: "'Inter', sans-serif", opacity, transform: `translateX(${tx}px)` }}
    >
      <AppShell activeItem="Templates">
        <div style={{
          padding: "26px 32px 0",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* ── Page header ─────────────────────────────────────────────────── */}
          <AnimIn delay={5}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 22,
            }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: L.TEXT, letterSpacing: "-0.4px" }}>
                  Templates
                </div>
                <div style={{ fontSize: 13, color: L.TEXT_MUTED, marginTop: 3 }}>
                  Manage your invoice and email templates
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <OutlineButton><Store size={13} />Marketplace</OutlineButton>
                <OutlineButton><Download size={13} />Export</OutlineButton>
                <OutlineButton><Mail size={13} />Email template</OutlineButton>
                <PrimaryButton><Plus size={13} />Create template</PrimaryButton>
              </div>
            </div>
          </AnimIn>

          {/* ── Section header: Invoice Templates ───────────────────────────── */}
          <AnimIn delay={12}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 14,
              borderBottom: `1px solid ${L.BORDER}`,
              marginBottom: 18,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: L.PRIMARY_BG,
                  border: `1px solid ${L.PRIMARY_BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <FileText size={18} color={L.PRIMARY} strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: L.TEXT, letterSpacing: "-0.3px" }}>
                    Invoice Templates
                  </div>
                  <div style={{ fontSize: 12, color: L.TEXT_MUTED, marginTop: 1 }}>
                    Design and manage your branded invoice layouts
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: L.TEXT_DIM }}>4 templates</div>
            </div>
          </AnimIn>

          {/* ── AI generation banner ─────────────────────────────────────────── */}
          <AnimIn delay={20}>
            <div style={{
              borderRadius: 14,
              background: `linear-gradient(135deg, ${L.PRIMARY_BG} 0%, #f7fffe 100%)`,
              border: `1px solid ${L.PRIMARY_BORDER}`,
              padding: "14px 22px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>
                  Generate from Invoice:{" "}
                </span>
                <span style={{ fontSize: 13, color: L.TEXT_MUTED }}>
                  Upload a PDF or image to create a matching template automatically.
                </span>
              </div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: L.PRIMARY,
                color: "#fff",
                padding: "9px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}>
                <Upload size={12} />
                Upload Invoice
              </div>
            </div>
          </AnimIn>

          {/* ── Template card grid ──────────────────────────────────────────── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}>
            {TEMPLATES.map((tpl, i) => (
              <TemplateCard key={tpl.name} tpl={tpl} delay={28 + i * 10} highlighted={i === 0} />
            ))}
          </div>
        </div>
      </AppShell>

      <FeatureBadge
        text="Your brand. Your templates."
        subtext="Design once, use everywhere"
        delay={60}
      />
    </AbsoluteFill>
  );
};

// ── Mini invoice document preview ─────────────────────────────────────────────
const MiniDocument: React.FC<{ accentColor: string; accentBg: string }> = ({
  accentColor,
  accentBg,
}) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: "#f0f0f0",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      paddingTop: 16,
      overflow: "hidden",
    }}
  >
    {/* Paper */}
    <div
      style={{
        width: "68%",
        background: "#ffffff",
        borderRadius: "6px 6px 0 0",
        boxShadow: "0 4px 16px rgba(0,0,0,0.13)",
        overflow: "hidden",
      }}
    >
      {/* Accent stripe at top */}
      <div style={{ height: 6, background: accentColor }} />

      {/* Document body */}
      <div style={{ padding: "10px 13px" }}>

        {/* Header row */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 9,
        }}>
          {/* Company */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: accentColor, letterSpacing: "-0.3px" }}>
              Acme Corp
            </div>
            <div style={{ fontSize: 6.5, color: L.TEXT_DIM, marginTop: 1 }}>123 Business Ave, NY</div>
          </div>
          {/* Invoice label */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: L.TEXT, letterSpacing: "0.03em" }}>
              INVOICE
            </div>
            <div style={{ fontSize: 7, color: L.TEXT_DIM, marginTop: 1 }}>#INV-2025-042</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: L.BORDER, marginBottom: 9 }} />

        {/* Bill to / dates */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{
              fontSize: 5.5,
              fontWeight: 700,
              color: L.TEXT_MUTED,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
              Bill To
            </div>
            {[65, 50, 58].map((w, i) => (
              <div key={i} style={{
                height: 4,
                width: `${w}%`,
                background: L.BORDER_STRONG,
                borderRadius: 2,
                marginBottom: 3,
              }} />
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            {[["Date", L.BORDER_STRONG], ["Due Date", `${accentColor}55`]].map(([label, barColor], i) => (
              <div key={i} style={{ marginBottom: i === 0 ? 6 : 0 }}>
                <div style={{ fontSize: 5.5, color: L.TEXT_DIM, marginBottom: 3 }}>{label}</div>
                <div style={{ height: 4, width: 52, background: barColor, borderRadius: 2, marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Items table */}
        {/* Header row */}
        <div style={{
          background: accentBg,
          borderRadius: "4px 4px 0 0",
          padding: "5px 8px",
          display: "flex",
          justifyContent: "space-between",
        }}>
          {["Description", "Qty", "Rate", "Total"].map((h) => (
            <div key={h} style={{
              fontSize: 5.5,
              fontWeight: 700,
              color: accentColor,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* Item rows */}
        {[
          ["Design Services", "1", "$2,400", "$2,400"],
          ["Monthly Retainer", "1", "$800", "$800"],
        ].map((row, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "5px 8px",
            borderBottom: `1px solid ${L.BORDER}`,
            background: i % 2 === 0 ? "#ffffff" : "#fafafa",
          }}>
            {row.map((cell, j) => (
              <div key={j} style={{
                height: 3.5,
                width: j === 0 ? "38%" : "14%",
                background: j === 0 ? L.BORDER_STRONG : L.BORDER,
                borderRadius: 1.5,
              }} />
            ))}
          </div>
        ))}

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "7px 8px 0" }}>
          <div style={{
            background: accentColor,
            borderRadius: 4,
            padding: "5px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.7)" }}>TOTAL</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#ffffff" }}>$3,200.00</div>
          </div>
        </div>

      </div>
    </div>
  </div>
);

// ── Template card ──────────────────────────────────────────────────────────────
const TemplateCard: React.FC<{
  tpl: TemplateData;
  delay: number;
  highlighted: boolean;
}> = ({ tpl, delay, highlighted }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 30 });
  const s = interpolate(e, [0, 1], [0.94, 1]);
  const t = interpolate(e, [0, 1], [16, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);

  const glowO = highlighted
    ? interpolate(Math.sin((frame / fps) * Math.PI * 1.2), [-1, 1], [0.10, 0.24])
    : 0;

  const published = tpl.status === "published";

  return (
    <div
      style={{
        transform: `scale(${s}) translateY(${t}px)`,
        opacity: o,
        borderRadius: 8,
        border: highlighted ? `1.5px solid ${L.PRIMARY_ACCENT}` : `1px solid ${L.BORDER}`,
        overflow: "hidden",
        boxShadow: highlighted
          ? `0 0 0 3px ${L.PRIMARY_BG}, 0 4px 24px rgba(34,197,94,${glowO})`
          : "0 1px 4px rgba(0,0,0,0.06)",
        background: L.CARD,
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
      }}
    >
      {/* Preview area */}
      <div style={{ height: 200, position: "relative", overflow: "hidden", flexShrink: 0 }}>
        <MiniDocument accentColor={tpl.accentColor} accentBg={tpl.accentBg} />

        {/* Selection ring indicator */}
        {highlighted && (
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: L.PRIMARY_ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#fff",
            fontWeight: 800,
            boxShadow: "0 2px 8px rgba(34,197,94,0.45)",
          }}>
            ✓
          </div>
        )}

        {/* Checkbox (top-left) */}
        <div style={{
          position: "absolute",
          top: 10,
          left: 10,
          width: 18,
          height: 18,
          borderRadius: 4,
          background: highlighted ? L.PRIMARY_ACCENT : "rgba(255,255,255,0.92)",
          border: `1.5px solid ${highlighted ? L.PRIMARY_ACCENT : L.BORDER_STRONG}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 9,
          color: "#fff",
          fontWeight: 800,
          backdropFilter: "blur(4px)",
        }}>
          {highlighted ? "✓" : ""}
        </div>

        {/* Edit / Delete hover buttons (shown on first card) */}
        {highlighted && (
          <div style={{
            position: "absolute",
            top: 10,
            right: 40,
            display: "flex",
            gap: 6,
          }}>
            {["✎", "🗑"].map((icon, i) => (
              <div key={i} style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "rgba(255,255,255,0.94)",
                border: `1px solid ${L.BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              }}>
                {icon}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card content */}
      <div style={{
        padding: "14px 16px",
        borderTop: `1px solid ${L.BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        {/* Title + description */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: L.TEXT, marginBottom: 4 }}>
            {tpl.name}
          </div>
          <div style={{ fontSize: 11.5, color: L.TEXT_MUTED, lineHeight: 1.5 }}>
            {tpl.description}
          </div>
        </div>

        {/* Badges + date row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {/* Status + region badges */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 9999,
              fontSize: 10.5,
              fontWeight: 500,
              background: published ? L.PRIMARY_BG : "#f4f4f5",
              color: published ? L.PRIMARY : "#52525b",
              border: `1px solid ${published ? L.PRIMARY_BORDER : "#d4d4d8"}`,
            }}>
              <div style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: published ? L.PRIMARY_ACCENT : "#a1a1aa",
              }} />
              {published ? "Published" : "Draft"}
            </div>

            {tpl.region && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 9999,
                fontSize: 10.5,
                fontWeight: 500,
                background: "transparent",
                color: L.TEXT_MUTED,
                border: `1px solid ${L.BORDER}`,
              }}>
                {tpl.region}
              </div>
            )}
          </div>

          {/* Date */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: L.TEXT_DIM,
          }}>
            <Calendar size={11} color={L.TEXT_DIM} strokeWidth={1.8} />
            {tpl.date}
          </div>
        </div>
      </div>
    </div>
  );
};
