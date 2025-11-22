import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { CreditCard, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

export default function OrganizationBillingPage() {
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const { data: organization, isLoading } = useCurrentOrganization();
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('settings.organization.billing.noOrganization.title')}</h3>
        <p className="text-gray-600">{t('settings.organization.billing.noOrganization.description')}</p>
      </div>
    );
  }

  const subscription = organization.subscription;
  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const isTrialing = subscription.status === "trialing";

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return formatDateShort(new Date(dateString));
  };

  const getPlanFeatures = (plan: string) => {
    return t(`settings.organization.billing.planFeatures.${plan}`, { returnObjects: true }) as string[] || [];
  };

  const getPlanPrice = (plan: string) => {
    const prices = {
      free: { monthly: 0, yearly: 0 },
      starter: { monthly: 29, yearly: 290 },
      professional: { monthly: 99, yearly: 990 },
      enterprise: { monthly: 299, yearly: 2990 },
    };
    return prices[plan as keyof typeof prices] || prices.free;
  };

  const currentPlanPrice = getPlanPrice(subscription.plan);
  const features = getPlanFeatures(subscription.plan);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.organization.billing.title')}</h1>
        <p className="text-gray-600 mt-1">
          {t('settings.organization.billing.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Plan */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t('settings.organization.billing.currentPlan.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('settings.organization.billing.currentPlan.description')}
                  </CardDescription>
                </div>
                <Badge 
                  variant={isActive ? "default" : "destructive"}
                  className="capitalize"
                >
                  {subscription.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold capitalize">{subscription.plan} Plan</h3>
                  <p className="text-gray-600">
                    {currentPlanPrice.monthly === 0 
                      ? t('settings.organization.billing.currentPlan.freeForever')
                      : t('settings.organization.billing.currentPlan.perMonth', { price: currentPlanPrice.monthly })
                    }
                  </p>
                </div>
                {isTrialing && (
                  <div className="text-right">
                    <p className="text-sm text-orange-600 font-medium">{t('settings.organization.billing.currentPlan.trialPeriod')}</p>
                    <p className="text-sm text-gray-600">
                      {t('settings.organization.billing.currentPlan.trialEnds', { date: formatDate(subscription.trialEnd) })}
                    </p>
                  </div>
                )}
              </div>

              {subscription.currentPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {isTrialing ? t('settings.organization.billing.currentPlan.trialEnds', { date: formatDate(subscription.currentPeriodEnd) }) : t('settings.organization.billing.currentPlan.nextBillingDate')}: {formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium">{t('settings.organization.billing.currentPlan.planFeatures')}</h4>
                <ul className="space-y-1">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                {subscription.plan !== "enterprise" && (
                  <Button 
                    onClick={() => setIsUpgrading(true)}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? t('settings.organization.billing.processing') : t('settings.organization.billing.upgradePlan')}
                  </Button>
                )}
                <Button variant="outline">
                  {t('settings.organization.billing.manageBilling')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.organization.billing.usage.title')}</CardTitle>
              <CardDescription>
                {t('settings.organization.billing.usage.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.usage.invoiceCount}
                  </div>
                  <div className="text-sm text-gray-600">{t('settings.organization.billing.usage.invoicesCreated')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? t('settings.organization.billing.usage.limit', { limit: "5" }) : t('settings.organization.billing.usage.unlimited')}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.usage.templateCount}
                  </div>
                  <div className="text-sm text-gray-600">{t('settings.organization.billing.usage.templates')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? t('settings.organization.billing.usage.limit', { limit: "3" }) : t('settings.organization.billing.usage.unlimited')}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.memberIds.length}
                  </div>
                  <div className="text-sm text-gray-600">{t('settings.organization.billing.usage.teamMembers')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? t('settings.organization.billing.usage.limit', { limit: "1" }) : 
                     subscription.plan === "starter" ? t('settings.organization.billing.usage.limit', { limit: "3" }) :
                     subscription.plan === "professional" ? t('settings.organization.billing.usage.limit', { limit: "10" }) : t('settings.organization.billing.usage.unlimited')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.organization.billing.availablePlans.title')}</CardTitle>
              <CardDescription>
                {t('settings.organization.billing.availablePlans.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {["starter", "professional", "enterprise"].map((plan) => {
                const planPrice = getPlanPrice(plan);
                const isCurrentPlan = plan === subscription.plan;
                
                return (
                  <div 
                    key={plan}
                    className={`p-4 rounded-lg border ${
                      isCurrentPlan 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold capitalize">{plan}</h4>
                      {isCurrentPlan && (
                        <Badge variant="default">{t('settings.organization.billing.availablePlans.current')}</Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold mb-2">
                      ${planPrice.monthly}
                      <span className="text-sm font-normal text-gray-600">{t('settings.organization.billing.availablePlans.perMonthLabel')}</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      variant={isCurrentPlan ? "outline" : "default"}
                      disabled={isCurrentPlan}
                    >
                      {isCurrentPlan ? t('settings.organization.billing.availablePlans.currentPlan') : t('settings.organization.billing.availablePlans.upgrade')}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.organization.billing.billingInformation.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t('settings.organization.billing.billingInformation.paymentMethod')}</span>
                <span className="font-medium">•••• •••• •••• 4242</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t('settings.organization.billing.billingInformation.billingEmail')}</span>
                <span className="font-medium">billing@example.com</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t('settings.organization.billing.billingInformation.nextInvoice')}</span>
                <span className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4">
                {t('settings.organization.billing.billingInformation.updatePaymentMethod')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
