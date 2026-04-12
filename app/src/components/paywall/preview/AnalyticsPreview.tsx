/**
 * Animated analytics dashboard mockup for the paywall right panel.
 * Metric cards count up, bar chart grows — looping every ~5.5s.
 */

import { useEffect, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

function AnimatedValue({
  target,
  delay = 0,
  prefix = "",
  suffix = "",
}: {
  target: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
}) {
  const count = useMotionValue(0);
  const display = useTransform(count, (v) =>
    `${prefix}${Math.round(v).toLocaleString("de-DE")}${suffix}`,
  );
  useEffect(() => {
    const ctrl = animate(count, target, { duration: 1.5, delay, ease: "easeOut" });
    return ctrl.stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return <motion.span>{display}</motion.span>;
}

// ─── bar chart data ───────────────────────────────────────────────────────────
const BARS = [
  { label: "Nov", height: 38 },
  { label: "Dec", height: 52 },
  { label: "Jan", height: 44 },
  { label: "Feb", height: 62 },
  { label: "Mar", height: 71 },
  { label: "Apr", height: 89, current: true },
];

const METRICS = [
  { label: "Revenue",     value: 28450, prefix: "€", suffix: "", color: "#3b82f6" },
  { label: "Invoices",    value: 47,    prefix: "",  suffix: "",  color: "#8b5cf6" },
  { label: "Outstanding", value: 3200,  prefix: "€", suffix: "", color: "#f59e0b" },
];

function Inner() {
  const [showBadge, setShowBadge] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowBadge(true), 3400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col w-full h-full p-6 gap-4 relative">
      {/* grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/30 font-medium">
            Overview
          </p>
          <p className="text-[15px] font-bold text-white leading-tight">
            April 2025
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-[10px] font-semibold tracking-wide text-white/30 bg-white/5 border border-white/10 rounded-md px-2.5 py-1"
        >
          LIVE
        </motion.div>
      </motion.div>

      {/* metric cards */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.1, ease: EASE_OUT_EXPO }}
            className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <p className="text-[9px] text-white/40 font-medium mb-1">{m.label}</p>
            <p className="text-[14px] font-extrabold" style={{ color: m.color }}>
              <AnimatedValue
                target={m.value}
                delay={0.3 + i * 0.1}
                prefix={m.prefix}
                suffix={m.suffix}
              />
            </p>
          </motion.div>
        ))}
      </div>

      {/* bar chart */}
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.08em]">
          Monthly revenue
        </p>
        <div className="flex-1 flex items-end gap-2 relative">
          {/* horizontal gridlines */}
          {[25, 50, 75].map((pct) => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-dashed border-white/[0.06]"
              style={{ bottom: `${pct}%` }}
            />
          ))}

          {BARS.map((bar, i) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-t-md"
                style={{
                  height: `${bar.height}%`,
                  background: bar.current
                    ? "linear-gradient(to top, #3b82f6, #60a5fa)"
                    : "rgba(255,255,255,0.12)",
                  transformOrigin: "bottom",
                  scaleY: 0,
                  maxHeight: "100%",
                  boxShadow: bar.current ? "0 0 12px #3b82f666" : "none",
                }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.55 + i * 0.08,
                  ease: EASE_OUT_EXPO,
                }}
              />
              <span className="text-[9px] text-white/30">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* trend badge */}
      <AnimatePresence>
        {showBadge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2"
          >
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
            <span className="text-[11px] font-semibold text-emerald-400">
              ↑ 34% vs last month
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AnalyticsPreview() {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCycle((c) => c + 1), 5600);
    return () => clearInterval(t);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={cycle}
        className="w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Inner />
      </motion.div>
    </AnimatePresence>
  );
}
