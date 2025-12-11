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
import { Search, Building2, Users, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

export function AdminOrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: organizations, isLoading, error } = useAdminOrganizations();

  if (error) {
    console.error(error);
  }

  // Filter by search query client-side
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

  // Calculate stats
  const stats = useMemo(() => {
    if (!organizations) {
      return {
        total: 0,
        active: 0,
        withSubscriptions: 0,
      };
    }

    return {
      total: organizations.length,
      active: organizations.filter((o) => o.status === "active").length,
      withSubscriptions: organizations.filter(
        (o) => o.subscription?.status === "active"
      ).length,
    };
  }, [organizations]);

  // Fetch usage data for each org (in parallel)
  const orgIds = useMemo(() => (filteredOrganizations || []).map((o) => o.id), [filteredOrganizations]);

  const { data: usageData } = useQuery({
    queryKey: ["admin", "organizations", "usage", orgIds],
    queryFn: async () => {
      const usageMap: Record<string, { invoices: number; templates: number }> = {};

      await Promise.all(
        orgIds.map(async (orgId) => {
          const [invoices, templates] = await Promise.all([
            invoiceRepository.getAll({
              queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
              pagination: { limit: 1 },
            }),
            templateRepository.getAll({
              queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
              pagination: { limit: 1 },
            }),
          ]);

          usageMap[orgId] = {
            invoices: invoices.length,
            templates: templates.length,
          };
        })
      );

      return usageMap;
    },
    enabled: orgIds.length > 0,
    staleTime: 60 * 1000,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "suspended":
        return "destructive";
      case "deleted":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSubscriptionBadgeVariant = (status?: string) => {
    switch (status) {
      case "active":
        return "default";
      case "trialing":
        return "secondary";
      case "past_due":
        return "destructive";
      case "canceled":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all organizations on the platform
          </p>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            {stats.total} organization{stats.total !== 1 ? "s" : ""} found
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
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => {
                    const usage = usageData?.[org.id] || { invoices: 0, templates: 0 };
                    const memberCount = org.memberIds?.length || 0;
                    const createdAt = org.createdAt 
                      ? (typeof org.createdAt === 'string' 
                          ? new Date(org.createdAt)
                          : (org.createdAt && typeof org.createdAt === 'object' && 'getTime' in org.createdAt
                              ? org.createdAt as Date
                              : new Date()))
                      : new Date();

                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name || "Unnamed Organization"}</div>
                            <div className="text-sm text-muted-foreground">{org.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(org.status || "active")}>
                            {org.status || "active"}
                          </Badge>
                        </TableCell>
                      <TableCell>
                        <Badge variant={getSubscriptionBadgeVariant(org.subscription?.status)}>
                          {org.subscription?.status || "none"}
                        </Badge>
                      </TableCell>
                        <TableCell>{memberCount}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{usage.invoices} invoices</div>
                            <div className="text-muted-foreground">
                              {usage.templates} templates
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {createdAt.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/organizations/${org.id}`}>View</Link>
                          </Button>
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
    </div>
  );
}

