import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, CreditCard, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { Link } from "react-router-dom";

export function AdminBillingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: organizations, isLoading, error } = useAdminOrganizations();

  // Filter organizations by search query
  const filteredOrganizations = useMemo(() => {
    if (!organizations || !searchQuery) {
      return organizations || [];
    }

    const searchLower = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name?.toLowerCase().includes(searchLower) ||
        org.id.toLowerCase().includes(searchLower)
    );
  }, [organizations, searchQuery]);

  // Calculate billing stats
  const stats = useMemo(() => {
    if (!organizations) {
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        trialing: 0,
        pastDue: 0,
        totalMRR: 0,
      };
    }

    const withSubscriptions = organizations.filter(
      (org) => org.subscription && org.subscription.status !== "cancelled"
    );

    // Calculate MRR (simplified - would need actual pricing data)
    const mrr = withSubscriptions.length * 50; // Placeholder calculation

    return {
      totalSubscriptions: withSubscriptions.length,
      activeSubscriptions: organizations.filter(
        (org) => org.subscription?.status === "active"
      ).length,
      trialing: organizations.filter((org) => org.subscription?.status === "trialing").length,
      pastDue: organizations.filter((org) => org.subscription?.status === "past_due").length,
      totalMRR: mrr,
    };
  }, [organizations]);

  const getSubscriptionBadgeVariant = (status?: string) => {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "past_due":
        return "destructive";
      case "cancelled":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPlanBadgeVariant = (plan?: string) => {
    switch (plan) {
      case "enterprise":
        return "default";
      case "professional":
        return "secondary";
      case "starter":
        return "outline";
      default:
        return "outline";
    }
  };

  if (error) {
    console.error(error);
  }

  // Filter organizations with subscriptions
  const orgsWithSubscriptions = useMemo(() => {
    return (filteredOrganizations || []).filter(
      (org) => org.subscription && org.subscription.status !== "cancelled"
    );
  }, [filteredOrganizations]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground">Manage subscriptions and billing</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trialing</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.pastDue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalMRR.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>
            {orgsWithSubscriptions.length} active subscription
            {orgsWithSubscriptions.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgsWithSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No active subscriptions found
                    </TableCell>
                  </TableRow>
                ) : (
                  orgsWithSubscriptions.map((org) => {
                    const subscription = org.subscription;
                    const periodStart = subscription?.currentPeriodStart
                      ? new Date(subscription.currentPeriodStart)
                      : null;
                    const periodEnd = subscription?.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd)
                      : null;

                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name || "Unnamed Organization"}</div>
                            <div className="text-sm text-muted-foreground">{org.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPlanBadgeVariant(subscription?.plan)}>
                            {subscription?.plan || "free"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSubscriptionBadgeVariant(subscription?.status)}>
                            {subscription?.status || "none"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {periodStart && periodEnd ? (
                            <div className="text-sm">
                              <div>{periodStart.toLocaleDateString()}</div>
                              <div className="text-muted-foreground">
                                to {periodEnd.toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/organizations/${org.id}`}>View</Link>
                            </Button>
                            <Button variant="outline" size="sm" disabled>
                              Manage
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stripe Integration Note */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Integration</CardTitle>
          <CardDescription>Manage subscriptions through Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              Stripe integration for subscription management will be available in a future update.
              This will include:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Direct Stripe dashboard links</li>
              <li>Subscription modification tools</li>
              <li>Payment method management</li>
              <li>Invoice generation and tracking</li>
              <li>Usage-based billing controls</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

