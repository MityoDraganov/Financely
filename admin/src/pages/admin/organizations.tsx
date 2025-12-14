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
import { useState, useMemo, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { ExportButton } from "@/components/admin/ExportButton";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";
import { useQuery } from "@tanstack/react-query";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";

const databaseService = serviceHost.getDatabaseService();
const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
const templateRepository = repositoryHost.getTemplatesReposity(databaseService);

const ITEMS_PER_PAGE = 20;

export function AdminOrganizationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { data: organizations, isLoading, error } = useAdminOrganizations();

  if (error) {
    console.error(error);
  }

  // Filter by search query client-side
  const filteredOrganizations = useMemo(() => {
    if (!organizations) {
      return [];
    }

    if (!searchQuery) {
      return organizations;
    }

    const searchLower = searchQuery.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name?.toLowerCase().includes(searchLower) ||
        org.id.toLowerCase().includes(searchLower)
    );
  }, [organizations, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredOrganizations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrganizations = filteredOrganizations.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1);
    }
  }, [searchQuery]);

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
        <div className="flex gap-2">
          <ExportButton
            data={filteredOrganizations}
            filename="organizations"
            exportFormat="csv"
            transform={(org) => {
              let createdAtStr = "";
              const createdAt = org.createdAt;
              if (createdAt) {
                if (typeof createdAt === "string") {
                  createdAtStr = createdAt;
                } else if (createdAt && typeof createdAt === "object" && "getTime" in createdAt) {
                  createdAtStr = (createdAt as Date).toISOString();
                } else {
                  createdAtStr = String(createdAt);
                }
              }
              return {
                id: org.id,
                name: org.name || "",
                status: org.status || "active",
                memberCount: org.memberIds?.length || 0,
                subscriptionPlan: org.subscription?.plan || "free",
                subscriptionStatus: org.subscription?.status || "none",
                createdAt: createdAtStr,
              };
            }}
          />
          <ExportButton
            data={filteredOrganizations}
            filename="organizations"
            exportFormat="json"
          />
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
            Showing {startIndex + 1}-{Math.min(endIndex, filteredOrganizations.length)} of{" "}
            {filteredOrganizations.length} organization
            {filteredOrganizations.length !== 1 ? "s" : ""}
            {searchQuery && " (filtered)"}
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
                {paginatedOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {filteredOrganizations.length === 0
                        ? "No organizations found"
                        : "No organizations on this page"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrganizations.map((org) => {
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={currentPage === page}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

