/**
 * Animated workflow / automation mockup for the paywall right panel.
 * Shows a 3-step automation flow that triggers and completes — looping every ~5.5s.
 * Used for: workflows, AI features, brand sites, integrations.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const STEPS = [
  {
    icon: "⚡",
    label: "Trigger",
    title: "Invoice Created",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    delay: 0.2,
  },
  {
    icon: "✉",
    label: "Action",
    title: "Send Email",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
    delay: 0.85,
  },
  {
    icon: "✓",
    label: "Result",
    title: "CRM Updated",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.3)",
    delay: 1.5,
  },
];

function Connector({ delay }: { delay: number }) {
  return (
    <div className="flex flex-col items-center my-1">
      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay, ease: EASE_OUT_EXPO }}
        style={{ transformOrigin: "top" }}
        className="w-px h-5 bg-white/20"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, delay: delay + 0.3, type: "spring", damping: 12 }}
        className="w-1.5 h-1.5 rounded-full bg-white/20"
      />
    </div>
  );
}

function Inner() {
  const [runCount, setRunCount] = useState(0);
  const [showRuns, setShowRuns] = useState(false);

  useEffect(() => {
    // count up runs
    let n = 0;
    const interval = setInterval(() => {
      n += Math.floor(Math.random() * 4) + 1;
      if (n >= 247) {
        n = 247;
        clearInterval(interval);
        setShowRuns(true);
      }
      setRunCount(n);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-8 py-6 relative">
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        className="self-start mb-5"
      >
        <p className="text-[11px] uppercase tracking-[0.1em] text-white/30 font-medium mb-0.5">
          Workflow
        </p>
        <p className="text-[15px] font-bold text-white leading-tight">
          Invoice Follow-up
        </p>
      </motion.div>

      {/* steps */}
      <div className="w-full flex flex-col items-center">
        {STEPS.map((step, i) => (
          <div key={step.title} className="w-full flex flex-col items-center">
            {i > 0 && <Connector delay={step.delay - 0.3} />}

            <motion.div
              initial={{ opacity: 0, x: -16, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: step.delay, ease: EASE_OUT_EXPO }}
              className="w-full rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: step.bg,
                border: `1px solid ${step.border}`,
              }}
            >
              <motion.div
                animate={{
                  boxShadow: [
                    `0 0 0px ${step.color}55`,
                    `0 0 14px ${step.color}55`,
                    `0 0 0px ${step.color}55`,
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: step.delay + 0.5,
                  ease: "easeInOut",
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ background: `${step.color}22`, border: `1px solid ${step.color}44` }}
              >
                {step.icon}
              </motion.div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: step.color }}>
                  {step.label}
                </p>
                <p className="text-[13px] font-semibold text-white leading-tight">
                  {step.title}
                </p>
              </div>

              {/* run indicator on last step */}
              {i === STEPS.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: step.delay + 0.4 }}
                  className="ml-auto"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    style={{ boxShadow: "0 0 8px #22c55e88" }}
                  />
                </motion.div>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      {/* run count badge */}
      <AnimatePresence>
        {showRuns && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="mt-5 flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5"
          >
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-blue-400"
            />
            <span className="text-[11px] font-semibold text-white/50">
              {runCount.toLocaleString()} runs this month
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute bottom-4 text-[9px] font-medium tracking-[0.15em] uppercase text-white/40"
      >
        Financely · Automation
      </motion.p>
    </div>
  );
}

export function GeneralPreview() {
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
