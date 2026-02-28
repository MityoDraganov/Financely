/**
 * IntegrationsScene — 3-phase animation of the Site Builder / Integrations page
 *
 * Phase 1 (fr 0–46):   Widget listing grid (select or create a widget)
 * Phase 2 (fr 40–96):  Widget builder open — Design tab (block palette + form preview + properties)
 * Phase 3 (fr 90–155): Share tab — embed script + iframe code snippets
 */
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import {
  Layout,
  Plus,
  Copy,
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { L, AppShell, PrimaryButton } from "../components/UIWindow";

// ── AnimIn spring helper ──────────────────────────────────────────────────────
const AnimIn: React.FC<{
  frame: number;
  fps: number;
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ frame, fps, delay = 0, children, style }) => {
  const f = Math.max(0, frame - delay);
  const progress = spring({ frame: f, fps, config: { damping: 80, stiffness: 200 } });
  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [14, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Widget listing card ────────────────────────────────────────────────────────
const WidgetCard: React.FC<{
  name: string;
  status: "published" | "draft";
  description?: string;
}> = ({ name, status, description }) => (
  <div
    style={{
      background: L.CARD,
      border: `1px solid ${L.BORDER}`,
      borderRadius: 12,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      height: 160,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      fontFamily: "inherit",
    }}
  >
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: L.BG_MUTED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Layout size={18} color={L.TEXT_MUTED} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: L.TEXT, lineHeight: 1.3 }}>
          {name}
        </div>
        {description && (
          <div style={{ fontSize: 11, color: L.TEXT_MUTED, marginTop: 3, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
    </div>
    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: status === "published" ? L.PRIMARY_ACCENT : "#f59e0b",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: L.TEXT_MUTED }}>
        {status === "published" ? "Published" : "Draft"}
      </span>
    </div>
  </div>
);

// ── Create New dashed card ─────────────────────────────────────────────────────
const CreateCard: React.FC = () => (
  <div
    style={{
      border: `2px dashed ${L.BORDER}`,
      borderRadius: 12,
      height: 160,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      background: L.BG,
      fontFamily: "inherit",
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: L.BG_MUTED,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Plus size={22} color={L.TEXT_MUTED} strokeWidth={1.8} />
    </div>
    <span style={{ fontSize: 14, fontWeight: 600, color: L.TEXT_MUTED }}>Create New</span>
  </div>
);

// ── Phase 1: Widget listing ───────────────────────────────────────────────────
const WidgetListing: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div style={{ padding: "26px 32px", height: "100%", overflow: "hidden" }}>
    <AnimIn frame={frame} fps={fps} delay={0}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: L.TEXT,
              letterSpacing: "-0.4px",
              marginBottom: 3,
            }}
          >
            Site Builder
          </div>
          <div style={{ fontSize: 13, color: L.TEXT_MUTED }}>
            Create embeddable widgets and forms for your website
          </div>
        </div>
        <PrimaryButton>
          <Plus size={14} />
          Create Widget
        </PrimaryButton>
      </div>
    </AnimIn>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
      }}
    >
      <AnimIn frame={frame} fps={fps} delay={4}>
        <CreateCard />
      </AnimIn>
      <AnimIn frame={frame} fps={fps} delay={8}>
        <WidgetCard
          name="Contact Form"
          status="published"
          description="Capture leads and messages"
        />
      </AnimIn>
      <AnimIn frame={frame} fps={fps} delay={12}>
        <WidgetCard
          name="Invoice Request"
          status="draft"
          description="Let clients request invoices"
        />
      </AnimIn>
      <AnimIn frame={frame} fps={fps} delay={16}>
        <WidgetCard
          name="Quote Request"
          status="published"
          description="Accept quote inquiries"
        />
      </AnimIn>
      <AnimIn frame={frame} fps={fps} delay={20}>
        <WidgetCard
          name="Newsletter Signup"
          status="published"
          description="Grow your subscriber list"
        />
      </AnimIn>
    </div>
  </div>
);

