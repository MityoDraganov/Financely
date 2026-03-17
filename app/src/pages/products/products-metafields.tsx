import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database,
  Plus,
  Trash2,
  ChevronLeft,
  Search,
  Edit3,
  X,
  Package,
  Type,
  Hash,
  Image,
  Link2,
  Calendar,
  ToggleLeft,
  Palette,
  Braces,
  List,
  BookOpen,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useProductsByOrg } from "@/hooks";
import {
  useDeleteProductMetafieldDefinition,
  useDeleteProductMetafield,
  useProductMetafieldDefinitions,
  useProductMetafields,
  useUpdateProductMetafieldDefinition,
  useUpdateProductMetafield,
} from "@/hooks/repository-hooks/use-product-metafields";
import { useCreateProductMetafieldDefinition } from "@/hooks/service-hooks/use-product-metafield-functions";
import {
  CreateProductMetafieldDefinitionInput,
  MetafieldDefinition,
  UpdateProductMetafieldDefinitionInput,
} from "@/core";

// ─── Type helpers ────────────────────────────────────────────────────────────

type TypeCategory = "text" | "number" | "media" | "reference" | "link" | "date" | "boolean" | "color" | "json" | "list" | "other";

function getTypeCategory(type: string): TypeCategory {
  if (type.startsWith("list.")) return "list";
  if (["single_line_text_field", "multi_line_text_field", "rich_text_field", "single_line_text_field_choice_list", "single_line_text_field_email"].includes(type)) return "text";
  if (["number_integer", "number_decimal", "id", "money", "rating", "weight", "volume", "dimension"].includes(type)) return "number";
  if (["file_reference", "file_reference_image", "file_reference_video"].includes(type)) return "media";
  if (type.includes("_reference") || type === "mixed_reference") return "reference";
  if (["link", "url"].includes(type)) return "link";
  if (["date", "date_time"].includes(type)) return "date";
  if (type === "boolean") return "boolean";
  if (type === "color") return "color";
  if (type === "json") return "json";
  return "other";
}

