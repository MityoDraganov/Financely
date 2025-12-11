import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Download,
  TrendingUp,
  Users,
  FileText,
  HardDrive,
  Zap,
  HelpCircle,
  Bell,
  Info,
  Receipt,
  DollarSign,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Separator } from "@/components/ui/separator";
import { useUsageHistory } from "@/hooks/service-hooks/use-usage-history";
import { useBillingInvoices, useDownloadBillingInvoice } from "@/hooks/service-hooks/use-billing-invoices";
import { useUpdateBillingSettings } from "@/hooks/service-hooks/use-billing-settings";

type PeriodType = "current" | "previous" | "custom";

export default function OrganizationBillingPage() {
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const { data: organization, isLoading: isOrgLoading } = useCurrentOrganization();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>("current");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  
  // Fetch real usage history
  const {
    data: usageHistoryData,
    isLoading: isUsageLoading,
    error: usageError,
  } = useUsageHistory(organization?.id, {
    periodType,
    startDate: customStartDate?.toISOString(),
    endDate: customEndDate?.toISOString(),
  });

  // Fetch billing invoices
  const {
    data: billingInvoices = [],
    isLoading: isInvoicesLoading,
    error: invoicesError,
  } = useBillingInvoices(organization?.id);

  // Billing settings mutations
  const updateBillingSettings = useUpdateBillingSettings();
  const downloadInvoice = useDownloadBillingInvoice();

  // Initialize billing settings from organization
  const [autoRenew, setAutoRenew] = useState(
    organization?.settings?.billing?.autoRenew ?? true
  );
  const [usageAlerts, setUsageAlerts] = useState(
    organization?.settings?.billing?.usageAlerts ?? true
  );

  // Update local state when organization data changes
  useEffect(() => {
    if (organization?.settings?.billing) {
      setAutoRenew(organization.settings.billing.autoRenew ?? true);
      setUsageAlerts(organization.settings.billing.usageAlerts ?? true);
    }
  }, [organization]);


  // Handle loading state
  if (isOrgLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t("settings.organization.billing.noOrganization.title")}
        </h3>
        <p className="text-muted-foreground">
          {t("settings.organization.billing.noOrganization.description")}
        </p>
      </div>
    );
  }

  const subscription = organization.subscription;
  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const isTrialing = subscription.status === "trialing";
  const usage = organization.usage;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return formatDateShort(new Date(dateString));
  };

  const getPlanFeatures = (plan: string) => {
    return (
      (t(`settings.organization.billing.planFeatures.${plan}`, {
        returnObjects: true,
      }) as string[]) || []
    );
  };

  const getPlanPrice = (plan: string) => {
    const prices = {
      free: { monthly: 0, yearly: 0 },
      starter: { monthly: 29, yearly: 290 },
      professional: { monthly: 99, yearly: 990 },
      enterprise: { monthly: 299, yearly: 2990 },
    };
    return prices[plan as keyof typeof prices] || prices.free;
  };

  const getPlanLimits = (plan: string) => {
    const limits = {
      free: { invoices: 5, templates: 3, members: 1, storage: 100 },
      starter: { invoices: 50, templates: 20, members: 3, storage: 1000 },
      professional: { invoices: 500, templates: 100, members: 10, storage: 10000 },
      enterprise: { invoices: Infinity, templates: Infinity, members: Infinity, storage: Infinity },
    };
    return limits[plan as keyof typeof limits] || limits.free;
  };

  const currentPlanPrice = getPlanPrice(subscription.plan);
  const features = getPlanFeatures(subscription.plan);
  const limits = getPlanLimits(subscription.plan);

  const calculateUsagePercentage = (used: number, limit: number) => {
    if (limit === Infinity) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const avgCostPerInvoice = currentPlanPrice.monthly > 0 
    ? (currentPlanPrice.monthly / Math.max(usage.invoiceCount, 1)).toFixed(2)
    : "0.00";
  const storageInGB = (usage.storageBytes / (1024 * 1024 * 1024)).toFixed(2);

  // Get current period data
  const currentPeriodData = usageHistoryData?.periods?.[0];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("settings.organization.billing.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("settings.organization.billing.description")}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subscription Overview Card */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Subscription Overview
                      </CardTitle>
                      <CardDescription>
                        Current plan details and billing information
                      </CardDescription>
                    </div>
                    <Badge
                      variant={isActive ? "default" : "destructive"}
                      className="capitalize"
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Plan Info */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-semibold capitalize">
                        {subscription.plan} Plan
                      </h3>
                      <p className="text-muted-foreground">
                        {currentPlanPrice.monthly === 0
                          ? "Free forever"
                          : `$${currentPlanPrice.monthly}/month`}
                      </p>
                    </div>
                    {isTrialing && (
                      <div className="text-right">
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Trial
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ends {formatDate(subscription.trialEnd)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Billing Cycle Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Period</p>
                      <p className="text-sm font-medium">
                        {subscription.currentPeriodStart
                          ? formatDate(subscription.currentPeriodStart)
                          : "N/A"}{" "}
                        - {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next Billing Date</p>
                      <p className="text-sm font-medium">
                        {subscription.currentPeriodEnd
                          ? formatDate(subscription.currentPeriodEnd)
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Payment Method</Label>
                      <Button variant="ghost" size="sm">
                        Update
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                        <p className="text-xs text-muted-foreground">Expires 12/25</p>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Renew Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-renew" className="text-sm font-medium">
                        Auto-Renew Subscription
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically renew your subscription at the end of each billing period
                      </p>
                    </div>
                    <Switch
                      id="auto-renew"
                      checked={autoRenew}
                      onCheckedChange={async (checked) => {
                        setAutoRenew(checked);
                        if (organization?.id) {
                          try {
                            await updateBillingSettings.mutateAsync({
                              organizationId: organization.id,
                              settings: { autoRenew: checked },
                            });
                            toast.success("Billing settings updated");
                          } catch {
                            toast.error("Failed to update billing settings");
                            setAutoRenew(!checked); // Revert on error
                          }
                        }
                      }}
                      disabled={updateBillingSettings.isPending}
                    />
                  </div>

                  {/* Plan Features */}
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Plan Features</h4>
                    <ul className="space-y-2">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {subscription.plan !== "enterprise" && (
                      <Button onClick={() => setIsUpgrading(true)} disabled={isUpgrading}>
                        {isUpgrading ? "Processing..." : "Upgrade Plan"}
                      </Button>
                    )}
                    <Button variant="outline">Manage Billing</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Usage This Billing Cycle</CardTitle>
                      <CardDescription>
                        Track your resource usage against plan limits
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={periodType}
                        onValueChange={(value) => {
                          setPeriodType(value as PeriodType);
                          if (value !== "custom") {
                            setCustomStartDate(undefined);
                            setCustomEndDate(undefined);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Current Period</SelectItem>
                          <SelectItem value="previous">Previous Period</SelectItem>
                          <SelectItem value="custom">Custom Period</SelectItem>
                        </SelectContent>
                      </Select>
                      {periodType === "custom" && (
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm">
                                {customStartDate ? formatDate(customStartDate.toISOString()) : "Start"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={customStartDate}
                                onSelect={setCustomStartDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm">
                                {customEndDate ? formatDate(customEndDate.toISOString()) : "End"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={customEndDate}
                                onSelect={setCustomEndDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {periodType === "custom" && (!customStartDate || !customEndDate) ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <Info className="h-5 w-5 mx-auto mb-2" />
                      Please select both start and end dates to view usage data
                    </div>
                  ) : isUsageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : usageError ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                      Failed to load usage data
                    </div>
                  ) : (
                    <>
                      {/* Current Period Usage Metrics */}
                      <div className="space-y-4">
                        {/* Invoices */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Invoices</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Number of invoices created this billing period</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <span className="text-muted-foreground">
                              {currentPeriodData?.invoices ?? usage.invoiceCount} / {limits.invoices === Infinity ? "∞" : limits.invoices}
                            </span>
                          </div>
                          {limits.invoices !== Infinity && (
                            <Progress
                              value={calculateUsagePercentage(
                                currentPeriodData?.invoices ?? usage.invoiceCount,
                                limits.invoices
                              )}
                              className="h-2"
                            />
                          )}
                        </div>

                        {/* Templates */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Templates</span>
                            </div>
                            <span className="text-muted-foreground">
                              {currentPeriodData?.templates ?? usage.templateCount} / {limits.templates === Infinity ? "∞" : limits.templates}
                            </span>
                          </div>
                          {limits.templates !== Infinity && (
                            <Progress
                              value={calculateUsagePercentage(
                                currentPeriodData?.templates ?? usage.templateCount,
                                limits.templates
                              )}
                              className="h-2"
                            />
                          )}
                        </div>

                        {/* Team Members */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Team Members</span>
                            </div>
                            <span className="text-muted-foreground">
                              {currentPeriodData?.members ?? organization.memberIds.length} / {limits.members === Infinity ? "∞" : limits.members}
                            </span>
                          </div>
                          {limits.members !== Infinity && (
                            <Progress
                              value={calculateUsagePercentage(
                                currentPeriodData?.members ?? organization.memberIds.length,
                                limits.members
                              )}
                              className="h-2"
                            />
                          )}
                        </div>

                        {/* Storage */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Storage</span>
                            </div>
                            <span className="text-muted-foreground">
                              {currentPeriodData?.storageMB 
                                ? `${(currentPeriodData.storageMB / 1024).toFixed(2)} GB`
                                : `${storageInGB} GB`} / {limits.storage === Infinity ? "∞" : `${limits.storage} GB`}
                            </span>
                          </div>
                          {limits.storage !== Infinity && (
                            <Progress
                              value={calculateUsagePercentage(
                                currentPeriodData?.storageMB 
                                  ? currentPeriodData.storageMB / 1024
                                  : usage.storageBytes / (1024 * 1024 * 1024),
                                limits.storage
                              )}
                              className="h-2"
                            />
                          )}
                        </div>
                      </div>

                      {/* Usage History Table */}
                      {usageHistoryData?.periods && usageHistoryData.periods.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-3">Usage History</h4>
                              <div className="space-y-4">
                                {usageHistoryData.periods.map((period, index) => {
                                  const maxInvoices = Math.max(...usageHistoryData.periods.map(p => p.invoices), 1);
                                  const barWidth = maxInvoices > 0 ? (period.invoices / maxInvoices) * 100 : 0;

                                  return (
                                    <div key={index} className="space-y-3 p-4 border rounded-lg">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="font-medium">{period.periodLabel}</span>
                                          <span className="text-muted-foreground">
                                            {period.invoices} invoices
                                          </span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-primary transition-all duration-500"
                                            style={{ width: `${barWidth}%` }}
                                          />
                                        </div>
                                      </div>

                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="h-8">Metric</TableHead>
                                            <TableHead className="h-8 text-right">Value</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow>
                                            <TableCell className="font-medium">Invoices</TableCell>
                                            <TableCell className="text-right">{period.invoices}</TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium">Templates</TableCell>
                                            <TableCell className="text-right">{period.templates}</TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium">Members</TableCell>
                                            <TableCell className="text-right">{period.members}</TableCell>
                                          </TableRow>
                                          <TableRow>
                                            <TableCell className="font-medium">Storage</TableCell>
                                            <TableCell className="text-right">{period.storageMB} MB</TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Value Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Value Delivered
                  </CardTitle>
                  <CardDescription>
                    Insights into your usage and ROI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isUsageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Total Processed</p>
                        </div>
                        <p className="text-2xl font-bold">
                          {currentPeriodData?.invoices || 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Invoices {currentPeriodData?.periodLabel ? `(${currentPeriodData.periodLabel})` : ""}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Cost per Invoice</p>
                        </div>
                        <p className="text-2xl font-bold">
                          ${avgCostPerInvoice}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">This billing cycle</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Efficiency</p>
                        </div>
                        <p className="text-2xl font-bold">
                          {usage.invoiceCount > 0 ? "High" : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Active usage</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Available Plans */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>Upgrade to unlock more features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {["starter", "professional", "enterprise"].map((plan) => {
                    const planPrice = getPlanPrice(plan);
                    const isCurrentPlan = plan === subscription.plan;

                    return (
                      <div
                        key={plan}
                        className={`p-4 rounded-lg border transition-colors ${
                          isCurrentPlan
                            ? "border-primary bg-primary/10 dark:bg-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold capitalize">{plan}</h4>
                          {isCurrentPlan && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                        <div className="text-2xl font-bold mb-2">
                          ${planPrice.monthly}
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          variant={isCurrentPlan ? "outline" : "default"}
                          disabled={isCurrentPlan}
                        >
                          {isCurrentPlan ? "Current Plan" : "Upgrade"}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Usage Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Usage Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Email Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          Get notified when approaching limits
                        </p>
                      </div>
                      <Switch
                        checked={usageAlerts}
                        onCheckedChange={async (checked) => {
                          setUsageAlerts(checked);
                          if (organization?.id) {
                            try {
                              await updateBillingSettings.mutateAsync({
                                organizationId: organization.id,
                                settings: { usageAlerts: checked },
                              });
                              toast.success("Billing settings updated");
                            } catch {
                              toast.error("Failed to update billing settings");
                              setUsageAlerts(!checked); // Revert on error
                            }
                          }
                        }}
                        disabled={updateBillingSettings.isPending}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Alert Thresholds</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Warning</span>
                          <span className="text-muted-foreground">
                            {organization?.settings?.billing?.usageAlertThresholds?.warning || 75}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Critical</span>
                          <span className="text-muted-foreground">
                            {organization?.settings?.billing?.usageAlertThresholds?.critical || 90}%
                          </span>
                        </div>
                      </div>
                    </div>
                </CardContent>
              </Card>

              {/* Help & Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Help & Support
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Info className="h-4 w-4 mr-2" />
                    Billing FAQ
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Contact Support
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Pricing Guide
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invoice History</CardTitle>
                  <CardDescription>
                    View and download your past subscription invoices
                  </CardDescription>
                </div>
                {billingInvoices.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isInvoicesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoicesError ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Failed to load invoices. Please try again later.
                  </p>
                </div>
              ) : billingInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No billing invoices yet</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Invoices will appear here once Stripe integration is complete
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{formatDate(invoice.date)}</TableCell>
                        <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {invoice.plan}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${invoice.amount} {invoice.currency}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === "paid" ? "default" : "secondary"
                            }
                            className="capitalize"
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                if (invoice.pdfUrl) {
                                  window.open(invoice.pdfUrl, "_blank");
                                } else {
                                  const url = await downloadInvoice(invoice.id);
                                  window.open(url, "_blank");
                                }
                              } catch {
                                toast.error("Failed to download invoice");
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Invoice Preview */}
          {subscription.currentPeriodEnd && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Invoice</CardTitle>
                <CardDescription>
                  Preview of your next billing cycle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Billing Period</span>
                    <span className="text-sm font-medium">
                      {formatDate(subscription.currentPeriodStart)} -{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {subscription.plan} Plan
                    </span>
                    <span className="text-sm font-medium">
                      ${currentPlanPrice.monthly}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>${currentPlanPrice.monthly}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
