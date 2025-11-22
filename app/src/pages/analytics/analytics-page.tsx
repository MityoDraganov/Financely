import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useAnalyticsConfig, useUpdateAnalyticsConfig } from "@/hooks/repository-hooks/use-analytics-config";
import { useBrandSitesByOrganization } from "@/hooks/repository-hooks/use-brand-site";
import { useUpdateAnalyticsScript } from "@/hooks/service-hooks/use-brand-site";
import { useAnalyticsMetrics } from "@/hooks/service-hooks/use-analytics-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Loader2, BarChart3, Settings, ExternalLink, CheckCircle2, XCircle, Monitor, Globe, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { ConsentBannerCustomizer } from "@/components/analytics/consent-banner-customizer";
import { ConsentBannerStyling, consentBannerStylingSchema } from "@/core/entities/analytics-config";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { formatDateShort } = useDateFormatting();
  const { data: organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: analyticsConfig, isLoading: configLoading } = useAnalyticsConfig(organization?.id);
  const { data: brandSites, isLoading: sitesLoading } = useBrandSitesByOrganization(organization?.id);
  const updateAnalyticsConfig = useUpdateAnalyticsConfig();
  const updateAnalyticsScript = useUpdateAnalyticsScript();
  
  // Date range state
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  });

  const { data: metrics, isLoading: metricsLoading } = useAnalyticsMetrics(
    organization?.id,
    dateRange.start,
    dateRange.end,
  );

  console.log("Analytics metrics", metrics);


  const [isSaving, setIsSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<{
    enabled: boolean;
    enableGA4: boolean;
    enablePlausible: boolean;
    enableUmami: boolean;
    enableClarity: boolean;
    ga4MeasurementId: string;
    clarityProjectId: string;
    plausibleDomain: string;
    umamiScriptUrl: string;
    umamiWebsiteId: string;
    consentDefault: "denied" | "granted";
    bannerProvider: "custom" | "cookiebot" | "iubenda" | "klaro";
    enableBigQueryServerLogs: boolean;
    consentBannerStyling?: ConsentBannerStyling;
  }>({
    enabled: false,
    enableGA4: false,
    enablePlausible: false,
    enableUmami: false,
    enableClarity: false,
    ga4MeasurementId: "",
    clarityProjectId: "",
    plausibleDomain: "",
    umamiScriptUrl: "",
    umamiWebsiteId: "",
    consentDefault: "denied",
    bannerProvider: "custom",
    enableBigQueryServerLogs: false,
  });

  // Update local config when analyticsConfig changes
  useEffect(() => {
    if (analyticsConfig) {
      // Handle migration from old strategy-based config to new multi-provider config
      const legacyStrategy = analyticsConfig.strategy;
      let enableGA4 = analyticsConfig.enableGA4 ?? false;
      let enablePlausible = analyticsConfig.enablePlausible ?? false;
      let enableUmami = analyticsConfig.enableUmami ?? false;
      
      // Migrate from legacy strategy field if new fields are not set
      if (!analyticsConfig.enableGA4 && !analyticsConfig.enablePlausible && !analyticsConfig.enableUmami) {
        if (legacyStrategy === "gtag_only") {
          enableGA4 = true;
        } else if (legacyStrategy === "plausible") {
          enablePlausible = true;
        } else if (legacyStrategy === "umami") {
          enableUmami = true;
        }
      }
      
      // Parse consent banner styling if it exists, otherwise use defaults
      let consentBannerStyling: ConsentBannerStyling | undefined;
      if (analyticsConfig.consentBannerStyling) {
        // Validate and parse existing styling
        const parsed = consentBannerStylingSchema.safeParse(analyticsConfig.consentBannerStyling);
        if (parsed.success) {
          consentBannerStyling = parsed.data;
        } else {
          // Use defaults if parsing fails
          consentBannerStyling = consentBannerStylingSchema.parse({});
        }
      }
      
      setLocalConfig({
        enabled: analyticsConfig.enabled ?? false,
        enableGA4,
        enablePlausible,
        enableUmami,
        enableClarity: analyticsConfig.enableClarity ?? false,
        ga4MeasurementId: analyticsConfig.ga4MeasurementId ?? "",
        clarityProjectId: analyticsConfig.clarityProjectId ?? "",
        plausibleDomain: analyticsConfig.plausibleDomain ?? "",
        umamiScriptUrl: analyticsConfig.umamiScriptUrl ?? "",
        umamiWebsiteId: analyticsConfig.umamiWebsiteId ?? "",
        consentDefault: analyticsConfig.consentDefault ?? "denied",
        bannerProvider: "custom", // Always use custom banner provider
        enableBigQueryServerLogs: analyticsConfig.enableBigQueryServerLogs ?? false,
        consentBannerStyling,
      });
    }
  }, [analyticsConfig]);

  const handleSave = async () => {
    if (!organization?.id) return;

    setIsSaving(true);
    try {
      // Clean up undefined values and prepare data
      const configData: {
        enabled: boolean;
        enableGA4: boolean;
        enablePlausible: boolean;
        enableUmami: boolean;
        enableClarity: boolean;
        consentDefault: "denied" | "granted";
        bannerProvider: "custom";
        enableBigQueryServerLogs: boolean;
        orgId: string;
        siteId?: string;
        brandName?: string;
        ga4MeasurementId?: string;
        clarityProjectId?: string;
        plausibleDomain?: string;
        umamiScriptUrl?: string;
        umamiWebsiteId?: string;
        consentBannerStyling?: ConsentBannerStyling;
      } = {
        enabled: localConfig.enabled,
        enableGA4: localConfig.enableGA4,
        enablePlausible: localConfig.enablePlausible,
        enableUmami: localConfig.enableUmami,
        enableClarity: localConfig.enableClarity,
        consentDefault: localConfig.consentDefault,
        bannerProvider: "custom", // Always use custom banner provider
        enableBigQueryServerLogs: localConfig.enableBigQueryServerLogs,
        orgId: organization.id,
        // Use prefixed format to match what's used in analytics script generation
        siteId: brandSites?.[0]?.id ? `brand-${brandSites[0].id}` : undefined,
        brandName: organization.settings?.branding?.companyName || organization.name || undefined,
      };

      // Include consent banner styling if it exists
      if (localConfig.consentBannerStyling) {
        configData.consentBannerStyling = localConfig.consentBannerStyling;
      }

      // Only include provider-specific fields if they have values
      if (localConfig.ga4MeasurementId) {
        configData.ga4MeasurementId = localConfig.ga4MeasurementId;
      }
      if (localConfig.clarityProjectId) {
        configData.clarityProjectId = localConfig.clarityProjectId;
      }
      if (localConfig.plausibleDomain) {
        configData.plausibleDomain = localConfig.plausibleDomain;
      }
      if (localConfig.umamiScriptUrl) {
        configData.umamiScriptUrl = localConfig.umamiScriptUrl;
      }
      if (localConfig.umamiWebsiteId) {
        configData.umamiWebsiteId = localConfig.umamiWebsiteId;
      }

      await updateAnalyticsConfig.mutateAsync({
        orgId: organization.id,
        data: configData,
      });

      // If there's an active site, update analytics script without full regeneration
      const activeSite = brandSites?.find((site) => site.status === "success");
      if (activeSite) {
        // Update analytics script in existing HTML (lightweight, no AI regeneration)
        updateAnalyticsScript.mutate({
          brandSiteId: activeSite.id,
        });
        toast.success(t('analytics.toasts.configurationSaved'));
      } else {
        toast.success(t('analytics.toasts.configurationSaved'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(t('analytics.toasts.saveFailed', { message: errorMessage }));
      console.error("Analytics config save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (orgLoading || configLoading || sitesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeSite = brandSites?.find((site) => site.status === "success");
  const isConfigured = analyticsConfig?.enabled && (
    (analyticsConfig.enableGA4 && analyticsConfig.ga4MeasurementId) ||
    (analyticsConfig.enablePlausible && analyticsConfig.plausibleDomain) ||
    (analyticsConfig.enableUmami && analyticsConfig.umamiScriptUrl && analyticsConfig.umamiWebsiteId) ||
    (analyticsConfig.enableClarity && analyticsConfig.clarityProjectId)
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('analytics.subtitle')}
          </p>
        </div>
        {activeSite && (
          <Button variant="outline" asChild>
            <a href={activeSite.deployedUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('analytics.viewSite')}
            </a>
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{t('analytics.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="settings">{t('analytics.tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Date Range Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t('analytics.dateRange.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('analytics.dateRange.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-1 space-y-2 min-w-0">
                  <Label htmlFor="startDate" className="text-sm">{t('analytics.dateRange.startDate')}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    max={dateRange.end}
                    className="h-9"
                  />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <Label htmlFor="endDate" className="text-sm">{t('analytics.dateRange.endDate')}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    min={dateRange.start}
                    max={new Date().toISOString().split("T")[0]}
                    className="h-9"
                  />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 7);
                      setDateRange({
                        start: start.toISOString().split("T")[0],
                        end: end.toISOString().split("T")[0],
                      });
                    }}
                    className="h-9"
                  >
                    {t('analytics.dateRange.days7')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 30);
                      setDateRange({
                        start: start.toISOString().split("T")[0],
                        end: end.toISOString().split("T")[0],
                      });
                    }}
                    className="h-9"
                  >
                    {t('analytics.dateRange.days30')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - 90);
                      setDateRange({
                        start: start.toISOString().split("T")[0],
                        end: end.toISOString().split("T")[0],
                      });
                    }}
                    className="h-9"
                  >
                    {t('analytics.dateRange.days90')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.status.title')}</CardTitle>
              <CardDescription>
                {t('analytics.status.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('analytics.status.status')}</span>
                  {isConfigured ? (
                    <Badge variant="default" className="gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('analytics.status.active')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-2">
                      <XCircle className="h-3 w-3" />
                      {t('analytics.status.notConfigured')}
                    </Badge>
                  )}
                </div>
                {analyticsConfig && (
                  <div className="text-sm text-muted-foreground">
                    {t('analytics.status.activeProviders')}{" "}
                    <span className="font-medium">
                      {[
                        analyticsConfig.enableGA4 && "GA4",
                        analyticsConfig.enablePlausible && "Plausible",
                        analyticsConfig.enableUmami && "Umami",
                        analyticsConfig.enableClarity && "Clarity",
                      ]
                        .filter(Boolean)
                        .join(", ") || t('analytics.status.none')}
                    </span>
                  </div>
                )}
              </div>

              {!isConfigured && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    {t('analytics.status.notFullyConfigured')}
                  </p>
                </div>
              )}

              {activeSite && isConfigured && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">{t('analytics.status.trackingActiveOn')}</p>
                  <a
                    href={activeSite.deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {activeSite.deployedUrl}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metrics Placeholder */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {t('analytics.metrics.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('analytics.metrics.description')}
                  </CardDescription>
                </div>
                {metrics && metrics.dataSources && metrics.dataSources.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('analytics.metrics.dataFrom')}</span>
                    <div className="flex gap-1 flex-wrap">
                      {metrics.dataSources.map((source: "firestore" | "ga4" | "plausible" | "umami" | "clarity") => (
                        <Badge key={source} variant="outline" className="text-xs">
                          {source === "firestore" ? t('analytics.metrics.realTime') : source.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : metrics ? (
                <>
                  {metrics && "indexError" in metrics && metrics.indexError && (
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">
                          <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            {"warning" in metrics && metrics.warning ? metrics.warning : t('analytics.metrics.indexWarning')}
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            {metrics.indexError.message}
                          </p>
                          {"indexError" in metrics && metrics.indexError?.indexUrl && (
                            <a
                              href={metrics.indexError.indexUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline mt-2 inline-block"
                            >
                              {t('analytics.metrics.createIndex')}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">{metrics.pageViews.toLocaleString()}</div>
                      <div className="text-sm font-medium text-muted-foreground">{t('analytics.metrics.pageViews')}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {formatDateShort(new Date(dateRange.start))} - {formatDateShort(new Date(dateRange.end))}
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">{metrics.visitors.toLocaleString()}</div>
                      <div className="text-sm font-medium text-muted-foreground">{t('analytics.metrics.uniqueVisitors')}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {t('analytics.metrics.basedOnClientIds')}
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">
                        {metrics.bounceRate > 0 ? `${metrics.bounceRate.toFixed(1)}%` : "—"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">{t('analytics.metrics.bounceRate')}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {metrics.avgSessionDuration > 0 
                          ? t('analytics.metrics.avgSession', { seconds: Math.round(metrics.avgSessionDuration) })
                          : t('analytics.metrics.sessionDataUnavailable')}
                      </div>
                    </div>
                  </div>

                  {/* Top Pages */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">{t('analytics.metrics.topPages')}</h3>
                    {metrics.topPages.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.topPages.slice(0, 10).map((page, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium truncate flex-1">{page.path || "/"}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {page.views.toLocaleString()} {page.views === 1 ? t('analytics.metrics.view') : t('analytics.metrics.views')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t('analytics.metrics.noPageViews')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Traffic Sources */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">{t('analytics.metrics.trafficSources')}</h3>
                    {metrics.trafficSources.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.trafficSources.slice(0, 10).map((source, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium">{source.source || t('analytics.metrics.direct')}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {source.visitors.toLocaleString()} {source.visitors === 1 ? t('analytics.metrics.visitor') : t('analytics.metrics.visitors')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t('analytics.metrics.noTrafficSources')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Devices & Browsers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        {t('analytics.metrics.devices')}
                      </h3>
                      {"devices" in metrics && metrics.devices && metrics.devices.length > 0 ? (
                        <div className="space-y-2">
                          {metrics.devices.map((device: { device: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                              <span className="text-sm font-medium">{device.device}</span>
                              <span className="text-sm font-semibold ml-4 text-muted-foreground">
                                {device.visitors.toLocaleString()} {device.visitors === 1 ? t('analytics.metrics.visitor') : t('analytics.metrics.visitors')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 border rounded-lg bg-muted/30 text-center">
                          <p className="text-sm text-muted-foreground">{t('analytics.metrics.noDeviceData')}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        {t('analytics.metrics.browsers')}
                      </h3>
                      {"browsers" in metrics && metrics.browsers && metrics.browsers.length > 0 ? (
                        <div className="space-y-2">
                          {metrics.browsers.map((browser: { browser: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                              <span className="text-sm font-medium">{browser.browser}</span>
                              <span className="text-sm font-semibold ml-4 text-muted-foreground">
                                {browser.visitors.toLocaleString()} {browser.visitors === 1 ? t('analytics.metrics.visitor') : t('analytics.metrics.visitors')}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 border rounded-lg bg-muted/30 text-center">
                          <p className="text-sm text-muted-foreground">{t('analytics.metrics.noBrowserData')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referrers */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">{t('analytics.metrics.topReferrers')}</h3>
                    {"referrers" in metrics && metrics.referrers && metrics.referrers.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.referrers.slice(0, 10).map((referrer: { referrer: string; visitors: number }, index: number) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium truncate flex-1">{referrer.referrer}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {referrer.visitors.toLocaleString()} {referrer.visitors === 1 ? t('analytics.metrics.visitor') : t('analytics.metrics.visitors')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          {t('analytics.metrics.noReferrers')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Page Views Over Time */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {t('analytics.metrics.pageViewsOverTime')}
                      </h3>
                      {metrics && "pageViewsOverTime" in metrics && metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 0 && (() => {
                        const totalViews = metrics.pageViewsOverTime.reduce((sum: number, d: { date: string; views: number }) => sum + d.views, 0);
                        const avgViews = (totalViews / metrics.pageViewsOverTime.length).toFixed(1);
                        const maxViews = Math.max(...metrics.pageViewsOverTime.map((d: { date: string; views: number }) => d.views), 0);
                        return (
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="hidden sm:inline">Avg: <span className="font-semibold text-foreground">{avgViews}</span></span>
                            <span>Peak: <span className="font-semibold text-foreground">{maxViews}</span></span>
                          </div>
                        );
                      })()}
                    </div>
                    {"pageViewsOverTime" in metrics && metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 0 ? (
                      <Card>
                        <CardContent className="p-6">
                          {(() => {
                            // Prepare chart data
                            const chartData = metrics.pageViewsOverTime.map((day: { date: string; views: number; desktop?: number; mobile?: number; tablet?: number }) => {
                              const date = new Date(day.date);
                              const isToday = day.date === new Date().toISOString().split("T")[0];
                              
                              // Format date label based on range length
                              let dateLabel: string;
                              if (metrics.pageViewsOverTime.length <= 7) {
                                dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              } else if (metrics.pageViewsOverTime.length <= 14) {
                                dateLabel = date.getDate().toString();
                              } else {
                                dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
                              }
                              
                              const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
                              const monthName = date.toLocaleDateString('en-US', { month: 'long' });
                              const dayNumber = date.getDate();
                              const year = date.getFullYear();
                              
                              return {
                                date: day.date,
                                views: day.views,
                                desktop: day.desktop || 0,
                                mobile: day.mobile || 0,
                                tablet: day.tablet || 0,
                                label: dateLabel,
                                fullDate: formatDateShort(date),
                                isToday,
                                dayOfWeek,
                                monthName,
                                dayNumber,
                                year,
                                fullDateString: `${dayOfWeek}, ${monthName} ${dayNumber}, ${year}`,
                              };
                            });
                            
                            const maxViews = Math.max(...chartData.map(d => d.views), 1);
                            
                            // Smart scaling: Use "nice" numbers for better UX with small data
                            // This ensures bars are more visible even with small numbers
                            const getNiceMax = (max: number): number => {
                              if (max <= 0) return 5;
                              if (max <= 2) return 2;
                              if (max <= 5) return 5;
                              if (max <= 10) return 10;
                              if (max <= 20) return 20;
                              if (max <= 50) return Math.ceil(max / 10) * 10;
                              if (max <= 100) return Math.ceil(max / 20) * 20;
                              if (max <= 500) return Math.ceil(max / 50) * 50;
                              if (max <= 1000) return Math.ceil(max / 100) * 100;
                              return Math.ceil(max / 200) * 200;
                            };
                            
                            const niceMax = getNiceMax(maxViews);
                            
                            // Chart configuration
                            const chartConfig = {
                              desktop: {
                                label: "Desktop",
                                color: "hsl(var(--primary))",
                              },
                              mobile: {
                                label: "Mobile",
                                color: "hsl(var(--primary))",
                              },
                            };
                            
                            return (
                              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                                  <AreaChart
                                    data={chartData}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                                  >
                                    <defs>
                                      <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                          offset="5%"
                                          stopColor="hsl(var(--primary))"
                                          stopOpacity={0.8}
                                        />
                                        <stop
                                          offset="95%"
                                          stopColor="hsl(var(--primary))"
                                          stopOpacity={0.1}
                                        />
                                      </linearGradient>
                                      <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                          offset="5%"
                                          stopColor="hsl(var(--primary))"
                                          stopOpacity={0.5}
                                        />
                                        <stop
                                          offset="95%"
                                          stopColor="hsl(var(--primary))"
                                          stopOpacity={0.05}
                                        />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} />
                                  <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    minTickGap={32}
                                    className="text-xs text-muted-foreground"
                                    interval={Math.max(0, Math.floor(chartData.length / 10))}
                                    tickFormatter={(value) => {
                                      const date = new Date(value);
                                      if (chartData.length <= 7) {
                                        return date.toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        });
                                      } else if (chartData.length <= 14) {
                                        return date.getDate().toString();
                                      } else {
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                      }
                                    }}
                                  />
                                    <YAxis
                                      tickLine={false}
                                      axisLine={false}
                                      tickMargin={8}
                                      domain={[0, niceMax]}
                                      allowDataOverflow={false}
                                      tickCount={6}
                                      className="text-xs text-muted-foreground"
                                      tickFormatter={(value) => value.toString()}
                                    />
                                    <ChartTooltip
                                      cursor={false}
                                      content={
                                        <ChartTooltipContent
                                          labelFormatter={(value) => {
                                            const date = new Date(value);
                                            const dataPoint = chartData.find(d => d.date === value);
                                            const formattedDate = date.toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                            });
                                            
                                            if (dataPoint?.isToday) {
                                              return (
                                                <div className="space-y-1">
                                                  <p className="font-semibold">{formattedDate}</p>
                                                  <p className="text-xs text-primary font-medium">Today</p>
                                                </div>
                                              );
                                            }
                                            
                                            return formattedDate;
                                          }}
                                          indicator="dot"
                                        />
                                      }
                                    />
                                    <Area
                                      dataKey="mobile"
                                      type="monotone"
                                      fill="url(#fillMobile)"
                                      stroke="hsl(var(--primary))"
                                      strokeOpacity={0.6}
                                      stackId="a"
                                      isAnimationActive={false}
                                    />
                                    <Area
                                      dataKey="desktop"
                                      type="monotone"
                                      fill="url(#fillDesktop)"
                                      stroke="hsl(var(--primary))"
                                      stackId="a"
                                      isAnimationActive={false}
                                    />
                                    <ChartLegend content={<ChartLegendContent />} />
                                  </AreaChart>
                              </ChartContainer>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="p-12 border rounded-lg bg-muted/30 text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">
                          {t('analytics.metrics.noPageViewData')}
                          <br />
                          {t('analytics.metrics.dataWillAppear')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Overall Empty State */}
                  {metrics.pageViews === 0 && metrics.visitors === 0 && (
                    <div className="mt-8 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">{t('analytics.metrics.noAnalyticsData')}</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        {t('analytics.metrics.analyticsReady')}
                      </p>
                      {activeSite && (
                        <Button variant="outline" asChild>
                          <a href={activeSite.deployedUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t('analytics.metrics.visitYourSite')}
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.metrics.unableToLoad')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('analytics.settings.title')}
              </CardTitle>
              <CardDescription>
                {t('analytics.settings.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Analytics */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">{t('analytics.settings.enableAnalytics')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.settings.enableAnalyticsDescription')}
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={localConfig.enabled}
                  onCheckedChange={(checked) =>
                    setLocalConfig({ ...localConfig, enabled: checked })
                  }
                />
              </div>

              {localConfig.enabled && (
                <>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">{t('analytics.settings.analyticsProviders')}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('analytics.settings.analyticsProvidersDescription')}
                      </p>
                    </div>

                    {/* Google Analytics 4 */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableGA4">{t('analytics.settings.ga4.label')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('analytics.settings.ga4.description')}
                          </p>
                        </div>
                        <Switch
                          id="enableGA4"
                          checked={localConfig.enableGA4}
                          onCheckedChange={(checked) =>
                            setLocalConfig({ ...localConfig, enableGA4: checked })
                          }
                        />
                      </div>
                      {localConfig.enableGA4 && (
                        <div className="space-y-2 pt-2 border-t">
                          <Label htmlFor="ga4MeasurementId">{t('analytics.settings.ga4.measurementId')}</Label>
                          <Input
                            id="ga4MeasurementId"
                            placeholder={t('analytics.settings.ga4.measurementIdPlaceholder')}
                            value={localConfig.ga4MeasurementId}
                            onChange={(e) =>
                              setLocalConfig({ ...localConfig, ga4MeasurementId: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Plausible */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enablePlausible">{t('analytics.settings.plausible.label')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('analytics.settings.plausible.description')}
                          </p>
                        </div>
                        <Switch
                          id="enablePlausible"
                          checked={localConfig.enablePlausible}
                          onCheckedChange={(checked) =>
                            setLocalConfig({ ...localConfig, enablePlausible: checked })
                          }
                        />
                      </div>
                      {localConfig.enablePlausible && (
                        <div className="space-y-2 pt-2 border-t">
                          <Label htmlFor="plausibleDomain">{t('analytics.settings.plausible.domain')}</Label>
                          <Input
                            id="plausibleDomain"
                            placeholder={t('analytics.settings.plausible.domainPlaceholder')}
                            value={localConfig.plausibleDomain}
                            onChange={(e) =>
                              setLocalConfig({ ...localConfig, plausibleDomain: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>

                    {/* Umami */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableUmami">{t('analytics.settings.umami.label')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('analytics.settings.umami.description')}
                          </p>
                        </div>
                        <Switch
                          id="enableUmami"
                          checked={localConfig.enableUmami}
                          onCheckedChange={(checked) =>
                            setLocalConfig({ ...localConfig, enableUmami: checked })
                          }
                        />
                      </div>
                      {localConfig.enableUmami && (
                        <div className="space-y-4 pt-2 border-t">
                          <div className="space-y-2">
                            <Label htmlFor="umamiScriptUrl">{t('analytics.settings.umami.scriptUrl')}</Label>
                            <Input
                              id="umamiScriptUrl"
                              placeholder={t('analytics.settings.umami.scriptUrlPlaceholder')}
                              value={localConfig.umamiScriptUrl}
                              onChange={(e) =>
                                setLocalConfig({ ...localConfig, umamiScriptUrl: e.target.value })
                              }
                            />
                            <p className="text-sm text-muted-foreground">
                              {t('analytics.settings.umami.scriptUrlDescription')}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="umamiWebsiteId">{t('analytics.settings.umami.websiteId')}</Label>
                            <Input
                              id="umamiWebsiteId"
                              placeholder={t('analytics.settings.umami.websiteIdPlaceholder')}
                              value={localConfig.umamiWebsiteId}
                              onChange={(e) =>
                                setLocalConfig({ ...localConfig, umamiWebsiteId: e.target.value })
                              }
                            />
                            <p className="text-sm text-muted-foreground">
                              {t('analytics.settings.umami.websiteIdDescription')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Microsoft Clarity */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableClarity">{t('analytics.settings.clarity.label')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {t('analytics.settings.clarity.description')}
                          </p>
                        </div>
                        <Switch
                          id="enableClarity"
                          checked={localConfig.enableClarity}
                          onCheckedChange={(checked) =>
                            setLocalConfig({ ...localConfig, enableClarity: checked })
                          }
                        />
                      </div>
                      {localConfig.enableClarity && (
                        <div className="space-y-2 pt-2 border-t">
                          <Label htmlFor="clarityProjectId">{t('analytics.settings.clarity.projectId')}</Label>
                          <Input
                            id="clarityProjectId"
                            placeholder={t('analytics.settings.clarity.projectIdPlaceholder')}
                            value={localConfig.clarityProjectId}
                            onChange={(e) =>
                              setLocalConfig({ ...localConfig, clarityProjectId: e.target.value })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Consent Settings */}
                  <div className="space-y-2">
                    <Label htmlFor="consentDefault">{t('analytics.settings.consent.default')}</Label>
                    <Select
                      value={localConfig.consentDefault}
                      onValueChange={(value: "denied" | "granted") =>
                        setLocalConfig({ ...localConfig, consentDefault: value })
                      }
                    >
                      <SelectTrigger id="consentDefault">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="denied">{t('analytics.settings.consent.denied')}</SelectItem>
                        <SelectItem value="granted">{t('analytics.settings.consent.granted')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      {t('analytics.settings.consent.defaultDescription')}
                    </p>
                  </div>

                  {/* Consent Banner Customizer - Only show when consent is denied */}
                  {localConfig.consentDefault === "denied" && (
                    <div className="pt-4 border-t">
                      <ConsentBannerCustomizer
                        styling={
                          localConfig.consentBannerStyling ||
                          consentBannerStylingSchema.parse({})
                        }
                        onStylingChange={(styling) =>
                          setLocalConfig({ ...localConfig, consentBannerStyling: styling })
                        }
                      />
                    </div>
                  )}
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving || !organization?.id}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('analytics.settings.saving')}
                    </>
                  ) : (
                    t('analytics.settings.saveConfiguration')
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

