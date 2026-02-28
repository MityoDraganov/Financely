import { useState, useMemo } from "react";
import {
  Search,
  Database,
  Plus,
  Users,
  Package,
  ChevronRight,
  ArrowLeft,
  Layers,
  Hash,
  Type,
  AlignLeft,
  File,
  Link2,
  Calendar,
  ToggleLeft,
  Palette,
  Code,
  DollarSign,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MetaobjectDefinitionCard } from "@/components/content/metaobject-definition-card";
import { MetaobjectDefinitionForm } from "@/components/content/metaobject-definition-form";
import { DeleteMetaobjectDefinitionDialog } from "@/components/content/delete-metaobject-definition-dialog";
import {
  useMetaobjectDefinitions,
  useCreateMetaobjectDefinition,
  useUpdateMetaobjectDefinition,
  useDeleteMetaobjectDefinition,
} from "@/hooks/repository-hooks/use-metaobjects";
import {
  useContactMetafieldDefinitions,
  useDeleteContactMetafieldDefinition,
} from "@/hooks/repository-hooks/use-contact-metafields";
import {
  useProductMetafieldDefinitions,
  useDeleteProductMetafieldDefinition,
} from "@/hooks/repository-hooks/use-product-metafields";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import {
  CreateMetaobjectDefinitionInput,
  UpdateMetaobjectDefinitionInput,
  MetafieldDefinition,
} from "@/core";
import { toast } from "sonner";

// ── View state ────────────────────────────────────────────────────────────
type View =
  | { kind: "main" }
  | { kind: "metafields"; entityKey: "contacts" | "products" }
  | { kind: "create-metaobject-definition" }
  | { kind: "edit-metaobject-definition"; id: string };

// ── Field type → icon ─────────────────────────────────────────────────────
function fieldTypeIcon(type: string) {
  if (type.includes("multi_line")) return AlignLeft;
  if (type.includes("text") || type.includes("rich")) return Type;
  if (
    type.includes("number") ||
    type.includes("integer") ||
    type.includes("decimal") ||
    type === "id" ||
    type.includes("rating") ||
    type.includes("weight") ||
    type.includes("volume") ||
    type.includes("dimension")
  )
    return Hash;
  if (type.includes("money")) return DollarSign;
  if (type.includes("file") || type.includes("image") || type.includes("video")) return File;
  if (type.includes("url") || type.includes("link")) return Link2;
  if (type.includes("date")) return Calendar;
  if (type === "boolean") return ToggleLeft;
  if (type === "color") return Palette;
  if (type === "json") return Code;
  if (type.includes("reference")) return Database;
  return Layers;
}

function fieldTypeLabel(type: string): string {
  return type
    .replace(/^list\./, "List · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Section label ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
      {children}
    </p>
  );
}

