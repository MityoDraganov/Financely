import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Globe, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";

type OrganizationGeneralForm = z.infer<ReturnType<typeof getOrganizationGeneralSchema>>;

function getOrganizationGeneralSchema(_t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, "Organization name is required"),
    description: z.string().optional(),
    website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  });
}

export default function OrganizationGeneralPage() {
  const { t } = useTranslation();
  const { data: organization, isLoading } = useCurrentOrganization();
  const updateOrganization = useUpdateOrganization();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const organizationGeneralSchema = getOrganizationGeneralSchema(t);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrganizationGeneralForm>({
    resolver: zodResolver(organizationGeneralSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
    },
  });

  // Watch for changes to detect unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Reset form when organization data loads
  useEffect(() => {
    if (organization) {
      const address = organization.settings?.address;
      reset({
        name: organization.name || "",
        description: organization.description || "",
        website: organization.website || "",
        email: organization.settings?.email || "",
        phone: organization.settings?.phone || "",
        address: address?.street || "",
        city: address?.city || "",
        state: address?.state || "",
        zipCode: address?.zipCode || "",
        country: address?.country || "",
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationGeneralForm) => {
    if (!organization) return;

    try {
      // Build address object if any address fields are provided
      const address = (data.address || data.city || data.state || data.zipCode || data.country) ? {
        street: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        country: data.country || undefined,
      } : undefined;

      // Update settings with address and contact information
      // Note: settings.country should be ISO code (e.g., "US"), not full name
      // The full country name goes in address.country
      const currentSettings = organization.settings || {};
      const updatedSettings = {
        ...currentSettings,
        ...(address && { address }),
        // Save email and phone (empty string means clear the field)
        email: data.email || undefined,
        phone: data.phone || undefined,
        // Keep existing country code if it exists, don't overwrite with full name
      };

      await updateOrganization.mutateAsync({
        id: organization.id,
        data: {
          name: data.name,
          description: data.description || undefined,
          website: data.website || undefined,
          settings: updatedSettings,
        },
      });

      toast.success(t('settings.organization.general.toasts.updated'));
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to update organization:", error);
      toast.error(t('settings.organization.general.toasts.updateFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-0.5 pb-3 border-b">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t('settings.organization.general.pageTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('settings.organization.general.pageDescription')}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('settings.organization.general.basicInformation.title')}</CardTitle>
            <CardDescription className="text-sm">
              {t('settings.organization.general.basicInformation.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('settings.organization.general.basicInformation.name')}</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder={t('settings.organization.general.basicInformation.namePlaceholder')}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">{t('settings.organization.general.basicInformation.website')}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="website"
                    {...register("website")}
                    placeholder={t('settings.organization.general.basicInformation.websitePlaceholder')}
                    className={`pl-10 ${errors.website ? "border-red-500" : ""}`}
                  />
                </div>
                {errors.website && (
                  <p className="text-sm text-red-600">{errors.website.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('settings.organization.general.basicInformation.description')}</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder={t('settings.organization.general.basicInformation.descriptionPlaceholder')}
                rows={3}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('settings.organization.general.contactInformation.title')}</CardTitle>
            <CardDescription className="text-sm">
              {t('settings.organization.general.contactInformation.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('settings.organization.general.contactInformation.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    {...register("email")}
                    placeholder={t('settings.organization.general.contactInformation.emailPlaceholder')}
                    className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('settings.organization.general.contactInformation.phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    {...register("phone")}
                    placeholder={t('settings.organization.general.contactInformation.phonePlaceholder')}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t('settings.organization.general.address.title')}</CardTitle>
            <CardDescription className="text-sm">
              {t('settings.organization.general.address.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="address">{t('settings.organization.general.address.streetAddress')}</Label>
              <Input
                id="address"
                {...register("address")}
                placeholder={t('settings.organization.general.address.streetAddressPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">{t('settings.organization.general.address.city')}</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder={t('settings.organization.general.address.cityPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">{t('settings.organization.general.address.state')}</Label>
                <Input
                  id="state"
                  {...register("state")}
                  placeholder={t('settings.organization.general.address.statePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">{t('settings.organization.general.address.zipCode')}</Label>
                <Input
                  id="zipCode"
                  {...register("zipCode")}
                  placeholder={t('settings.organization.general.address.zipCodePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">{t('settings.organization.general.address.country')}</Label>
              <Input
                id="country"
                {...register("country")}
                placeholder={t('settings.organization.general.address.countryPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        {hasUnsavedChanges && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t p-4 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-medium">
                  {t('settings.organization.general.unsavedChanges')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasUnsavedChanges(false);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  {t('settings.organization.general.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={updateOrganization.isPending}
                  className="flex-1 sm:flex-none"
                >
                  {updateOrganization.isPending ? t('settings.organization.general.saving') : t('settings.organization.general.saveChanges')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