const TYPE_META: Record<TypeCategory, { label: string; icon: React.ReactNode; className: string }> = {
  text:      { label: "Text",      icon: <Type className="h-3.5 w-3.5" />,         className: "bg-blue-50 text-blue-700 border-blue-200" },
  number:    { label: "Number",    icon: <Hash className="h-3.5 w-3.5" />,          className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  media:     { label: "Media",     icon: <Image className="h-3.5 w-3.5" />,         className: "bg-purple-50 text-purple-700 border-purple-200" },
  reference: { label: "Reference", icon: <BookOpen className="h-3.5 w-3.5" />,      className: "bg-orange-50 text-orange-700 border-orange-200" },
  link:      { label: "Link",      icon: <Link2 className="h-3.5 w-3.5" />,         className: "bg-sky-50 text-sky-700 border-sky-200" },
  date:      { label: "Date",      icon: <Calendar className="h-3.5 w-3.5" />,      className: "bg-amber-50 text-amber-700 border-amber-200" },
  boolean:   { label: "Boolean",   icon: <ToggleLeft className="h-3.5 w-3.5" />,    className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  color:     { label: "Color",     icon: <Palette className="h-3.5 w-3.5" />,       className: "bg-rose-50 text-rose-700 border-rose-200" },
  json:      { label: "JSON",      icon: <Braces className="h-3.5 w-3.5" />,        className: "bg-slate-100 text-slate-700 border-slate-200" },
  list:      { label: "List",      icon: <List className="h-3.5 w-3.5" />,          className: "bg-violet-50 text-violet-700 border-violet-200" },
  other:     { label: "Other",     icon: <SlidersHorizontal className="h-3.5 w-3.5" />, className: "bg-gray-50 text-gray-700 border-gray-200" },
};

function formatTypeName(type: string): string {
  return type
    .replace(/^list\./, "List · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TypeBadge({ type }: { type: string }) {
  const category = getTypeCategory(type);
  const meta = TYPE_META[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Products using a definition ─────────────────────────────────────────────

function ProductCoverage({
  metafields,
  isLoading,
  products,
}: {
  metafields: Array<Record<string, unknown>>;
  isLoading: boolean;
  products: Array<{ id: string; name: string; category?: string | null }>;
}) {
  const productMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; category?: string | null }>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const filledProducts = useMemo(() => {
    const seen = new Set<string>();
    return metafields
      .filter((m) => {
        const pid = m.productId as string;
        if (!pid || seen.has(pid)) return false;
        seen.add(pid);
        return true;
      })
      .map((m) => {
        const pid = m.productId as string;
        return productMap.get(pid) ?? { id: pid, name: pid };
      });
  }, [metafields, productMap]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Loading coverage...
      </div>
    );
  }

  if (filledProducts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
        <Package className="h-8 w-8 opacity-40" />
        <p className="text-sm">No products have this metafield filled in yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-3">
        {filledProducts.length} of {products.length} product{products.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
        {filledProducts.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
          >
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              {product.category && (
                <p className="text-xs text-muted-foreground truncate">{product.category}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function DefinitionSheet({
  definition,
  open,
  onClose,
  orgId,
  products,
  productCategories,
  onDeleted,
}: {
  definition: MetafieldDefinition | null;
  open: boolean;
  onClose: () => void;
  orgId: string;
  products: Array<{ id: string; name: string; category?: string | null }>;
  productCategories: string[];
  onDeleted: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateDefinition = useUpdateProductMetafieldDefinition();
  const deleteDefinition = useDeleteProductMetafieldDefinition();
  const updateMetafield = useUpdateProductMetafield();
  const deleteMetafield = useDeleteProductMetafield();

  // Lifted metafields query — drives ProductCoverage, type locking, and migrate dialog
  const { data: existingMetafields = [], isLoading: metafieldsLoading, error } = useProductMetafields(
    orgId,
    undefined,
    definition?.id
  );

  if(error){
    console.error(error)
  }

  const hasValues = existingMetafields.length > 0;

  // Map: stored value-key → count of products using it
  const inUseOptionValues = useMemo(() => {
    const map = new Map<string, number>();
    existingMetafields.forEach((m) => {
      const val = (m as Record<string, unknown>).value;
      if (typeof val === "string" && val) {
        map.set(val, (map.get(val) ?? 0) + 1);
      }
    });
    return map;
  }, [existingMetafields]);

  // Batch-migrate or clear product values when an in-use select option is removed
  const handleMigrateOptionValue = async (
    oldValue: string,
    newValue: string | null,
    _affectedCount?: number
  ) => {
    const affected = existingMetafields.filter(
      (m) => (m as Record<string, unknown>).value === oldValue
    );
    if (newValue !== null) {
      // Migrate: update every affected metafield to the new value
      await Promise.all(
        affected.map((m) =>
          updateMetafield.mutateAsync({
            id: (m as Record<string, unknown>).id as string,
            data: { value: newValue },
          })
        )
      );
      toast.success(
        `Migrated ${affected.length} product${affected.length !== 1 ? "s" : ""} to new option`
      );
    } else {
      // Clear: delete the metafield record entirely on each product
      await Promise.all(
        affected.map((m) =>
          deleteMetafield.mutateAsync((m as Record<string, unknown>).id as string)
        )
      );
      toast.success(
        `Cleared field on ${affected.length} product${affected.length !== 1 ? "s" : ""}`
      );
    }
  };

  const handleEdit = async (
    data: CreateProductMetafieldDefinitionInput | UpdateProductMetafieldDefinitionInput
  ) => {
    if (!definition) return;
    try {
      await updateDefinition.mutateAsync({
        id: definition.id,
        data: data as UpdateProductMetafieldDefinitionInput,
      });
      toast.success("Metafield definition updated");
      setIsEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to update: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!definition) return;
    try {
      await deleteDefinition.mutateAsync(definition.id);
      toast.success("Metafield definition deleted");
      onDeleted();
      onClose();
    } catch {
      toast.error("Failed to delete metafield definition");
    }
  };

  // Reset state when definition changes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsEditing(false);
      setConfirmDelete(false);
      onClose();
    }
  };

  if (!definition) return null;

  const category = getTypeCategory(definition.type);
  const meta = TYPE_META[category];

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b flex-row items-start justify-between space-y-0">
          <div className="space-y-1 flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                {meta.icon}
                {meta.label}
              </span>
            </div>
            <SheetTitle className="text-lg leading-tight">{definition.name}</SheetTitle>
            <p className="text-xs font-mono text-muted-foreground">{formatTypeName(definition.type)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setIsEditing(true); setConfirmDelete(false); }}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                {!confirmDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="text-xs text-destructive mr-1">Delete?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs px-2"
                      onClick={handleDelete}
                      disabled={deleteDefinition.isPending}
                    >
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => setConfirmDelete(false)}
                    >
                      No
                    </Button>
                  </div>
                )}
              </>
            )}
            {isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            <div className="px-6 py-5">
              <MetafieldDefinitionForm
                initialData={definition}
                onSubmit={handleEdit}
                onCancel={() => setIsEditing(false)}
                isPending={updateDefinition.isPending}
                organizationId={orgId}
                availableCategories={productCategories}
                hasValues={hasValues}
                inUseOptionValues={inUseOptionValues}
                onMigrateOptionValue={handleMigrateOptionValue}
              />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="h-full">
              <TabsList className="w-full rounded-none border-b h-10 bg-transparent px-6 justify-start gap-4">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 px-0 pb-0 text-sm"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="products"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-10 px-0 pb-0 text-sm"
                >
                  Products
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0 px-6 py-5 space-y-5">
                {definition.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="text-sm text-foreground">{definition.description}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field type</p>
                  <p className="text-sm font-mono">{formatTypeName(definition.type)}</p>
                </div>

                {definition.options?.storefrontApiAccess && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                    Storefront API access enabled
                  </div>
                )}

                {definition.options?.selectOptions && definition.options.selectOptions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Select options</p>
                    <div className="space-y-1.5">
                      {(definition.options.selectOptions as Array<{ label: string; value: string }>).map((opt) => (
                        <div key={opt.value} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                          <span className="font-medium">{opt.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">{opt.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {definition.categoryAssignments && definition.categoryAssignments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category assignments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {definition.categoryAssignments.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(!definition.description && (!definition.categoryAssignments || definition.categoryAssignments.length === 0)) && (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <Database className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No additional details</p>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="text-xs gap-1.5">
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit to add details
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="products" className="mt-0 px-6 py-5">
                <ProductCoverage
                  metafields={existingMetafields as Array<Record<string, unknown>>}
                  isLoading={metafieldsLoading}
                  products={products}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Create sheet ─────────────────────────────────────────────────────────────

function CreateSheet({
  open,
  onClose,
  orgId,
  productCategories,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  productCategories: string[];
}) {
  const createDefinition = useCreateProductMetafieldDefinition();

  const handleCreate = async (
    data: CreateProductMetafieldDefinitionInput | UpdateProductMetafieldDefinitionInput
  ) => {
    if (!("organizationId" in data)) {
      throw new Error("Organization ID required");
    }
    await createDefinition.mutateAsync(data as CreateProductMetafieldDefinitionInput);
    toast.success("Metafield definition created");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>Add metafield definition</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Define a custom field that can be added to products
          </p>
        </SheetHeader>
        <div className="px-6 py-5">
          <MetafieldDefinitionForm
            onSubmit={handleCreate}
            onCancel={onClose}
            isPending={createDefinition.isPending}
            organizationId={orgId}
            availableCategories={productCategories}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All types" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "media", label: "Media" },
  { value: "reference", label: "Reference" },
  { value: "boolean", label: "Boolean" },
  { value: "color", label: "Color" },
  { value: "json", label: "JSON" },
  { value: "list", label: "List" },
];

export default function ProductMetafieldsPage() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganizationContext();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDefinition, setSelectedDefinition] = useState<MetafieldDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: products = [] } = useProductsByOrg(currentOrganization?.id);
  const { data: metafieldDefinitions = [], error: metafieldDefinitionsError } =
    useProductMetafieldDefinitions(currentOrganization?.id);

  if (metafieldDefinitionsError) {
    console.error(metafieldDefinitionsError);
  }

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredDefinitions = useMemo(() => {
    return metafieldDefinitions.filter((def) => {
      if (typeFilter !== "all" && getTypeCategory(def.type) !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          def.name.toLowerCase().includes(q) ||
          (def.description || "").toLowerCase().includes(q) ||
          def.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [metafieldDefinitions, search, typeFilter]);

  const orgId = currentOrganization?.id ?? "";

  return (
    <div className="py-6 pr-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Product metafield definitions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {metafieldDefinitions.length} definition{metafieldDefinitions.length !== 1 ? "s" : ""} · Custom fields for your products
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add definition
        </Button>
      </div>

      {/* Search + filter */}
      {metafieldDefinitions.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search definitions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Empty state */}
      {metafieldDefinitions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Database className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-center">
              <p className="font-medium">No metafield definitions yet</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create custom fields to attach additional data to your products
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)} className="mt-2 gap-2">
              <Plus className="h-4 w-4" />
              Add your first definition
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No results */}
      {metafieldDefinitions.length > 0 && filteredDefinitions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No definitions match your search</p>
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Definition list */}
      {filteredDefinitions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {filteredDefinitions.map((def) => {
              const isSelected = selectedDefinition?.id === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => { setSelectedDefinition(def); setIsCreating(false); }}
                  className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 group ${isSelected ? "bg-muted/60" : ""}`}
                >
                  {/* Type indicator */}
                  <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border ${TYPE_META[getTypeCategory(def.type)].className}`}>
                    {TYPE_META[getTypeCategory(def.type)].icon}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{def.name}</span>
                      <TypeBadge type={def.type} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {def.description ? (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{def.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic">No description</p>
                      )}
                      {def.categoryAssignments && def.categoryAssignments.length > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {def.categoryAssignments.length} categor{def.categoryAssignments.length !== 1 ? "ies" : "y"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Detail sheet */}
      <DefinitionSheet
        definition={selectedDefinition}
        open={!!selectedDefinition}
        onClose={() => setSelectedDefinition(null)}
        orgId={orgId}
        products={products as Array<{ id: string; name: string; category?: string | null }>}
        productCategories={productCategories}
        onDeleted={() => setSelectedDefinition(null)}
      />

      {/* Create sheet */}
      <CreateSheet
        open={isCreating}
        onClose={() => setIsCreating(false)}
        orgId={orgId}
        productCategories={productCategories}
      />
    </div>
  );
}
