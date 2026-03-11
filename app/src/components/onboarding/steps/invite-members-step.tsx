import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useSendInvite } from "@/hooks/use-invites";
import { ORGANIZATION_ROLES, type OrganizationRole } from "@/core/roles";

interface EmailRow {
  id: string;
  email: string;
  role: OrganizationRole;
  blurred: boolean;
}

interface InviteMembersStepProps {
  organizationId: string;
  onNext: () => void;
  onBack: () => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const createRow = (): EmailRow => ({
  id: crypto.randomUUID(),
  email: "",
  role: ORGANIZATION_ROLES.MEMBER,
  blurred: false,
});

export function InviteMembersStep({ organizationId, onNext, onBack }: InviteMembersStepProps) {
  const [rows, setRows] = useState<EmailRow[]>([createRow()]);
  const [sending, setSending] = useState(false);

  const sendInvite = useSendInvite();

  const updateRow = (id: string, patch: Partial<EmailRow>) =>
    setRows((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      // Auto-append a new row when the last row gets any content
      const last = updated[updated.length - 1];
      if (last.id === id && "email" in patch && patch.email && patch.email.length > 0 && prev[prev.length - 1].email === "") {
        return [...updated, createRow()];
      }
      return updated;
    });

  const blurRow = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, blurred: true } : r)));

  const removeRow = (id: string) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const addRow = () => setRows((prev) => [...prev, createRow()]);

  const validRows = rows.filter((r) => isValidEmail(r.email));

  const handleSendAll = async () => {
    if (validRows.length === 0) return;
    setSending(true);
    await Promise.allSettled(
      validRows.map((row) =>
        sendInvite.mutateAsync({
          email: row.email.trim(),
          role: row.role,
          organizationId,
        })
      )
    );
    setSending(false);
    onNext();
  };

  return (
    <motion.div
      className="flex flex-col flex-1 justify-center gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Optional</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Invite your team
        </h2>
        <p className="text-muted-foreground text-base max-w-md">
          Add teammates to your workspace now, or skip and do it later from settings.
        </p>
      </div>

      {/* Email rows */}
      <div className="space-y-2 max-w-lg">
        <AnimatePresence initial={false}>
        {rows.map((row, index) => {
          const valid = isValidEmail(row.email);
          // Show invalid state only after the field has been blurred (and has content)
          const showInvalid = row.blurred && !valid && row.email.length > 0;
          // Show valid state the moment the email becomes valid, regardless of blur
          const showValid = valid;
          return (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, y: -3, filter: "blur(3px)", transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
              className="flex items-center gap-2"
            >
              {/* Email input with inline validation icon */}
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={`teammate${index + 1}@company.com`}
                  value={row.email}
                  onChange={(e) => updateRow(row.id, { email: e.target.value })}
                  onBlur={() => blurRow(row.id)}
                  className={cn(
                    "rounded-xl pr-9 transition-colors",
                    showInvalid && "border-destructive focus-visible:ring-destructive/30",
                    showValid && "border-green-500 focus-visible:ring-green-500/30",
                  )}
                />
                {(showValid || showInvalid) && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {showValid ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>

              {/* Role */}
              <Select
                value={row.role}
                onValueChange={(v) => updateRow(row.id, { role: v as OrganizationRole })}
              >
                <SelectTrigger className="rounded-xl w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ORGANIZATION_ROLES.MEMBER}>Member</SelectItem>
                  <SelectItem value={ORGANIZATION_ROLES.ADMIN}>Admin</SelectItem>
                  <SelectItem value={ORGANIZATION_ROLES.VIEWER}>Viewer</SelectItem>
                </SelectContent>
              </Select>

              {/* Remove row — hidden for the first row */}
              {index > 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : (
                <div className="w-9 shrink-0" />
              )}
            </motion.div>
          );
        })}
        </AnimatePresence>

        {/* Add row */}
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pt-1 ml-0.5"
        >
          <Plus className="w-4 h-4" />
          Add another teammate
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={onBack} variant="outline" size="lg" className="rounded-xl gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {validRows.length > 0 ? (
          <Button
            onClick={handleSendAll}
            disabled={sending}
            size="lg"
            className="rounded-xl px-8 gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
            {sending
              ? "Sending…"
              : `Send ${validRows.length} invite${validRows.length !== 1 ? "s" : ""}`}
          </Button>
        ) : (
          <Button onClick={onNext} variant="outline" size="lg" className="rounded-xl px-8 gap-2">
            Skip for now
            <ArrowRight className="w-5 h-5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