// ── Widget builder nav bar ────────────────────────────────────────────────────
const WidgetNavBar: React.FC<{ activeTab: "design" | "share" }> = ({ activeTab }) => {
  const TABS = [
    { id: "design", label: "Design" },
    { id: "share", label: "Share" },
    { id: "pageBuilder", label: "Page Builder" },
    { id: "automations", label: "Automations" },
  ] as const;

  return (
    <div
      style={{
        height: 50,
        borderBottom: `1px solid ${L.BORDER}`,
        background: L.BG,
        display: "flex",
        alignItems: "center",
        paddingLeft: 16,
        flexShrink: 0,
      }}
    >
      {/* Back + widget name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingRight: 20,
          borderRight: `1px solid ${L.BORDER}`,
          marginRight: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: L.TEXT_MUTED,
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: L.TEXT, fontFamily: "inherit" }}>
          Contact Form
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#065f46",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 99,
            padding: "2px 8px",
            fontFamily: "inherit",
          }}
        >
          Published
        </div>
      </div>

      {/* Tabs */}
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            style={{
              padding: "0 16px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? L.TEXT : L.TEXT_MUTED,
              borderBottom: active ? `2px solid ${L.PRIMARY}` : "2px solid transparent",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            {tab.label}
          </div>
        );
      })}

      {/* Save button */}
      <div style={{ marginLeft: "auto", paddingRight: 16 }}>
        <PrimaryButton style={{ padding: "6px 14px", fontSize: 12 }}>
          Save Draft
        </PrimaryButton>
      </div>
    </div>
  );
};

// ── Block palette (left sidebar in builder) ───────────────────────────────────
const BlockPalette: React.FC = () => {
  const groups = [
    { label: "Layout", items: ["Section header", "Container", "Columns", "Divider", "Spacer"] },
    { label: "Content", items: ["Paragraph"] },
    { label: "Inputs", items: ["Text", "Email", "Phone", "Textarea", "File upload", "Select", "Date"] },
    { label: "Actions", items: ["Submit button", "Success block"] },
  ];

  return (
    <div
      style={{
        width: 200,
        borderRight: `1px solid ${L.BORDER}`,
        background: L.BG_SUBTLE,
        padding: "12px 8px",
        flexShrink: 0,
        height: "100%",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: L.TEXT_DIM,
              padding: "0 8px",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => (
            <div
              key={item}
              style={{
                padding: "5px 10px",
                borderRadius: 5,
                fontSize: 12,
                color: L.TEXT,
                fontFamily: "inherit",
                marginBottom: 1,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ── Form preview (center canvas) ──────────────────────────────────────────────
const FormPreview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <AnimIn frame={frame} fps={fps} delay={2}>
    <div
      style={{
        background: L.BG,
        border: `1px solid ${L.BORDER}`,
        borderRadius: 10,
        padding: 24,
        width: 380,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)",
        fontFamily: "inherit",
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: L.TEXT,
            marginBottom: 3,
            letterSpacing: "-0.3px",
          }}
        >
          Contact Us
        </div>
        <div style={{ fontSize: 11.5, color: L.TEXT_MUTED }}>
          Fill out the form and we'll get back to you.
        </div>
      </div>

      {/* Full Name */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: L.TEXT, marginBottom: 4 }}>
          Full Name <span style={{ color: "#ef4444" }}>*</span>
        </div>
        <div
          style={{
            border: `1px solid ${L.BORDER}`,
            borderRadius: 6,
            padding: "8px 11px",
            fontSize: 12.5,
            color: L.TEXT_DIM,
            background: L.BG,
          }}
        >
          e.g. John Smith
        </div>
      </div>

      {/* Email — selected (blue outline) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: L.TEXT, marginBottom: 4 }}>
          Email <span style={{ color: "#ef4444" }}>*</span>
        </div>
        <div
          style={{
            border: `2px solid #3b82f6`,
            borderRadius: 6,
            padding: "7px 11px",
            fontSize: 12.5,
            color: "#1d4ed8",
            background: "#eff6ff",
          }}
        >
          e.g. hello@example.com
        </div>
      </div>

      {/* Message */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: L.TEXT, marginBottom: 4 }}>
          Message
        </div>
        <div
          style={{
            border: `1px solid ${L.BORDER}`,
            borderRadius: 6,
            padding: "8px 11px",
            fontSize: 12.5,
            color: L.TEXT_DIM,
            background: L.BG,
            minHeight: 52,
          }}
        >
          Your message…
        </div>
      </div>

      {/* Submit */}
      <div
        style={{
          background: L.PRIMARY,
          color: "#fff",
          borderRadius: 6,
          padding: "10px 0",
          textAlign: "center",
          fontSize: 13.5,
          fontWeight: 600,
          fontFamily: "inherit",
        }}
      >
        Send Message
      </div>
    </div>
  </AnimIn>
);

// ── Prop field + Toggle (properties panel helpers) ────────────────────────────
const PropField: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: L.TEXT_MUTED, marginBottom: 3 }}>{label}</div>
    <div
      style={{
        border: `1px solid ${L.BORDER}`,
        borderRadius: 5,
        padding: "5px 9px",
        fontSize: 11.5,
        color: mono ? L.TEXT_MUTED : L.TEXT,
        background: L.BG,
        fontFamily: mono ? "'Courier New', monospace" : "inherit",
      }}
    >
      {value}
    </div>
  </div>
);

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <div
    style={{
      width: 30,
      height: 16,
      borderRadius: 8,
      background: on ? L.PRIMARY : L.BG_MUTED,
      position: "relative",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "#fff",
        position: "absolute",
        top: 2,
        right: on ? 2 : undefined,
        left: on ? undefined : 2,
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}
    />
  </div>
);

