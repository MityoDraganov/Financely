import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Mail,
  Phone,
  Copy,
  ChevronsUpDown,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { languages } from "@/utils/languages";
import { deleteField } from "firebase/firestore";
import type { Organization } from "@/core";
import { CURRENCIES, getExchangeRate } from "@/utils/currencies";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useUpdateOrganization } from "@/hooks/repository-hooks/use-organizations";
import { useUserByClerkId } from "@/hooks/repository-hooks/use-users";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { DuplicateOrganizationDialog } from "@/components/organization/duplicate-organization-dialog";
import { isAdminOrOwner, ORGANIZATION_ROLES } from "@/core/roles";
import { functionsService } from "@/services/functions/functions-service";

type OrganizationGeneralForm = z.infer<ReturnType<typeof getOrganizationGeneralSchema>>;
const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLIC_SLUG_MAX_LENGTH = 64;

function normalizePublicSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, PUBLIC_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return normalized;
}

function getOrganizationGeneralSchema() {
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
    publicSlug: z
      .string()
      .max(PUBLIC_SLUG_MAX_LENGTH, `Slug must be ${PUBLIC_SLUG_MAX_LENGTH} characters or less`)
      .regex(PUBLIC_SLUG_PATTERN, "Use lowercase letters, numbers, and single hyphens only")
      .optional()
      .or(z.literal("")),
    defaultLanguage: z.string(),
    defaultCurrency: z.string().length(3, "Currency must be a 3-letter code"),
    paymentReferenceFormat: z.string().optional(),
    paymentBankInstructions: z.string().optional(),
    paymentBankAccountName: z.string().optional(),
    paymentBankAccountNumber: z.string().optional(),
    paymentIban: z.string().optional(),
    paymentSwift: z.string().optional(),
    paymentBeneficiaryName: z.string().optional(),
    paymentBeneficiaryAddress: z.string().optional(),
    currencyRateOverrides: z.array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        rate: z.number().positive("Rate must be greater than 0"),
      })
    ),
  });
}

