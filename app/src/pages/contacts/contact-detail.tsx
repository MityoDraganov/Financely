import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Database, Link2, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContactsByOrg, useUpdateContact } from "@/hooks/repository-hooks/use-contacts";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import {
  ContactData,
  CreateContactMetafieldDefinitionInput,
  UpdateContactMetafieldDefinitionInput,
} from "@/core";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useContactMetafieldDefinitions,
  useContactMetafields,
  useCreateContactMetafield,
  useDeleteContactMetafield,
  useUpdateContactMetafield,
} from "@/hooks/repository-hooks/use-contact-metafields";
import { useCreateContactMetafieldDefinition } from "@/hooks/service-hooks/use-contact-metafield-functions";
import { MetafieldInput } from "@/components/metafields/metafield-input";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { extractUrls, getFileLabelFromUrl } from "@/utils/file-links";
import { cn } from "@/lib/utils";

// ─── File preview ──────────────────────────────────────────────────────────────

const NATIVE_PREVIEW_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp",
  "mp4", "webm", "ogg", "mp3", "wav",
  "txt", "csv", "json", "xml", "html", "htm",
]);

function getPreviewUrl(url: string): string {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
    if (NATIVE_PREVIEW_EXTENSIONS.has(ext)) return url;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  lead:     { dot: "bg-amber-400",   label: "Lead" },
  prospect: { dot: "bg-blue-400",    label: "Prospect" },
  customer: { dot: "bg-emerald-400", label: "Customer" },
  active:   { dot: "bg-green-400",   label: "Active" },
  inactive: { dot: "bg-gray-400",    label: "Inactive" },
} as const;

// ─── Form types ───────────────────────────────────────────────────────────────

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  tags: string[];
  notes?: string;
  status: "active" | "inactive" | "prospect" | "customer" | "lead";
  preferences: {
    preferredContactMethod: "email" | "phone" | "sms";
    marketingOptIn: boolean;
    newsletterOptIn: boolean;
  };
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
}

const createEmptyContactFormValues = (): ContactFormData => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
  address: { street: "", city: "", state: "", zipCode: "", country: "" },
  tags: [],
  notes: "",
  status: "lead",
  preferences: { preferredContactMethod: "email", marketingOptIn: false, newsletterOptIn: false },
  socialMedia: { linkedin: "", twitter: "", facebook: "", instagram: "" },
});

