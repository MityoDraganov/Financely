import { useTranslation } from "react-i18next";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useContactsByOrg } from "@/hooks/repository-hooks/use-contacts";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/metric-card";
import { ActivationGuide } from "@/components/dashboard/activation-guide";
import {
  FileText,
  Plus,
  Brush,
  DollarSign,
  Settings,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { getInvoiceAmount, getInvoiceValue } from "@/utils/invoice-helpers";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();
  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices(currentOrganization?.id);
  const { data: templates, isLoading: isTemplatesLoading } = useTemplates(currentOrganization?.id);
  const { data: contacts } = useContactsByOrg(currentOrganization?.id);

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
    <div className="py-6 pr-6 space-y-4 min-w-0 overflow-x-hidden w-full">
      {/* Header */}
      <div className="space-y-2 min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {currentOrganization?.name 
            ? t('dashboard.welcome', { name: currentOrganization.name })
            : t('dashboard.welcomeFallback')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Activation guide — shown to new orgs until all tasks are done */}
      {currentOrganization?.id && (
        <ActivationGuide
          orgId={currentOrganization.id}
          invoiceCount={invoices?.length ?? 0}
          templateCount={templates?.length ?? 0}
          contactCount={contacts?.length ?? 0}
        />
      )}

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
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        <MetricCard
          title={t('dashboard.metrics.totalInvoices')}
          value={totalInvoices}
          description={t('dashboard.metrics.paidUnpaid', { paid: paidInvoices.length, unpaid: unpaidInvoices.length })}
          icon={FileText}
          isLoading={isInvoicesLoading}
        />

        {paidInvoices.length > 0 || unpaidInvoices.length > 0 ? (
          <>
            <MetricCard
              title={t('dashboard.metrics.paidRevenue')}
              value={`$${paidRevenue.toLocaleString()}`}
              description={
                paidInvoices.length === 1 
                  ? t('dashboard.metrics.paidInvoice', { count: paidInvoices.length })
                  : t('dashboard.metrics.paidInvoices', { count: paidInvoices.length })
              }
              icon={DollarSign}
              isLoading={isInvoicesLoading}
            />

            <MetricCard
              title={t('dashboard.metrics.outstanding')}
              value={`$${outstandingAmount.toLocaleString()}`}
              description={
                unpaidInvoices.length === 1
                  ? t('dashboard.metrics.unpaidInvoice', { count: unpaidInvoices.length })
                  : t('dashboard.metrics.unpaidInvoices', { count: unpaidInvoices.length })
              }
              icon={DollarSign}
              isLoading={isInvoicesLoading}
            />
          </>
        ) : (
          <>
            <MetricCard
              title={t('dashboard.metrics.draftInvoices')}
              value={draftInvoices.length}
              description={
                draftAmount > 0 
                  ? t('dashboard.metrics.draftAmount', { amount: draftAmount.toLocaleString() })
                  : t('dashboard.metrics.noDrafts')
              }
              icon={FileText}
              isLoading={isInvoicesLoading}
            />

            <MetricCard
              title={t('dashboard.metrics.totalAmount')}
              value={`$${(paidRevenue + outstandingAmount + draftAmount).toLocaleString()}`}
              description={t('dashboard.metrics.acrossAllInvoices')}
              icon={DollarSign}
              isLoading={isInvoicesLoading}
            />
          </>
        )}

        <MetricCard
          title={t('dashboard.metrics.templates')}
          value={totalTemplates}
          description={
            totalTemplates > 0 
              ? t('dashboard.metrics.readyToUse') 
              : t('dashboard.metrics.createFirstTemplate')
          }
          icon={Brush}
          isLoading={isTemplatesLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        {/* Recent Invoices */}
        <Card className="col-span-1 md:col-span-2 min-w-0 overflow-hidden rounded-sm">
          <CardHeader className="p-3 pb-2">
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
          <CardContent className="p-3 pt-0 min-w-0">
            {isInvoicesLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-sm" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentInvoices.length > 0 ? (
              <div className="space-y-2.5">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center space-x-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
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
              <div className="text-center py-4">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">{t('dashboard.recentInvoices.noInvoices')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('dashboard.recentInvoices.getStarted')}
                </p>
                <div className="mt-4">
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
        <div className="col-span-1 md:col-span-2 space-y-3 min-w-0">
          {/* Templates */}
          <Card className="min-w-0 overflow-hidden rounded-sm">
            <CardHeader className="p-3 pb-2">
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
            <CardContent className="p-3 pt-0 min-w-0">
              {isTemplatesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-sm" />
                  ))}
                </div>
              ) : recentTemplates.length > 0 ? (
                <div className="space-y-2">
                  {recentTemplates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-2.5 p-2 rounded-sm border">
                      <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/10 shrink-0">
                        <Brush className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {template.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {template.description || t('dashboard.templates.noDescription')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {template.status || t('dashboard.templates.active')}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
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
          <Card className="min-w-0 overflow-hidden rounded-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle>{t('dashboard.invoiceStatus.title')}</CardTitle>
              <CardDescription>
                {t('dashboard.invoiceStatus.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2 min-w-0">
              {isInvoicesLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-7 w-full rounded-sm" />
                  <Skeleton className="h-7 w-full rounded-sm" />
                  <Skeleton className="h-7 w-full rounded-sm" />
                </div>
              ) : totalInvoices > 0 ? (
                <>
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
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
                  
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
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
                  
                  <div className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
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
                    <div className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
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
                <div className="text-center py-3">
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