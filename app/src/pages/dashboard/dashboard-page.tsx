import { useTranslation } from "react-i18next";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Plus, 
  Brush, 
  DollarSign, 
  Settings,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Invoice } from "@/core/entities/invoice";

// Helper to safely get a value from dynamic invoice data
function getInvoiceValue(invoice: Invoice, path: string): string {
  const parts = path.split(".");
  let value: unknown = invoice.data;
  
  for (const part of parts) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return "";
    }
  }
  
  return value ? String(value) : "";
}

// Helper to get total amount from invoice (checks multiple field names)
function getInvoiceAmount(invoice: Invoice): number {
  const total =
    getInvoiceValue(invoice, "total") ||
    getInvoiceValue(invoice, "totalAmount") ||
    getInvoiceValue(invoice, "grandTotal") ||
    getInvoiceValue(invoice, "amount");
  
  if (total) {
    // Remove any currency symbols and parse
    const cleaned = total.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  
  return 0;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices(currentOrganization?.id);
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);

  // Calculate dashboard metrics from real data
  const totalInvoices = invoices?.length || 0;
  const totalTemplates = templates?.length || 0;
  
  // Calculate invoice metrics by status
  const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
  const unpaidInvoices = invoices?.filter(inv => inv.status === 'sent') || [];
  const draftInvoices = invoices?.filter(inv => inv.status === 'draft') || [];
  
  // Calculate revenue - only from paid invoices
  const paidRevenue = paidInvoices.reduce((sum, invoice) => {
    return sum + getInvoiceAmount(invoice);
  }, 0);
  
  // Calculate total outstanding (unpaid invoices)
  const outstandingAmount = unpaidInvoices.reduce((sum, invoice) => {
    return sum + getInvoiceAmount(invoice);
  }, 0);
  
  // Calculate draft invoices total amount
  const draftAmount = draftInvoices.reduce((sum, invoice) => {
    return sum + getInvoiceAmount(invoice);
  }, 0);
  
  // Sort invoices by updated date (most recent first)
  const sortedInvoices = invoices ? [...invoices].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  }) : [];
  
  const recentInvoices = sortedInvoices.slice(0, 5);
  const recentTemplates = templates?.slice(0, 3) || [];

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
    <div className="p-6 space-y-4 min-w-0 overflow-x-hidden w-full">
      {/* Header */}
      <div className="space-y-2 min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">
          {currentOrganization?.name 
            ? t('dashboard.welcome', { name: currentOrganization.name })
            : t('dashboard.welcomeFallback')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 min-w-0">
        <Button asChild>
          <Link to="/create-invoice">
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.quickActions.createInvoice')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/designer">
            <Brush className="mr-2 h-4 w-4" />
            {t('dashboard.quickActions.designTemplate')}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings/organization/general">
            <Settings className="mr-2 h-4 w-4" />
            {t('dashboard.quickActions.organizationSettings')}
          </Link>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.totalInvoices')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isInvoicesLoading ? <Skeleton className="h-8 w-16" /> : totalInvoices}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.metrics.paidUnpaid', { paid: paidInvoices.length, unpaid: unpaidInvoices.length })}
            </p>
          </CardContent>
        </Card>

        {paidInvoices.length > 0 || unpaidInvoices.length > 0 ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.metrics.paidRevenue')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isInvoicesLoading ? <Skeleton className="h-8 w-20" /> : `$${paidRevenue.toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {paidInvoices.length === 1 
                    ? t('dashboard.metrics.paidInvoice', { count: paidInvoices.length })
                    : t('dashboard.metrics.paidInvoices', { count: paidInvoices.length })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.metrics.outstanding')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isInvoicesLoading ? <Skeleton className="h-8 w-20" /> : `$${outstandingAmount.toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {unpaidInvoices.length === 1
                    ? t('dashboard.metrics.unpaidInvoice', { count: unpaidInvoices.length })
                    : t('dashboard.metrics.unpaidInvoices', { count: unpaidInvoices.length })}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.metrics.draftInvoices')}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isInvoicesLoading ? <Skeleton className="h-8 w-16" /> : draftInvoices.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {draftAmount > 0 
                    ? t('dashboard.metrics.draftAmount', { amount: draftAmount.toLocaleString() })
                    : t('dashboard.metrics.noDrafts')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.metrics.totalAmount')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isInvoicesLoading ? <Skeleton className="h-8 w-20" /> : `$${(paidRevenue + outstandingAmount + draftAmount).toLocaleString()}`}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.metrics.acrossAllInvoices')}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.metrics.templates')}</CardTitle>
            <Brush className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isTemplatesLoading ? <Skeleton className="h-8 w-16" /> : totalTemplates}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTemplates > 0 ? t('dashboard.metrics.readyToUse') : t('dashboard.metrics.createFirstTemplate')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        {/* Recent Invoices */}
        <Card className="col-span-1 md:col-span-2 min-w-0 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <CardTitle>{t('dashboard.recentInvoices.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard.recentInvoices.description')}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link to="/invoices">
                  {t('dashboard.recentInvoices.viewAll')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
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
                  <div key={invoice.id} className="flex items-center space-x-4 min-w-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {String(invoice.data?.invoiceNumber || t('dashboard.recentInvoices.invoiceNumber', { number: invoice.id.slice(-6) }))}
                        </p>
                        <Badge 
                          variant={
                            invoice.status === 'paid' ? 'default' :
                            invoice.status === 'sent' ? 'secondary' :
                            invoice.status === 'cancelled' ? 'destructive' :
                            'outline'
                          }
                          className="text-xs shrink-0"
                        >
                          {invoice.status ? t(`dashboard.status.${invoice.status}`) : t('dashboard.status.draft')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getInvoiceValue(invoice, "buyer.name") ||
                         getInvoiceValue(invoice, "customer.name") ||
                         getInvoiceValue(invoice, "client.name") ||
                         getInvoiceValue(invoice, "clientName") ||
                         t('dashboard.recentInvoices.unknownClient')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        ${getInvoiceAmount(invoice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.updatedAt ? formatDateTable(invoice.updatedAt) : t('dashboard.recentInvoices.recently')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">{t('dashboard.recentInvoices.noInvoices')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.recentInvoices.getStarted')}
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/create-invoice">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('dashboard.quickActions.createInvoice')}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates & Invoice Status */}
        <div className="col-span-1 md:col-span-2 space-y-4 min-w-0">
          {/* Templates */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <CardTitle>{t('dashboard.templates.title')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.templates.description')}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link to="/designer">
                    <Brush className="mr-2 h-4 w-4" />
                    {t('dashboard.templates.design')}
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
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
                          {template.description || t('dashboard.templates.noDescription')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {template.status || t('dashboard.templates.active')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Brush className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">{t('dashboard.templates.noTemplates')}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.templates.createFirst')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Status Summary */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>{t('dashboard.invoiceStatus.title')}</CardTitle>
              <CardDescription>
                {t('dashboard.invoiceStatus.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 min-w-0">
              {isInvoicesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : totalInvoices > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">{t('dashboard.invoiceStatus.paid')}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{paidInvoices.length}</p>
                      {paidRevenue > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ${paidRevenue.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm">{t('dashboard.invoiceStatus.sent')}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{unpaidInvoices.length}</p>
                      {outstandingAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ${outstandingAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="text-sm">{t('dashboard.invoiceStatus.draft')}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{draftInvoices.length}</p>
                      {draftAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ${draftAmount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {invoices && invoices.some(inv => inv.status === 'cancelled') && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-sm">{t('dashboard.invoiceStatus.cancelled')}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {invoices.filter(inv => inv.status === 'cancelled').length}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('dashboard.invoiceStatus.noInvoices')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}