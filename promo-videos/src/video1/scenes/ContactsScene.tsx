import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Plus, Download } from "lucide-react";
import {
  AppShell, L, StatusPill, PageHeader,
  PrimaryButton, OutlineButton, SearchBar, ShadCard,
} from "../components/UIWindow";
import { FeatureBadge } from "../components/FeatureBadge";

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  SM: { bg: "#ede9fe", text: "#5b21b6" },
  JF: { bg: "#fef3c7", text: "#92400e" },
  PD: { bg: "#dbeafe", text: "#1d4ed8" },
  LB: { bg: "#fce7f3", text: "#9d174d" },
  EC: { bg: "#d1fae5", text: "#065f46" },
};

type ContactStatus = "active" | "lead" | "customer" | "prospect" | "inactive";

const CONTACTS: Array<{
  avatar: string; name: string; company: string;
  email: string; phone: string; status: ContactStatus;
}> = [
  { avatar: "SM", name: "Sarah Mitchell",     company: "Acme Corp",      email: "sarah@acme.co",      phone: "+1 555 100 2001", status: "active"   },
  { avatar: "JF", name: "James Fowler",       company: "Horizon Labs",   email: "j.fowler@horizon.io", phone: "+1 555 200 3002", status: "lead"     },
  { avatar: "PD", name: "Priya Desai",        company: "CloudBase",      email: "priya@cloudbase.dev", phone: "+1 555 300 4003", status: "customer" },
  { avatar: "LB", name: "Lucas Bauer",        company: "Nexus Digital",  email: "l.bauer@nexus.de",    phone: "+49 30 000 0001", status: "prospect" },
  { avatar: "EC", name: "Emma Christodoulou", company: "Streamline Co",  email: "emma@streamline.eu",  phone: "+44 20 000 0001", status: "active"   },
];

const STATUS_FILTER_OPTS: Array<{ label: string; value: string; color?: string }> = [
  { label: "All",       value: "all" },
  { label: "Lead",      value: "lead",     color: "#8b5cf6" },
  { label: "Prospect",  value: "prospect", color: "#f59e0b" },
  { label: "Customer",  value: "customer", color: "#3b82f6" },
  { label: "Active",    value: "active",   color: "#10b981" },
  { label: "Inactive",  value: "inactive", color: "#a1a1aa" },
];

const AnimIn: React.FC<{ delay: number; axis?: "y" | "x"; children: React.ReactNode }> = ({ delay, axis = "y", children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 26 });
  const t = interpolate(e, [0, 1], [20, 0]);
  const o = interpolate(e, [0, 1], [0, 1]);
  return <div style={{ transform: axis === "y" ? `translateY(${t}px)` : `translateX(${t}px)`, opacity: o }}>{children}</div>;
};

export const ContactsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiE = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 35 });
  const opacity = interpolate(uiE, [0, 1], [0, 1]);
  const tx = interpolate(uiE, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{ background: L.BG, fontFamily: "'Inter', sans-serif", opacity, transform: `translateX(${tx}px)` }}
    >
      <AppShell activeItem="Contacts">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

          {/* Header */}
          <AnimIn delay={5}>
            <PageHeader title="Contacts" subtitle="Manage your clients and leads">
              <div style={{ display: "flex", gap: 8 }}>
                <OutlineButton><Download size={13} />Export</OutlineButton>
                <PrimaryButton><Plus size={13} />Add contact</PrimaryButton>
              </div>
            </PageHeader>
          </AnimIn>

          {/* Search + count */}
          <AnimIn delay={12}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SearchBar placeholder="Search contacts..." />
              <span style={{ fontSize: 12, color: L.TEXT_DIM, marginLeft: "auto" }}>
                {CONTACTS.length} contacts
              </span>
            </div>
          </AnimIn>

          {/* Status filter chips */}
          <AnimIn delay={16}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {STATUS_FILTER_OPTS.map((opt, i) => (
                <div
                  key={opt.value}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: i === 0 ? 600 : 500,
                    border: `1px solid ${i === 0 ? L.TEXT : opt.color ? `${opt.color}50` : L.BORDER}`,
                    background: i === 0 ? L.TEXT : opt.color ? `${opt.color}10` : "transparent",
                    color: i === 0 ? L.BG : opt.color ?? L.TEXT_MUTED,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </AnimIn>

          {/* Contacts table card */}
          <AnimIn delay={20}>
            <ShadCard>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 2fr 1.2fr",
                padding: "10px 16px",
                background: `${L.BG_MUTED}80`,
                borderBottom: `1px solid ${L.BORDER}`,
              }}>
                {["Contact", "Email", "Phone", "Status"].map((h) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 500, color: L.TEXT_MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {CONTACTS.map((c, i) => (
                <ContactRow key={c.email} contact={c} delay={28 + i * 9} />
              ))}
            </ShadCard>
          </AnimIn>
        </div>
      </AppShell>

      <FeatureBadge text="Every contact. Every deal." subtext="Your entire client base in one place" delay={60} position="bottom-right" />
    </AbsoluteFill>
  );
};

const ContactRow: React.FC<{
  contact: { avatar: string; name: string; company: string; email: string; phone: string; status: ContactStatus };
  delay: number;
}> = ({ contact, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  const tx = interpolate(e, [0, 1], [-16, 0]);
  const o  = interpolate(e, [0, 1], [0, 1]);
  const avatarC = AVATAR_COLORS[contact.avatar] ?? { bg: "#f1f5f9", text: "#64748b" };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 2fr 2fr 1.2fr",
        padding: "12px 16px",
        borderBottom: `1px solid ${L.BORDER}`,
        transform: `translateX(${tx}px)`,
        opacity: o,
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: avatarC.bg, color: avatarC.text,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {contact.avatar}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: L.TEXT }}>{contact.name}</div>
          {contact.company && <div style={{ fontSize: 11, color: L.TEXT_MUTED }}>{contact.company}</div>}
        </div>
      </div>

      <div style={{ fontSize: 13, color: L.TEXT_MUTED }}>{contact.email}</div>
      <div style={{ fontSize: 13, color: L.TEXT_MUTED }}>{contact.phone}</div>
      <StatusPill status={contact.status} />
    </div>
  );
};
