import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { usePaywall } from "@/contexts/paywall-context";
import type { FeatureKey } from "@/lib/billing/feature-registry";

interface PaywallGateProps {
  /** The feature key to check. Declared in lib/billing/feature-registry.ts */
  feature: FeatureKey;
  children: ReactNode;
  /**
   * Optional custom element to render when access is denied.
   * If omitted, children are shown with a dimmed locked overlay.
   */
  fallback?: ReactNode;
}

/**
 * Declarative wrapper that gates UI elements behind billing access.
 *
 * When access is denied and no fallback is provided, children are rendered
 * in a dimmed, non-interactive state with a lock badge. Clicking the wrapper
 * opens the paywall modal for the given feature.
 *
 * @example
 * <PaywallGate feature="invoice_create">
 *   <Button onClick={onCreate}>New Invoice</Button>
 * </PaywallGate>
 */
export function PaywallGate({ feature, children, fallback }: PaywallGateProps) {
  const { canAccess } = useBilling();
  const { openPaywall } = usePaywall();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={() => openPaywall(feature)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openPaywall(feature);
      }}
      aria-label="Upgrade to unlock this feature"
    >
      {/* Dimmed children */}
      <div className="pointer-events-none opacity-50">{children}</div>

      {/* Lock badge */}
      <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted ring-1 ring-border">
        <Lock className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}
