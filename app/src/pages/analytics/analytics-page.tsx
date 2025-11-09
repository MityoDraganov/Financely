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
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useAnalyticsMetrics(
    organization?.id,
    dateRange.start,
    dateRange.end,
  );

  useEffect(() => {
    if (metricsError) {
      toast.error("Failed to fetch analytics metrics");
    }
  }, [metricsError]);

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
        bannerProvider: analyticsConfig.bannerProvider ?? "custom",
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
        enableGA4: boolean;
        enablePlausible: boolean;
        enableUmami: boolean;
        enableClarity: boolean;
        consentDefault: "denied" | "granted";
        bannerProvider: "custom" | "cookiebot" | "iubenda" | "klaro";
        enableBigQueryServerLogs: boolean;
        orgId: string;
        siteId?: string;
        brandName?: string;
        ga4MeasurementId?: string;
        clarityProjectId?: string;
        plausibleDomain?: string;
        umamiScriptUrl?: string;
        umamiWebsiteId?: string;
      } = {
        enabled: localConfig.enabled,
        enableGA4: localConfig.enableGA4,
        enablePlausible: localConfig.enablePlausible,
        enableUmami: localConfig.enableUmami,
        enableClarity: localConfig.enableClarity,
        consentDefault: localConfig.consentDefault,
        bannerProvider: localConfig.bannerProvider,
        enableBigQueryServerLogs: localConfig.enableBigQueryServerLogs,
        orgId: organization.id,
        siteId: brandSites?.[0]?.id || undefined,
        brandName: organization.settings?.branding?.companyName || organization.name || undefined,
      };

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
    (analyticsConfig.enableGA4 && analyticsConfig.ga4MeasurementId) ||
    (analyticsConfig.enablePlausible && analyticsConfig.plausibleDomain) ||
    (analyticsConfig.enableUmami && analyticsConfig.umamiScriptUrl && analyticsConfig.umamiWebsiteId) ||
    (analyticsConfig.enableClarity && analyticsConfig.clarityProjectId)
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
                    Active providers:{" "}
                    <span className="font-medium">
                      {[
                        analyticsConfig.enableGA4 && "GA4",
                        analyticsConfig.enablePlausible && "Plausible",
                        analyticsConfig.enableUmami && "Umami",
                        analyticsConfig.enableClarity && "Clarity",
                      ]
                        .filter(Boolean)
                        .join(", ") || "None"}
                    </span>
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
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
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

                  {/* Main Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">{metrics.pageViews.toLocaleString()}</div>
                      <div className="text-sm font-medium text-muted-foreground">Page Views</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(dateRange.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(dateRange.end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">{metrics.visitors.toLocaleString()}</div>
                      <div className="text-sm font-medium text-muted-foreground">Unique Visitors</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Based on client IDs
                      </div>
                    </div>
                    <div className="p-6 border rounded-lg bg-card hover:shadow-md transition-shadow">
                      <div className="text-3xl font-bold mb-1">
                        {metrics.bounceRate > 0 ? `${metrics.bounceRate.toFixed(1)}%` : "—"}
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">Bounce Rate</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {metrics.avgSessionDuration > 0 
                          ? `Avg session: ${Math.round(metrics.avgSessionDuration)}s`
                          : "Session data unavailable"}
                      </div>
                    </div>
                  </div>

                  {/* Top Pages */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
                    {metrics.topPages.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.topPages.slice(0, 10).map((page, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium truncate flex-1">{page.path || "/"}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {page.views.toLocaleString()} {page.views === 1 ? "view" : "views"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No page views recorded yet. Pages will appear here once visitors start browsing your site.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Traffic Sources */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Traffic Sources</h3>
                    {metrics.trafficSources.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.trafficSources.slice(0, 10).map((source, index) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium">{source.source || "Direct"}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {source.visitors.toLocaleString()} {source.visitors === 1 ? "visitor" : "visitors"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No traffic sources recorded yet. Sources will appear here as visitors arrive.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Devices & Browsers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Devices
                      </h3>
                      {"devices" in metrics && metrics.devices && metrics.devices.length > 0 ? (
                        <div className="space-y-2">
                          {metrics.devices.map((device: { device: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                              <span className="text-sm font-medium">{device.device}</span>
                              <span className="text-sm font-semibold ml-4 text-muted-foreground">
                                {device.visitors.toLocaleString()} {device.visitors === 1 ? "visitor" : "visitors"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 border rounded-lg bg-muted/30 text-center">
                          <p className="text-sm text-muted-foreground">No device data available</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Browsers
                      </h3>
                      {"browsers" in metrics && metrics.browsers && metrics.browsers.length > 0 ? (
                        <div className="space-y-2">
                          {metrics.browsers.map((browser: { browser: string; visitors: number }, index: number) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                              <span className="text-sm font-medium">{browser.browser}</span>
                              <span className="text-sm font-semibold ml-4 text-muted-foreground">
                                {browser.visitors.toLocaleString()} {browser.visitors === 1 ? "visitor" : "visitors"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 border rounded-lg bg-muted/30 text-center">
                          <p className="text-sm text-muted-foreground">No browser data available</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Referrers */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Top Referrers</h3>
                    {"referrers" in metrics && metrics.referrers && metrics.referrers.length > 0 ? (
                      <div className="space-y-2">
                        {metrics.referrers.slice(0, 10).map((referrer: { referrer: string; visitors: number }, index: number) => (
                          <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <span className="text-sm font-medium truncate flex-1">{referrer.referrer}</span>
                            <span className="text-sm font-semibold ml-4 text-muted-foreground">
                              {referrer.visitors.toLocaleString()} {referrer.visitors === 1 ? "visitor" : "visitors"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No referrers recorded yet. Referrers will appear here when visitors arrive from other websites.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Page Views Over Time */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Page Views Over Time
                    </h3>
                    {"pageViewsOverTime" in metrics && metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 0 ? (
                      <div className="p-6 border rounded-lg bg-muted/30">
                        <div className="flex items-end gap-1 h-64 mb-4">
                          {metrics.pageViewsOverTime.map((day: { date: string; views: number }, index: number) => {
                            const maxViews = Math.max(...metrics.pageViewsOverTime.map((d: { date: string; views: number }) => d.views), 1);
                            const height = (day.views / maxViews) * 100;
                            return (
                              <div
                                key={index}
                                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
                                title={`${day.date}: ${day.views} ${day.views === 1 ? "view" : "views"}`}
                              >
                                <div
                                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80 min-h-[4px] shadow-sm"
                                  style={{ height: `${Math.max(height, 4)}%` }}
                                />
                                {metrics.pageViewsOverTime.length <= 30 && (
                                  <span className="text-xs text-muted-foreground transform -rotate-45 origin-top-left whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {metrics.pageViewsOverTime && metrics.pageViewsOverTime.length > 30 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Showing daily page views (hover bars for details)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-12 border rounded-lg bg-muted/30 text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">
                          No page view data available for the selected date range. 
                          <br />
                          Data will appear here once visitors start browsing your site.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Overall Empty State */}
                  {metrics.pageViews === 0 && metrics.visitors === 0 && (
                    <div className="mt-8 p-8 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">No Analytics Data Yet</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        Your analytics is configured and ready. Once visitors start browsing your site, 
                        metrics will appear here automatically.
                      </p>
                      {activeSite && (
                        <Button variant="outline" asChild>
                          <a href={activeSite.deployedUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Visit Your Site
                          </a>
                        </Button>
                      )}
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
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Analytics Providers</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Enable one or more analytics providers to track your website. You can use multiple providers simultaneously.
                      </p>
                    </div>

                    {/* Google Analytics 4 */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableGA4">Google Analytics 4 (gtag.js)</Label>
                          <p className="text-sm text-muted-foreground">
                            Direct Google Analytics 4 tracking
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
                    </div>

                    {/* Plausible */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enablePlausible">Plausible Analytics</Label>
                          <p className="text-sm text-muted-foreground">
                            Privacy-friendly, open-source analytics
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
                    </div>

                    {/* Umami */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableUmami">Umami Analytics</Label>
                          <p className="text-sm text-muted-foreground">
                            Privacy-focused, open-source analytics solution
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
                    </div>

                    {/* Microsoft Clarity */}
                    <div className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableClarity">Microsoft Clarity</Label>
                          <p className="text-sm text-muted-foreground">
                            Session replay, heatmaps, and user behavior insights
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
                          <Label htmlFor="clarityProjectId">Clarity Project ID</Label>
                          <Input
                            id="clarityProjectId"
                            placeholder="Clarity Project ID"
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

