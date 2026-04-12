import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useBilling } from "@/hooks/use-billing";
import { PaywallModal } from "@/components/paywall/PaywallModal";
import type { FeatureKey } from "@/lib/billing/feature-registry";

interface PaywallContextType {
  isOpen: boolean;
  activeFeature: FeatureKey | null;
  /**
   * Call before any gated action. Returns true if the org has access.
   * Returns false and opens the paywall modal if access is denied.
   *
   * @example
   * const { requireAccess } = usePaywall();
   * const handleCreate = () => {
   *   if (!requireAccess("invoice_create")) return;
   *   // proceed
   * };
   */
  requireAccess: (featureKey: FeatureKey) => boolean;
  /** Manually open the paywall for a specific feature. */
  openPaywall: (featureKey: FeatureKey) => void;
  closePaywall: () => void;
}

const PaywallContext = createContext<PaywallContextType | undefined>(undefined);

export function usePaywall(): PaywallContextType {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within <PaywallProvider>");
  return ctx;
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const { canAccess } = useBilling();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);

  const openPaywall = useCallback((featureKey: FeatureKey) => {
    setActiveFeature(featureKey);
    setIsOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsOpen(false);
    // Radix Dialog keeps content mounted during its exit animation.
    // Clear the feature key after the transition so the modal content
    // doesn't flash to the fallback while closing.
    setTimeout(() => setActiveFeature(null), 200);
  }, []);

  const requireAccess = useCallback(
    (featureKey: FeatureKey): boolean => {
      if (canAccess(featureKey)) return true;
      openPaywall(featureKey);
      return false;
    },
    [canAccess, openPaywall],
  );

  return (
    <PaywallContext.Provider value={{ isOpen, activeFeature, requireAccess, openPaywall, closePaywall }}>
      {children}
      <PaywallModal isOpen={isOpen} featureKey={activeFeature} onClose={closePaywall} />
    </PaywallContext.Provider>
  );
}