function CurrencyCombobox({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = CURRENCIES.find((c) => c.code === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal h-9"
        >
          <span className="truncate">
            {selected ? `${selected.code} · ${selected.name}` : "Select currency"}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command filter={(val, search) => {
          const cur = CURRENCIES.find((c) => c.code === val);
          if (!cur) return 0;
          const q = search.toLowerCase();
          return (cur.code.toLowerCase().includes(q) || cur.name.toLowerCase().includes(q)) ? 1 : 0;
        }}>
          <CommandInput placeholder="Search currency…" />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map((cur) => (
                <CommandItem
                  key={cur.code}
                  value={cur.code}
                  onSelect={(code) => { onChange(code); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${value === cur.code ? "opacity-100" : "opacity-0"}`} />
                  <span className="font-mono text-xs mr-2 w-10">{cur.code}</span>
                  <span className="text-sm">{cur.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{cur.symbol}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function OrganizationGeneralPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: clerkUser } = useUser();
  const { data: dbUser } = useUserByClerkId(clerkUser?.id);
  const { data: organization, isLoading } = useCurrentOrganization();
  const {
    data: organizationMembers = [],
    isLoading: isOrganizationMembersLoading,
  } = useOrganizationMembers(organization?.id);
  const updateOrganization = useUpdateOrganization();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [languagePopoverOpen, setLanguagePopoverOpen] = useState(false);
  const [fetchingRates, setFetchingRates] = useState<Set<string>>(new Set());
  const [selectedTransferMemberId, setSelectedTransferMemberId] = useState<string>("");
  const [transferTargetEmail, setTransferTargetEmail] = useState("");
  const [isConfirmMemberTransferOpen, setIsConfirmMemberTransferOpen] = useState(false);
  const [isConfirmEmailTransferOpen, setIsConfirmEmailTransferOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  
  const organizationGeneralSchema = getOrganizationGeneralSchema();

  // Check if user is owner or admin
  const isOwnerOrAdmin = useMemo(() => {
    if (!dbUser || !organization) return false;
    const userRole = dbUser.organizationRoles?.[organization.id];
    if (!userRole) return false;
    return isAdminOrOwner(userRole);
  }, [dbUser, organization]);

  const isOwner = useMemo(() => {
    if (!dbUser || !organization) return false;
    const userRole = dbUser.organizationRoles?.[organization.id];
    return userRole === ORGANIZATION_ROLES.OWNER;
  }, [dbUser, organization]);

  const transferCandidates = useMemo(
    () =>
      organizationMembers.filter(
        (member) =>
          member.id !== dbUser?.id &&
          member.role !== ORGANIZATION_ROLES.OWNER &&
          member.status === "active",
      ),
    [dbUser?.id, organizationMembers],
  );

  const selectedTransferMember = useMemo(
    () => transferCandidates.find((member) => member.id === selectedTransferMemberId) || null,
    [selectedTransferMemberId, transferCandidates],
  );

  const invalidateOrganizationQueries = async () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    queryClient.invalidateQueries({ queryKey: ["organization-members"] });
    queryClient.invalidateQueries({ queryKey: ["user-organizations"] });
    queryClient.invalidateQueries({ queryKey: ["current-organization"] });
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["users"] }),
      queryClient.refetchQueries({ queryKey: ["organizations"] }),
      queryClient.refetchQueries({ queryKey: ["organization-members", organization?.id] }),
      queryClient.refetchQueries({ queryKey: ["user-organizations"] }),
    ]);
  };

  const transferOwnershipMutation = useMutation({
    mutationFn: async ({
      organizationId,
      newOwnerId,
    }: {
      organizationId: string;
      newOwnerId: string;
    }) =>
      functionsService.transferOrganizationOwnership({
        organizationId,
        newOwnerId,
      }),
    onSuccess: async () => {
      toast.success("Ownership transferred successfully.");
      setIsConfirmMemberTransferOpen(false);
      setSelectedTransferMemberId("");
      await invalidateOrganizationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to transfer ownership.");
    },
  });

  const requestOwnershipTransferMutation = useMutation({
    mutationFn: async ({
      organizationId,
      targetEmail,
    }: {
      organizationId: string;
      targetEmail: string;
    }) =>
      functionsService.requestOrganizationOwnershipTransfer({
        organizationId,
        targetEmail,
      }),
    onSuccess: async (result) => {
      if (result.mode === "direct") {
        toast.success("Ownership transferred to existing member.");
      } else {
        toast.success("Transfer email sent.");
      }
      setIsConfirmEmailTransferOpen(false);
      setTransferTargetEmail("");
      await invalidateOrganizationQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to request ownership transfer.");
    },
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: async ({
      organizationId,
      confirmName,
    }: {
      organizationId: string;
      confirmName: string;
    }) =>
      functionsService.deleteOrganization({
        organizationId,
        confirmName,
      }),
    onSuccess: async () => {
      toast.success("Organization deleted.");
      setIsDeleteDialogOpen(false);
      setDeleteConfirmName("");
      await invalidateOrganizationQueries();
      navigate("/onboarding", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete organization.");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
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
      publicSlug: "",
      defaultLanguage: "en",
      defaultCurrency: "USD",
      paymentReferenceFormat: "{{invoiceNumber}}",
      paymentBankInstructions:
        "Online payment is unavailable. Use bank transfer and include the payment reference.",
      paymentBankAccountName: "",
      paymentBankAccountNumber: "",
      paymentIban: "",
      paymentSwift: "",
      paymentBeneficiaryName: "",
      paymentBeneficiaryAddress: "",
      currencyRateOverrides: [],
    },
  });
  const {
    fields: currencyRateFields,
    append: appendCurrencyRate,
    remove: removeCurrencyRate,
  } = useFieldArray({
    control,
    name: "currencyRateOverrides",
  });
  const publicSlugInput = watch("publicSlug") || "";
  const defaultLanguage = watch("defaultLanguage") || "en";
  const defaultCurrency = watch("defaultCurrency") || "USD";
  const publicSlugPreview = normalizePublicSlug(publicSlugInput) || normalizePublicSlug(organization?.name || "");
  const fetchLiveRate = async (from: string, to: string, index: number) => {
    const key = `${from}-${to}`;
    setFetchingRates((prev) => new Set(prev).add(key));
    try {
      const rate = await getExchangeRate(from, to);
      setValue(`currencyRateOverrides.${index}.rate`, rate, { shouldDirty: true });
    } catch {
      toast.error(`Could not fetch live rate for ${from} → ${to}`);
    } finally {
      setFetchingRates((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Watch for changes to detect unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // Reset form when organization data loads
  useEffect(() => {
    if (organization) {
      const address = organization.settings?.address;
      const savedCurrencyOverrides =
        organization.settings?.currencyRates?.overrides ||
        organization.settings?.multiCurrency?.pairs ||
        [];
      const paymentFallback = organization.settings?.paymentFallback;
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
        publicSlug: organization.settings?.publicPages?.orgSlug || "",
        defaultLanguage: organization.settings?.defaultLanguage || "en",
        defaultCurrency: organization.settings?.defaultCurrency || "USD",
        paymentReferenceFormat: paymentFallback?.referenceFormat || "{{invoiceNumber}}",
        paymentBankInstructions:
          paymentFallback?.bankInstructions ||
          "Online payment is unavailable. Use bank transfer and include the payment reference.",
        paymentBankAccountName: paymentFallback?.bankAccountName || "",
        paymentBankAccountNumber: paymentFallback?.bankAccountNumber || "",
        paymentIban: paymentFallback?.iban || "",
        paymentSwift: paymentFallback?.swift || "",
        paymentBeneficiaryName: paymentFallback?.beneficiaryName || "",
        paymentBeneficiaryAddress: paymentFallback?.beneficiaryAddress || "",
        currencyRateOverrides: savedCurrencyOverrides,
      });
    }
  }, [organization, reset]);

  const onSubmit = async (data: OrganizationGeneralForm) => {
    if (!organization) return;

    try {
      const hasAddressValues = Boolean(
        data.address || data.city || data.state || data.zipCode || data.country,
      );
      const address = hasAddressValues
        ? {
            ...(data.address ? { street: data.address } : {}),
            ...(data.city ? { city: data.city } : {}),
            ...(data.state ? { state: data.state } : {}),
            ...(data.zipCode ? { zipCode: data.zipCode } : {}),
            ...(data.country ? { country: data.country } : {}),
          }
        : null;

      // Use dot-path updates and deleteField() for cleared optional fields.
      // This avoids sending undefined values to Firestore.
      const updateData: Record<string, unknown> = {
        name: data.name,
        description: data.description?.trim() ?? "",
      };

      if (data.website) {
        updateData["website"] = data.website;
      } else if (organization.website) {
        updateData["website"] = deleteField();
      }

      if (data.email) {
        updateData["settings.email"] = data.email;
      } else if (organization.settings?.email) {
        updateData["settings.email"] = deleteField();
      }

      if (data.phone) {
        updateData["settings.phone"] = data.phone;
      } else if (organization.settings?.phone) {
        updateData["settings.phone"] = deleteField();
      }

      if (address) {
        updateData["settings.address"] = address;
      } else if (organization.settings?.address) {
        updateData["settings.address"] = deleteField();
      }

      const normalizedPublicSlug = normalizePublicSlug(data.publicSlug?.trim() || "");
      if (normalizedPublicSlug) {
        updateData["settings.publicPages.orgSlug"] = normalizedPublicSlug;
      } else if (organization.settings?.publicPages?.orgSlug) {
        updateData["settings.publicPages.orgSlug"] = deleteField();
      }

      updateData["settings.defaultLanguage"] = data.defaultLanguage || "en";
      updateData["settings.defaultCurrency"] = data.defaultCurrency || "USD";
      updateData["settings.paymentFallback"] = {
        referenceFormat: data.paymentReferenceFormat?.trim() || "{{invoiceNumber}}",
        bankInstructions:
          data.paymentBankInstructions?.trim() ||
          "Online payment is unavailable. Use bank transfer and include the payment reference.",
        bankAccountName: data.paymentBankAccountName?.trim() || "",
        bankAccountNumber: data.paymentBankAccountNumber?.trim() || "",
        iban: data.paymentIban?.trim() || "",
        swift: data.paymentSwift?.trim() || "",
        beneficiaryName: data.paymentBeneficiaryName?.trim() || "",
        beneficiaryAddress: data.paymentBeneficiaryAddress?.trim() || "",
      };
      updateData["settings.currencyRates"] = {
        overrides: data.currencyRateOverrides,
      };
      if ((organization.settings as { multiCurrency?: unknown } | undefined)?.multiCurrency) {
        updateData["settings.multiCurrency"] = deleteField();
      }
      if ((organization.settings as { currency?: string } | undefined)?.currency) {
        updateData["settings.currency"] = deleteField();
      }

      await updateOrganization.mutateAsync({
        id: organization.id,
        data: updateData as Partial<Organization>,
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
              <Label htmlFor="publicSlug">Public catalog slug</Label>
              <Input
                id="publicSlug"
                {...register("publicSlug", {
                  onBlur: (event) => {
                    const normalized = normalizePublicSlug(event.target.value || "");
                    setValue("publicSlug", normalized, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  },
                })}
                placeholder="your-business-name"
                className={errors.publicSlug ? "border-red-500" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Public URL: /p/{publicSlugPreview || "<slug>"}
              </p>
              <p className="text-xs text-muted-foreground">
                If this slug is already in use, a numeric suffix is added automatically.
              </p>
              {errors.publicSlug && (
                <p className="text-sm text-red-600">{errors.publicSlug.message}</p>
              )}
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

        {/* Localization */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Localization</CardTitle>
            <CardDescription className="text-sm">
              Controls how dates and months appear on your public catalog pages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label>Public catalog language</Label>
              <Popover open={languagePopoverOpen} onOpenChange={setLanguagePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={languagePopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {(() => {
                      const lang = languages.find((l) => l.code === defaultLanguage);
                      return lang ? `${lang.flag} ${lang.name}` : "Select language";
                    })()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command filter={(value, search) => {
                    const lang = languages.find((l) => l.code === value);
                    if (!lang) return 0;
                    const q = search.toLowerCase();
                    return (
                      lang.code.toLowerCase().includes(q) ||
                      lang.name.toLowerCase().includes(q) ||
                      lang.nativeName.toLowerCase().includes(q)
                    ) ? 1 : 0;
                  }}>
                    <CommandInput placeholder="Search by name, code, or native name…" />
                    <CommandList>
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup>
                        {languages.map((lang) => (
                          <CommandItem
                            key={lang.code}
                            value={lang.code}
                            onSelect={(value) => {
                              setValue("defaultLanguage", value, { shouldDirty: true });
                              setLanguagePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 shrink-0 ${defaultLanguage === lang.code ? "opacity-100" : "opacity-0"}`}
                            />
                            <span className="mr-2">{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className="ml-1 text-muted-foreground">({lang.nativeName})</span>
                            <span className="ml-auto text-xs text-muted-foreground">{lang.code}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Month and date names on your public catalog will display in this language.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Currency</CardTitle>
            <CardDescription className="text-sm">
              Set a single base currency for this organization and optional conversion overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-sm">
              <Label>Base currency</Label>
              <CurrencyCombobox
                value={defaultCurrency}
                onChange={(code) =>
                  setValue("defaultCurrency", code, { shouldDirty: true })
                }
              />
              <p className="text-xs text-muted-foreground">
                Products are stored in this currency.
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="space-y-0.5">
                <Label>Conversion overrides</Label>
                <p className="text-xs text-muted-foreground">
                  Manual rates are used before live FX rates.
                </p>
              </div>

              {currencyRateFields.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 px-1">
                    <span className="text-xs text-muted-foreground">From</span>
                    <span className="text-xs text-muted-foreground text-center w-4">=</span>
                    <span className="text-xs text-muted-foreground">To (rate)</span>
                    <span />
                    <span />
                  </div>

                  {currencyRateFields.map((field, index) => {
                    const isFetching = fetchingRates.has(`${field.from}-${field.to}`);
                    const fromValue = watch(`currencyRateOverrides.${index}.from`);
                    const toValue = watch(`currencyRateOverrides.${index}.to`);
                    return (
                      <div key={field.id} className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-start gap-2">
                        <CurrencyCombobox
                          value={fromValue}
                          onChange={(code) =>
                            setValue(`currencyRateOverrides.${index}.from`, code, { shouldDirty: true })
                          }
                        />

                        <span className="text-sm text-muted-foreground font-medium mt-2">=</span>

                        <div className="space-y-1">
                          <div className="relative flex items-center">
                            <Input
                              type="number"
                              step="0.000001"
                              min="0.000001"
                              placeholder="0.00"
                              {...register(`currencyRateOverrides.${index}.rate`, { valueAsNumber: true })}
                              className={`pr-14 ${errors.currencyRateOverrides?.[index]?.rate ? "border-red-500" : ""}`}
                            />
                            <span className="absolute right-3 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
                              {toValue || "—"}
                            </span>
                          </div>
                          <CurrencyCombobox
                            value={toValue}
                            onChange={(code) =>
                              setValue(`currencyRateOverrides.${index}.to`, code, { shouldDirty: true })
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={isFetching || !fromValue || !toValue}
                          onClick={() => fetchLiveRate(fromValue, toValue, index)}
                          title="Fetch live rate"
                          className="shrink-0 mt-0.5"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCurrencyRate(index)}
                          className="shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendCurrencyRate({ from: defaultCurrency, to: "", rate: 1 })}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add conversion override
              </Button>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="space-y-0.5">
                <Label>Fallback payment instructions</Label>
                <p className="text-xs text-muted-foreground">
                  Used in Smart Payment Instructions when online payment link is unavailable.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentReferenceFormat">Reference format</Label>
                <Input
                  id="paymentReferenceFormat"
                  placeholder="{{invoiceNumber}}"
                  {...register("paymentReferenceFormat")}
                />
                <p className="text-xs text-muted-foreground">
                  Supported variables: {"{{invoiceNumber}}"}, {"{{invoiceId}}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentBankInstructions">Fallback instructions</Label>
                <Textarea
                  id="paymentBankInstructions"
                  rows={3}
                  placeholder="Online payment is unavailable. Use bank transfer and include the payment reference."
                  {...register("paymentBankInstructions")}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paymentBankAccountName">Bank account name</Label>
                  <Input id="paymentBankAccountName" {...register("paymentBankAccountName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentBankAccountNumber">Bank account number</Label>
                  <Input id="paymentBankAccountNumber" {...register("paymentBankAccountNumber")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentIban">IBAN</Label>
                  <Input id="paymentIban" {...register("paymentIban")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentSwift">SWIFT / BIC</Label>
                  <Input id="paymentSwift" {...register("paymentSwift")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentBeneficiaryName">Beneficiary name</Label>
                  <Input id="paymentBeneficiaryName" {...register("paymentBeneficiaryName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentBeneficiaryAddress">Beneficiary address</Label>
                  <Input id="paymentBeneficiaryAddress" {...register("paymentBeneficiaryAddress")} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Organization */}
        {isOwnerOrAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Duplicate Organization</CardTitle>
              <CardDescription className="text-sm">
                Create a full copy of this organization with all templates, workflows, email templates, products, and other entities.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <AlertDescription>
                  This will create a new organization with copies of all your templates, workflows, email templates, products, and other entities. 
                  All identity-bound data (users, clients, invoices) will be excluded.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDuplicateDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Organization
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-destructive">
                Danger Zone
              </CardTitle>
              <CardDescription className="text-sm">
                High-impact organization actions. These actions can change access permanently.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Transfer organization ownership</p>
                  <p className="text-xs text-muted-foreground">
                    Transfer to an existing member instantly, or send an ownership transfer email.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select
                    value={selectedTransferMemberId || undefined}
                    onValueChange={setSelectedTransferMemberId}
                    disabled={isOrganizationMembersLoading || transferCandidates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isOrganizationMembersLoading
                            ? "Loading members..."
                            : transferCandidates.length === 0
                              ? "No eligible members found"
                              : "Select existing member"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {transferCandidates.length > 0 ? (
                        transferCandidates.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} ({member.email})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {isOrganizationMembersLoading
                            ? "Loading members..."
                            : "No active non-owner members available for direct transfer."}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !selectedTransferMemberId ||
                      transferOwnershipMutation.isPending ||
                      transferCandidates.length === 0
                    }
                    onClick={() => setIsConfirmMemberTransferOpen(true)}
                  >
                    <Crown className="mr-2 h-4 w-4" />
                    Transfer to member
                  </Button>
                </div>
                {transferCandidates.length === 0 && !isOrganizationMembersLoading && (
                  <p className="text-xs text-muted-foreground">
                    No eligible existing members were found. Use the email transfer flow below.
                  </p>
                )}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    type="email"
                    value={transferTargetEmail}
                    placeholder="new-owner@company.com"
                    onChange={(event) => setTransferTargetEmail(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      requestOwnershipTransferMutation.isPending ||
                      transferTargetEmail.trim().length === 0
                    }
                    onClick={() => setIsConfirmEmailTransferOpen(true)}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send transfer email
                  </Button>
                </div>
              </div>

              <div className="border-t pt-5 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    Delete organization
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deletes organization access for all members and attempts to cancel any active Stripe subscription first.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete organization
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

      <AlertDialog
        open={isConfirmMemberTransferOpen}
        onOpenChange={setIsConfirmMemberTransferOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer organization ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer ownership to{" "}
              <span className="font-medium">{selectedTransferMember?.name || "selected member"}</span>
              ? You will become a member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferOwnershipMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={transferOwnershipMutation.isPending || !organization || !selectedTransferMember}
              onClick={() => {
                if (!organization || !selectedTransferMember) return;
                transferOwnershipMutation.mutate({
                  organizationId: organization.id,
                  newOwnerId: selectedTransferMember.id,
                });
              }}
            >
              {transferOwnershipMutation.isPending ? "Transferring..." : "Confirm transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isConfirmEmailTransferOpen}
        onOpenChange={setIsConfirmEmailTransferOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send ownership transfer request</AlertDialogTitle>
            <AlertDialogDescription>
              Send transfer request to{" "}
              <span className="font-medium">{transferTargetEmail.trim()}</span>.
              If this email already belongs to an existing member in this organization,
              ownership will be transferred directly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={requestOwnershipTransferMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                requestOwnershipTransferMutation.isPending ||
                !organization ||
                transferTargetEmail.trim().length === 0
              }
              onClick={() => {
                if (!organization || transferTargetEmail.trim().length === 0) return;
                requestOwnershipTransferMutation.mutate({
                  organizationId: organization.id,
                  targetEmail: transferTargetEmail.trim(),
                });
              }}
            >
              {requestOwnershipTransferMutation.isPending ? "Sending..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Type{" "}
              <span className="font-semibold">{organization?.name}</span> to confirm.
              Stripe subscription cancellation will be attempted before deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmOrganizationDelete">Organization name</Label>
            <Input
              id="confirmOrganizationDelete"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              placeholder={organization?.name || "Organization name"}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrganizationMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                deleteOrganizationMutation.isPending ||
                !organization ||
                deleteConfirmName !== organization.name
              }
              onClick={() => {
                if (!organization) return;
                deleteOrganizationMutation.mutate({
                  organizationId: organization.id,
                  confirmName: deleteConfirmName,
                });
              }}
            >
              {deleteOrganizationMutation.isPending ? "Deleting..." : "Delete organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Organization Dialog */}
      <DuplicateOrganizationDialog
        open={isDuplicateDialogOpen}
        onOpenChange={setIsDuplicateDialogOpen}
        onSuccess={() => {
          toast.success("Organization duplicated successfully!");
        }}
      />
    </div>
  );
}
