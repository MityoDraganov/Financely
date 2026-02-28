import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Plus, Download, Upload, Layers, TrendingUp, Calendar, Hash, Search,
} from "lucide-react";
import {
  AppShell, L, StatusPill, StatusBar, PageHeader,
  PrimaryButton, OutlineButton, SearchBar, ShadCard,
} from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

const INVOICES = [
  { id: "INV-2401", client: "Acme Corp",      date: "Feb 24, 2026", status: "paid"   as const, amount: "€4,200.00" },
  { id: "INV-2400", client: "Horizon Labs",   date: "Feb 23, 2026", status: "sent"   as const, amount: "€1,850.00" },
  { id: "INV-2399", client: "CloudBase",      date: "Feb 21, 2026", status: "paid"   as const, amount: "€7,500.00" },
  { id: "INV-2398", client: "Nexus Digital",  date: "Feb 20, 2026", status: "draft"  as const, amount: "€920.00"   },
  { id: "INV-2397", client: "Streamline Co",  date: "Feb 19, 2026", status: "sent"   as const, amount: "€3,100.00" },
  { id: "INV-2396", client: "ByteWave Labs",  date: "Feb 18, 2026", status: "paid"   as const, amount: "€6,400.00" },
];

const AnimIn: React.FC<{ delay: number; axis?: "y" | "x"; children: React.ReactNode }> = ({
  delay, axis = "y", children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 28 });
  const t = interpolate(e, [0, 1], [20, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  return (
    <div style={{ transform: axis === "y" ? `translateY(${t}px)` : `translateX(${t}px)`, opacity: o }}>
      {children}
    </div>
  );
};

export const InvoicesScene: React.FC = () => {
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
      <AppShell activeItem="Invoices">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>

          {/* Header */}
          <AnimIn delay={5}>
            <PageHeader title="Invoices" subtitle="Manage and track your invoices">
              <div style={{ display: "flex", gap: 8 }}>
                <OutlineButton><Download size={13} />Export</OutlineButton>
                <OutlineButton><Upload size={13} />Upload</OutlineButton>
                <PrimaryButton><Plus size={13} />Create invoice</PrimaryButton>
              </div>
            </PageHeader>
          </AnimIn>

          {/* Stats strip — 3 cards */}
          <AnimIn delay={12}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { Icon: Layers,     value: 24,          label: "Total invoices" },
                { Icon: TrendingUp, value: "€63,970",   label: "Total revenue"  },
                { Icon: Calendar,   value: 8,            label: "This month"    },
              ].map(({ Icon, value, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: L.CARD,
                    border: `1px solid ${L.BORDER}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: L.PRIMARY_BG,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={15} color={L.PRIMARY} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: L.TEXT, letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: L.TEXT_MUTED, marginTop: 2 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </AnimIn>

          {/* Filter bar */}
          <AnimIn delay={18}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SearchBar placeholder="Search invoices..." />
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px", border: `1px solid ${L.BORDER}`,
                borderRadius: 6, fontSize: 13, color: L.TEXT_MUTED,
                background: L.BG,
              }}>
                <Search size={13} />All statuses
              </div>
            </div>
          </AnimIn>

          {/* Table */}
          <AnimIn delay={22}>
            <ShadCard style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Table header */}
              <div style={{
                display: "flex",
                padding: "10px 0",
                background: L.BG_MUTED,
                borderBottom: `1px solid ${L.BORDER}`,
                paddingLeft: 3,
              }}>
                <div style={{ width: 3 }} /> {/* accent bar spacer */}
                {[
                  { label: <>&#x23; Invoice</>,  flex: 1.2 },
                  { label: "Client",             flex: 1.5 },
                  { label: "Date",               flex: 1   },
                  { label: "Status",             flex: 1   },
                  { label: "Amount",             flex: 1   },
                ].map(({ label, flex }, i) => (
                  <div key={i} style={{
                    flex,
                    padding: "0 14px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: L.TEXT_MUTED,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {INVOICES.map((inv, i) => (
                <InvoiceTableRow key={inv.id} inv={inv} delay={30 + i * 8} />
              ))}

              {/* Footer */}
              <div style={{
                padding: "8px 16px",
                background: `${L.BG_MUTED}80`,
                borderTop: `1px solid ${L.BORDER}`,
                fontSize: 11,
                color: L.TEXT_DIM,
              }}>
                6 of 24 invoices
              </div>
            </ShadCard>
          </AnimIn>
        </div>
      </AppShell>

      <FeatureBadge text="Invoices that ship fast." subtext="Auto-fill. Templates. Sent in seconds." delay={65} />
    </AbsoluteFill>
  );
};

const InvoiceTableRow: React.FC<{
  inv: { id: string; client: string; date: string; status: "paid"|"sent"|"draft"; amount: string };
  delay: number;
}> = ({ inv, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  const tx = interpolate(e, [0, 1], [-12, 0]);
  const o  = interpolate(e, [0, 1], [0, 1]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      borderBottom: `1px solid ${L.BORDER}`,
      background: L.CARD,
      transform: `translateX(${tx}px)`,
      opacity: o,
      cursor: "pointer",
    }}>
      <StatusBar status={inv.status} />
      <div style={{ flex: 1.2, padding: "12px 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <Hash size={12} color={L.TEXT_DIM} />
        <span style={{ fontSize: 13, fontWeight: 600, color: L.TEXT }}>{inv.id.replace("INV-", "")}</span>
      </div>
      <div style={{ flex: 1.5, padding: "12px 14px", fontSize: 13, color: L.TEXT_MUTED }}>{inv.client}</div>
      <div style={{ flex: 1, padding: "12px 14px", fontSize: 12, color: L.TEXT_MUTED }}>{inv.date}</div>
      <div style={{ flex: 1, padding: "12px 14px" }}><StatusPill status={inv.status} /></div>
      <div style={{ flex: 1, padding: "12px 14px", fontSize: 13, fontWeight: 600, color: L.TEXT }}>{inv.amount}</div>
    </div>
  );
};