// ── Properties panel (right sidebar in builder) ───────────────────────────────
const PropertiesPanel: React.FC = () => (
  <div
    style={{
      width: 240,
      borderLeft: `1px solid ${L.BORDER}`,
      background: L.BG,
      padding: 16,
      flexShrink: 0,
      height: "100%",
      overflow: "hidden",
      fontFamily: "inherit",
    }}
  >
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: L.TEXT_DIM,
        marginBottom: 14,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      Properties
    </div>

    {/* Selected element badge */}
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 500,
        color: "#1d4ed8",
        marginBottom: 14,
      }}
    >
      Email — Input
    </div>

    <PropField label="Label" value="Email" />
    <PropField label="Field key" value="email" mono />
    <PropField label="Placeholder" value="e.g. hello@example.com" />

    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <Toggle on />
      <span style={{ fontSize: 11.5, color: L.TEXT }}>Required</span>
    </div>

    <div style={{ height: 1, background: L.BORDER, marginBottom: 14 }} />

    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: L.TEXT_DIM,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
      }}
    >
      On Submit
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div
        style={{ width: 7, height: 7, borderRadius: "50%", background: L.PRIMARY_ACCENT }}
      />
      <span style={{ fontSize: 12, color: L.TEXT }}>Create lead in CRM</span>
    </div>
  </div>
);

