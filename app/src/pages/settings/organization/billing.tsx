import { useState } from "react";
import { CreditCard, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

export default function OrganizationBillingPage() {
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
        <h3 className="text-lg font-medium text-gray-900 mb-2">No organization found</h3>
        <p className="text-gray-600">Please contact support if this issue persists.</p>
      </div>
    );
  }

  const subscription = organization.subscription;
  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const isTrialing = subscription.status === "trialing";

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getPlanFeatures = (plan: string) => {
    const features = {
      free: [
        "Up to 5 invoices per month",
        "Basic templates",
        "Email support",
        "Standard branding",
      ],
      starter: [
        "Up to 50 invoices per month",
        "All templates",
        "Priority support",
        "Custom branding",
        "Team collaboration (up to 3 users)",
      ],
      professional: [
        "Unlimited invoices",
        "All templates + custom templates",
        "Priority support",
        "Full white-label branding",
        "Team collaboration (up to 10 users)",
        "Advanced analytics",
        "API access",
      ],
      enterprise: [
        "Everything in Professional",
        "Unlimited team members",
        "Dedicated support",
        "Custom domain",
        "SSO/SAML integration",
        "Advanced security features",
        "Custom integrations",
      ],
    };
    return features[plan as keyof typeof features] || features.free;
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
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-1">
          Manage your subscription, billing information, and usage.
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
                    Current Plan
                  </CardTitle>
                  <CardDescription>
                    Your current subscription details
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
                      ? "Free forever" 
                      : `$${currentPlanPrice.monthly}/month`
                    }
                  </p>
                </div>
                {isTrialing && (
                  <div className="text-right">
                    <p className="text-sm text-orange-600 font-medium">Trial Period</p>
                    <p className="text-sm text-gray-600">
                      Ends {formatDate(subscription.trialEnd)}
                    </p>
                  </div>
                )}
              </div>

              {subscription.currentPeriodEnd && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {isTrialing ? "Trial ends" : "Next billing date"}: {formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium">Plan Features:</h4>
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
                    {isUpgrading ? "Processing..." : "Upgrade Plan"}
                  </Button>
                )}
                <Button variant="outline">
                  Manage Billing
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
              <CardDescription>
                Track your current usage against plan limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.usage.invoiceCount}
                  </div>
                  <div className="text-sm text-gray-600">Invoices Created</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? "5" : "Unlimited"} limit
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.usage.templateCount}
                  </div>
                  <div className="text-sm text-gray-600">Templates</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? "3" : "Unlimited"} limit
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {organization.memberIds.length}
                  </div>
                  <div className="text-sm text-gray-600">Team Members</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {subscription.plan === "free" ? "1" : 
                     subscription.plan === "starter" ? "3" :
                     subscription.plan === "professional" ? "10" : "Unlimited"} limit
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
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                Choose the plan that fits your needs
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
                        <Badge variant="default">Current</Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold mb-2">
                      ${planPrice.monthly}
                      <span className="text-sm font-normal text-gray-600">/month</span>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      variant={isCurrentPlan ? "outline" : "default"}
                      disabled={isCurrentPlan}
                    >
                      {isCurrentPlan ? "Current Plan" : "Upgrade"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium">•••• •••• •••• 4242</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Billing Email</span>
                <span className="font-medium">billing@example.com</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Next Invoice</span>
                <span className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-4">
                Update Payment Method
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
