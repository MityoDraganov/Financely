/**
 * UIWindow.tsx — Light-theme design system
 * Mirrors the real Financely app (white/slate palette, shadcn-style cards)
 */
import React from "react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Brush,
  Users,
  Sparkles,
  Zap,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";

// ── Design tokens (light theme) ──────────────────────────────────────────────
export const L = {
  BG: "#ffffff",
  BG_SUBTLE: "#f8fafc",   // sidebar
  BG_MUTED: "#f1f5f9",    // canvas, table header rows
  CARD: "#ffffff",
  BORDER: "#e2e8f0",
  BORDER_STRONG: "#cbd5e1",

  TEXT: "#0f172a",
  TEXT_MUTED: "#64748b",
  TEXT_DIM: "#94a3b8",

  PRIMARY: "#166534",         // brand green (dark)
  PRIMARY_ACCENT: "#22c55e",  // brand green (bright)
  PRIMARY_BG: "#f0fdf4",      // green-50
  PRIMARY_BORDER: "#bbf7d0",  // green-200

  // Status pill tokens (matching real app STATUS_CFG)
  STATUS: {
    paid:      { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981", bar: "#10b981" },
    sent:      { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6", bar: "#3b82f6" },
    draft:     { bg: "#f4f4f5", text: "#52525b", border: "#d4d4d8", dot: "#a1a1aa", bar: "#a1a1aa" },
    cancelled: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#ef4444", bar: "#ef4444" },
    active:    { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", dot: "#10b981", bar: "#10b981" },
    customer:  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6", bar: "#3b82f6" },
    lead:      { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe", dot: "#8b5cf6", bar: "#8b5cf6" },
    prospect:  { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", bar: "#f59e0b" },
    inactive:  { bg: "#f4f4f5", text: "#52525b", border: "#d4d4d8", dot: "#a1a1aa", bar: "#a1a1aa" },
  },
} as const;

type StatusKey = keyof typeof L.STATUS;

// ── StatusPill — matches real app inline-flex pill ───────────────────────────
export const StatusPill: React.FC<{ status: StatusKey }> = ({ status }) => {
  const c = L.STATUS[status] ?? L.STATUS.draft;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 9999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        fontSize: 11,
        fontWeight: 500,
        color: c.text,
        lineHeight: 1,
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
};

// ── StatusAccentBar — 3px left border on table rows ──────────────────────────
export const StatusBar: React.FC<{ status: StatusKey }> = ({ status }) => {
  const c = L.STATUS[status] ?? L.STATUS.draft;
  return (
    <div
      style={{ width: 3, alignSelf: "stretch", background: c.bar, flexShrink: 0 }}
    />
  );
};

// ── Sidebar navigation ───────────────────────────────────────────────────────
const NAV_ITEMS: { label: string; Icon: LucideIcon }[] = [
  { label: "Dashboard",  Icon: LayoutDashboard },
  { label: "Invoices",   Icon: FileText },
  { label: "Templates",  Icon: FolderOpen },
  { label: "Designer",   Icon: Brush },
  { label: "Contacts",   Icon: Users },
  { label: "Site Builder", Icon: Sparkles },
  { label: "Workflows",  Icon: Zap },
  { label: "Products",   Icon: Package },
  { label: "Settings",   Icon: Settings },
];

export const SidebarNav: React.FC<{ activeItem: string }> = ({ activeItem }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
    {NAV_ITEMS.map(({ label, Icon }) => {
      const active = label === activeItem;
      return (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px 12px",
            borderRadius: 6,
            background: active ? L.PRIMARY_BG : "transparent",
            color: active ? L.PRIMARY : L.TEXT_MUTED,
            fontSize: 13,
            fontWeight: active ? 600 : 400,
            fontFamily: "inherit",
          }}
        >
          <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
          {label}
        </div>
      );
    })}
  </div>
);

// ── App shell (sidebar + main) ────────────────────────────────────────────────
export const AppShell: React.FC<{
  children: React.ReactNode;
  activeItem: string;
}> = ({ children, activeItem }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      background: L.BG,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}
  >
    {/* Sidebar */}
    <div
      style={{
        width: 220,
        background: L.BG_SUBTLE,
        borderRight: `1px solid ${L.BORDER}`,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        padding: "0 0 16px",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 18px",
          borderBottom: `1px solid ${L.BORDER}`,
          marginBottom: 10,
        }}
      >
        <FinancelyWordmark size={22} />
      </div>
      <SidebarNav activeItem={activeItem} />
    </div>

    {/* Main */}
    <div style={{ flex: 1, overflow: "hidden", background: L.BG }}>
      {children}
    </div>
  </div>
);

// ── Financely wordmark ────────────────────────────────────────────────────────
export const FinancelyWordmark: React.FC<{ size?: number; dark?: boolean }> = ({
  size = 22,
  dark = false,
}) => (
  <span
    style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: size,
      fontWeight: 900,
      color: dark ? "#ffffff" : L.PRIMARY,
      letterSpacing: "-1px",
      lineHeight: 1,
    }}
  >
    Financely
    <span style={{ color: L.PRIMARY_ACCENT }}>.</span>
  </span>
);

// ── MetricCard — matches real app metric-card.tsx ────────────────────────────
export const MetricCard: React.FC<{
  title: string;
  value: string | number;
  description?: string;
  Icon: LucideIcon;
  style?: React.CSSProperties;
}> = ({ title, value, description, Icon, style }) => (
  <div
    style={{
      background: L.CARD,
      border: `1px solid ${L.BORDER}`,
      borderRadius: 6,
      padding: "12px 14px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      flex: 1,
      fontFamily: "inherit",
      ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <Icon size={14} color={L.TEXT_MUTED} strokeWidth={1.8} />
      <span style={{ fontSize: 12, fontWeight: 500, color: L.TEXT_MUTED }}>
        {title}
      </span>
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: L.TEXT,
        letterSpacing: "-0.5px",
        marginBottom: 4,
      }}
    >
      {value}
    </div>
    {description && (
      <div style={{ fontSize: 11, color: L.TEXT_DIM }}>{description}</div>
    )}
  </div>
);

// ── PageHeader ────────────────────────────────────────────────────────────────
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
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
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 13, color: L.TEXT_MUTED }}>{subtitle}</div>
      )}
    </div>
    {children}
  </div>
);

// ── PrimaryButton ─────────────────────────────────────────────────────────────
export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: L.PRIMARY,
      color: "#ffffff",
      padding: "8px 16px",
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "inherit",
      ...style,
    }}
  >
    {children}
  </div>
);

// ── OutlineButton ─────────────────────────────────────────────────────────────
export const OutlineButton: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: L.BG,
      color: L.TEXT,
      padding: "7px 14px",
      border: `1px solid ${L.BORDER}`,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 500,
      fontFamily: "inherit",
      ...style,
    }}
  >
    {children}
  </div>
);

// ── SearchBar ─────────────────────────────────────────────────────────────────
export const SearchBar: React.FC<{ placeholder: string }> = ({ placeholder }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: L.BG,
      border: `1px solid ${L.BORDER}`,
      borderRadius: 6,
      padding: "7px 12px",
      fontSize: 13,
      color: L.TEXT_DIM,
      fontFamily: "inherit",
      flex: 1,
      maxWidth: 260,
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={L.TEXT_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    {placeholder}
  </div>
);

// ── Card wrapper ──────────────────────────────────────────────────────────────
export const ShadCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: L.CARD,
      border: `1px solid ${L.BORDER}`,
      borderRadius: 8,
      overflow: "hidden",
      fontFamily: "inherit",
      ...style,
    }}
  >
    {children}
  </div>
);
