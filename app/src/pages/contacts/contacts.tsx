import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  User,
  Download,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useContactsByOrg,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useSearchContacts,
} from "@/hooks/repository-hooks/use-contacts";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import {
  ContactData,
  CreateContactMetafieldDefinitionInput,
  UpdateContactMetafieldDefinitionInput,
} from "@/core";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-import/export-dialog";
import {
  useContactMetafieldDefinitions,
  useDeleteContactMetafieldDefinition,
} from "@/hooks/repository-hooks/use-contact-metafields";
import { useCreateContactMetafieldDefinition } from "@/hooks/service-hooks/use-contact-metafield-functions";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";
import { cn } from "@/lib/utils";

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "lead",
  "prospect",
  "customer",
  "active",
  "inactive",
] as const;
type ContactStatus = typeof STATUS_OPTIONS[number];

const STATUS_CONFIG: Record<
  ContactStatus,
  { dot: string; badge: string; activePill: string; idlePill: string }
> = {
  lead: {
    dot: "bg-violet-400",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    activePill: "bg-violet-600 text-white border-violet-600 shadow-sm",
    idlePill: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  },
  prospect: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    activePill: "bg-amber-500 text-white border-amber-500 shadow-sm",
    idlePill: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  customer: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    activePill: "bg-blue-600 text-white border-blue-600 shadow-sm",
    idlePill: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  active: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activePill: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    idlePill: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  inactive: {
    dot: "bg-stone-400",
    badge: "bg-stone-50 text-stone-500 border-stone-200",
    activePill: "bg-stone-600 text-white border-stone-600 shadow-sm",
    idlePill: "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100",
  },
};

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
];

