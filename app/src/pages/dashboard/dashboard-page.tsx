import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Plus, 
  Brush, 
  DollarSign, 
  Calendar,
  Users,
  Settings,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices();
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);

  // Calculate dashboard metrics
  const totalInvoices = invoices?.length || 0;
  const totalTemplates = templates?.length || 0;
  const recentInvoices = invoices?.slice(0, 5) || [];
  const recentTemplates = templates?.slice(0, 3) || [];

  // Mock revenue calculation (you can replace with actual calculation)
  const totalRevenue = invoices?.reduce((sum, invoice) => {
    const amount = invoice.data?.totalAmount || invoice.data?.amount || 0;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0) || 0;

  if (isOrgLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {currentOrganization?.name || 'User'}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your invoices and templates today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/create-invoice">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/designer">
            <Brush className="mr-2 h-4 w-4" />
            Design Template
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings/organization/general">
            <Settings className="mr-2 h-4 w-4" />
            Organization Settings
          </Link>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isInvoicesLoading ? <Skeleton className="h-8 w-16" /> : totalInvoices}
            </div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isInvoicesLoading ? <Skeleton className="h-8 w-20" /> : `$${totalRevenue.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground">
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Brush className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTemplatesLoading ? <Skeleton className="h-8 w-16" /> : totalTemplates}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTemplates > 0 ? 'Ready to use' : 'Create your first template'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentOrganization?.subscription?.plan || 'Free'}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentOrganization?.subscription?.status || 'Active'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Invoices */}
        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>
                  Your latest invoice activity
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/invoices">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isInvoicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-4">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {String(invoice.data?.invoiceNumber || `Invoice #${invoice.id.slice(-6)}`)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {String(invoice.data?.clientName || 'Unknown Client')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ${(invoice.data?.totalAmount || invoice.data?.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.updatedAt ? format(new Date(invoice.updatedAt), 'MMM dd') : 'Recently'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No invoices yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Get started by creating your first invoice.
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/create-invoice">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Invoice
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates & Organization Info */}
        <div className="col-span-3 space-y-6">
          {/* Templates */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Templates</CardTitle>
                  <CardDescription>
                    Your invoice templates
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/designer">
                    <Brush className="mr-2 h-4 w-4" />
                    Design
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isTemplatesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : recentTemplates.length > 0 ? (
                <div className="space-y-3">
                  {recentTemplates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                        <Brush className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {template.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {template.description || 'No description'}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {template.status || 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Brush className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No templates</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create your first template
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization Status */}
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>
                Current plan and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{currentOrganization?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentOrganization?.subscription?.plan || 'Free'} Plan
                  </p>
                </div>
                <Badge 
                  variant={currentOrganization?.subscription?.status === 'active' ? 'default' : 'secondary'}
                >
                  {currentOrganization?.subscription?.status || 'Active'}
                </Badge>
              </div>
              
              {currentOrganization?.subscription?.currentPeriodEnd && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Renews {format(new Date(currentOrganization.subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to="/settings/organization/billing">
                  Manage Billing
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}