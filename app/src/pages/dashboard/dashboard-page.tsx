import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useInvoices } from "@/hooks/repository-hooks/use-invoices";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useContactsByOrg } from "@/hooks/repository-hooks/use-contacts";
import { useLeadsByOrg } from "@/hooks/repository-hooks/use-leads";
import { useOpportunitiesByOrg } from "@/hooks/repository-hooks/use-opportunities";
import { useProposalsByOrg } from "@/hooks/repository-hooks/use-proposals";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivationGuide } from "@/components/dashboard/activation-guide";
import {
  FileText,
  Plus,
  DollarSign,
  Settings,
  ArrowRight,
  MessageSquare,
  TrendingUp,
  Clock,
  Receipt,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getInvoiceAmount, getInvoiceValue } from "@/utils/invoice-helpers";
import { INVOICE_STATUSES, normalizeInvoiceStatus } from "@/core/entities/invoice";
import { normalizeProposalStatus, PROPOSAL_STATUSES } from "@/core/entities/proposal";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const { data: currentOrganization, isLoading: isOrgLoading } = useCurrentOrganization();

  const orgId = currentOrganization?.id;

  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices(orgId);
  const { data: templates } = useTemplates(orgId);
  const { data: contacts } = useContactsByOrg(orgId);
  const { data: leads, isLoading: isLeadsLoading } = useLeadsByOrg(orgId);
  const { data: opportunities, isLoading: isOppsLoading } = useOpportunitiesByOrg(orgId);
  const { data: proposals, isLoading: isProposalsLoading } = useProposalsByOrg(orgId);

  // ── Invoice metrics ──────────────────────────────────────────────────────────
  const sentInvoices = invoices?.filter((inv) => normalizeInvoiceStatus(inv.status) === INVOICE_STATUSES.SENT) ?? [];


  // ── Pipeline stage counts ────────────────────────────────────────────────────
  const newLeadsCount = leads?.filter((l) => l.data?.status === "new").length ?? 0;
  const totalLeadsCount = leads?.length ?? 0;

  const activeOppsCount =
    opportunities?.filter((o) => o.stage !== "won" && o.stage !== "lost").length ?? 0;

  const activeProposalsCount =
    proposals?.filter((p) => {
      const s = normalizeProposalStatus(p.status);
      return s === PROPOSAL_STATUSES.CREATED || s === PROPOSAL_STATUSES.SENT;
    }).length ?? 0;

  const unpaidInvoicesCount = sentInvoices.length;

  // ── Focus on: urgent items ───────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueOppsCount =
    opportunities?.filter((o) => {
      if (o.stage === "won" || o.stage === "lost") return false;
      if (!o.expectedCloseDate) return false;
      return new Date(o.expectedCloseDate) < today;
    }).length ?? 0;

  interface FocusItem {
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    label: string;
    count: number;
    href: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }

  const focusItems: FocusItem[] = [
    newLeadsCount > 0 && {
      icon: MessageSquare,
      iconBg: "bg-sky-100 dark:bg-sky-900/30",
      iconColor: "text-sky-600 dark:text-sky-400",
      label: t("dashboard.focus.newLeads", { count: newLeadsCount }),
      count: newLeadsCount,
      href: "/leads",
      badgeVariant: "secondary" as const,
    },
    overdueOppsCount > 0 && {
      icon: Clock,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      label: t("dashboard.focus.overdueOpportunities", { count: overdueOppsCount }),
      count: overdueOppsCount,
      href: "/opportunities",
      badgeVariant: "destructive" as const,
    },
    unpaidInvoicesCount > 0 && {
      icon: Receipt,
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      label: t("dashboard.focus.unpaidInvoices", { count: unpaidInvoicesCount }),
      count: unpaidInvoicesCount,
      href: "/invoices",
      badgeVariant: "outline" as const,
    },
  ].filter(Boolean) as FocusItem[];

  const isPipelineLoading = isLeadsLoading || isOppsLoading || isProposalsLoading || isInvoicesLoading;
  const [checkAnimKey, setCheckAnimKey] = useState(0);
  const checkAnimatingRef = useRef(false);

  function handleCheckHover() {
    if (checkAnimatingRef.current) return;
    checkAnimatingRef.current = true;
    setCheckAnimKey((k) => k + 1);
    // circle: 0.5s + check delay 0.45s + check duration 0.35s = 0.8s total
    setTimeout(() => { checkAnimatingRef.current = false; }, 850);
  }

  // ── Recent invoices ──────────────────────────────────────────────────────────
  const sortedInvoices = invoices
    ? [...invoices].sort((a, b) => {
        const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dB - dA;
      })
    : [];
  const recentInvoices = sortedInvoices.slice(0, 5);

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
    <div className="py-6 pr-6 space-y-3 min-w-0 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-none">
            {currentOrganization?.name
              ? t("dashboard.welcome", { name: currentOrganization.name })
              : t("dashboard.welcomeFallback")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("dashboard.subtitle")}</p>
        </div>

        {/* Quick Actions — consistent height, tight group */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" asChild>
            <Link to="/leads">
              <Plus className="h-3.5 w-3.5" />
              {t("dashboard.quickActions.addLead")}
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/create-invoice">
              <FileText className="h-3.5 w-3.5" />
              {t("dashboard.quickActions.createInvoice")}
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="px-2" asChild>
            <Link to="/settings/organization/general">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Activation guide */}
      {currentOrganization?.id && (
        <ActivationGuide
          orgId={currentOrganization.id}
          invoiceCount={invoices?.length ?? 0}
          templateCount={templates?.length ?? 0}
          contactCount={contacts?.length ?? 0}
        />
      )}

      {/* Pipeline — compact stat strip, not a stacked tower */}
      <Card className="overflow-hidden">
        {isPipelineLoading ? (
          <div className="flex divide-x">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1 px-4 py-3 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex divide-x items-stretch">
            {[
              {
                href: "/leads",
                label: t("dashboard.pipeline.leads"),
                count: totalLeadsCount,
                sub: newLeadsCount > 0 ? t("dashboard.pipeline.newCount", { count: newLeadsCount }) : null,
                subColor: "text-sky-600 dark:text-sky-400",
                icon: MessageSquare,
                iconColor: "text-sky-500",
              },
              {
                href: "/opportunities",
                label: t("dashboard.pipeline.opportunities"),
                count: activeOppsCount,
                sub: t("dashboard.pipeline.active"),
                subColor: "text-muted-foreground",
                icon: TrendingUp,
                iconColor: "text-violet-500",
              },
              {
                href: "/proposals",
                label: t("dashboard.pipeline.proposals"),
                count: activeProposalsCount,
                sub: t("dashboard.pipeline.open"),
                subColor: "text-muted-foreground",
                icon: FileText,
                iconColor: "text-amber-500",
              },
              {
                href: "/invoices",
                label: t("dashboard.pipeline.invoices"),
                count: unpaidInvoicesCount,
                sub: t("dashboard.pipeline.unpaid"),
                subColor: "text-muted-foreground",
                icon: DollarSign,
                iconColor: "text-emerald-500",
              },
            ].map((stage) => (
              <Link key={stage.href} to={stage.href} className="flex-1 group">
                <div className="px-4 py-3 h-full hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <stage.icon className={`h-3 w-3 shrink-0 ${stage.iconColor}`} />
                    <span className="text-xs text-muted-foreground truncate">{stage.label}</span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums leading-none">{stage.count}</p>
                  {stage.sub && (
                    <p className={`text-xs mt-0.5 leading-none ${stage.subColor}`}>{stage.sub}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Focus On + Revenue Row */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 min-w-0">
        {/* Focus On */}
        <Card className="overflow-hidden" onMouseEnter={handleCheckHover}>
          <CardHeader>
            <CardTitle>{t("dashboard.focus.title")}</CardTitle>
            <CardDescription>{t("dashboard.focus.description")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-1 flex-1">
            {isPipelineLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : focusItems.length > 0 ? (
              <div className="space-y-0.5">
                {focusItems.map((item, i) => (
                  <Link key={i} to={item.href}>
                    <div className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-muted/50 transition-colors group -mx-2">
                      <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.iconColor}`} />
                      <p className="flex-1 text-sm leading-none">{item.label}</p>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                        item.badgeVariant === "destructive" ? "text-destructive" : "text-muted-foreground"
                      }`}>{item.count}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center gap-1 h-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
                  <motion.circle
                    key={`circle-${checkAnimKey}`}
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <motion.path
                    key={`check-${checkAnimKey}`}
                    d="M7.5 12.5l3 3 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: 0.45 }}
                  />
                </svg>
                <p className="text-sm font-medium leading-none">{t("dashboard.focus.allClear")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.focus.allClearDescription")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Value */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between col-span-2">
              <div>
                <CardTitle>{t("dashboard.pipelineValue.title")}</CardTitle>
                <CardDescription>{t("dashboard.pipelineValue.description")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" asChild>
                <Link to="/opportunities">{t("dashboard.pipelineValue.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {isOppsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-32" />
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              </div>
            ) : (() => {
              const activeOpps = opportunities?.filter(
                (o) => o.stage !== "won" && o.stage !== "lost"
              ) ?? [];
              const totalValue = activeOpps.reduce(
                (sum, o) => sum + (o.estimatedValue ?? 0), 0
              );
              const fmt = (n: number) =>
                n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

              // Top 3 soonest closing (with a date set)
              const soonest = [...activeOpps]
                .filter((o) => o.expectedCloseDate)
                .sort(
                  (a, b) =>
                    new Date(a.expectedCloseDate!).getTime() -
                    new Date(b.expectedCloseDate!).getTime()
                )
                .slice(0, 3);

              return (
                <>
                  {/* Hero: total pipeline value */}
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    ${fmt(totalValue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {t("dashboard.pipelineValue.activeCount", { count: activeOpps.length })}
                  </p>

                  {/* Soonest closing */}
                  {soonest.length > 0 ? (
                    <div className="space-y-0">
                      {soonest.map((opp) => {
                        const closeDate = new Date(opp.expectedCloseDate!);
                        const daysUntil = Math.ceil(
                          (closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const isOverdue = daysUntil < 0;
                        const isSoon = !isOverdue && daysUntil <= 7;
                        const timeLabel = isOverdue
                          ? t("dashboard.pipelineValue.daysOverdue", { count: Math.abs(daysUntil) })
                          : daysUntil === 0
                            ? t("dashboard.pipelineValue.closesToday")
                            : t("dashboard.pipelineValue.closesIn", { count: daysUntil });

                        return (
                          <Link key={opp.id} to={`/opportunities/${opp.id}`}>
                            <div className="flex items-center justify-between py-2 border-b last:border-0 group hover:opacity-80 transition-opacity">
                              <div className="min-w-0 pr-3">
                                <p className="text-xs font-medium leading-none truncate">{opp.title}</p>
                                <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive" : isSoon ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"}`}>
                                  {timeLabel}
                                </p>
                              </div>
                              <span className="text-xs font-semibold tabular-nums shrink-0">
                                {opp.estimatedValue ? `$${fmt(opp.estimatedValue)}` : "—"}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : activeOpps.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.pipelineValue.noCloseDates")}
                    </p>
                  ) : (
                    <div className="py-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        {t("dashboard.pipelineValue.empty")}
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                        <Link to="/leads">{t("dashboard.pipelineValue.convertLeads")}</Link>
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="overflow-hidden min-w-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 min-w-0 col-span-2">
            <div className="min-w-0">
              <CardTitle>{t("dashboard.recentInvoices.title")}</CardTitle>
              <CardDescription>{t("dashboard.recentInvoices.description")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link to="/invoices">
                {t("dashboard.recentInvoices.viewAll")}
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-1 min-w-0">
          {isInvoicesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-sm shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : recentInvoices.length > 0 ? (
            <div className="space-y-0">
              {recentInvoices.map((invoice) => {
                const normalizedStatus = normalizeInvoiceStatus(invoice.status);
                return (
                  <Link key={invoice.id} to={`/invoices/${invoice.id}`} className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-sm border-b last:border-0 min-w-0 hover:bg-muted/40 transition-colors">
                    <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-muted shrink-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {String(invoice.data?.invoiceNumber || t("dashboard.recentInvoices.invoiceNumber", { number: invoice.id.slice(-6) }))}
                        </p>
                        <Badge
                          variant={
                            normalizedStatus === INVOICE_STATUSES.PAID
                              ? "default"
                              : normalizedStatus === INVOICE_STATUSES.SENT
                                ? "secondary"
                                : normalizedStatus === INVOICE_STATUSES.CANCELLED
                                  ? "destructive"
                                  : "outline"
                          }
                          className="text-[10px] h-4 px-1 shrink-0"
                        >
                          {t(`dashboard.status.${normalizedStatus}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {getInvoiceValue(invoice, "buyer.name") ||
                          getInvoiceValue(invoice, "customer.name") ||
                          getInvoiceValue(invoice, "client.name") ||
                          getInvoiceValue(invoice, "clientName") ||
                          t("dashboard.recentInvoices.unknownClient")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">
                        ${getInvoiceAmount(invoice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {invoice.updatedAt ? formatDateTable(invoice.updatedAt) : t("dashboard.recentInvoices.recently")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">{t("dashboard.recentInvoices.noInvoices")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.recentInvoices.getStarted")}</p>
              <Button size="sm" asChild className="mt-3">
                <Link to="/create-invoice">
                  <Plus className="h-3.5 w-3.5" />
                  {t("dashboard.quickActions.createInvoice")}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
