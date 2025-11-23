import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Palette, Upload, Eye, Globe, Mail, X, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useFileUpload } from "@/hooks/use-file-upload";

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
  const { t } = useTranslation();
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [brandImages, setBrandImages] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const faviconUploadRef = useRef<HTMLInputElement>(null);
  const galleryUploadRef = useRef<HTMLInputElement>(null);
  const logoFileUpload = useFileUpload();
  const faviconFileUpload = useFileUpload();
  const galleryFileUpload = useFileUpload();

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
  const prevOrganizationIdRef = useRef<string | undefined>(undefined);
  const prevBrandingRef = useRef<string>("");
  const prevBrandColorsRef = useRef<string>("");
  
  useEffect(() => {
    if (!organization?.id || !organization?.settings) return;
    
      const settings = organization.settings;
    const brandingKey = JSON.stringify(settings.branding || {});
    const brandColorsKey = JSON.stringify(settings.brandColors || {});
    const orgId = organization.id;
    
    // Only reset if organization changed or settings actually changed
    if (
      prevOrganizationIdRef.current === orgId &&
      prevBrandingRef.current === brandingKey &&
      prevBrandColorsRef.current === brandColorsKey
    ) {
      return;
    }
    
    prevOrganizationIdRef.current = orgId;
    prevBrandingRef.current = brandingKey;
    prevBrandColorsRef.current = brandColorsKey;
    
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
    setBrandImages(settings.branding?.brandImages || []);
    setDescription(settings.branding?.description || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, organization?.settings]);

  const handleLogoUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/logo-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await logoFileUpload.uploadFile(file, path);

    if (url) {
      setValue("customLogo", url, { shouldDirty: true });
      toast.success(t('settings.organization.branding.toasts.logoUploaded'));
    } else {
      toast.error(logoFileUpload.error || t('settings.organization.branding.toasts.logoUploadFailed'));
    }
  };

  const handleFaviconUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/favicon-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await faviconFileUpload.uploadFile(file, path);

    if (url) {
      setValue("customFavicon", url, { shouldDirty: true });
      toast.success(t('settings.organization.branding.toasts.faviconUploaded'));
    } else {
      toast.error(faviconFileUpload.error || t('settings.organization.branding.toasts.faviconUploadFailed'));
    }
  };

  const handleLogoRemove = () => {
    setValue("customLogo", "", { shouldDirty: true });
  };

  const handleFaviconRemove = () => {
    setValue("customFavicon", "", { shouldDirty: true });
  };

  const handleGalleryUpload = async (file: File) => {
    if (!organization) return;

    const path = `organizations/${organization.id}/branding/gallery-${Date.now()}.${file.name.split('.').pop()}`;
    const url = await galleryFileUpload.uploadFile(file, path);

    if (url) {
      setBrandImages([...brandImages, url]);
      setHasUnsavedChanges(true);
      toast.success(t('settings.organization.branding.toasts.imageUploaded'));
    } else {
      toast.error(galleryFileUpload.error || t('settings.organization.branding.toasts.imageUploadFailed'));
    }
  };

  const handleGalleryRemove = (index: number) => {
    const newImages = brandImages.filter((_, i) => i !== index);
    setBrandImages(newImages);
    setHasUnsavedChanges(true);
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
      type BrandingFields = {
        customLogo?: string;
        customFavicon?: string;
        companyName?: string;
        customDomain?: string;
        emailFromName?: string;
        emailFromAddress?: string;
        footerText?: string;
        description?: string;
        brandImages?: string[];
        socialLinks?: {
          twitter?: string;
          linkedin?: string;
          facebook?: string;
        };
      };

      const brandColors = {
        primary: (data.primaryColor && data.primaryColor.trim()) || existingBrandColors.primary || defaultColors.primaryColor,
        secondary: (data.secondaryColor && data.secondaryColor.trim()) || existingBrandColors.secondary || defaultColors.secondaryColor,
        accent: (data.accentColor && data.accentColor.trim()) || existingBrandColors.accent || defaultColors.accentColor,
      };

      // Build branding object, only including fields with values (Firestore doesn't accept undefined)
      const branding: BrandingFields = {};
      const typedExistingBranding = existingBranding as BrandingFields;
      
      // Merge existing branding values
      if (typedExistingBranding.customLogo) branding.customLogo = typedExistingBranding.customLogo;
      if (typedExistingBranding.customFavicon) branding.customFavicon = typedExistingBranding.customFavicon;
      if (typedExistingBranding.companyName) branding.companyName = typedExistingBranding.companyName;
      if (typedExistingBranding.customDomain) branding.customDomain = typedExistingBranding.customDomain;
      if (typedExistingBranding.emailFromName) branding.emailFromName = typedExistingBranding.emailFromName;
      if (typedExistingBranding.emailFromAddress) branding.emailFromAddress = typedExistingBranding.emailFromAddress;
      if (typedExistingBranding.footerText) branding.footerText = typedExistingBranding.footerText;
      
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
      
      // Add description and brandImages
      if (description.trim()) {
        branding.description = description.trim();
      } else if (typedExistingBranding.description) {
        delete branding.description;
      }
      
      if (brandImages.length > 0) {
        branding.brandImages = brandImages;
      } else if (typedExistingBranding.brandImages && typedExistingBranding.brandImages.length > 0) {
        delete branding.brandImages;
      }

      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          settings: {
            ...existingSettings,
            brandColors,
            // Only include branding if it has fields, otherwise keep existing or use empty object
            branding: (() => {
              const hasBrandingFields = Object.keys(branding).length > 0;
              const merged = hasBrandingFields 
                ? { ...typedExistingBranding, ...branding }
                : typedExistingBranding;
              return {
                ...merged,
                brandImages: merged?.brandImages || [],
              };
            })(),
          },
        },
      });

      toast.success(t('settings.organization.branding.toasts.updated'));
      setHasUnsavedChanges(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('settings.organization.branding.toasts.updateFailed');
      toast.error(errorMessage);
    }
  };

  const watchedColors = watch(["primaryColor", "secondaryColor", "accentColor"]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header with proper typography hierarchy */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Palette className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('settings.organization.branding.pageTitle')}</h1>
              <p className="text-muted-foreground mt-1">
                {t('settings.organization.branding.pageDescription')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2 shadow-sm"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? t('settings.organization.branding.hidePreview') : t('settings.organization.branding.showPreview')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex flex-col gap-8">
          {/* Left Column - Settings */}
          <div className="space-y-8">
            {/* Logo & Visual Identity */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Upload className="h-4 w-4 text-blue-600" />
                  </div>
                  {t('settings.organization.branding.logoVisualIdentity.title')}
                </CardTitle>
                <CardDescription className="ml-11">
                  {t('settings.organization.branding.logoVisualIdentity.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customLogo">{t('settings.organization.branding.logoVisualIdentity.logo')}</Label>
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
                          className="h-20 w-auto rounded border border-border object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow-sm hover:bg-muted"
                          onClick={handleLogoRemove}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => logoUploadRef.current?.click()}
                        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">{t('settings.organization.branding.logoVisualIdentity.clickToUpload')}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('settings.organization.branding.logoVisualIdentity.uploadHint')}</p>
                      </div>
                    )}
                    {logoFileUpload.isUploading && (
                      <p className="text-sm text-gray-500">{t('settings.organization.branding.logoVisualIdentity.uploading', { progress: logoFileUpload.uploadProgress })}</p>
                    )}
                    {logoFileUpload.error && (
                      <p className="text-sm text-red-600">{logoFileUpload.error}</p>
                    )}
                    <div className="mt-2">
                      <Input
                        id="customLogo"
                        {...register("customLogo")}
                        placeholder={t('settings.organization.branding.logoVisualIdentity.orEnterUrl')}
                        className={errors.customLogo ? "border-red-500" : ""}
                      />
                      {errors.customLogo && (
                        <p className="text-sm text-red-600 mt-1">{errors.customLogo.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customFavicon">{t('settings.organization.branding.logoVisualIdentity.favicon')}</Label>
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
                          className="h-12 w-12 rounded border border-border object-contain"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border border-border shadow-sm hover:bg-muted"
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
                        <p className="text-xs text-gray-600">{t('settings.organization.branding.logoVisualIdentity.clickToUploadFavicon')}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('settings.organization.branding.logoVisualIdentity.uploadHintFavicon')}</p>
                      </div>
                    )}
                    {faviconFileUpload.isUploading && (
                      <p className="text-sm text-gray-500">{t('settings.organization.branding.logoVisualIdentity.uploading', { progress: faviconFileUpload.uploadProgress })}</p>
                    )}
                    {faviconFileUpload.error && (
                      <p className="text-sm text-red-600">{faviconFileUpload.error}</p>
                    )}
                    <div className="mt-2">
                      <Input
                        id="customFavicon"
                        {...register("customFavicon")}
                        placeholder={t('settings.organization.branding.logoVisualIdentity.orEnterFaviconUrl')}
                        className={errors.customFavicon ? "border-red-500" : ""}
                      />
                      {errors.customFavicon && (
                        <p className="text-sm text-red-600 mt-1">{errors.customFavicon.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">{t('settings.organization.branding.logoVisualIdentity.companyName')}</Label>
                  <Input
                    id="companyName"
                    {...register("companyName")}
                    placeholder={t('settings.organization.branding.logoVisualIdentity.companyNamePlaceholder')}
                  />
                  <p className="text-xs text-gray-500">
                    {t('settings.organization.branding.logoVisualIdentity.companyNameHint')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Gallery Section */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <ImageIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{t('settings.organization.branding.gallery.title')}</CardTitle>
                      <CardDescription className="ml-0">
                        {t('settings.organization.branding.gallery.description')}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => galleryUploadRef.current?.click()}
                    disabled={galleryFileUpload.isUploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t('settings.organization.branding.gallery.addImage')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <input
                  ref={galleryUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleGalleryUpload(file);
                    }
                  }}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {brandImages.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-border"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background border border-border shadow-sm hover:bg-destructive/10 dark:hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleGalleryRemove(index)}
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  ))}
                  {/* Plus placeholder - always last */}
                  <div
                    onClick={() => galleryUploadRef.current?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg h-32 cursor-pointer hover:border-primary/50 transition-colors bg-muted/50"
                  >
                    <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-xs text-gray-600">{t('settings.organization.branding.gallery.addImage')}</p>
                  </div>
                </div>
                {galleryFileUpload.isUploading && (
                  <p className="text-sm text-gray-500 mt-2">
                    {t('settings.organization.branding.logoVisualIdentity.uploading', { progress: galleryFileUpload.uploadProgress })}
                  </p>
                )}
                {galleryFileUpload.error && (
                  <p className="text-sm text-red-600 mt-2">{galleryFileUpload.error}</p>
                )}
              </CardContent>
            </Card>

            {/* Brand Description */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Globe className="h-4 w-4 text-blue-600" />
                  </div>
                  {t('settings.organization.branding.brandDescription.title')}
                </CardTitle>
                <CardDescription className="ml-11">
                  {t('settings.organization.branding.brandDescription.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={t('settings.organization.branding.brandDescription.placeholder')}
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>

            {/* Brand Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  {t('settings.organization.branding.brandColors.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.organization.branding.brandColors.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <ColorPicker
                      label={t('settings.organization.branding.brandColors.primaryColor')}
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
                      label={t('settings.organization.branding.brandColors.secondaryColor')}
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
                      label={t('settings.organization.branding.brandColors.accentColor')}
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
                  {t('settings.organization.branding.emailCommunication.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.organization.branding.emailCommunication.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">{t('settings.organization.branding.emailCommunication.emailFromName')}</Label>
                  <Input
                    id="emailFromName"
                    {...register("emailFromName")}
                    placeholder={t('settings.organization.branding.emailCommunication.emailFromNamePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress">{t('settings.organization.branding.emailCommunication.emailFromAddress')}</Label>
                  <Input
                    id="emailFromAddress"
                    {...register("emailFromAddress")}
                    placeholder={t('settings.organization.branding.emailCommunication.emailFromAddressPlaceholder')}
                    className={errors.emailFromAddress ? "border-red-500" : ""}
                  />
                  {errors.emailFromAddress && (
                    <p className="text-sm text-red-600">{errors.emailFromAddress.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footerText">{t('settings.organization.branding.emailCommunication.footerText')}</Label>
                  <Input
                    id="footerText"
                    {...register("footerText")}
                    placeholder={t('settings.organization.branding.emailCommunication.footerTextPlaceholder')}
                  />
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Column - Preview */}
          {previewMode && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.organization.branding.preview.title')}</CardTitle>
                  <CardDescription>
                    {t('settings.organization.branding.preview.description')}
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
                      <p className="text-sm font-medium">{t('settings.organization.branding.preview.buttonStyles')}</p>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 rounded text-white text-sm font-medium"
                          style={{ backgroundColor: watchedColors[0] || defaultColors.primaryColor }}
                        >
                          {t('settings.organization.branding.preview.primaryButton')}
                        </button>
                        <button 
                          className="px-4 py-2 rounded text-white text-sm font-medium"
                          style={{ backgroundColor: watchedColors[2] || defaultColors.accentColor }}
                        >
                          {t('settings.organization.branding.preview.accentButton')}
                        </button>
                      </div>
                    </div>

                    {/* Color Palette Preview */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t('settings.organization.branding.preview.colorPalette')}</p>
                      <div className="flex gap-2">
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[0] || defaultColors.primaryColor }}
                          />
                          <p className="text-xs mt-1">{t('settings.organization.branding.preview.primary')}</p>
                        </div>
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[1] || defaultColors.secondaryColor }}
                          />
                          <p className="text-xs mt-1">{t('settings.organization.branding.preview.secondary')}</p>
                        </div>
                        <div className="text-center">
                          <div 
                            className="w-12 h-12 rounded border"
                            style={{ backgroundColor: watchedColors[2] || defaultColors.accentColor }}
                          />
                          <p className="text-xs mt-1">{t('settings.organization.branding.preview.accent')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Save Button Footer - Always visible, sticky at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-end">
              <div className="flex gap-2">
              {hasUnsavedChanges ? (
                <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasUnsavedChanges(false);
                  }}
                >
                  {t('settings.organization.general.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganization.isPending}
                >
                  {updateOrganization.isPending ? t('settings.organization.general.saving') : t('settings.organization.general.saveChanges')}
                  </Button>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          type="button"
                          variant="outline"
                          disabled
                        >
                          {t('settings.organization.general.cancel')}
                </Button>
              </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.organization.branding.allChangesSaved')}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          type="submit"
                          disabled
                        >
                          {t('settings.organization.general.saveChanges')}
                        </Button>
            </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.organization.branding.allChangesSaved')}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </form>
    </div>
  );
}
