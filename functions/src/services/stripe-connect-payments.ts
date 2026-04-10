import Stripe from "stripe";
import {
  OrganizationPayments,
  OrganizationPaymentsStatus,
} from "../core/entities/organization";

export function getOrganizationPaymentsStatus(input?: {
  connectAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}): OrganizationPaymentsStatus {
  if (!input?.connectAccountId) {
    return "not_connected";
  }
  if (input.chargesEnabled && input.payoutsEnabled) {
    return "ready";
  }
  return "pending";
}

export function isOrganizationConnectReady(payments?: {
  connectAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}): boolean {
  return (
    !!payments?.connectAccountId &&
    payments.chargesEnabled === true &&
    payments.payoutsEnabled === true
  );
}

export function buildOrganizationPaymentsFromStripeAccount(params: {
  account: Stripe.Account;
  existing?: Partial<OrganizationPayments> | null;
  onboardingLinkCreatedAt?: string;
}): OrganizationPayments {
  const { account, existing, onboardingLinkCreatedAt } = params;
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;
  const status = getOrganizationPaymentsStatus({
    connectAccountId: account.id,
    chargesEnabled,
    payoutsEnabled,
  });

  return {
    provider: "stripe",
    connectAccountId: account.id,
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    onboardingComplete: chargesEnabled && payoutsEnabled && detailsSubmitted,
    status,
    lastOnboardingLinkCreatedAt:
      onboardingLinkCreatedAt ??
      existing?.lastOnboardingLinkCreatedAt,
    lastStatusRefreshAt: new Date().toISOString(),
  };
}
