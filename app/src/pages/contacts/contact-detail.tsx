import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Database, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  if (!contactData) {
    return createEmptyContactFormValues();
  }
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
    socialMedia: contactData.socialMedia || { linkedin: "", twitter: "", facebook: "", instagram: "" },
  };
};

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
  const lastHydratedMetafieldsKeyRef = useRef<string | null>(null);
  const lastFormValuesKeyRef = useRef<string | null>(null);

  const contact = contacts.find((c) => c.id === id);
  const contactData = contact ? (contact.data || contact) : null;

  useEffect(() => {
    if (!metafieldsQuery.data) {
      return;
    }
    const values: Record<string, unknown> = {};
    metafieldsQuery.data.forEach((metafield) => {
      values[metafield.definitionId] = metafield.value;
    });
    const valuesKey = JSON.stringify(values);
    if (lastHydratedMetafieldsKeyRef.current === valuesKey) {
      return;
    }
    lastHydratedMetafieldsKeyRef.current = valuesKey;
    setMetafieldValues(values);
  }, [metafieldsQuery.data]);

  const formValues = useMemo<ContactFormData>(() => {
    return mapContactToFormData(contactData);
  }, [contactData]);
  const formValuesKey = useMemo(() => JSON.stringify(formValues), [formValues]);

  const form = useForm<ContactFormData>({
    defaultValues: createEmptyContactFormValues(),
  });
  const notesValue = form.watch("notes") ?? "";
  const noteLinks = useMemo(() => extractUrls(notesValue), [notesValue]);

  useEffect(() => {
    if (lastFormValuesKeyRef.current === formValuesKey) {
      return;
    }
    lastFormValuesKeyRef.current = formValuesKey;
    form.reset(formValues);
  }, [form, formValues, formValuesKey]);

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
        await createMetafieldDefinitionMutation.mutateAsync(data as CreateContactMetafieldDefinitionInput);
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

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!contact || !contactData) {
    return (
      <div className="p-4 sm:p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t("contacts.notFound", "Contact not found")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("contacts.notFoundDescription", "This contact may have been deleted or you don't have access.")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{t("contacts.editTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("contacts.editDescription")}</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("contacts.form.firstName")}</Label>
                <Input
                  id="firstName"
                  {...form.register("firstName", { required: t("contacts.form.firstNameRequired") })}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("contacts.form.lastName")}</Label>
                <Input
                  id="lastName"
                  {...form.register("lastName", { required: t("contacts.form.lastNameRequired") })}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("contacts.form.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email", { required: t("contacts.form.emailRequired") })}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("contacts.form.phone")}</Label>
                <Input id="phone" {...form.register("phone")} />
              </div>
            </div>

            {/* Company + Job title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">{t("contacts.form.company")}</Label>
                <Input id="company" {...form.register("company")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">{t("contacts.form.jobTitle")}</Label>
                <Input id="jobTitle" {...form.register("jobTitle")} />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>{t("contacts.form.status")}</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value as ContactFormData["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("contacts.form.statusPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">{t("contacts.status.lead")}</SelectItem>
                  <SelectItem value="prospect">{t("contacts.status.prospect")}</SelectItem>
                  <SelectItem value="customer">{t("contacts.status.customer")}</SelectItem>
                  <SelectItem value="active">{t("contacts.status.active")}</SelectItem>
                  <SelectItem value="inactive">{t("contacts.status.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <Label>{t("contacts.form.address", "Address")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-xs text-muted-foreground">
                    {t("contacts.form.street", "Street")}
                  </Label>
                  <Input id="street" {...form.register("address.street")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs text-muted-foreground">
                    {t("contacts.form.city", "City")}
                  </Label>
                  <Input id="city" {...form.register("address.city")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-xs text-muted-foreground">
                    {t("contacts.form.state", "State")}
                  </Label>
                  <Input id="state" {...form.register("address.state")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="text-xs text-muted-foreground">
                    {t("contacts.form.zipCode", "Zip code")}
                  </Label>
                  <Input id="zipCode" {...form.register("address.zipCode")} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="country" className="text-xs text-muted-foreground">
                    {t("contacts.form.country", "Country")}
                  </Label>
                  <Input id="country" {...form.register("address.country")} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t("contacts.form.notes")}</Label>
              <Textarea id="notes" rows={3} {...form.register("notes")} />
              {noteLinks.length > 0 && (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Detected file links</p>
                  {noteLinks.map((url) => (
                    <div key={url} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{getFileLabelFromUrl(url)}</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        Open
                      </a>
                      <a href={url} download className="underline text-primary">
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metafields */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Contact metafields</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingMetafieldDefinition(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add metafield
                </Button>
              </div>

              {metafieldDefinitions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No metafields available. Create one to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {metafieldDefinitions.map((definition) => {
                    const existingMetafield = existingMetafields.find((m) => m.definitionId === definition.id);
                    const currentValue = metafieldValues[definition.id] !== undefined
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/contacts")}>
                {t("contacts.actions.cancel")}
              </Button>
              <Button type="submit" disabled={updateContactMutation.isPending}>
                {updateContactMutation.isPending
                  ? t("contacts.actions.updating")
                  : t("contacts.actions.update")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isCreatingMetafieldDefinition} onOpenChange={setIsCreatingMetafieldDefinition}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add contact metafield</DialogTitle>
            <DialogDescription>
              Create a new metafield definition that can be used across contacts
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
