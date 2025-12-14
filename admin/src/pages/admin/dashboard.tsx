import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, TrendingUp, AlertCircle, Activity, RefreshCw } from "lucide-react";
import { useAdminDashboardStats } from "@/hooks/admin/use-admin-dashboard-stats";
import { useState } from "react";

export function AdminDashboardPage() {
  const { data: stats, isLoading, refetch } = useAdminDashboardStats();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total Organizations",
      value: stats?.totalOrganizations ?? 0,
      icon: Building2,
      description: "All organizations",
    },
    {
      title: "Active Subscriptions",
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      description: "Currently active",
    },
    {
      title: "New Orgs Today",
      value: stats?.newOrgsToday ?? 0,
      icon: TrendingUp,
      description: "Created today",
    },
    {
      title: "Total MRR",
      value: `$${stats?.totalMRR.toLocaleString() ?? 0}`,
      icon: CreditCard,
      description: "Monthly recurring revenue",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Platform overview and system health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Summary</CardTitle>
          <CardDescription>Platform-wide usage metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">{stats?.totalUsage.invoices ?? 0}</div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalUsage.templates ?? 0}</div>
              <p className="text-sm text-muted-foreground">Total Templates</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalUsage.storageMB ?? 0} MB</div>
              <p className="text-sm text-muted-foreground">Total Storage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Current system status and alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold text-destructive">
                {stats?.systemHealth.errorCount ?? 0}
              </div>
              <p className="text-sm text-muted-foreground">Errors (24h)</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">
                {stats?.systemHealth.failedWorkflows ?? 0}
              </div>
              <p className="text-sm text-muted-foreground">Failed Workflows</p>
            </div>
            <div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {stats?.systemHealth.activeAlerts ?? 0}
                {stats && stats.systemHealth.activeAlerts > 0 && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">Active Alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

