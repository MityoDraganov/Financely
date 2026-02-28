import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FileText,
  DollarSign,
  Brush,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  AppShell,
  L,
  MetricCard,
  StatusPill,
  StatusBar,
  PageHeader,
  PrimaryButton,
  OutlineButton,
  ShadCard,
} from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

const RECENT_INVOICES = [
  { id: "INV-2401", client: "Acme Corp",     amount: "€4,200", status: "paid"  as const, date: "Feb 24" },
  { id: "INV-2400", client: "Horizon Labs",  amount: "€1,850", status: "sent"  as const, date: "Feb 23" },
  { id: "INV-2399", client: "CloudBase",     amount: "€7,500", status: "paid"  as const, date: "Feb 21" },
  { id: "INV-2398", client: "Nexus Digital", amount: "€920",   status: "draft" as const, date: "Feb 20" },
  { id: "INV-2397", client: "Streamline Co", amount: "€3,100", status: "sent"  as const, date: "Feb 19" },
];

const TEMPLATES = [
  { name: "Modern Pro",    desc: "Default invoice template",   status: "active" as const },
  { name: "Clean Minimal", desc: "Minimalist design",          status: "active" as const },
  { name: "Bold Studio",   desc: "Creative agency style",      status: "active" as const },
];

const AnimIn: React.FC<{ delay: number; axis?: "y" | "x"; children: React.ReactNode }> = ({
  delay, axis = "y", children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 28 });
  const t = interpolate(e, [0, 1], [24, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  return (
    <div style={{
      transform: axis === "y" ? `translateY(${t}px)` : `translateX(${t}px)`,
      opacity: o,
    }}>
      {children}
    </div>
  );
};

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        background: L.BG,
        fontFamily: "'Inter', sans-serif",
        opacity,
        transform: `translateX(${tx}px)`,
      }}
    >
      <AppShell activeItem="Dashboard">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>

          {/* Header row */}
          <AnimIn delay={5}>
            <PageHeader title="Welcome back, Acme 👋" subtitle="Here's what's happening with your business">
              <div style={{ display: "flex", gap: 8 }}>
                <OutlineButton><Brush size={13} />Design template</OutlineButton>
                <PrimaryButton><Plus size={13} />Create invoice</PrimaryButton>
              </div>
            </PageHeader>
          </AnimIn>

          {/* Metric cards */}
          <AnimIn delay={12}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <MetricCard title="Total Invoices"  value={24}       description="4 paid · 3 unpaid"      Icon={FileText}    />
              <MetricCard title="Paid Revenue"    value="€48,230"  description="18 paid invoices"       Icon={DollarSign}  />
              <MetricCard title="Outstanding"     value="€8,400"   description="3 unpaid invoices"      Icon={DollarSign}  />
              <MetricCard title="Templates"       value={12}       description="Ready to use"           Icon={Brush}       />
            </div>
          </AnimIn>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>
            {/* Recent Invoices card */}
            <AnimIn delay={20}>
              <ShadCard style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* Card header */}
                <div style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${L.BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: L.TEXT }}>Recent Invoices</div>
                    <div style={{ fontSize: 12, color: L.TEXT_MUTED }}>Your latest billing activity</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: L.PRIMARY, fontWeight: 500 }}>
                    View all <ArrowRight size={12} />
                  </div>
                </div>

                {/* Invoice rows */}
                <div style={{ flex: 1 }}>
                  {RECENT_INVOICES.map((inv, i) => (
                    <InvoiceListRow key={inv.id} inv={inv} delay={30 + i * 7} />
                  ))}
                </div>
              </ShadCard>
            </AnimIn>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Templates card */}
              <AnimIn delay={24}>
                <ShadCard>
                  <div style={{
                    padding: "12px 16px",
                    borderBottom: `1px solid ${L.BORDER}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: L.TEXT }}>Templates</div>
                      <div style={{ fontSize: 12, color: L.TEXT_MUTED }}>Your recent designs</div>
                    </div>
                    <OutlineButton style={{ padding: "5px 12px", fontSize: 12 }}>
                      <Brush size={12} /> Design
                    </OutlineButton>
                  </div>
                  <div>
                    {TEMPLATES.map((t, i) => (
                      <TemplateRow key={t.name} tpl={t} delay={32 + i * 6} />
                    ))}
                  </div>
                </ShadCard>
              </AnimIn>

              {/* Invoice Status card */}
              <AnimIn delay={28}>
                <ShadCard>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${L.BORDER}` }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: L.TEXT }}>Invoice Status</div>
                    <div style={{ fontSize: 12, color: L.TEXT_MUTED }}>Breakdown by status</div>
                  </div>
                  <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Paid",    dot: "#10b981", count: 18, amount: "€48,230" },
                      { label: "Sent",    dot: "#3b82f6", count: 3,  amount: "€8,400" },
                      { label: "Draft",   dot: "#a1a1aa", count: 3,  amount: "—" },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: L.TEXT }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: row.dot }} />
                          {row.label}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>{row.count}</div>
                          <div style={{ fontSize: 11, color: L.TEXT_DIM }}>{row.amount}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShadCard>
              </AnimIn>
            </div>
          </div>
        </div>
      </AppShell>

      <FeatureBadge text="Live metrics. Real clarity." subtext="Everything your business needs at a glance" delay={55} />
    </AbsoluteFill>
  );
};

const InvoiceListRow: React.FC<{
  inv: { id: string; client: string; amount: string; status: "paid" | "sent" | "draft"; date: string };
  delay: number;
}> = ({ inv, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  const tx = interpolate(e, [0, 1], [-14, 0]);
  const o  = interpolate(e, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderBottom: `1px solid ${L.BORDER}`,
        transform: `translateX(${tx}px)`,
        opacity: o,
      }}
    >
      <StatusBar status={inv.status} />
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        padding: "10px 14px", gap: 0,
      }}>
        {/* Icon + invoice number */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: L.PRIMARY_BG,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <FileText size={14} color={L.PRIMARY} strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>{inv.id}</div>
            <div style={{ fontSize: 11, color: L.TEXT_MUTED }}>{inv.client}</div>
          </div>
        </div>
        <StatusPill status={inv.status} />
        <div style={{ textAlign: "right", marginLeft: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>{inv.amount}</div>
          <div style={{ fontSize: 11, color: L.TEXT_DIM }}>{inv.date}</div>
        </div>
      </div>
    </div>
  );
};

const TemplateRow: React.FC<{
  tpl: { name: string; desc: string; status: "active" };
  delay: number;
}> = ({ tpl, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 20 });
  const o = interpolate(e, [0, 1], [0, 1]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px",
      borderBottom: `1px solid ${L.BORDER}`,
      opacity: o,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 4,
        background: L.PRIMARY_BG,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Brush size={14} color={L.PRIMARY} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: L.TEXT }}>{tpl.name}</div>
        <div style={{ fontSize: 11, color: L.TEXT_MUTED }}>{tpl.desc}</div>
      </div>
      <StatusPill status={tpl.status} />
    </div>
  );
};