// ── Phase 2: Design tab ───────────────────────────────────────────────────────
const DesignView: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <WidgetNavBar activeTab="design" />
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <BlockPalette />
      {/* Canvas */}
      <div
        style={{
          flex: 1,
          background: L.BG_MUTED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <FormPreview frame={frame} fps={fps} />
      </div>
      <PropertiesPanel />
    </div>
  </div>
);

// ── Code block for embed snippets ─────────────────────────────────────────────
const CodeBlock: React.FC<{
  label: string;
  lines: string[];
  frame: number;
  fps: number;
  delay?: number;
}> = ({ label, lines, frame, fps, delay = 0 }) => (
  <AnimIn frame={frame} fps={fps} delay={delay}>
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: L.TEXT, marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          background: "#0f172a",
          borderRadius: 8,
          padding: "14px 16px",
          position: "relative",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 12,
          lineHeight: 1.7,
          color: "#e2e8f0",
          border: "1px solid #1e293b",
        }}
      >
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {/* Copy chip */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "#1e293b",
            borderRadius: 5,
            padding: "3px 9px",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10.5,
            color: "#94a3b8",
          }}
        >
          <Copy size={10} color="#94a3b8" />
          Copy
        </div>
      </div>
    </div>
  </AnimIn>
);

// ── Phase 3: Share tab ────────────────────────────────────────────────────────
const ShareView: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <WidgetNavBar activeTab="share" />
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "32px 48px",
      }}
    >
      <div style={{ maxWidth: 700, width: "100%" }}>
        <AnimIn frame={frame} fps={fps} delay={0}>
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: L.TEXT,
                letterSpacing: "-0.3px",
                marginBottom: 4,
              }}
            >
              Embed your widget
            </div>
            <div style={{ fontSize: 13, color: L.TEXT_MUTED }}>
              Add your widget to any website using a script tag or iframe — no coding required.
            </div>
          </div>
        </AnimIn>

        <CodeBlock
          label="Script tag (recommended)"
          lines={[
            '<script',
            '  src="/widget-loader.js"',
            '  data-org-id="acme-org-abc123"',
            '  data-widget-id="contact-form-xyz"',
            '  data-app-url="https://app.financely.io">',
            '</script>',
          ]}
          frame={frame}
          fps={fps}
          delay={5}
        />

        <CodeBlock
          label="iFrame embed"
          lines={[
            '<iframe',
            '  src="https://app.financely.io/widget/contact-form-xyz"',
            '  width="100%" height="600"',
            '  frameborder="0"',
            '  style="border: none;">',
            '</iframe>',
          ]}
          frame={frame}
          fps={fps}
          delay={12}
        />

        <AnimIn frame={frame} fps={fps} delay={18}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: L.PRIMARY_BG,
              border: `1px solid ${L.PRIMARY_BORDER}`,
              borderRadius: 8,
              padding: "12px 16px",
              fontFamily: "inherit",
            }}
          >
            <CheckCircle2 size={16} color={L.PRIMARY_ACCENT} />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: L.PRIMARY, flex: 1 }}>
              Widget is live and publicly accessible
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: L.PRIMARY,
              }}
            >
              <ExternalLink size={12} />
              Preview
            </div>
          </div>
        </AnimIn>
      </div>
    </div>
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const IntegrationsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase cross-fades
  const phase1Opacity = interpolate(
    frame,
    [0, 8, 38, 46],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const phase2Opacity = interpolate(
    frame,
    [40, 50, 88, 96],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const phase3Opacity = interpolate(
    frame,
    [90, 100],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const frameP1 = frame;
  const frameP2 = Math.max(0, frame - 40);
  const frameP3 = Math.max(0, frame - 90);

  return (
    <AppShell activeItem="Site Builder">
      <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
        {phase1Opacity > 0 && (
          <div
            style={{ position: "absolute", inset: 0, opacity: phase1Opacity, zIndex: 1 }}
          >
            <WidgetListing frame={frameP1} fps={fps} />
          </div>
        )}
        {phase2Opacity > 0 && (
          <div
            style={{ position: "absolute", inset: 0, opacity: phase2Opacity, zIndex: 2 }}
          >
            <DesignView frame={frameP2} fps={fps} />
          </div>
        )}
        {phase3Opacity > 0 && (
          <div
            style={{ position: "absolute", inset: 0, opacity: phase3Opacity, zIndex: 3 }}
          >
            <ShareView frame={frameP3} fps={fps} />
          </div>
        )}
      </div>
    </AppShell>
  );
};
