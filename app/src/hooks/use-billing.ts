import { useCallback } from "react";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { canOrgRead, canOrgWrite } from "@/core/entities/organization";
import type { BillingStatus } from "@/core/entities/organization";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/billing/feature-registry";

export interface UseBillingReturn {
  /** Raw Stripe billing status, null while org is loading */
  status: BillingStatus | null;

  // Granular status flags — match Stripe vocabulary
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isUnpaid: boolean;
  isCanceled: boolean;
  isPaused: boolean;
  isIncomplete: boolean;

  /** Read access: active | trialing | past_due */
  canRead: boolean;
  /** Write access: active | trialing */
  canWrite: boolean;

  /** Checks whether the current org can access a specific feature (uses registry tier). */
  canAccess: (featureKey: FeatureKey) => boolean;

  /** Shorthand: org has any valid subscription (canRead === true) */
  hasSubscription: boolean;

  /** True when billing needs user attention (past_due | unpaid | canceled) */
  needsAttention: boolean;

  /** Current organization ID — used for checkout/portal sessions */
  organizationId: string | null;

  /** Pass-through from org context — prevents banner flash on first load */
  isLoading: boolean;
}

export function useBilling(): UseBillingReturn {
  const { currentOrganization, isLoading } = useOrganizationContext();

  const status: BillingStatus | null =
    (currentOrganization?.billing?.status as BillingStatus) ?? null;

  const isActive    = status === "active";
  const isTrialing  = status === "trialing";
  const isPastDue   = status === "past_due";
  const isUnpaid    = status === "unpaid";
  const isCanceled  = status === "canceled";
  const isPaused    = status === "paused";
  const isIncomplete = status === "incomplete";

  const canRead  = currentOrganization ? canOrgRead(currentOrganization) : false;
  const canWrite = currentOrganization ? canOrgWrite(currentOrganization) : false;

  const canAccess = useCallback(
    (featureKey: FeatureKey): boolean => {
      if (isLoading) return true; // optimistic while loading to avoid premature locks
      if (!currentOrganization) return false;

      const definition = FEATURE_REGISTRY[featureKey];
      if (!definition) return false; // unknown key → deny

      switch (definition.tier) {
        case "write":
          return canOrgWrite(currentOrganization);
        case "read":
          return canOrgRead(currentOrganization);
        case "entitlement": {
          const key = definition.entitlementKey;
          if (!key) return false;
          return currentOrganization.billing?.entitlements?.[key] === true;
        }
        default:
          return false;
      }
    },
    [currentOrganization, isLoading],
  );

  return {
    status,
    isActive,
    isTrialing,
    isPastDue,
    isUnpaid,
    isCanceled,
    isPaused,
    isIncomplete,
    canRead,
    canWrite,
    canAccess,
    hasSubscription: canRead,
    needsAttention: isPastDue || isUnpaid || isCanceled,
    organizationId: currentOrganization?.id ?? null,
    isLoading,
  };
}
