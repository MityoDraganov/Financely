/**
 * Animated invoice mockup for the paywall right panel.
 * Shows a stylised Financely invoice being built and paid — looping every ~5.5s.
 */

import { useEffect, useMemo, useState } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

// ─── shared easing ────────────────────────────────────────────────────────────
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ─── currency formatting ──────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", CHF: "CHF ", SEK: "kr ", NOK: "kr ",
  DKK: "kr ", PLN: "zł ", CZK: "Kč ", HUF: "Ft ", RON: "lei ",
  BGN: "лв ", HRK: "kn ", RSD: "din ", TRY: "₺", AED: "د.إ ",
  SAR: "﷼ ", QAR: "﷼ ", KWD: "د.ك ", BHD: "BD ", OMR: "﷼ ",
  JOD: "JD ", EGP: "E£ ", MAD: "MAD ", ZAR: "R ", NGN: "₦", KES: "KSh ",
  GHS: "₵", TZS: "TSh ", UGX: "USh ", INR: "₹", JPY: "¥", CNY: "¥",
  KRW: "₩", SGD: "S$", HKD: "HK$", AUD: "A$", NZD: "NZ$", CAD: "CA$",
  MXN: "MX$", BRL: "R$", ARS: "AR$", CLP: "CL$", COP: "CO$", PEN: "S/.",
  VND: "₫", THB: "฿", MYR: "RM ", IDR: "Rp ", PHP: "₱", PKR: "Rs ",
  BDT: "৳", LKR: "Rs ", NPR: "Rs ",
};

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code} `;
}

function formatAmount(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  // Currencies that conventionally show no decimals
  const noDecimals = new Set(["JPY", "KRW", "VND", "HUF", "IDR", "UGX", "TZS"]);
  const formatted = noDecimals.has(currency.toUpperCase())
    ? Math.round(amount).toLocaleString("de-DE")
    : amount.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${sym}${formatted}`;
}

// ─── types ────────────────────────────────────────────────────────────────────
export interface InvoiceItem {
  label: string;
  amount: number;
}

// ─── animated counter ─────────────────────────────────────────────────────────
function AnimatedTotal({
  target,
  delay = 0,
  currency,
}: {
  target: number;
  delay?: number;
  currency: string;
}) {
  const count = useMotionValue(0);
  const sym = currencySymbol(currency);
  const noDecimals = new Set(["JPY", "KRW", "VND", "HUF", "IDR", "UGX", "TZS"]);
  const display = useTransform(count, (v) => {
    const rounded = Math.round(v);
    return noDecimals.has(currency.toUpperCase())
      ? `${sym}${rounded.toLocaleString("de-DE")}`
      : `${sym}${rounded.toLocaleString("de-DE")}`;
  });
  useEffect(() => {
    const ctrl = animate(count, target, {
      duration: 1.6,
      delay,
      ease: "easeOut",
    });
    return ctrl.stop;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return <motion.span>{display}</motion.span>;
}

// ─── item variants ────────────────────────────────────────────────────────────
const itemVariants = {
  hidden:  { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.38, delay: i * 0.14, ease: EASE_OUT_EXPO },
  }),
};

// ─── inner (re-mounts to loop) ────────────────────────────────────────────────
interface InnerProps {
  orgName?: string;
  items: InvoiceItem[];
  currency: string;
  primaryColor: string;
}

function Inner({ orgName, items, currency, primaryColor }: InnerProps) {
  const [showPaid, setShowPaid] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowPaid(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-7 relative">
      {/* subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* floating card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
        className="relative w-full max-w-[310px] rounded-xl bg-white shadow-[0_24px_72px_rgba(0,0,0,0.55)]"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >

        <div className="px-5 py-4">
          {/* header row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex items-start justify-between mb-4"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400 font-medium mb-0.5">
                From
              </p>
              <p className="text-[13px] font-semibold text-slate-800 truncate max-w-[120px]">
                {orgName ?? "Your Business"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.1em] text-slate-400 font-medium mb-0.5">To</p>
              <p className="text-[13px] font-semibold text-slate-800 truncate max-w-[110px]">
                Acme Corp
              </p>
            </div>
          </motion.div>

          <div className="h-px bg-slate-100 mb-3" />

          {/* line items */}
          <motion.div
            initial="hidden"
            animate="visible"
            className="space-y-2 mb-3"
          >
            {items.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={itemVariants}
                className="flex items-center justify-between"
              >
                <span className="text-[11px] text-slate-500 truncate max-w-[160px]">
                  {item.label}
                </span>
                <span className="text-[11px] font-semibold text-slate-700 shrink-0 ml-2">
                  {formatAmount(item.amount, currency)}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* total */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-slate-100">
            <span className="text-[12px] font-semibold text-slate-500">
              Total
            </span>
            <span
              className="text-[19px] font-extrabold"
              style={{ color: primaryColor }}
            >
              <AnimatedTotal target={total} delay={0.9} currency={currency} />
            </span>
          </div>
        </div>

        {/* paid badge */}
        <AnimatePresence>
          {showPaid && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 11, stiffness: 260 }}
              className="absolute -top-3 -right-3"
            >
              <motion.div
                animate={{ boxShadow: ["0 0 0px #22c55e44", "0 0 18px #22c55e66", "0 0 0px #22c55e44"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700 tracking-wide">
                  PAID
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute bottom-4 text-[9px] font-medium tracking-[0.15em] uppercase text-white/40"
      >
        Financely · Invoicing
      </motion.p>
    </div>
  );
}

// ─── looping wrapper ──────────────────────────────────────────────────────────
interface InvoicePreviewProps {
  orgName?: string;
  items: InvoiceItem[];
  currency: string;
  primaryColor: string;
}

export function InvoicePreview({ orgName, items, currency, primaryColor }: InvoicePreviewProps) {
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
        <Inner
          orgName={orgName}
          items={items}
          currency={currency}
          primaryColor={primaryColor}
        />
      </motion.div>
    </AnimatePresence>
  );
}
