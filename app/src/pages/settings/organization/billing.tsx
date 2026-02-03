import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  AlertCircle,
  Check,
  CreditCard,
  FileText,
  HardDrive,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUsageHistory } from "@/hooks/service-hooks/use-usage-history";
import { useUpdateBillingSettings } from "@/hooks/service-hooks/use-billing-settings";
import { useCreateCheckoutSession, useCreatePortalSession } from "@/hooks/use-stripe-checkout";
import { useStripeBilling } from "@/hooks/use-stripe-billing";

const PLAN = {
  name: "Pro Plan",
  priceId: import.meta.env.VITE_STRIPE_PRICE_ID || "price_1SrZmZKFYBp87OV7EqNtL0T0",
  price: "€5",
  period: "month",
  trialDays: 14,
  features: [
    "Unlimited invoices",
    "Custom templates",
    "Email automation",
    "Analytics dashboard",
    "Priority support",
  ],
};

export default function OrganizationBillingPage() {
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const { data: organization, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: stripeBilling, isLoading: isStripeBillingLoading } = useStripeBilling(organization?.id);
  const { data: usageHistoryData, isLoading: isUsageLoading, error: usageError } = useUsageHistory(
    organization?.id,
    { periodType: "current" }
  );
  const updateBillingSettings = useUpdateBillingSettings();
  const checkoutMutation = useCreateCheckoutSession();
  const portalMutation = useCreatePortalSession();

  const [usageAlerts, setUsageAlerts] = useState(organization?.settings?.billing?.usageAlerts ?? true);

  useEffect(() => {
    if (organization?.settings?.billing?.usageAlerts !== undefined) {
      setUsageAlerts(organization.settings.billing.usageAlerts);
    }
  }, [organization]);

  const handleSubscribe = async () => {
    if (!organization?.id) {
      toast.error(t("settings.organization.billing.noOrganization", { defaultValue: "Organization not found" }));
      return;
    }
    try {
      const result = await checkoutMutation.mutateAsync({
        orgId: organization.id,
        priceId: PLAN.priceId,
        successUrl: `${window.location.origin}/settings/organization/billing?checkout=success`,
        cancelUrl: `${window.location.origin}/settings/organization/billing`,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(t("settings.organization.billing.checkoutFailed", { defaultValue: `Checkout failed: ${message}` }));
    }
  };

  const handleManageBilling = async () => {
    if (!organization?.id) {
      toast.error(t("settings.organization.billing.noOrganization", { defaultValue: "Organization not found" }));
      return;
    }
    try {
      const result = await portalMutation.mutateAsync({
        orgId: organization.id,
        returnUrl: `${window.location.origin}/settings/organization/billing`,
      });
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(t("settings.organization.billing.portalFailed", { defaultValue: `Portal failed: ${message}` }));
    }
  };

  const formatDate = (dateString?: string) =>
    dateString ? formatDateShort(new Date(dateString)) : "N/A";

  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">
          {t("settings.organization.billing.noOrganization.title")}
        </h3>
        <p className="text-muted-foreground">
          {t("settings.organization.billing.noOrganization.description")}
        </p>
      </div>
    );
  }

  // Prefer Stripe for billing info (period, renewal, status); fall back to Firestore when not yet loaded
  const billing = stripeBilling ?? organization.billing;
  const isActive = billing?.status === "active" || billing?.status === "trialing";
  const isPastDue = billing?.status === "past_due";
  const hasActiveSubscription =
    stripeBilling != null
      ? stripeBilling.status === "active" || stripeBilling.status === "trialing"
      : (organization.billing?.status === "active" || organization.billing?.status === "trialing");
  const usage = organization.usage;
  const currentPeriod = usageHistoryData?.periods?.[0];
  const storageGB = (usage.storageBytes / (1024 * 1024 * 1024)).toFixed(2);
  const isStripeLoading = checkoutMutation.isPending || portalMutation.isPending;
  const isBillingLoading = isStripeBillingLoading && organization?.id != null;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("settings.organization.billing.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("settings.organization.billing.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        {t("settings.organization.billing.subscription", { defaultValue: "Subscription" })}
                      </CardTitle>
                      <CardDescription>
                        {hasActiveSubscription
                          ? t("settings.organization.billing.subscriptionActive", { defaultValue: "Current plan and billing" })
                          : t("settings.organization.billing.subscriptionInactive", { defaultValue: "Subscribe to unlock features" })}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={isActive ? "default" : isPastDue ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {isBillingLoading
                        ? t("settings.organization.billing.loading", { defaultValue: "Loading..." })
                        : (billing?.status ?? t("settings.organization.billing.noSubscription", { defaultValue: "No subscription" }))}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isBillingLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t("settings.organization.billing.loading", { defaultValue: "Loading billing..." })}
                      </p>
                    </div>
                  ) : !hasActiveSubscription ? (
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl">{PLAN.name}</CardTitle>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-primary">{PLAN.price}</span>
                            <span className="text-sm font-normal text-muted-foreground">/{PLAN.period}</span>
                            {PLAN.trialDays > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {PLAN.trialDays}-day {t("settings.organization.billing.trial", { defaultValue: "free trial" })}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2">
                          {PLAN.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={handleSubscribe}
                          disabled={isStripeLoading}
                          className="w-full"
                          size="lg"
                        >
                          {checkoutMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("settings.organization.billing.processing", { defaultValue: "Processing..." })}
                            </>
                          ) : (
                            t("settings.organization.billing.subscribe", { defaultValue: "Subscribe" })
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {stripeBilling?.planName != null && (
                        <div className="flex items-center justify-between py-2">
                          <p className="text-sm font-medium">{stripeBilling.planName}</p>
                          {stripeBilling.planAmount != null && stripeBilling.planCurrency != null && (
                            <p className="text-sm text-muted-foreground">
                              {new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: stripeBilling.planCurrency.toUpperCase(),
                                minimumFractionDigits: 2,
                              }).format(stripeBilling.planAmount / 100)}
                              {stripeBilling.planInterval != null ? `/${stripeBilling.planInterval}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("settings.organization.billing.periodEnds", { defaultValue: "Period ends" })}
                          </p>
                          <p className="text-sm font-medium">{formatDate(billing?.currentPeriodEnd)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {t("settings.organization.billing.renewal", { defaultValue: "Renewal" })}
                          </p>
                          <p className="text-sm font-medium">
                            {billing?.cancelAtPeriodEnd
                              ? t("settings.organization.billing.cancelsAtEnd", { defaultValue: "Cancels at period end" })
                              : t("settings.organization.billing.autoRenew", { defaultValue: "Auto-renew" })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleManageBilling}
                        disabled={isStripeLoading}
                        className="w-full"
                      >
                        {portalMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("settings.organization.billing.loading", { defaultValue: "Loading..." })}
                          </>
                        ) : (
                          t("settings.organization.billing.manageBilling", { defaultValue: "Manage billing" })
                        )}
                      </Button>
                    </>
                  )}

              

                  {billing?.entitlements && Object.keys(billing.entitlements).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">
                        {t("settings.organization.billing.features", { defaultValue: "Enabled features" })}
                      </h4>
                      <ul className="space-y-2">
                        {Object.entries(billing.entitlements)
                          .filter(([, enabled]) => enabled)
                          .map(([feature]) => (
                            <li key={feature} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary shrink-0" />
                              <span className="capitalize">{feature.replace(/_/g, " ")}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.organization.billing.usage.title", { defaultValue: "Usage this period" })}</CardTitle>
                  <CardDescription>
                    {t("settings.organization.billing.usage.description", { defaultValue: "Current billing cycle" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isUsageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : usageError ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                      {t("settings.organization.billing.usageError", { defaultValue: "Failed to load usage" })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {t("settings.organization.billing.usage.invoicesCreated", { defaultValue: "Invoices" })}
                        </span>
                        <span>{currentPeriod?.invoices ?? usage.invoiceCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {t("settings.organization.billing.usage.templates", { defaultValue: "Templates" })}
                        </span>
                        <span>{currentPeriod?.templates ?? usage.templateCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {t("settings.organization.billing.usage.teamMembers", { defaultValue: "Team members" })}
                        </span>
                        <span>{currentPeriod?.members ?? organization.memberIds.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          {t("settings.organization.billing.storage", { defaultValue: "Storage" })}
                        </span>
                        <span>
                          {currentPeriod?.storageMB != null
                            ? `${(currentPeriod.storageMB / 1024).toFixed(2)} GB`
                            : `${storageGB} GB`}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.organization.billing.alerts", { defaultValue: "Usage alerts" })}</CardTitle>
                  <CardDescription>
                    {t("settings.organization.billing.alertsDescription", { defaultValue: "Email when approaching limits" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t("settings.organization.billing.emailAlerts", { defaultValue: "Email notifications" })}</Label>
                    <Switch
                      checked={usageAlerts}
                      onCheckedChange={async (checked) => {
                        setUsageAlerts(checked);
                        if (!organization?.id) return;
                        try {
                          await updateBillingSettings.mutateAsync({
                            organizationId: organization.id,
                            settings: { usageAlerts: checked },
                          });
                          toast.success(t("settings.organization.billing.settingsUpdated", { defaultValue: "Settings updated" }));
                        } catch {
                          toast.error(t("settings.organization.billing.settingsFailed", { defaultValue: "Failed to update" }));
                          setUsageAlerts(!checked);
                        }
                      }}
                      disabled={updateBillingSettings.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
    </div>
  );
}
