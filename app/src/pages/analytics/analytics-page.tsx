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
import { Loader2, BarChart3, Settings, ExternalLink, CheckCircle2, XCircle, Calendar, Monitor, Globe, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function AnalyticsPage() {
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

  // Fetch real analytics metrics
  const { data: metrics, isLoading: metricsLoading } = useAnalyticsMetrics(
    organization?.id,
    dateRange.start,
    dateRange.end,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<{
    enabled: boolean;
    strategy: "gtm" | "gtag_only" | "plausible" | "umami";
    gtmContainerId: string;
    ga4MeasurementId: string;
    clarityProjectId: string;
    plausibleDomain: string;
    umamiScriptUrl: string;
    umamiWebsiteId: string;
    consentDefault: "denied" | "granted";
    bannerProvider: "custom" | "cookiebot" | "iubenda" | "klaro";
    enableClarity: boolean;
    enableBigQueryServerLogs: boolean;
  }>({
    enabled: false,
    strategy: "gtag_only",
    gtmContainerId: "",
    ga4MeasurementId: "",
    clarityProjectId: "",
    plausibleDomain: "",
    umamiScriptUrl: "",
    umamiWebsiteId: "",
    consentDefault: "denied",
    bannerProvider: "custom",
    enableClarity: false,
    enableBigQueryServerLogs: false,
  });

  // Update local config when analyticsConfig changes
  useEffect(() => {
    if (analyticsConfig) {
      setLocalConfig({
        enabled: analyticsConfig.enabled ?? false,
        strategy: analyticsConfig.strategy ?? "gtag_only",
        gtmContainerId: analyticsConfig.gtmContainerId ?? "",
        ga4MeasurementId: analyticsConfig.ga4MeasurementId ?? "",
        clarityProjectId: analyticsConfig.clarityProjectId ?? "",
        plausibleDomain: analyticsConfig.plausibleDomain ?? "",
        umamiScriptUrl: analyticsConfig.umamiScriptUrl ?? "",
        umamiWebsiteId: analyticsConfig.umamiWebsiteId ?? "",
        consentDefault: analyticsConfig.consentDefault ?? "denied",
        bannerProvider: analyticsConfig.bannerProvider ?? "custom",
        enableClarity: analyticsConfig.enableClarity ?? false,
        enableBigQueryServerLogs: analyticsConfig.enableBigQueryServerLogs ?? false,
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
        strategy: "gtm" | "gtag_only" | "plausible" | "umami";
        consentDefault: "denied" | "granted";
        bannerProvider: "custom" | "cookiebot" | "iubenda" | "klaro";
        enableClarity: boolean;
        enableBigQueryServerLogs: boolean;
        orgId: string;
        siteId?: string;
        brandName?: string;
        gtmContainerId?: string;
        ga4MeasurementId?: string;
        clarityProjectId?: string;
        plausibleDomain?: string;
        umamiScriptUrl?: string;
        umamiWebsiteId?: string;
      } = {
        enabled: localConfig.enabled,
        strategy: localConfig.strategy,
        consentDefault: localConfig.consentDefault,
        bannerProvider: localConfig.bannerProvider,
        enableClarity: localConfig.enableClarity,
        enableBigQueryServerLogs: localConfig.enableBigQueryServerLogs,
        orgId: organization.id,
        siteId: brandSites?.[0]?.id || undefined,
        brandName: organization.settings?.branding?.companyName || organization.name || undefined,
      };

      // Only include strategy-specific fields if they have values
      if (localConfig.gtmContainerId) {
        configData.gtmContainerId = localConfig.gtmContainerId;
      }
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
      } else {
        toast.success("Analytics configuration saved");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save analytics configuration: ${errorMessage}`);
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
    (analyticsConfig.strategy === "gtm" && analyticsConfig.gtmContainerId) ||
    (analyticsConfig.strategy === "gtag_only" && analyticsConfig.ga4MeasurementId) ||
    (analyticsConfig.strategy === "plausible" && analyticsConfig.plausibleDomain) ||
    (analyticsConfig.strategy === "umami" && analyticsConfig.umamiScriptUrl && analyticsConfig.umamiWebsiteId)
  );

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Track and analyze your website performance
          </p>
        </div>
        {activeSite && (
          <Button variant="outline" asChild>
            <a href={activeSite.deployedUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Site
            </a>
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Date Range Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Date Range
              </CardTitle>
              <CardDescription>
                Select the time period for analytics data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    max={dateRange.end}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    min={dateRange.start}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="flex gap-2 pt-6">
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
                  >
                    7d
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
                  >
                    30d
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
                  >
                    90d
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics Status</CardTitle>
              <CardDescription>
                Current analytics configuration and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  {isConfigured ? (
                    <Badge variant="default" className="gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-2">
                      <XCircle className="h-3 w-3" />
                      Not Configured
                    </Badge>
                  )}
                </div>
                {analyticsConfig && (
                  <div className="text-sm text-muted-foreground">
                    Strategy: <span className="font-medium">{analyticsConfig.strategy}</span>
                  </div>
                )}
              </div>

              {!isConfigured && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    Analytics is not fully configured. Go to Settings to enable and configure
                    your analytics provider.
                  </p>
                </div>
              )}

              {activeSite && isConfigured && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Tracking Active On:</p>
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
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Metrics
              </CardTitle>
              <CardDescription>
                Website performance metrics and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : metrics ? (
                <>
                  {metrics && "indexError" in metrics && metrics.indexError && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">
                          <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            {"warning" in metrics && metrics.warning ? metrics.warning : "Index Warning"}
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
                              Create index →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-6 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.pageViews.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground mt-1">Page Views</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Last 30 days
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg">
                      <div className="text-2xl font-bold">{metrics.visitors.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground mt-1">Visitors</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Unique visitors
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg">
                      <div className="text-2xl font-bold">
                        {metrics.bounceRate > 0 ? `${metrics.bounceRate.toFixed(1)}%` : "N/A"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Bounce Rate</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {metrics.avgSessionDuration > 0 
                          ? `Avg: ${Math.round(metrics.avgSessionDuration)}s`
                          : "Session data unavailable"}
                      </div>
                    </div>
                  </div>

                  {metrics.topPages.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">Top Pages</h3>
                      <div className="space-y-2">
                        {metrics.topPages.slice(0, 5).map((page, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="text-sm font-medium truncate">{page.path}</span>
                            <span className="text-sm text-muted-foreground ml-4">
                              {page.views.toLocaleString()} views
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {metrics.trafficSources.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">Traffic Sources</h3>
                      <div className="space-y-2">
                        {metrics.trafficSources.slice(0, 5).map((source, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="text-sm font-medium">{source.source}</span>
                            <span className="text-sm text-muted-foreground ml-4">
                              {source.visitors.toLocaleString()} visitors
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Devices & Browsers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {"devices" in metrics && metrics.devices && metrics.devices.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Monitor className="h-5 w-5" />
                          Devices
                        </h3>
                        <div className="space-y-2">
                          {metrics.devices.map((device: { device: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <span className="text-sm font-medium">{device.device}</span>
                              <span className="text-sm text-muted-foreground ml-4">
                                {device.visitors.toLocaleString()} visitors
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {"browsers" in metrics && metrics.browsers && metrics.browsers.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          Browsers
                        </h3>
                        <div className="space-y-2">
                          {metrics.browsers.map((browser: { browser: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <span className="text-sm font-medium">{browser.browser}</span>
                              <span className="text-sm text-muted-foreground ml-4">
                                {browser.visitors.toLocaleString()} visitors
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Referrers */}
                  {"referrers" in metrics && metrics.referrers && metrics.referrers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">Top Referrers</h3>
                      <div className="space-y-2">
                        {metrics.referrers.slice(0, 5).map((referrer: { referrer: string; visitors: number }, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="text-sm font-medium truncate">{referrer.referrer}</span>
                            <span className="text-sm text-muted-foreground ml-4">
                              {referrer.visitors.toLocaleString()} visitors
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Page Views Over Time */}
                  {"pageViewsOverTime" in metrics && metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Page Views Over Time
                      </h3>
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-end gap-1 h-48">
                          {metrics.pageViewsOverTime.map((day: { date: string; views: number }, index: number) => {
                            const maxViews = Math.max(...metrics.pageViewsOverTime.map((d: { date: string; views: number }) => d.views), 1);
                            const height = (day.views / maxViews) * 100;
                            return (
                              <div
                                key={index}
                                className="flex-1 flex flex-col items-center gap-1 group"
                                title={`${day.date}: ${day.views} views`}
                              >
                                <div
                                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80 min-h-[2px]"
                                  style={{ height: `${Math.max(height, 2)}%` }}
                                />
                                {metrics.pageViewsOverTime.length <= 30 && (
                                  <span className="text-xs text-muted-foreground transform -rotate-45 origin-top-left whitespace-nowrap">
                                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 30 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Showing daily page views (hover bars for details)
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {metrics.pageViews === 0 && metrics.visitors === 0 && (
                    <div className="mt-6 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        No analytics data available yet. Once visitors start browsing your site,
                        metrics will appear here automatically.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Unable to load analytics data. Please ensure analytics is properly configured.
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
                Analytics Configuration
              </CardTitle>
              <CardDescription>
                Configure your analytics provider and tracking settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Analytics */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">Enable Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable analytics tracking on your website
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
                  {/* Strategy Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Analytics Strategy</Label>
                    <Select
                      value={localConfig.strategy}
                      onValueChange={(value: "gtm" | "gtag_only" | "plausible" | "umami") =>
                        setLocalConfig({ ...localConfig, strategy: value })
                      }
                    >
                      <SelectTrigger id="strategy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gtm">Google Tag Manager</SelectItem>
                        <SelectItem value="gtag_only">Google Analytics 4 (gtag)</SelectItem>
                        <SelectItem value="plausible">Plausible</SelectItem>
                        <SelectItem value="umami">Umami</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GTM Configuration */}
                  {localConfig.strategy === "gtm" && (
                    <div className="space-y-2">
                      <Label htmlFor="gtmContainerId">GTM Container ID</Label>
                      <Input
                        id="gtmContainerId"
                        placeholder="GTM-XXXXXXX"
                        value={localConfig.gtmContainerId}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, gtmContainerId: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {/* GA4 Configuration */}
                  {(localConfig.strategy === "gtag_only" || localConfig.strategy === "gtm") && (
                    <div className="space-y-2">
                      <Label htmlFor="ga4MeasurementId">GA4 Measurement ID</Label>
                      <Input
                        id="ga4MeasurementId"
                        placeholder="G-XXXXXXXXXX"
                        value={localConfig.ga4MeasurementId}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, ga4MeasurementId: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {/* Plausible Configuration */}
                  {localConfig.strategy === "plausible" && (
                    <div className="space-y-2">
                      <Label htmlFor="plausibleDomain">Plausible Domain</Label>
                      <Input
                        id="plausibleDomain"
                        placeholder="yourdomain.com"
                        value={localConfig.plausibleDomain}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, plausibleDomain: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {/* Umami Configuration */}
                  {localConfig.strategy === "umami" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="umamiScriptUrl">Umami Script URL</Label>
                        <Input
                          id="umamiScriptUrl"
                          placeholder="https://cloud.umami.is/script.js"
                          value={localConfig.umamiScriptUrl}
                          onChange={(e) =>
                            setLocalConfig({ ...localConfig, umamiScriptUrl: e.target.value })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          The URL to your Umami script (e.g., https://cloud.umami.is/script.js)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="umamiWebsiteId">Umami Website ID</Label>
                        <Input
                          id="umamiWebsiteId"
                          placeholder="e74df8d0-2837-4ec1-bac8-ce82e8a170b2"
                          value={localConfig.umamiWebsiteId}
                          onChange={(e) =>
                            setLocalConfig({ ...localConfig, umamiWebsiteId: e.target.value })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          Your Umami website ID from the tracking code
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Clarity Configuration */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="enableClarity">Enable Microsoft Clarity</Label>
                        <p className="text-sm text-muted-foreground">
                          Session replay and heatmaps
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
                      <Input
                        id="clarityProjectId"
                        placeholder="Clarity Project ID"
                        value={localConfig.clarityProjectId}
                        onChange={(e) =>
                          setLocalConfig({ ...localConfig, clarityProjectId: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {/* Consent Settings */}
                  <div className="space-y-2">
                    <Label htmlFor="consentDefault">Default Consent</Label>
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
                        <SelectItem value="denied">Denied (GDPR Compliant)</SelectItem>
                        <SelectItem value="granted">Granted</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Default consent state for analytics tracking
                    </p>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving || !organization?.id}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
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

