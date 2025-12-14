import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Organization } from "@/core";
import { Calendar, AlertCircle } from "lucide-react";

interface OrganizationBillingTabProps {
  organization: Organization;
}

export function OrganizationBillingTab({ organization }: OrganizationBillingTabProps) {
  const subscription = organization.subscription;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Details</CardTitle>
          <CardDescription>Current subscription and billing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Plan</label>
              <div className="text-base font-medium mt-1">
                <Badge variant="outline" className="text-base px-3 py-1">
                  {subscription?.plan || "free"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge
                  variant={
                    subscription?.status === "active"
                      ? "default"
                      : subscription?.status === "past_due"
                      ? "destructive"
                      : subscription?.status === "trialing"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-base px-3 py-1"
                >
                  {subscription?.status || "none"}
                </Badge>
              </div>
            </div>
            {subscription?.currentPeriodStart && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Current Period Start
                </label>
                <div className="text-base mt-1">
                  {new Date(subscription.currentPeriodStart).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            )}
            {subscription?.currentPeriodEnd && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Current Period End
                </label>
                <div className="text-base mt-1">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            )}
            {subscription?.trialEnd && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Trial End
                </label>
                <div className="text-base mt-1">
                  {new Date(subscription.trialEnd).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe Customer ID - TODO: Add stripeCustomerId to Organization schema */}
      {/* {organization.stripeCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle>Stripe Integration</CardTitle>
            <CardDescription>Stripe customer information</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Customer ID</label>
              <div className="text-base font-mono mt-1">{organization.stripeCustomerId}</div>
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage subscription and billing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              View in Stripe
            </Button>
            <Button variant="outline" disabled>
              Update Plan
            </Button>
            <Button variant="outline" disabled>
              Cancel Subscription
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Stripe integration actions will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