const mapContactToFormData = (contactData: ContactData | null): ContactFormData => {
  if (!contactData) return createEmptyContactFormValues();
  return {
    firstName: contactData.firstName || "",
    lastName: contactData.lastName || "",
    email: contactData.email || "",
    phone: Array.isArray(contactData.phone)
      ? contactData.phone[0] || ""
      : contactData.phone || "",
    company: contactData.company || "",
    jobTitle: contactData.jobTitle || "",
    address: contactData.address || { street: "", city: "", state: "", zipCode: "", country: "" },
    tags: contactData.tags || [],
    notes: contactData.notes || "",
    status: contactData.status || "lead",
    preferences: contactData.preferences || {
      preferredContactMethod: "email",
      marketingOptIn: false,
      newsletterOptIn: false,
    },
    socialMedia: contactData.socialMedia || {
      linkedin: "",
      twitter: "",
      facebook: "",
      instagram: "",
    },
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentOrganization } = useOrganizationContext();

  const { data: contacts = [], isLoading } = useContactsByOrg(currentOrganization?.id);
  const updateContactMutation = useUpdateContact();
  const { data: metafieldDefinitions = [] } = useContactMetafieldDefinitions(currentOrganization?.id);
  const metafieldsQuery = useContactMetafields(currentOrganization?.id, id);
  const existingMetafields = metafieldsQuery.data ?? [];
  const createMetafieldMutation = useCreateContactMetafield();
  const updateMetafieldMutation = useUpdateContactMetafield();
  const deleteMetafieldMutation = useDeleteContactMetafield();
  const createMetafieldDefinitionMutation = useCreateContactMetafieldDefinition();

  const [metafieldValues, setMetafieldValues] = useState<Record<string, unknown>>({});
  const [isCreatingMetafieldDefinition, setIsCreatingMetafieldDefinition] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const lastHydratedMetafieldsKeyRef = useRef<string | null>(null);
  const lastFormValuesKeyRef = useRef<string | null>(null);
  const hasInitializedAddressRef = useRef(false);

  const contact = contacts.find((c) => c.id === id);
  const contactData = contact ? (contact.data || contact) : null;

  // Expand address section if the contact already has address data
  useEffect(() => {
    if (contactData && !hasInitializedAddressRef.current) {
      hasInitializedAddressRef.current = true;
      const hasAddr = !!(
        contactData.address?.street ||
        contactData.address?.city ||
        contactData.address?.country
      );
      if (hasAddr) setShowAddress(true);
    }
  }, [contactData]);

  useEffect(() => {
    if (!metafieldsQuery.data) return;
    const values: Record<string, unknown> = {};
    metafieldsQuery.data.forEach((metafield) => {
      values[metafield.definitionId] = metafield.value;
    });
    const valuesKey = JSON.stringify(values);
    if (lastHydratedMetafieldsKeyRef.current === valuesKey) return;
    lastHydratedMetafieldsKeyRef.current = valuesKey;
    setMetafieldValues(values);
  }, [metafieldsQuery.data]);

  const formValues = useMemo<ContactFormData>(
    () => mapContactToFormData(contactData),
    [contactData],
  );
  const formValuesKey = useMemo(() => JSON.stringify(formValues), [formValues]);

  const form = useForm<ContactFormData>({
    defaultValues: createEmptyContactFormValues(),
  });

  const notesValue = form.watch("notes") ?? "";
  const noteLinks = useMemo(() => extractUrls(notesValue), [notesValue]);
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const status = form.watch("status");

  useEffect(() => {
    if (lastFormValuesKeyRef.current === formValuesKey) return;
    lastFormValuesKeyRef.current = formValuesKey;
    form.reset(formValues);
  }, [form, formValues, formValuesKey]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = async (data: ContactFormData) => {
    if (!contact?.id || !currentOrganization?.id) return;

    const existingPhones = Array.isArray(contactData?.phone)
      ? contactData.phone
      : contactData?.phone
      ? [contactData.phone]
      : [];
    const newPhone = data.phone?.trim();
    const updatedPhones = [...existingPhones];
    if (newPhone && !existingPhones.includes(newPhone)) {
      updatedPhones.push(newPhone);
    }

    try {
      await updateContactMutation.mutateAsync({
        id: contact.id,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: updatedPhones.length > 0 ? updatedPhones : [],
          company: data.company,
          jobTitle: data.jobTitle,
          address: data.address,
          tags: data.tags,
          notes: data.notes,
          status: data.status,
          preferences: data.preferences,
          socialMedia: data.socialMedia,
          organizationId: currentOrganization.id,
        } as Partial<ContactData>,
      });

      for (const definition of metafieldDefinitions) {
        const value = metafieldValues[definition.id];
        const existingMetafield = existingMetafields.find((m) => m.definitionId === definition.id);

        if (value === undefined || value === null || value === "") {
          if (existingMetafield) {
            await deleteMetafieldMutation.mutateAsync(existingMetafield.id);
          }
          continue;
        }

        if (existingMetafield) {
          if (JSON.stringify(existingMetafield.value) !== JSON.stringify(value)) {
            await updateMetafieldMutation.mutateAsync({
              id: existingMetafield.id,
              data: { value },
            });
          }
        } else {
          await createMetafieldMutation.mutateAsync({
            organizationId: currentOrganization.id,
            contactId: contact.id,
            definitionId: definition.id,
            value,
          });
        }
      }

      toast.success(t("contacts.messages.contactUpdated"));
      navigate("/contacts");
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast.error(t("contacts.messages.updateFailed"));
    }
  };

  const handleCreateMetafieldDefinition = async (
    data: CreateContactMetafieldDefinitionInput | UpdateContactMetafieldDefinitionInput,
  ) => {
    try {
      if ("organizationId" in data) {
        await createMetafieldDefinitionMutation.mutateAsync(
          data as CreateContactMetafieldDefinitionInput,
        );
      } else {
        throw new Error("Update not supported in this context");
      }
      toast.success("Contact metafield definition created successfully");
      setIsCreatingMetafieldDefinition(false);
    } catch (error) {
      console.error("Failed to create contact metafield definition:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create contact metafield definition: ${errorMessage}`);
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 pt-2">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-28 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Not found ─────────────────────────────────────────────────────────────

  if (!contact || !contactData) {
    return (
      <div className="p-4 sm:p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t("contacts.notFound", "Contact not found")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t(
            "contacts.notFoundDescription",
            "This contact may have been deleted or you don't have access.",
          )}
        </p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6">
      <form onSubmit={form.handleSubmit(handleSubmit)}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 shrink-0"
              onClick={() => navigate("/contacts")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-none truncate">
                {firstName || contactData.firstName} {lastName || contactData.lastName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Edit contact</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/contacts")}
            >
              {t("contacts.actions.cancel")}
            </Button>
            <Button type="submit" disabled={updateContactMutation.isPending}>
              {updateContactMutation.isPending
                ? t("contacts.actions.updating")
                : t("contacts.actions.update")}
            </Button>
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_288px] gap-8 max-w-5xl">

          {/* LEFT: Core fields ────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Name + contact info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="firstName">
                  {t("contacts.form.firstName")}
                </Label>
                <Input
                  id="firstName"
                  {...form.register("firstName", {
                    required: t("contacts.form.firstNameRequired"),
                  })}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="lastName">
                  {t("contacts.form.lastName")}
                </Label>
                <Input
                  id="lastName"
                  {...form.register("lastName", {
                    required: t("contacts.form.lastNameRequired"),
                  })}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="email">
                  {t("contacts.form.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email", {
                    required: t("contacts.form.emailRequired"),
                  })}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="phone">
                  {t("contacts.form.phone")}
                </Label>
                <Input id="phone" {...form.register("phone")} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="company">
                  {t("contacts.form.company")}
                </Label>
                <Input id="company" {...form.register("company")} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="jobTitle">
                  {t("contacts.form.jobTitle")}
                </Label>
                <Input id="jobTitle" {...form.register("jobTitle")} />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5 max-w-[200px]">
              <Label className="text-xs">{t("contacts.form.status")}</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  form.setValue("status", v as ContactFormData["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("contacts.form.statusPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(STATUS_CONFIG) as Array<
                      [string, (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]]
                    >
                  ).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address — collapsible */}
            {showAddress ? (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Address
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddress(false)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="street">
                    {t("contacts.form.street", "Street")}
                  </Label>
                  <Input id="street" {...form.register("address.street")} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="city">
                      {t("contacts.form.city", "City")}
                    </Label>
                    <Input id="city" {...form.register("address.city")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="state">
                      {t("contacts.form.state", "State")}
                    </Label>
                    <Input id="state" {...form.register("address.state")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="zipCode">
                      {t("contacts.form.zipCode", "Zip code")}
                    </Label>
                    <Input id="zipCode" {...form.register("address.zipCode")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="country">
                      {t("contacts.form.country", "Country")}
                    </Label>
                    <Input id="country" {...form.register("address.country")} />
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddress(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Add address
              </button>
            )}
          </div>

          {/* RIGHT: Notes + Custom fields ─────────────────────────────────── */}
          <div className="space-y-6 lg:border-l lg:pl-8">

            {/* Notes */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </p>
              <Textarea
                id="notes"
                rows={5}
                className="resize-none"
                placeholder="Add notes about this contact..."
                {...form.register("notes")}
              />
              {noteLinks.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Detected files
                  </p>
                  {noteLinks.map((url) => (
                    <div key={url} className="flex flex-wrap items-center gap-2 py-0.5">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate max-w-[140px]">
                        {getFileLabelFromUrl(url)}
                      </span>
                      <a
                        href={getPreviewUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        Preview
                      </a>
                      <a
                        href={url}
                        download
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Custom fields
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setIsCreatingMetafieldDefinition(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add field
                </Button>
              </div>

              {metafieldDefinitions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Database className="h-7 w-7 mb-2 opacity-25" />
                  <p className="text-sm">No custom fields yet.</p>
                  <p className="text-xs opacity-60 mt-0.5">
                    Create one to store additional data.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {metafieldDefinitions.map((definition) => {
                    const existingMetafield = existingMetafields.find(
                      (m) => m.definitionId === definition.id,
                    );
                    const currentValue =
                      metafieldValues[definition.id] !== undefined
                        ? metafieldValues[definition.id]
                        : existingMetafield?.value;

                    return (
                      <MetafieldInput
                        key={definition.id}
                        definition={definition}
                        value={currentValue}
                        onChange={(value) =>
                          setMetafieldValues((prev) => ({
                            ...prev,
                            [definition.id]: value,
                          }))
                        }
                        organizationId={currentOrganization?.id}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ── Create metafield definition dialog ──────────────────────────────── */}
      <Dialog
        open={isCreatingMetafieldDefinition}
        onOpenChange={setIsCreatingMetafieldDefinition}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add custom field</DialogTitle>
            <DialogDescription>
              Create a new custom field that can be used across contacts
            </DialogDescription>
          </DialogHeader>
          <MetafieldDefinitionForm
            onSubmit={handleCreateMetafieldDefinition}
            onCancel={() => setIsCreatingMetafieldDefinition(false)}
            isPending={createMetafieldDefinitionMutation.isPending}
            organizationId={currentOrganization?.id || ""}
            showCategories={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