// ── Metafield row ─────────────────────────────────────────────────────────
function MetafieldRow({
  definition,
  onDelete,
  isDeleting,
}: {
  definition: MetafieldDefinition;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const Icon = fieldTypeIcon(definition.type);
  return (
    <div className="group flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors border-b border-border/60 last:border-0">
      <div className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-primary/8 flex items-center justify-center text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{definition.name}</p>
        {definition.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{definition.description}</p>
        )}
      </div>
      <Badge
        variant="secondary"
        className="text-xs font-mono shrink-0 hidden sm:flex bg-muted/60 text-muted-foreground border-0"
      >
        {fieldTypeLabel(definition.type)}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={isDeleting}
            onClick={() => onDelete(definition.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Entity card ───────────────────────────────────────────────────────────
function EntityCard({
  icon: Icon,
  label,
  description,
  fieldCount,
  isLoading,
  accentClass,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  fieldCount: number;
  isLoading: boolean;
  accentClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group w-full text-left rounded-xl border border-border bg-card p-4 sm:p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${accentClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-3 w-16" />
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">{fieldCount}</span>{" "}
              metafield{fieldCount !== 1 ? "s" : ""}
            </>
          )}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function MetaobjectsPage() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;

  const [view, setView] = useState<View>({ kind: "main" });
  const [metaobjectSearch, setMetaobjectSearch] = useState("");
  const [metafieldSearch, setMetafieldSearch] = useState("");
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: metaobjectDefs = [], isLoading: loadingMetaobjectDefs } =
    useMetaobjectDefinitions(orgId);
  const { data: contactMetafields = [], isLoading: loadingContactMF } =
    useContactMetafieldDefinitions(orgId);
  const { data: productMetafields = [], isLoading: loadingProductMF } =
    useProductMetafieldDefinitions(orgId);

  const createMetaobjectDef = useCreateMetaobjectDefinition();
  const updateMetaobjectDef = useUpdateMetaobjectDefinition();
  const deleteMetaobjectDef = useDeleteMetaobjectDefinition();
  const deleteContactMF     = useDeleteContactMetafieldDefinition();
  const deleteProductMF     = useDeleteProductMetafieldDefinition();

  // ── Filtered metaobject defs ──────────────────────────────────────────
  const filteredMetaobjectDefs = useMemo(() => {
    if (!metaobjectSearch.trim()) return metaobjectDefs;
    const q = metaobjectSearch.toLowerCase();
    return metaobjectDefs.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q),
    );
  }, [metaobjectDefs, metaobjectSearch]);

  // ── Metafields for drill-in view ──────────────────────────────────────
  const activeMetafields: MetafieldDefinition[] = useMemo(() => {
    if (view.kind !== "metafields") return [];
    const raw =
      view.entityKey === "contacts"
        ? (contactMetafields as MetafieldDefinition[])
        : (productMetafields as MetafieldDefinition[]);
    const q = metafieldSearch.toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q),
    );
  }, [view, contactMetafields, productMetafields, metafieldSearch]);

  const activeEntityLabel =
    view.kind === "metafields"
      ? view.entityKey === "contacts"
        ? "Contacts"
        : "Products"
      : "";

  // ── Delete confirmation dialog ────────────────────────────────────────
  const deletingDef = deleteDialogId
    ? metaobjectDefs.find((d) => d.id === deleteDialogId)
    : null;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleCreateMetaobjectDef = async (
    data: CreateMetaobjectDefinitionInput | UpdateMetaobjectDefinitionInput,
  ) => {
    if (!orgId) { toast.error("Organization is required"); return; }
    const cd = data as CreateMetaobjectDefinitionInput;
    try {
      await createMetaobjectDef.mutateAsync({
        organizationId: orgId,
        name: cd.name,
        description: cd.description,
        fieldDefinitions: cd.fieldDefinitions,
        access: { admin: "MERCHANT_READ_WRITE", storefront: "PRIVATE" },
      });
      toast.success("Metaobject definition created");
      setView({ kind: "main" });
    } catch {
      toast.error("Failed to create metaobject definition");
    }
  };

  const handleUpdateMetaobjectDef = async (
    data: UpdateMetaobjectDefinitionInput,
  ) => {
    if (view.kind !== "edit-metaobject-definition") return;
    try {
      await updateMetaobjectDef.mutateAsync({ id: view.id, data });
      toast.success("Metaobject definition updated");
      setView({ kind: "main" });
    } catch {
      toast.error("Failed to update metaobject definition");
    }
  };

  const handleDeleteMetaobjectDef = async (id: string) => {
    try {
      await deleteMetaobjectDef.mutateAsync(id);
      toast.success("Metaobject definition deleted");
      setDeleteDialogId(null);
    } catch {
      toast.error("Failed to delete metaobject definition");
    }
  };

  const handleDeleteMetafield = async (id: string) => {
    if (view.kind !== "metafields") return;
    try {
      if (view.entityKey === "contacts") {
        await deleteContactMF.mutateAsync(id);
      } else {
        await deleteProductMF.mutateAsync(id);
      }
      toast.success("Metafield deleted");
    } catch {
      toast.error("Failed to delete metafield");
    }
  };

  const isDeletingMetafield =
    deleteContactMF.isPending || deleteProductMF.isPending;

  // ── Form views ────────────────────────────────────────────────────────
  if (
    view.kind === "create-metaobject-definition" ||
    view.kind === "edit-metaobject-definition"
  ) {
    const editingDef =
      view.kind === "edit-metaobject-definition"
        ? metaobjectDefs.find((d) => d.id === view.id)
        : undefined;
    return (
      <MetaobjectDefinitionForm
        initialData={editingDef}
        onSubmit={
          view.kind === "edit-metaobject-definition"
            ? handleUpdateMetaobjectDef
            : handleCreateMetaobjectDef
        }
        onCancel={() => setView({ kind: "main" })}
        isPending={createMetaobjectDef.isPending || updateMetaobjectDef.isPending}
      />
    );
  }

  // ── Metafields drill-in view ──────────────────────────────────────────
  if (view.kind === "metafields") {
    const Icon = view.entityKey === "contacts" ? Users : Package;
    const accentClass =
      view.entityKey === "contacts"
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
        : "bg-violet-500/10 text-violet-600 dark:text-violet-400";
    const isLoading =
      view.entityKey === "contacts" ? loadingContactMF : loadingProductMF;
    const raw =
      view.entityKey === "contacts"
        ? (contactMetafields as MetafieldDefinition[])
        : (productMetafields as MetafieldDefinition[]);

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => { setMetafieldSearch(""); setView({ kind: "main" }); }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground leading-none">
                {activeEntityLabel}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Metafield definitions
              </p>
            </div>
          </div>
          <Button size="sm" className="h-8 shrink-0" disabled>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Add metafield</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>

        {/* Search + count row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search metafields…"
              value={metafieldSearch}
              onChange={(e) => setMetafieldSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {!isLoading && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {raw.length} field{raw.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* List */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full hidden sm:block" />
                </div>
              ))}
            </div>
          ) : activeMetafields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Layers className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {metafieldSearch ? "No metafields found" : "No metafields yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                {metafieldSearch
                  ? "Try a different search term"
                  : `No metafield definitions for ${activeEntityLabel.toLowerCase()} have been created yet`}
              </p>
            </div>
          ) : (
            activeMetafields.map((mf) => (
              <MetafieldRow
                key={mf.id}
                definition={mf}
                onDelete={handleDeleteMetafield}
                isDeleting={isDeletingMetafield}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Main two-section view ─────────────────────────────────────────────
  return (
    <div className="space-y-8 sm:space-y-10">

      {/* ── SECTION 1: Metafields ── */}
      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>Metafields</SectionLabel>
          <p className="text-sm text-foreground font-medium mt-1">
            Built-in entity extensions
          </p>
          <p className="text-xs text-muted-foreground">
            Attach extra data fields to contacts and products
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EntityCard
            icon={Users}
            label="Contacts"
            description="Custom fields attached to contact records"
            fieldCount={contactMetafields.length}
            isLoading={loadingContactMF}
            accentClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            onClick={() => setView({ kind: "metafields", entityKey: "contacts" })}
          />
          <EntityCard
            icon={Package}
            label="Products"
            description="Custom fields attached to product records"
            fieldCount={productMetafields.length}
            isLoading={loadingProductMF}
            accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            onClick={() => setView({ kind: "metafields", entityKey: "products" })}
          />
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border/60" />

      {/* ── SECTION 2: Metaobjects ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <SectionLabel>Metaobjects</SectionLabel>
            <p className="text-sm text-foreground font-medium mt-1">
              Custom data types
            </p>
            <p className="text-xs text-muted-foreground">
              Structured schemas with configurable field definitions
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0 mt-0.5"
            onClick={() => setView({ kind: "create-metaobject-definition" })}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">New definition</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search definitions…"
            value={metaobjectSearch}
            onChange={(e) => setMetaobjectSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>

        {loadingMetaobjectDefs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : filteredMetaobjectDefs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-6">
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {metaobjectSearch ? "No definitions found" : "No metaobject definitions yet"}
              </p>
              <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">
                {metaobjectSearch
                  ? "Try a different search term"
                  : "Define a custom structured data type with its own field schema"}
              </p>
              {!metaobjectSearch && (
                <Button
                  size="sm"
                  onClick={() => setView({ kind: "create-metaobject-definition" })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New definition
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMetaobjectDefs.map((def) => (
              <MetaobjectDefinitionCard
                key={def.id}
                definition={def}
                onDelete={(id) => setDeleteDialogId(id)}
                onEdit={(id) => setView({ kind: "edit-metaobject-definition", id })}
                isDeleting={deleteMetaobjectDef.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Delete dialog */}
      {deletingDef && (
        <DeleteMetaobjectDefinitionDialog
          open={!!deleteDialogId}
          onOpenChange={(open) => !open && setDeleteDialogId(null)}
          definitionName={deletingDef.name}
          onConfirm={() => handleDeleteMetaobjectDef(deletingDef.id)}
          isPending={deleteMetaobjectDef.isPending}
        />
      )}
    </div>
  );
}
