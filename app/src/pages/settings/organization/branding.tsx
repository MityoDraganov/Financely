import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Palette, Upload, Eye, Globe, Mail, X, Image as ImageIcon, Sparkles, ExternalLink, RefreshCw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useGenerateSite, useRegenerateSite, useAddCustomDomain } from "@/hooks/service-hooks/use-brand-site";
import { useBrandSite, useBrandSitesByOrganization } from "@/hooks/repository-hooks/use-brand-site";

const brandingSchema = z.object({
  customLogo: z.string().optional(),
  customFavicon: z.string().optional(),
  companyName: z.string().optional(),
  customDomain: z.string().optional(),
  emailFromName: z.string().optional(),
  emailFromAddress: z.string().optional(),
  footerText: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color").optional(),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color").optional(),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color").optional(),
});

type BrandingForm = z.infer<typeof brandingSchema>;

const defaultColors = {
  primaryColor: "#2563eb",
  secondaryColor: "#6b7280", 
  accentColor: "#10b981",
};

export default function OrganizationBrandingPage() {
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const faviconUploadRef = useRef<HTMLInputElement>(null);
  const logoFileUpload = useFileUpload();
  const faviconFileUpload = useFileUpload();
  const generateSite = useGenerateSite();
  const regenerateSite = useRegenerateSite();
  const addCustomDomain = useAddCustomDomain();
  const [currentBrandSiteId, setCurrentBrandSiteId] = useState<string | null>(null);
  const brandSite = useBrandSite(currentBrandSiteId);
  console.log(brandSite.error);
  
  // Load existing brand sites for this organization
  const { data: brandSites = [], error: brandSitesError } = useBrandSitesByOrganization(organization?.id);
  console.log(brandSitesError);
  // Set current brand site ID from existing sites on mount
  useEffect(() => {
    if (brandSites.length > 0 && !currentBrandSiteId) {
      // Use the most recent site (first in the list since it's ordered by createdAt desc)
      setCurrentBrandSiteId(brandSites[0].id);
    }
  }, [brandSites, currentBrandSiteId]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<BrandingForm>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      customLogo: "",
      customFavicon: "",
      companyName: "",
      customDomain: "",
      emailFromName: "",
      emailFromAddress: "",
      footerText: "",
      ...defaultColors,
    },
  });

  // Watch for changes to detect unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Reset form when organization data loads
  useEffect(() => {
    if (organization?.settings) {
      const settings = organization.settings;
      reset({
        customLogo: settings.branding?.customLogo || "",
        customFavicon: settings.branding?.customFavicon || "",
        companyName: settings.branding?.companyName || "",
        customDomain: settings.branding?.customDomain || "",
        emailFromName: settings.branding?.emailFromName || "",
        emailFromAddress: settings.branding?.emailFromAddress || "",
        footerText: settings.branding?.footerText || "",
        primaryColor: settings.brandColors?.primary || defaultColors.primaryColor,
        secondaryColor: settings.brandColors?.secondary || defaultColors.secondaryColor,
        accentColor: settings.brandColors?.accent || defaultColors.accentColor,
      });
    }
  }, [organization, reset]);

  const handleLogoUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/logo-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await logoFileUpload.uploadFile(file, path);

    if (url) {
      setValue("customLogo", url, { shouldDirty: true });
      toast.success("Logo uploaded successfully");
    } else {
      toast.error(logoFileUpload.error || "Failed to upload logo");
    }
  };

  const handleFaviconUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/favicon-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await faviconFileUpload.uploadFile(file, path);

    if (url) {
      setValue("customFavicon", url, { shouldDirty: true });
      toast.success("Favicon uploaded successfully");
    } else {
      toast.error(faviconFileUpload.error || "Failed to upload favicon");
    }
  };

  const handleLogoRemove = () => {
    setValue("customLogo", "", { shouldDirty: true });
  };

  const handleFaviconRemove = () => {
    setValue("customFavicon", "", { shouldDirty: true });
  };

  const onSubmit = async (data: BrandingForm) => {
    if (!organization) return;

    try {
      // Build updates, merging with existing values and only including changed fields
      const existingSettings = organization.settings || {};
      const existingBrandColors = existingSettings.brandColors || {
        primary: defaultColors.primaryColor,
        secondary: defaultColors.secondaryColor,
        accent: defaultColors.accentColor,
      };
      const existingBranding = existingSettings.branding || {};

      const brandColors = {
        primary: (data.primaryColor && data.primaryColor.trim()) || existingBrandColors.primary || defaultColors.primaryColor,
        secondary: (data.secondaryColor && data.secondaryColor.trim()) || existingBrandColors.secondary || defaultColors.secondaryColor,
        accent: (data.accentColor && data.accentColor.trim()) || existingBrandColors.accent || defaultColors.accentColor,
      };

      // Build branding object, only including fields with values (Firestore doesn't accept undefined)
      const branding: Record<string, string> = {};
      
      // Merge existing branding values
      if (existingBranding.customLogo) branding.customLogo = existingBranding.customLogo;
      if (existingBranding.customFavicon) branding.customFavicon = existingBranding.customFavicon;
      if (existingBranding.companyName) branding.companyName = existingBranding.companyName;
      if (existingBranding.customDomain) branding.customDomain = existingBranding.customDomain;
      if (existingBranding.emailFromName) branding.emailFromName = existingBranding.emailFromName;
      if (existingBranding.emailFromAddress) branding.emailFromAddress = existingBranding.emailFromAddress;
      if (existingBranding.footerText) branding.footerText = existingBranding.footerText;
      
      // Override with new values if provided, or remove if set to empty
      if (data.customLogo !== undefined) {
        const trimmed = data.customLogo.trim();
        if (trimmed) {
          branding.customLogo = trimmed;
        } else {
          delete branding.customLogo;
        }
      }
      if (data.customFavicon !== undefined) {
        const trimmed = data.customFavicon.trim();
        if (trimmed) {
          branding.customFavicon = trimmed;
        } else {
          delete branding.customFavicon;
        }
      }
      if (data.companyName !== undefined) {
        const trimmed = data.companyName.trim();
        if (trimmed) {
          branding.companyName = trimmed;
        } else {
          delete branding.companyName;
        }
      }
      if (data.customDomain !== undefined) {
        const trimmed = data.customDomain.trim();
        if (trimmed) {
          branding.customDomain = trimmed;
        } else {
          delete branding.customDomain;
        }
      }
      if (data.emailFromName !== undefined) {
        const trimmed = data.emailFromName.trim();
        if (trimmed) {
          branding.emailFromName = trimmed;
        } else {
          delete branding.emailFromName;
        }
      }
      if (data.emailFromAddress !== undefined) {
        const trimmed = data.emailFromAddress.trim();
        if (trimmed) {
          branding.emailFromAddress = trimmed;
        } else {
          delete branding.emailFromAddress;
        }
      }
      if (data.footerText !== undefined) {
        const trimmed = data.footerText.trim();
        if (trimmed) {
          branding.footerText = trimmed;
        } else {
          delete branding.footerText;
        }
      }

      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...existingSettings,
            brandColors,
            // Only include branding if it has fields, otherwise keep existing or use empty object
            branding: Object.keys(branding).length > 0 ? branding : (existingBranding || {}),
          },
        },
      });

      toast.success("Branding settings updated successfully");
      setHasUnsavedChanges(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update branding settings";
      toast.error(errorMessage);
    }
  };

  const watchedColors = watch(["primaryColor", "secondaryColor", "accentColor"]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with proper typography hierarchy */}
      <div className="border-b border-gray-200 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Branding & Customization</h1>
              <p className="text-gray-600 mt-1">
                Customize your organization's appearance and branding.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2 shadow-sm"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col gap-8">
          {/* Left Column - Settings */}
          <div className="space-y-8">
            {/* Logo & Visual Identity */}
            <Card className="shadow-sm border-gray-200/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Upload className="h-4 w-4 text-blue-600" />
                  </div>
                  Logo & Visual Identity
                </CardTitle>
                <CardDescription className="ml-11">
                  Upload your organization's logo and favicon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customLogo">Logo</Label>
                  <div className="space-y-2">
                    <input
                      ref={logoUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleLogoUpload(file);
                        }
                      }}
                    />
                    {watch("customLogo") ? (
                      <div className="relative inline-block">
                        <img
                          src={watch("customLogo")}
                          alt="Logo preview"
                          className="h-20 w-auto rounded border border-gray-200 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow-sm hover:bg-gray-100"
                          onClick={handleLogoRemove}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoUploadRef.current?.click()}
                        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload logo</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                    {logoFileUpload.isUploading && (
                      <p className="text-sm text-gray-500">Uploading... {logoFileUpload.uploadProgress}%</p>
                    )}
                    {logoFileUpload.error && (
                      <p className="text-sm text-red-600">{logoFileUpload.error}</p>
                    )}
                    <div className="mt-2">
                      <Input
                        id="customLogo"
                        {...register("customLogo")}
                        placeholder="Or enter logo URL"
                        className={errors.customLogo ? "border-red-500" : ""}
                      />
                      {errors.customLogo && (
                        <p className="text-sm text-red-600 mt-1">{errors.customLogo.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customFavicon">Favicon</Label>
                  <div className="space-y-2">
                    <input
                      ref={faviconUploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFaviconUpload(file);
                        }
                      }}
                    />
                    {watch("customFavicon") ? (
                      <div className="relative inline-block">
                        <img
                          src={watch("customFavicon")}
                          alt="Favicon preview"
                          className="h-12 w-12 rounded border border-gray-200 object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow-sm hover:bg-gray-100"
                          onClick={handleFaviconRemove}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => faviconUploadRef.current?.click()}
                        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        <ImageIcon className="h-6 w-6 text-gray-400 mb-2" />
                        <p className="text-xs text-gray-600">Click to upload favicon</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, ICO up to 5MB</p>
                      </div>
                    )}
                    {faviconFileUpload.isUploading && (
                      <p className="text-sm text-gray-500">Uploading... {faviconFileUpload.uploadProgress}%</p>
                    )}
                    {faviconFileUpload.error && (
                      <p className="text-sm text-red-600">{faviconFileUpload.error}</p>
                    )}
                    <div className="mt-2">
                      <Input
                        id="customFavicon"
                        {...register("customFavicon")}
                        placeholder="Or enter favicon URL"
                        className={errors.customFavicon ? "border-red-500" : ""}
                      />
                      {errors.customFavicon && (
                        <p className="text-sm text-red-600 mt-1">{errors.customFavicon.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name Override</Label>
                  <Input
                    id="companyName"
                    {...register("companyName")}
                    placeholder="Your Company Name"
                  />
                  <p className="text-xs text-gray-500">
                    Override the default "Financely" branding with your company name.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Brand Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Colors
                </CardTitle>
                <CardDescription>
                  Customize your organization's color scheme.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <ColorPicker
                      label="Primary Color"
                      value={watchedColors[0] || defaultColors.primaryColor}
                      onChange={(color) => {
                        setValue("primaryColor", color, { shouldDirty: true });
                      }}
                    />
                    {errors.primaryColor && (
                      <p className="text-sm text-red-600">{errors.primaryColor.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <ColorPicker
                      label="Secondary Color"
                      value={watchedColors[1] || defaultColors.secondaryColor}
                      onChange={(color) => {
                        setValue("secondaryColor", color, { shouldDirty: true });
                      }}
                    />
                    {errors.secondaryColor && (
                      <p className="text-sm text-red-600">{errors.secondaryColor.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <ColorPicker
                      label="Accent Color"
                      value={watchedColors[2] || defaultColors.accentColor}
                      onChange={(color) => {
                        setValue("accentColor", color, { shouldDirty: true });
                      }}
                    />
                    {errors.accentColor && (
                      <p className="text-sm text-red-600">{errors.accentColor.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email & Communication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email & Communication
                </CardTitle>
                <CardDescription>
                  Customize email sender information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">Email From Name</Label>
                  <Input
                    id="emailFromName"
                    {...register("emailFromName")}
                    placeholder="Your Company"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress">Email From Address</Label>
                  <Input
                    id="emailFromAddress"
                    {...register("emailFromAddress")}
                    placeholder="noreply@yourcompany.com"
                    className={errors.emailFromAddress ? "border-red-500" : ""}
                  />
                  {errors.emailFromAddress && (
                    <p className="text-sm text-red-600">{errors.emailFromAddress.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    {...register("footerText")}
                    placeholder="© 2024 Your Company. All rights reserved."
                  />
                </div>
              </CardContent>
            </Card>

            {/* AI Site Builder */}
            <Card className="shadow-sm border-gray-200/50 bg-gradient-to-br from-white to-purple-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                  AI Site Builder
                </CardTitle>
                <CardDescription className="ml-11">
                  Generate a branded website automatically using AI. Your site will be hosted on a custom subdomain.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {/* Show Generate Website button only if no site exists */}
                  {brandSites.length === 0 && (
                    <Button
                      type="button"
                      onClick={() => {
                        if (!organization?.id) return;
                        generateSite.mutate(
                          {
                            organizationId: organization.id,
                            brandName: watch("companyName") || organization.name,
                            tone: "professional",
                          },
                          {
                            onSuccess: (result) => {
                              setCurrentBrandSiteId(result.id);
                            },
                          }
                        );
                      }}
                      disabled={generateSite.isPending || !organization?.id}
                      className="w-full shadow-sm"
                    >
                      {generateSite.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Website
                        </>
                      )}
                    </Button>
                  )}

                  {/* Show existing site info and regenerate button if site exists */}
                  {brandSites.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                            if (!brandSiteId) return;
                            regenerateSite.mutate({
                              brandSiteId,
                            });
                          }}
                          disabled={regenerateSite.isPending || (brandSite?.data || brandSites[0])?.status === "generating" || (brandSite?.data || brandSites[0])?.status === "deploying"}
                          className="flex-1 shadow-sm"
                        >
                          {regenerateSite.isPending || (brandSite?.data || brandSites[0])?.status === "generating" || (brandSite?.data || brandSites[0])?.status === "deploying" ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate Site
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Status Display - Only show if site exists */}
                      {(brandSite?.data || brandSites[0]) && (
                    <div className={`p-4 border rounded-lg ${
                      (brandSite?.data || brandSites[0])?.status === "success" 
                        ? "bg-green-50 border-green-200" 
                        : (brandSite?.data || brandSites[0])?.status === "failed"
                        ? "bg-red-50 border-red-200"
                        : "bg-blue-50 border-blue-200"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {((brandSite?.data || brandSites[0])?.status === "pending") && (
                            <>
                              <p className="text-sm font-medium text-blue-900">
                                Site generation queued...
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                Waiting to start generation
                              </p>
                            </>
                          )}
                          {((brandSite?.data || brandSites[0])?.status === "generating") && (
                            <>
                              <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating site with AI...
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                This may take 1-2 minutes
                              </p>
                            </>
                          )}
                          {((brandSite?.data || brandSites[0])?.status === "deploying") && (
                            <>
                              <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deploying site...
                              </p>
                              <p className="text-xs text-blue-700 mt-1">
                                Setting up hosting and DNS
                              </p>
                            </>
                          )}
                          {((brandSite?.data || brandSites[0])?.status === "success") && (brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl) && (
                            <>
                              <p className="text-sm font-medium text-green-900">
                                Site Generated Successfully!
                              </p>
                              <a
                                href={brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 mt-1"
                              >
                                {brandSite?.data?.deployedUrl || brandSites[0]?.deployedUrl}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          )}
                          {((brandSite?.data || brandSites[0])?.status === "failed") && (
                            <>
                              <p className="text-sm font-medium text-red-900">
                                Site Generation Failed
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                {(brandSite?.data || brandSites[0])?.error || "Unknown error occurred"}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                    </div>
                  )}

                  {generateSite.isError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">
                        {generateSite.error instanceof Error
                          ? generateSite.error.message
                          : "Failed to start site generation. Please try again."}
                      </p>
                    </div>
                  )}

                  {/* Custom Domain section - only show if site exists */}
                  {brandSites.length > 0 && (
                    <div className="border-t border-gray-200 pt-4 space-y-3">
                      <Label>Custom Domain (Optional)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="example.com"
                          value={customDomainInput}
                          onChange={(e) => setCustomDomainInput(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const brandSiteId = currentBrandSiteId || brandSites[0]?.id;
                            if (!brandSiteId || !customDomainInput) {
                              toast.error("Please enter a domain");
                              return;
                            }
                            addCustomDomain.mutate({
                              brandSiteId,
                              customDomain: customDomainInput,
                            });
                          }}
                          disabled={addCustomDomain.isPending || !customDomainInput}
                        >
                          {addCustomDomain.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            "Add Domain"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Connect your custom domain to your generated site. Make sure your domain DNS is configured correctly.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* White-label Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  White-label Settings
                </CardTitle>
                <CardDescription>
                  Advanced customization options for enterprise customers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Custom Domain</Label>
                  <Input
                    id="customDomain"
                    {...register("customDomain")}
                    placeholder="app.yourcompany.com"
                  />
                  <p className="text-xs text-gray-500">
                    Enterprise feature. Contact support to configure custom domain.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview */}
          {previewMode && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Live Preview</CardTitle>
                  <CardDescription>
                    See how your branding will appear to users.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Header Preview */}
                    <div 
                      className="p-4 rounded-lg border"
                      style={{ backgroundColor: watchedColors[0] || defaultColors.primaryColor }}
                    >
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          {watch("customLogo") ? (
                            <img 
                              src={watch("customLogo")} 
                              alt="Logo" 
                              className="h-8 w-8 rounded"
                            />
                          ) : (
                            <div className="h-8 w-8 bg-white/20 rounded flex items-center justify-center">
                              <span className="text-sm font-bold">F</span>
                            </div>
                          )}
                          <span className="font-semibold">
                            {watch("companyName") || "Financely"}
                          </span>
                        </div>
                        <div className="text-sm opacity-80">Dashboard</div>
                      </div>
                    </div>

                    {/* Button Preview */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Button Styles</p>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 rounded text-white text-sm font-medium"
                          style={{ backgroundColor: watchedColors[0] || defaultColors.primaryColor }}
                        >
                          Primary Button
                        </button>
                        <button 
                          className="px-4 py-2 rounded text-white text-sm font-medium"
                          style={{ backgroundColor: watchedColors[2] || defaultColors.accentColor }}
                        >
                          Accent Button
                        </button>
                      </div>
                    </div>

                    {/* Color Palette Preview */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Color Palette</p>
                      <div className="flex gap-2">
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[0] || defaultColors.primaryColor }}
                          />
                          <p className="text-xs mt-1">Primary</p>
                        </div>
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[1] || defaultColors.secondaryColor }}
                          />
                          <p className="text-xs mt-1">Secondary</p>
                        </div>
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[2] || defaultColors.accentColor }}
                          />
                          <p className="text-xs mt-1">Accent</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Save Button */}
        {hasUnsavedChanges && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                You have unsaved changes
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasUnsavedChanges(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganization.isPending}
                >
                  {updateOrganization.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
