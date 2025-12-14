import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, File, HardDrive, TrendingUp } from "lucide-react";
import { useState, useMemo } from "react";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

export function AdminUsagePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: organizations, isLoading: isLoadingOrgs } = useAdminOrganizations();

  // Fetch usage data for all organizations
  const orgIds = useMemo(() => (organizations || []).map((o) => o.id), [organizations]);

  const { data: allUsageData, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["admin", "usage", "all", orgIds],
    queryFn: async () => {
      const usageMap: Record<
        string,
        {
          invoices: { total: number; draft: number; sent: number; paid: number; cancelled: number };
          templates: { total: number; active: number };
          storage: { bytes: number; mb: number };
        }
      > = {};

      await Promise.all(
        orgIds.map(async (orgId) => {
          const [invoices, templates] = await Promise.all([
            invoiceRepository.getAll({
              queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
              pagination: { limit: 10000 },
            }),
            templateRepository.getAll({
              queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
              pagination: { limit: 10000 },
            }),
          ]);

          usageMap[orgId] = {
            invoices: {
              total: invoices.length,
              draft: invoices.filter((inv) => inv.status === "draft").length,
              sent: invoices.filter((inv) => inv.status === "sent").length,
              paid: invoices.filter((inv) => inv.status === "paid").length,
              cancelled: invoices.filter((inv) => inv.status === "cancelled").length,
            },
            templates: {
              total: templates.length,
              active: templates.length,
            },
            storage: {
              bytes: 0, // TODO: Calculate from actual storage
              mb: 0,
            },
          };
        })
      );

      return usageMap;
    },
    enabled: orgIds.length > 0,
    staleTime: 60 * 1000,
  });

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

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    if (!allUsageData) {
      return {
        totalInvoices: 0,
        totalTemplates: 0,
        totalStorageMB: 0,
        paidInvoices: 0,
      };
    }

    let totalInvoices = 0;
    let totalTemplates = 0;
    let totalStorageMB = 0;
    let paidInvoices = 0;

    Object.values(allUsageData).forEach((usage) => {
      totalInvoices += usage.invoices.total;
      totalTemplates += usage.templates.total;
      totalStorageMB += usage.storage.mb;
      paidInvoices += usage.invoices.paid;
    });

    return {
      totalInvoices,
      totalTemplates,
      totalStorageMB,
      paidInvoices,
    };
  }, [allUsageData]);

  const isLoading = isLoadingOrgs || isLoadingUsage;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usage</h1>
          <p className="text-muted-foreground">Platform-wide usage metrics and analytics</p>
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

      {/* Aggregate Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {aggregateStats.paidInvoices} paid
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalTemplates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalStorageMB.toFixed(2)} MB</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Organization</CardTitle>
          <CardDescription>
            Detailed usage metrics for each organization
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
                  <TableHead>Invoices</TableHead>
                  <TableHead>Templates</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => {
                    const usage = allUsageData?.[org.id] || {
                      invoices: { total: 0, draft: 0, sent: 0, paid: 0, cancelled: 0 },
                      templates: { total: 0, active: 0 },
                      storage: { bytes: 0, mb: 0 },
                    };

                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{org.name || "Unnamed Organization"}</div>
                            <div className="text-sm text-muted-foreground">{org.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{usage.invoices.total}</div>
                            <div className="text-xs text-muted-foreground">
                              {usage.invoices.paid} paid, {usage.invoices.draft} draft
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{usage.templates.total}</div>
                          <div className="text-xs text-muted-foreground">
                            {usage.templates.active} active
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{usage.storage.mb.toFixed(2)} MB</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/organizations/${org.id}`}>View Details</Link>
                            </Button>
                            <Button variant="outline" size="sm" disabled>
                              Override
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

      {/* Usage Override Note */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Override Tools</CardTitle>
          <CardDescription>Manually adjust usage limits and counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              Usage override tools will be available in a future update. This will allow admins to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Manually adjust usage counts for specific organizations</li>
              <li>Override usage limits temporarily</li>
              <li>Reset usage counters</li>
              <li>Set custom usage quotas</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

