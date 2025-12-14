import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, Users, CreditCard, Activity, FileText } from "lucide-react";
import { useAdminOrganization } from "@/hooks/admin/use-admin-organizations";
import { useAdminOrganizationMembers } from "@/hooks/admin/use-admin-organization-members";
import { useAdminOrganizationUsage } from "@/hooks/admin/use-admin-organization-usage";
import { OrganizationGeneralTab } from "@/components/admin/organization-tabs/OrganizationGeneralTab";
import { OrganizationUsersTab } from "@/components/admin/organization-tabs/OrganizationUsersTab";
import { OrganizationBillingTab } from "@/components/admin/organization-tabs/OrganizationBillingTab";
import { OrganizationUsageTab } from "@/components/admin/organization-tabs/OrganizationUsageTab";
import { OrganizationLogsTab } from "@/components/admin/organization-tabs/OrganizationLogsTab";

export function AdminOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: organization, isLoading, error } = useAdminOrganization(id);
  const { data: members } = useAdminOrganizationMembers(id);
  const { data: usage } = useAdminOrganizationUsage(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/organizations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Organizations
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              {error ? "Error loading organization" : "Organization not found"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      case "cancelled":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/organizations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {organization.name || "Unnamed Organization"}
            </h1>
            <p className="text-muted-foreground">{organization.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(organization.status || "active")}>
            {organization.status || "active"}
          </Badge>
          <Badge variant={getSubscriptionBadgeVariant(organization.subscription?.status)}>
            {organization.subscription?.status || "none"}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.invoices.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.templates.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.storage.mb || 0} MB</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="users">
            Users ({members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <OrganizationGeneralTab organization={organization} />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <OrganizationUsersTab 
            organizationId={id!} 
            members={members || []} 
          />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <OrganizationBillingTab organization={organization} />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <OrganizationUsageTab 
            organizationId={id} 
            usage={usage} 
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <OrganizationLogsTab organizationId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