function getInitials(firstName: string, lastName: string): string {
  const a = (firstName || "").charAt(0).toUpperCase();
  const b = (lastName || "").charAt(0).toUpperCase();
  return (a + b).trim() || "?";
}

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  status: ContactStatus;
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

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function ContactsLoadingSkeleton() {
  return (
    <div className="py-6 pr-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-9 w-64 rounded-md" />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-44 hidden md:block" />
              <Skeleton className="h-3 w-28 hidden lg:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganizationContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isMetafieldSheetOpen, setIsMetafieldSheetOpen] = useState(false);
  const [isMetafieldDialogOpen, setIsMetafieldDialogOpen] = useState(false);
  const [deleteMetafieldDefinitionId, setDeleteMetafieldDefinitionId] =
    useState<string | null>(null);

  const { data: contacts = [], isLoading } = useContactsByOrg(
    currentOrganization?.id
  );
  const { data: searchResults = [] } = useSearchContacts(
    currentOrganization?.id,
    searchTerm
  );
  const { data: metafieldDefinitions = [], error } =
    useContactMetafieldDefinitions(currentOrganization?.id);
  if (error) console.error("Failed to fetch contacts metafields:", error);

  const createContactMutation = useCreateContact();
  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();
  const createMetafieldDefinition = useCreateContactMetafieldDefinition();
  const deleteMetafieldDefinition = useDeleteContactMetafieldDefinition();

  const form = useForm<ContactFormData>({
    defaultValues: {
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
      preferences: {
        preferredContactMethod: "email",
        marketingOptIn: false,
        newsletterOptIn: false,
      },
      socialMedia: { linkedin: "", twitter: "", facebook: "", instagram: "" },
    },
  });

  const baseContacts = searchTerm.trim() ? searchResults : contacts;
  const displayedContacts =
    statusFilter === "all"
      ? baseContacts
      : baseContacts.filter((c) => {
          const d = c.data || c;
          return d.status === statusFilter;
        });

  const handleCreateContact = async (data: ContactFormData) => {
    if (!currentOrganization?.id) return;

    const normalizedEmail = data.email.trim().toLowerCase();
    const existingContact = contacts.find((contact) => {
      const contactData = contact.data || contact;
      return (contactData.email || "").trim().toLowerCase() === normalizedEmail;
    });

    if (existingContact) {
      const existingContactData = existingContact.data || existingContact;
      const existingPhones = Array.isArray(existingContactData.phone)
        ? existingContactData.phone
        : existingContactData.phone
        ? [existingContactData.phone]
        : [];
      const newPhone = data.phone?.trim();
      const updatedPhones = [...existingPhones];
      if (newPhone && !existingPhones.includes(newPhone)) {
        updatedPhones.push(newPhone);
      }
      try {
        await updateContactMutation.mutateAsync({
          id: existingContact.id,
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
        setIsCreateDialogOpen(false);
        form.reset();
        toast.success(
          newPhone && !existingPhones.includes(newPhone)
            ? t("contacts.messages.contactUpdatedWithPhone")
            : t("contacts.messages.contactUpdated")
        );
      } catch {
        toast.error(t("contacts.messages.updateFailed"));
      }
      return;
    }

    try {
      await createContactMutation.mutateAsync({
        ...data,
        phone: data.phone?.trim() ? [data.phone.trim()] : [],
        organizationId: currentOrganization.id,
      } as ContactData);
      setIsCreateDialogOpen(false);
      form.reset();
      toast.success(t("contacts.messages.contactCreated"));
    } catch {
      toast.error(t("contacts.messages.createFailed"));
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;
    try {
      await deleteContactMutation.mutateAsync(deleteContactId);
      setDeleteContactId(null);
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const handleCreateMetafieldDefinition = async (
    data:
      | CreateContactMetafieldDefinitionInput
      | UpdateContactMetafieldDefinitionInput
  ) => {
    if (!currentOrganization?.id) {
      toast.error("Organization is required");
      return;
    }
    try {
      if ("organizationId" in data) {
        await createMetafieldDefinition.mutateAsync(
          data as CreateContactMetafieldDefinitionInput
        );
      } else {
        throw new Error("Update not supported in this context");
      }
      toast.success("Custom field created");
      setIsMetafieldDialogOpen(false);
    } catch (error) {
      toast.error(
        `Failed to create field: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleDeleteMetafieldDefinition = async () => {
    if (!deleteMetafieldDefinitionId) return;
    try {
      await deleteMetafieldDefinition.mutateAsync(
        deleteMetafieldDefinitionId
      );
      toast.success("Custom field deleted");
      setDeleteMetafieldDefinitionId(null);
    } catch {
      toast.error("Failed to delete custom field");
    }
  };

  if (isLoading) return <ContactsLoadingSkeleton />;

  return (
    <div className="py-6 pr-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("contacts.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("contacts.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMetafieldSheetOpen(true)}
          >
            <Database className="mr-1.5 h-3.5 w-3.5" />
            Custom fields
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("contacts.addContact")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-1">
                <DialogTitle>{t("contacts.createTitle")}</DialogTitle>
                <DialogDescription>
                  {t("contacts.createDescription")}
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(handleCreateContact)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.firstName")}
                    </Label>
                    <Input
                      className="text-sm"
                      {...form.register("firstName", {
                        required: t("contacts.form.firstNameRequired"),
                      })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.lastName")}
                    </Label>
                    <Input
                      className="text-sm"
                      {...form.register("lastName", {
                        required: t("contacts.form.lastNameRequired"),
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.email")}
                    </Label>
                    <Input
                      type="email"
                      className="text-sm"
                      {...form.register("email", {
                        required: t("contacts.form.emailRequired"),
                      })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.phone")}
                    </Label>
                    <Input
                      className="text-sm"
                      {...form.register("phone")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.company")}
                    </Label>
                    <Input
                      className="text-sm"
                      {...form.register("company")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {t("contacts.form.jobTitle")}
                    </Label>
                    <Input
                      className="text-sm"
                      {...form.register("jobTitle")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("contacts.form.status")}</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(v) =>
                      form.setValue("status", v as ContactStatus)
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-sm">
                          {t(`contacts.status.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("contacts.form.notes")}</Label>
                  <Textarea
                    rows={2}
                    className="text-sm resize-none"
                    {...form.register("notes")}
                  />
                </div>
                <DialogFooter className="gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    {t("contacts.actions.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createContactMutation.isPending}
                  >
                    {createContactMutation.isPending
                      ? t("contacts.actions.creating")
                      : t("contacts.actions.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Search + count ── */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 pointer-events-none" />
          <Input
            placeholder={t("contacts.filters.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {displayedContacts.length === contacts.length
            ? `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`
            : `${displayedContacts.length} of ${contacts.length}`}
        </span>
      </div>

      {/* ── Status filter chips ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
            statusFilter === "all"
              ? "bg-foreground text-background border-foreground shadow-sm"
              : "text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
          )}
        >
          All
        </button>
        {STATUS_OPTIONS.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? "all" : status)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                isActive ? cfg.activePill : cfg.idlePill
              )}
            >
              {t(`contacts.status.${status}`)}
            </button>
          );
        })}
      </div>

      {/* ── Contacts table ── */}
      <Card className="overflow-hidden">
        {displayedContacts.length === 0 ? (
          <CardContent className="py-20 flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {searchTerm.trim() || statusFilter !== "all"
                  ? "No contacts match your filters"
                  : t("contacts.empty.title")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm.trim() || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : t("contacts.empty.getStarted")}
              </p>
            </div>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-medium pl-4">
                  Contact
                </TableHead>
                <TableHead className="text-xs font-medium">Email</TableHead>
                <TableHead className="text-xs font-medium">Phone</TableHead>
                <TableHead className="text-xs font-medium w-[120px]">
                  Status
                </TableHead>
                <TableHead className="w-[44px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedContacts.map((contact) => {
                const d = contact.data || contact;
                if (!contact?.id) return null;

                const fullName =
                  [d.firstName, d.lastName].filter(Boolean).join(" ") || "—";
                const initials = getInitials(
                  d.firstName || "",
                  d.lastName || ""
                );
                const avatarColor = getAvatarColor(
                  fullName + (d.email || "")
                );
                const status = (d.status || "lead") as ContactStatus;
                const statusCfg =
                  STATUS_CONFIG[status] || STATUS_CONFIG.lead;
                const phones = Array.isArray(d.phone)
                  ? d.phone
                  : d.phone
                  ? [d.phone]
                  : [];

                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer transition-colors duration-100 hover:bg-muted/40 group"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    {/* Avatar + name + company */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-transform duration-150 group-hover:scale-105",
                            avatarColor
                          )}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {fullName}
                          </p>
                          {d.company && (
                            <p className="text-xs text-muted-foreground truncate">
                              {d.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-sm text-muted-foreground py-3 max-w-[200px]">
                      <p className="truncate">{d.email || "—"}</p>
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="text-sm text-muted-foreground py-3 whitespace-nowrap">
                      {phones.length > 0 ? (
                        <>
                          {phones[0]}
                          {phones.length > 1 && (
                            <span className="text-xs text-muted-foreground/60 ml-1.5">
                              +{phones.length - 1}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          statusCfg.badge
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            statusCfg.dot
                          )}
                        />
                        {t(`contacts.status.${status}`)}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell
                      className="py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/contacts/${contact.id}`)
                            }
                          >
                            <Edit className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteContactId(contact.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Custom fields Sheet ── */}
      <Sheet open={isMetafieldSheetOpen} onOpenChange={setIsMetafieldSheetOpen}>
        <SheetContent className="sm:max-w-md p-0 gap-0" side="right">
          <div className="flex items-center justify-between px-6 py-5 border-b">
            <div>
              <SheetTitle className="text-base font-semibold">
                Custom fields
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Extra data fields available on all contacts
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsMetafieldDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add field
            </Button>
          </div>

          <div className="overflow-y-auto h-[calc(100vh-88px)]">
            {metafieldDefinitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">No custom fields yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add fields to capture extra contact data
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {metafieldDefinitions.map((def) => (
                  <div
                    key={def.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{def.name}</p>
                      {def.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {def.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() =>
                        setDeleteMetafieldDefinitionId(def.id)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Create metafield definition dialog ── */}
      <Dialog
        open={isMetafieldDialogOpen}
        onOpenChange={setIsMetafieldDialogOpen}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add custom field</DialogTitle>
            <DialogDescription>
              Define a new field that will be available on all contacts
            </DialogDescription>
          </DialogHeader>
          <MetafieldDefinitionForm
            onSubmit={handleCreateMetafieldDefinition}
            onCancel={() => setIsMetafieldDialogOpen(false)}
            isPending={createMetafieldDefinition.isPending}
            organizationId={currentOrganization?.id || ""}
            showCategories={false}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete contact confirmation ── */}
      <AlertDialog
        open={!!deleteContactId}
        onOpenChange={() => setDeleteContactId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contacts.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("contacts.delete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("contacts.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {t("contacts.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete custom field confirmation ── */}
      <AlertDialog
        open={!!deleteMetafieldDefinitionId}
        onOpenChange={(open) => {
          if (!open) setDeleteMetafieldDefinitionId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom field?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The field will be removed from all
              contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMetafieldDefinition}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["contacts"]}
      />
    </div>
  );
}
