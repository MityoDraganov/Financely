import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Plus, Zap } from "lucide-react";
import {
  AppShell, L, PageHeader, PrimaryButton,
} from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

// ── Node definitions ──────────────────────────────────────────────────────────
type NodeDef = {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  x: number;
  y: number;
};

const NODES: NodeDef[] = [
  { id: "trigger",   label: "Invoice Sent",    sublabel: "Trigger",     icon: "⚡", color: "#166534", x: 50,  y: 200 },
  { id: "condition", label: "Check Status",    sublabel: "Condition",   icon: "◈",  color: "#2563eb", x: 280, y: 200 },
  { id: "action",    label: "Send Reminder",   sublabel: "Email Action",icon: "✉",  color: "#d97706", x: 510, y: 130 },
  { id: "notify",    label: "Slack Alert",     sublabel: "Notification",icon: "🔔", color: "#7c3aed", x: 510, y: 270 },
  { id: "done",      label: "Mark Resolved",   sublabel: "Update",      icon: "✓",  color: "#166534", x: 760, y: 200 },
];

type EdgeDef = { from: string; to: string; label?: string };
const EDGES: EdgeDef[] = [
  { from: "trigger",   to: "condition" },
  { from: "condition", to: "action",  label: "overdue" },
  { from: "condition", to: "notify",  label: "urgent" },
  { from: "action",    to: "done" },
  { from: "notify",    to: "done" },
];

const getCenter = (id: string) => {
  const n = NODES.find((x) => x.id === id);
  return n ? { x: n.x + 90, y: n.y + 28 } : { x: 0, y: 0 };
};

const AnimIn: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 28 });
  const t = interpolate(e, [0, 1], [20, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  return <div style={{ transform: `translateY(${t}px)`, opacity: o }}>{children}</div>;
};

export const WorkflowsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{ background: L.BG, fontFamily: "'Inter', sans-serif", opacity, transform: `translateX(${tx}px)` }}
    >
      <AppShell activeItem="Workflows">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>

          {/* Header */}
          <AnimIn delay={5}>
            <PageHeader title="Workflows" subtitle="Automate your business operations">
              <div style={{ display: "flex", gap: 8 }}>
                {/* Active badge */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px",
                  border: `1px solid ${L.PRIMARY_BORDER}`,
                  borderRadius: 6, fontSize: 13, fontWeight: 600,
                  color: L.PRIMARY, background: L.PRIMARY_BG,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.PRIMARY_ACCENT }} />
                  4 Active
                </div>
                <PrimaryButton><Plus size={13} />New workflow</PrimaryButton>
              </div>
            </PageHeader>
          </AnimIn>

          {/* Canvas */}
          <AnimIn delay={18}>
            <WorkflowCanvas />
          </AnimIn>
        </div>
      </AppShell>

      <FeatureBadge text="Automate anything." subtext="Triggers, conditions, actions — no code needed" delay={60} position="bottom-right" />
    </AbsoluteFill>
  );
};

const WorkflowCanvas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - 20, fps, config: { damping: 200 }, durationInFrames: 30 });
  const o = interpolate(e, [0, 1], [0, 1]);

  return (
    <div
      style={{
        flex: 1,
        height: 600,
        background: L.BG_MUTED,
        border: `1px solid ${L.BORDER}`,
        borderRadius: 10,
        position: "relative",
        overflow: "hidden",
        opacity: o,
      }}
    >
      {/* Canvas dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, ${L.BORDER_STRONG} 1.2px, transparent 1.2px)`,
          backgroundSize: "24px 24px",
          opacity: 0.7,
        }}
      />

      {/* Workflow title badge */}
      <div style={{
        position: "absolute", top: 14, left: 14,
        background: L.CARD,
        border: `1px solid ${L.BORDER}`,
        borderRadius: 7,
        padding: "8px 14px",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <Zap size={13} color={L.PRIMARY} strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>Invoice Overdue Handler</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: L.PRIMARY_ACCENT }} />
          <span style={{ fontSize: 11, color: L.PRIMARY, fontWeight: 500 }}>Active</span>
        </div>
      </div>

      {/* SVG edges */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        {EDGES.map((edge, i) => (
          <WorkflowEdge key={i} edge={edge} delay={28 + i * 8} />
        ))}
      </svg>

      {/* Nodes */}
      {NODES.map((node, i) => (
        <WorkflowNode key={node.id} node={node} delay={22 + i * 12} />
      ))}
    </div>
  );
};

const WorkflowNode: React.FC<{ node: NodeDef; delay: number }> = ({ node, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const e = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 220 }, durationInFrames: 25 });
  const s = interpolate(e, [0, 1], [0.4, 1]);
  const o = interpolate(e, [0, 1], [0, 1]);

  // Very subtle color-tinted glow on light background
  const glowO = interpolate(
    Math.sin((frame / fps) * Math.PI * 1.4 + delay * 0.12),
    [-1, 1],
    [0.04, 0.14]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: 180,
        transform: `scale(${s})`,
        transformOrigin: "center",
        opacity: o,
      }}
    >
      <div
        style={{
          background: L.CARD,
          border: `1.5px solid ${node.color}50`,
          borderLeft: `3px solid ${node.color}`,
          borderRadius: 8,
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: `0 2px 8px rgba(0,0,0,0.08), 0 0 0 4px ${node.color}${Math.round(glowO * 255).toString(16).padStart(2, "0")}`,
        }}
      >
        {/* Icon badge */}
        <div
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: `${node.color}14`,
            border: `1px solid ${node.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, flexShrink: 0,
          }}
        >
          {node.icon}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: L.TEXT, marginBottom: 1, lineHeight: 1 }}>
            {node.label}
          </div>
          <div style={{ fontSize: 10, color: node.color, fontWeight: 600, letterSpacing: "0.02em" }}>
            {node.sublabel}
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkflowEdge: React.FC<{ edge: EdgeDef; delay: number }> = ({ edge, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 25 });
  const progress = interpolate(e, [0, 1], [0, 1]);

  const from = getCenter(edge.from);
  const to   = getCenter(edge.to);

  // Animated particle position
  const particleT = (frame / (fps * 1.6)) % 1;
  const px = from.x + (to.x - from.x) * particleT;
  const py = from.y + (to.y - from.y) * particleT;

  // Draw line only up to progress
  const lx2 = from.x + (to.x - from.x) * progress;
  const ly2 = from.y + (to.y - from.y) * progress;

  return (
    <g>
      <line
        x1={from.x} y1={from.y}
        x2={lx2} y2={ly2}
        stroke={L.BORDER_STRONG}
        strokeWidth={1.5}
        strokeDasharray="5 3"
      />
      {progress > 0.55 && (
        <circle cx={px} cy={py} r={3.5} fill={L.PRIMARY_ACCENT} opacity={0.85} />
      )}
      {edge.label && progress > 0.75 && (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 8}
          textAnchor="middle"
          fill={L.TEXT_DIM}
          fontSize={9}
          fontWeight="600"
          letterSpacing="0.05em"
        >
          {edge.label.toUpperCase()}
        </text>
      )}
    </g>
  );
};
