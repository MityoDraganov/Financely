import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, ToggleLeft, BarChart3, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAdminSystemSettings, useAdminUpdateSystemSettings } from "@/hooks/admin/use-admin-system-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Default settings values
const DEFAULT_PRICING = {
  starter: { monthly: 29, yearly: 290 },
  professional: { monthly: 99, yearly: 990 },
  enterprise: { monthly: 299, yearly: 2990 },
};

const DEFAULT_FEATURE_TOGGLES = {
  allowSignups: true,
  maintenanceMode: false,
  apiAccess: true,
  customTemplates: true,
  emailSending: true,
  pdfGeneration: true,
};

const DEFAULT_GLOBAL_LIMITS = {
  maxOrganizations: 10000,
  maxUsersPerOrg: 100,
  maxInvoicesPerOrg: 10000,
  maxTemplatesPerOrg: 1000,
  maxStoragePerOrgMB: 10000,
};

export function AdminSettingsPage() {
  const { data: settings, isLoading, error } = useAdminSystemSettings();
  const updateSettings = useAdminUpdateSystemSettings();

  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [featureToggles, setFeatureToggles] = useState(DEFAULT_FEATURE_TOGGLES);
  const [globalLimits, setGlobalLimits] = useState(DEFAULT_GLOBAL_LIMITS);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from backend
  useEffect(() => {
    if (!isLoading) {
      if (settings) {
        setPricing(settings.pricing || DEFAULT_PRICING);
        setFeatureToggles(settings.featureToggles || DEFAULT_FEATURE_TOGGLES);
        setGlobalLimits(settings.globalLimits || DEFAULT_GLOBAL_LIMITS);
        setHasChanges(false);
      } else {
        // Settings don't exist yet, use defaults
        setPricing(DEFAULT_PRICING);
        setFeatureToggles(DEFAULT_FEATURE_TOGGLES);
        setGlobalLimits(DEFAULT_GLOBAL_LIMITS);
        setHasChanges(false);
      }
    }
  }, [settings, isLoading]);

  const handlePricingChange = (plan: string, period: "monthly" | "yearly", value: number) => {
    if (isNaN(value) || value < 0) {
      return;
    }
    setPricing((prev) => {
      const newPricing = {
        ...prev,
        [plan]: {
          ...prev[plan as keyof typeof prev],
          [period]: value,
        },
      };
      // Check if pricing has changed from saved settings
      const hasChanged = !settings || JSON.stringify(newPricing) !== JSON.stringify(settings.pricing);
      setHasChanges(hasChanged);
      return newPricing;
    });
  };

  const handleFeatureToggle = (feature: string, enabled: boolean) => {
    setFeatureToggles((prev) => {
      const newToggles = {
        ...prev,
        [feature]: enabled,
      };
      // Check if toggles have changed from saved settings
      const hasChanged = !settings || JSON.stringify(newToggles) !== JSON.stringify(settings.featureToggles);
      setHasChanges(hasChanged);
      return newToggles;
    });
  };

  const handleLimitChange = (limit: string, value: number) => {
    if (isNaN(value) || value < 0) {
      return;
    }
    setGlobalLimits((prev) => {
      const newLimits = {
        ...prev,
        [limit]: value,
      };
      // Check if limits have changed from saved settings
      const hasChanged = !settings || JSON.stringify(newLimits) !== JSON.stringify(settings.globalLimits);
      setHasChanges(hasChanged);
      return newLimits;
    });
  };

  const handleSavePricing = () => {
    // Validate pricing values
    const hasInvalidPricing = Object.values(pricing).some(
      (plan) => plan.monthly < 0 || plan.yearly < 0 || isNaN(plan.monthly) || isNaN(plan.yearly)
    );

    if (hasInvalidPricing) {
      toast.error("Please enter valid pricing values (must be positive numbers)");
      return;
    }

    updateSettings.mutate(
      { pricing },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleSaveFeatureToggles = () => {
    updateSettings.mutate(
      { featureToggles },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleSaveGlobalLimits = () => {
    // Validate limits
    const hasInvalidLimits = Object.values(globalLimits).some(
      (limit) => limit < 0 || isNaN(limit)
    );

    if (hasInvalidLimits) {
      toast.error("Please enter valid limit values (must be positive numbers)");
      return;
    }

    updateSettings.mutate(
      { globalLimits },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure platform-wide settings and limits</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Error loading settings. Please try again.
              {error && (
                <div className="mt-2 text-sm text-destructive">
                  {error instanceof Error ? error.message : String(error)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Configure platform-wide settings and limits</p>
      </div>

      <Tabs defaultValue="pricing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="features">
            <ToggleLeft className="h-4 w-4 mr-2" />
            Feature Toggles
          </TabsTrigger>
          <TabsTrigger value="limits">
            <BarChart3 className="h-4 w-4 mr-2" />
            Global Limits
          </TabsTrigger>
        </TabsList>

        {/* Pricing Configuration */}
        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Pricing</CardTitle>
              <CardDescription>
                Configure pricing for different subscription plans
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Starter Plan */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Starter Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Basic features for small teams
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="starter-monthly">Monthly Price ($)</Label>
                    <Input
                      id="starter-monthly"
                      type="number"
                      value={pricing.starter.monthly}
                      onChange={(e) =>
                        handlePricingChange("starter", "monthly", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="starter-yearly">Yearly Price ($)</Label>
                    <Input
                      id="starter-yearly"
                      type="number"
                      value={pricing.starter.yearly}
                      onChange={(e) =>
                        handlePricingChange("starter", "yearly", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Professional Plan */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Professional Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Advanced features for growing businesses
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="professional-monthly">Monthly Price ($)</Label>
                    <Input
                      id="professional-monthly"
                      type="number"
                      value={pricing.professional.monthly}
                      onChange={(e) =>
                        handlePricingChange(
                          "professional",
                          "monthly",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="professional-yearly">Yearly Price ($)</Label>
                    <Input
                      id="professional-yearly"
                      type="number"
                      value={pricing.professional.yearly}
                      onChange={(e) =>
                        handlePricingChange(
                          "professional",
                          "yearly",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Enterprise Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Full features with custom support
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="enterprise-monthly">Monthly Price ($)</Label>
                    <Input
                      id="enterprise-monthly"
                      type="number"
                      value={pricing.enterprise.monthly}
                      onChange={(e) =>
                        handlePricingChange(
                          "enterprise",
                          "monthly",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="enterprise-yearly">Yearly Price ($)</Label>
                    <Input
                      id="enterprise-yearly"
                      type="number"
                      value={pricing.enterprise.yearly}
                      onChange={(e) =>
                        handlePricingChange(
                          "enterprise",
                          "yearly",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSavePricing}
                  disabled={updateSettings.isPending || !hasChanges}
                >
                  {updateSettings.isPending ? "Saving..." : "Save Pricing"}
                </Button>
                <Button variant="outline" disabled>
                  Sync with Stripe
                </Button>
                {hasChanges && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    Unsaved changes
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Toggles */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>
                Enable or disable platform features globally
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow New Signups</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new users to create accounts
                  </p>
                </div>
                <Switch
                  checked={featureToggles.allowSignups}
                  onCheckedChange={(checked) => handleFeatureToggle("allowSignups", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Put the platform in maintenance mode
                  </p>
                </div>
                <Switch
                  checked={featureToggles.maintenanceMode}
                  onCheckedChange={(checked) => handleFeatureToggle("maintenanceMode", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>API Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable API access for organizations
                  </p>
                </div>
                <Switch
                  checked={featureToggles.apiAccess}
                  onCheckedChange={(checked) => handleFeatureToggle("apiAccess", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Custom Templates</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow organizations to create custom templates
                  </p>
                </div>
                <Switch
                  checked={featureToggles.customTemplates}
                  onCheckedChange={(checked) => handleFeatureToggle("customTemplates", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Sending</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable email sending functionality
                  </p>
                </div>
                <Switch
                  checked={featureToggles.emailSending}
                  onCheckedChange={(checked) => handleFeatureToggle("emailSending", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>PDF Generation</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable PDF generation for invoices
                  </p>
                </div>
                <Switch
                  checked={featureToggles.pdfGeneration}
                  onCheckedChange={(checked) => handleFeatureToggle("pdfGeneration", checked)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveFeatureToggles}
                  disabled={updateSettings.isPending || !hasChanges}
                >
                  {updateSettings.isPending ? "Saving..." : "Save Feature Toggles"}
                </Button>
                {hasChanges && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    Unsaved changes
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Limits */}
        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Limits</CardTitle>
              <CardDescription>
                Set maximum limits for platform resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max-orgs">Max Organizations</Label>
                  <Input
                    id="max-orgs"
                    type="number"
                    value={globalLimits.maxOrganizations}
                    onChange={(e) =>
                      handleLimitChange("maxOrganizations", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-users-per-org">Max Users per Organization</Label>
                  <Input
                    id="max-users-per-org"
                    type="number"
                    value={globalLimits.maxUsersPerOrg}
                    onChange={(e) =>
                      handleLimitChange("maxUsersPerOrg", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-invoices-per-org">Max Invoices per Organization</Label>
                  <Input
                    id="max-invoices-per-org"
                    type="number"
                    value={globalLimits.maxInvoicesPerOrg}
                    onChange={(e) =>
                      handleLimitChange("maxInvoicesPerOrg", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-templates-per-org">Max Templates per Organization</Label>
                  <Input
                    id="max-templates-per-org"
                    type="number"
                    value={globalLimits.maxTemplatesPerOrg}
                    onChange={(e) =>
                      handleLimitChange("maxTemplatesPerOrg", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-storage-per-org">Max Storage per Organization (MB)</Label>
                  <Input
                    id="max-storage-per-org"
                    type="number"
                    value={globalLimits.maxStoragePerOrgMB}
                    onChange={(e) =>
                      handleLimitChange("maxStoragePerOrgMB", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveGlobalLimits}
                  disabled={updateSettings.isPending || !hasChanges}
                >
                  {updateSettings.isPending ? "Saving..." : "Save Global Limits"}
                </Button>
                {hasChanges && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    Unsaved changes
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warning */}
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Important Note
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              Changes to system settings will affect all organizations on the platform. Please
              review changes carefully before saving. Settings synchronization with Stripe and
              backend services will be implemented in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

