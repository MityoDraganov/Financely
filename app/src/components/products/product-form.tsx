import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Upload, X, Star, Plus, Database, CheckCircle, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { CreateProductInput, Product, CreateProductMetafieldDefinitionInput, UpdateProductMetafieldDefinitionInput } from "@/core";
import { slugifyPublicSegment } from "@/utils/slug";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useProductMetafieldDefinitions, useProductMetafields, useCreateProductMetafield, useUpdateProductMetafield, useDeleteProductMetafield } from "@/hooks/repository-hooks/use-product-metafields";
import { useCreateProductMetafieldDefinition } from "@/hooks/service-hooks/use-product-metafield-functions";
import { useCreateProduct, useProductsByOrg } from "@/hooks";
import { MetafieldInput } from "@/components/metafields/metafield-input";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";
import { toast } from "sonner";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

interface PendingImage {
  id: string;
  localUrl: string;
  progress: number;
  done: boolean;
  error: boolean;
}

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: CreateProductInput | Partial<CreateProductInput>) => Promise<void | { id: string } | undefined>;
  onCancel: () => void;
  isPending?: boolean;
  organizationId: string;
  hideHeader?: boolean;
}

const PUBLIC_SLUG_MAX_LENGTH = 64;

function normalizeCategoryValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePublicSlug(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return slugifyPublicSegment(trimmed)
    .slice(0, PUBLIC_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

function buildInitialFormData(product?: Product): Partial<CreateProductInput> {
  if (!product) {
    return {
      name: "",
      description: "",
      price: undefined,
      currency: undefined,
      sku: "",
      stockQuantity: undefined,
      trackInventory: false,
      category: "",
      status: undefined,
      images: [],
      lowStockThreshold: undefined,
      cost: undefined,
      taxRate: undefined,
    };
  }

  return {
    name: product.name ?? "",
    description: product.description ?? "",
    price: product.price ?? undefined,
    currency: product.currency ?? undefined,
    sku: product.sku ?? "",
    stockQuantity: product.stockQuantity ?? undefined,
    trackInventory: product.trackInventory ?? false,
    category: normalizeCategoryValue(product.category ?? ""),
    status: product.status ?? undefined,
    images: product.images ?? [],
    lowStockThreshold: product.lowStockThreshold ?? undefined,
    cost: product.cost ?? undefined,
    taxRate: product.taxRate ?? undefined,
  };
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
  organizationId,
  hideHeader = false,
}: ProductFormProps) {
  const { t } = useTranslation();
  const isEditMode = !!initialData;
  const imageUpload = useFileUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [publicSlugInput, setPublicSlugInput] = useState(
    normalizePublicSlug(initialData?.publicPage?.slug || ""),
  );
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(
    Boolean(initialData?.publicPage?.slug),
  );
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const { data: currentOrganization } = useCurrentOrganization();
  const organizationBaseCurrency = useMemo(() => {
    if (currentOrganization?.id === organizationId) {
      return currentOrganization.settings?.defaultCurrency || "USD";
    }
    return initialData?.currency || "USD";
  }, [currentOrganization?.id, currentOrganization?.settings?.defaultCurrency, organizationId, initialData?.currency]);

  const [formData, setFormData] = useState<Partial<CreateProductInput>>(
    () => buildInitialFormData(initialData),
  );

  const { data: metafieldDefinitions = [], error: metafieldDefinitionsError } = useProductMetafieldDefinitions(organizationId);
  if (metafieldDefinitionsError) {
    console.error(metafieldDefinitionsError);
  }
  const { data: organizationProducts = [] } = useProductsByOrg(organizationId);
  const { data: existingMetafields = [], error: existingMetafieldsError } = useProductMetafields(
    organizationId,
    initialData?.id
  );
  if (existingMetafieldsError) {
    console.error(existingMetafieldsError);
  }

  const createProductMutation = useCreateProduct();
  const createMetafieldMutation = useCreateProductMetafield();
  const updateMetafieldMutation = useUpdateProductMetafield();
  const deleteMetafieldMutation = useDeleteProductMetafield();
  const createMetafieldDefinitionMutation = useCreateProductMetafieldDefinition();

  const [metafieldValues, setMetafieldValues] = useState<Record<string, unknown>>({});
  const [isCreatingMetafieldDefinition, setIsCreatingMetafieldDefinition] = useState(false);
  const [isSlugChangeConfirmOpen, setIsSlugChangeConfirmOpen] = useState(false);

  useEffect(() => {
    if (existingMetafields.length === 0) return;
    const values: Record<string, unknown> = {};
    existingMetafields.forEach((metafield) => {
      values[metafield.definitionId] = metafield.value;
    });
    setMetafieldValues(values);
  }, [existingMetafields]);

  useEffect(() => {
    setFormData(buildInitialFormData(initialData));
    setPublicSlugInput(normalizePublicSlug(initialData?.publicPage?.slug || ""));
    setIsSlugManuallyEdited(Boolean(initialData?.publicPage?.slug));
    setPendingImages([]);
    setMetafieldValues({});
    setCategorySearch("");
    setIsCategoryPickerOpen(false);
  }, [isEditMode, initialData?.id]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      currency: organizationBaseCurrency,
    }));
  }, [organizationBaseCurrency]);

  const { categoryMetafields, productMetafields } = useMemo(() => {
    const productCategory = normalizeCategoryValue(formData.category || "");
    const category: typeof metafieldDefinitions = [];
    const product: typeof metafieldDefinitions = [];

    metafieldDefinitions.forEach((def) => {
      const hasCategoryAssignment = def.categoryAssignments && def.categoryAssignments.length > 0;
      const matchesCategory = productCategory && hasCategoryAssignment && def.categoryAssignments.includes(productCategory);
      
      if (hasCategoryAssignment && matchesCategory) {
        category.push(def);
      } else if (!hasCategoryAssignment) {
        product.push(def);
      }
    });

    return { categoryMetafields: category, productMetafields: product };
  }, [metafieldDefinitions, formData.category]);

  const allApplicableDefinitions = useMemo(() => {
    return [...categoryMetafields, ...productMetafields];
  }, [categoryMetafields, productMetafields]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();

    organizationProducts.forEach((product) => {
      const normalized = normalizeCategoryValue(product.category || "");
      if (!normalized) return;

      const key = normalized.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }

      counts.set(key, { label: normalized, count: 1 });
    });

    return Array.from(counts.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .map((entry) => entry.label);
  }, [organizationProducts]);

  const normalizedCategorySearch = normalizeCategoryValue(categorySearch);
  const hasExactCategoryMatch = categoryOptions.some(
    (category) => category.toLowerCase() === normalizedCategorySearch.toLowerCase(),
  );
  const currentCategoryLabel = normalizeCategoryValue(formData.category || "");

  const autoGeneratedPublicSlug = useMemo(
    () => normalizePublicSlug(formData.name || ""),
    [formData.name],
  );
  const savedPublicSlug = useMemo(
    () =>
      normalizePublicSlug(
        initialData?.publicPage?.slugCanonical ||
          initialData?.publicPage?.slug ||
          "",
      ),
    [
      initialData?.id,
      initialData?.publicPage?.slug,
      initialData?.publicPage?.slugCanonical,
    ],
  );
  const effectivePublicSlug = isSlugManuallyEdited
    ? publicSlugInput
    : autoGeneratedPublicSlug;
  const isSubmitDisabled = isPending || !formData.name?.trim() || formData.price == null || Number.isNaN(formData.price);

  const handleImageUpload = async (file: File, timestamp: number, pendingId: string) => {
    const path = `organizations/${organizationId}/products/${timestamp}-${file.name}`;

    // Organic progress simulation: fast start, slows near 75%
    let simulated = 0;
    const interval = setInterval(() => {
      simulated = simulated < 35 ? simulated + 4 : simulated < 60 ? simulated + 1.8 : simulated + 0.5;
      if (simulated >= 75) { simulated = 75; clearInterval(interval); }
      setPendingImages(prev =>
        prev.map(p => p.id === pendingId ? { ...p, progress: Math.min(75, simulated) } : p)
      );
    }, 60);

    const url = await imageUpload.uploadFile(file, path);
    clearInterval(interval);

    if (url) {
      // Snap to 100% → brief done state → crossfade into real image
      setPendingImages(prev => prev.map(p => p.id === pendingId ? { ...p, progress: 100, done: true } : p));
      setTimeout(() => {
        setFormData(prev => ({ ...prev, images: [...(prev.images || []), url] }));
        setPendingImages(prev => {
          const found = prev.find(p => p.id === pendingId);
          if (found) URL.revokeObjectURL(found.localUrl);
          return prev.filter(p => p.id !== pendingId);
        });
      }, 700);
    } else {
      clearInterval(interval);
      setPendingImages(prev => prev.map(p => p.id === pendingId ? { ...p, error: true } : p));
      setTimeout(() => {
        setPendingImages(prev => {
          const found = prev.find(p => p.id === pendingId);
          if (found) URL.revokeObjectURL(found.localUrl);
          return prev.filter(p => p.id !== pendingId);
        });
      }, 2500);
    }
  };

  const handleRemoveImage = useCallback((index: number) => {
    setFormData((prev) => {
      const newImages = prev.images?.filter((_, i) => i !== index) || [];
      return { ...prev, images: newImages };
    });
  }, []);

  const handleSetFeaturedImage = useCallback((index: number) => {
    setFormData((prev) => {
      if (!prev.images || prev.images.length === 0) return prev;
      const newImages = [...prev.images];
      const [featured] = newImages.splice(index, 1);
      newImages.unshift(featured);
      return { ...prev, images: newImages };
    });
  }, []);

  const handleMetafieldChange = (definitionId: string, value: unknown) => {
    setMetafieldValues((prev) => ({
      ...prev,
      [definitionId]: value,
    }));
  };

  const handleCreateMetafieldDefinition = async (data: CreateProductMetafieldDefinitionInput | UpdateProductMetafieldDefinitionInput) => {
    try {
      if ('organizationId' in data) {
        await createMetafieldDefinitionMutation.mutateAsync(data as CreateProductMetafieldDefinitionInput);
      } else {
        throw new Error("Update not supported in this context");
      }
      toast.success("Metafield definition created successfully");
      setIsCreatingMetafieldDefinition(false);
    } catch (error) {
      console.error("Failed to create metafield definition:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create metafield definition: ${errorMessage}`);
    }
  };

  const saveMetafields = async (productId: string) => {
    for (const definition of allApplicableDefinitions) {
      const value = metafieldValues[definition.id];
      const existingMetafield = existingMetafields.find((m) => m.definitionId === definition.id);

      if (value === undefined || value === null || value === "") {
        if (existingMetafield) {
          try {
            await deleteMetafieldMutation.mutateAsync(existingMetafield.id);
          } catch (error) {
            console.error(`Failed to delete metafield ${existingMetafield.id}:`, error);
          }
        }
        continue;
      }

      if (existingMetafield) {
        if (JSON.stringify(existingMetafield.value) !== JSON.stringify(value)) {
          try {
            await updateMetafieldMutation.mutateAsync({
              id: existingMetafield.id,
              data: { value },
            });
          } catch (error) {
            console.error(`Failed to update metafield ${existingMetafield.id}:`, error);
            toast.error(`Failed to update metafield: ${definition.name}`);
          }
        }
      } else {
        try {
          await createMetafieldMutation.mutateAsync({
            organizationId,
            productId,
            definitionId: definition.id,
            value,
          });
        } catch (error) {
          console.error(`Failed to create metafield for ${definition.id}:`, error);
          toast.error(`Failed to create metafield: ${definition.name}`);
        }
      }
    }
  };

  const handleSubmit = async (options?: { skipSlugChangeConfirm?: boolean }) => {
    if (!formData.name?.trim() || formData.price == null || Number.isNaN(formData.price)) {
      return;
    }

    let productId: string;
    const normalizedCategory = normalizeCategoryValue(formData.category || "");
    const trimmedPublicSlug = effectivePublicSlug.trim();
    const didSlugChangeInEditMode =
      isEditMode && trimmedPublicSlug !== savedPublicSlug;

    if (didSlugChangeInEditMode && !options?.skipSlugChangeConfirm) {
      setIsSlugChangeConfirmOpen(true);
      return;
    }

    if (isEditMode) {
      const updateData: Partial<CreateProductInput> = {
        name: formData.name!,
        price: formData.price!,
        currency: organizationBaseCurrency,
        trackInventory: formData.trackInventory,
        status: formData.status || "active",
        images: formData.images || [],
      };

      if (formData.description !== undefined) updateData.description = formData.description;
      if (formData.sku !== undefined) updateData.sku = formData.sku;
      if (formData.stockQuantity != null) updateData.stockQuantity = formData.stockQuantity;
      if (formData.lowStockThreshold != null) updateData.lowStockThreshold = formData.lowStockThreshold;
      if (formData.category !== undefined) updateData.category = normalizedCategory;
      if (formData.cost != null) updateData.cost = formData.cost;
      if (formData.taxRate != null) updateData.taxRate = formData.taxRate;
	      if (trimmedPublicSlug) {
	        updateData.publicPage = initialData?.publicPage
	          ? { ...initialData.publicPage, slug: trimmedPublicSlug }
	          : {
	              slug: trimmedPublicSlug,
	              slugAliases: [],
	              slugLookup: [],
	              state: (formData.status || "active") === "active" ? "published" : "unavailable",
	              version: 1,
	            };
	      }

      await onSubmit(updateData);
      productId = initialData!.id;
    } else {
      const createData: CreateProductInput = {
        organizationId,
        name: formData.name!,
        description: formData.description,
        price: formData.price!,
        currency: organizationBaseCurrency,
        sku: formData.sku,
        trackInventory: formData.trackInventory ?? false,
        category: normalizedCategory,
        status: formData.status || "active",
        images: formData.images || [],
        tags: [],
        ...(formData.stockQuantity != null && { stockQuantity: formData.stockQuantity }),
        ...(formData.lowStockThreshold != null && { lowStockThreshold: formData.lowStockThreshold }),
        ...(formData.cost != null && { cost: formData.cost }),
        ...(formData.taxRate != null && { taxRate: formData.taxRate }),
	        ...(trimmedPublicSlug && {
	          publicPage: {
	            slug: trimmedPublicSlug,
	            slugAliases: [],
	            slugLookup: [],
	            state: (formData.status || "active") === "active" ? "published" : "unavailable",
	            version: 1,
	          },
	        }),
      };

      const result = await onSubmit(createData);
      if (result && typeof result === 'object' && 'id' in result) {
        productId = result.id;
      } else {
        const mutationResult = await createProductMutation.mutateAsync(createData);
        productId = mutationResult.id;
      }
    }

    await saveMetafields(productId);
  };

  const renderMetafieldSection = (definitions: typeof metafieldDefinitions, title: string, showCategoryName = false) => {
    if (definitions.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            {title}
            {showCategoryName && formData.category && (
              <span className="text-sm font-normal text-muted-foreground ml-2">({formData.category})</span>
            )}
          </Label>
        </div>
        <div className="space-y-4">
          {definitions.map((definition) => {
            const existingMetafield = existingMetafields.find((m) => m.definitionId === definition.id);
            const currentValue = metafieldValues[definition.id] !== undefined
              ? metafieldValues[definition.id]
              : existingMetafield?.value;

                    return (
                      <MetafieldInput
                        key={definition.id}
                        definition={definition}
                        value={currentValue}
                        onChange={(value) => handleMetafieldChange(definition.id, value)}
                        organizationId={organizationId}
                      />
                    );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={
        hideHeader
          ? "space-y-6 pb-28 sm:pb-0"
          : "py-4 sm:py-6 pr-6 pl-0 pb-28 sm:pb-6 space-y-6 w-full overflow-x-hidden"
      }
    >
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-11 w-11 sm:h-10 sm:w-10" onClick={onCancel}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold truncate">
              {isEditMode ? t('products.editTitle') : t('products.createTitle')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEditMode ? t('products.editDescription') : t('products.createDescription')}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('products.form.productName')}</Label>
                <Input
                  id="name"
                  value={formData.name ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('products.form.productNamePlaceholder')}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">{t('products.form.sku')}</Label>
                <Input
                  id="sku"
                  value={formData.sku ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder={t('products.form.skuPlaceholder')}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicSlug">Public page slug (optional)</Label>
              <Input
                id="publicSlug"
                value={effectivePublicSlug}
                onChange={(e) => {
                  const normalized = normalizePublicSlug(e.target.value || "");
                  setPublicSlugInput(normalized);
                  setIsSlugManuallyEdited(normalized.length > 0);
                }}
                placeholder="custom-product-slug"
                className="h-11 sm:h-10 text-base sm:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from product name. Edit to customize, or clear to return to automatic.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('products.form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('products.form.descriptionPlaceholder')}
                rows={3}
                className="min-h-[112px] text-base sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t('products.form.price')}</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price ?? ""}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const parsed = parseFloat(rawValue);
                    setFormData((prev) => ({
                      ...prev,
                      price: rawValue === "" || !Number.isFinite(parsed) ? undefined : parsed,
                    }));
                  }}
                  placeholder={t('products.form.pricePlaceholder')}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('products.form.currency')}</Label>
                <Input
                  id="currency"
                  value={organizationBaseCurrency}
                  disabled
                  readOnly
                  className="h-11 sm:h-10 text-base sm:text-sm bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category-combobox">{t('products.form.category')}</Label>
                <Popover
                  open={isCategoryPickerOpen}
                  onOpenChange={(open) => {
                    setIsCategoryPickerOpen(open);
                    if (open) setCategorySearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="category-combobox"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCategoryPickerOpen}
                      className="h-11 sm:h-10 w-full justify-between text-base sm:text-sm"
                    >
                      <span className={currentCategoryLabel ? "truncate" : "truncate text-muted-foreground"}>
                        {currentCategoryLabel || t('products.form.categoryPlaceholder')}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
                  >
                    <Command>
                      <CommandInput
                        value={categorySearch}
                        onValueChange={setCategorySearch}
                        placeholder={t('products.form.categorySearchPlaceholder')}
                        className="h-11 sm:h-10 text-base sm:text-sm"
                      />
                      <CommandList>
                        {normalizedCategorySearch && !hasExactCategoryMatch && (
                          <CommandGroup heading={t('products.form.categoryCreateGroup')}>
                            <CommandItem
                              value={normalizedCategorySearch}
                              onSelect={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  category: normalizedCategorySearch,
                                }));
                                setCategorySearch("");
                                setIsCategoryPickerOpen(false);
                              }}
                              className="h-11 sm:h-10 text-base sm:text-sm"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              {t('products.form.categoryCreateOption', { value: normalizedCategorySearch })}
                            </CommandItem>
                          </CommandGroup>
                        )}

                        {categoryOptions.length > 0 && (
                          <CommandGroup heading={t('products.form.categoryExistingGroup')}>
                            {categoryOptions.map((category) => (
                              <CommandItem
                                key={category.toLowerCase()}
                                value={category}
                                onSelect={() => {
                                  setFormData((prev) => ({ ...prev, category }));
                                  setCategorySearch("");
                                  setIsCategoryPickerOpen(false);
                                }}
                                className="h-11 sm:h-10 text-base sm:text-sm"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    currentCategoryLabel.toLowerCase() === category.toLowerCase()
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                <span className="truncate">{category}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}

                        <CommandEmpty>{t('products.form.categoryNoResults')}</CommandEmpty>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  {t('products.form.categoryHint')}
                </p>
                {currentCategoryLabel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData((prev) => ({ ...prev, category: "" }))}
                    className="h-9 px-2 text-sm text-muted-foreground hover:text-destructive"
                  >
                    {t('products.form.categoryClear')}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t('products.form.status')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "inactive" | "archived") => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                    <SelectValue placeholder={t('products.form.statusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('products.status.active')}</SelectItem>
                    <SelectItem value="inactive">{t('products.status.inactive')}</SelectItem>
                    <SelectItem value="archived">{t('products.status.archived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">{t('products.form.stockQuantity')}</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  value={formData.stockQuantity ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder={t('products.form.stockQuantityPlaceholder')}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="trackInventory"
                  className="flex h-11 sm:h-10 items-center gap-3 rounded-md border border-input bg-background px-3 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    id="trackInventory"
                    checked={Boolean(formData.trackInventory)}
                    onChange={(e) => setFormData((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                    className="h-5 w-5 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{t('products.form.trackInventory')}</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('products.images.title')}</Label>
              <div className="space-y-3">
                {(formData.images && formData.images.length > 0 || pendingImages.length > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {formData.images?.map((image, index) => (
                        <motion.div
                          key={image}
                          layout
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", stiffness: 480, damping: 32 }}
                          className="relative group"
                        >
                          <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-border">
                            <img
                              src={image}
                              alt={t('products.images.imageAlt', { index: index + 1 })}
                              className="w-full h-full object-cover"
                            />
                            {index === 0 && (
                              <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="hidden sm:inline">{t('products.images.featured')}</span>
                              </div>
                            )}
                            {/* Desktop: reveal on hover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center gap-2">
                              {index !== 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSetFeaturedImage(index)}
                                  className="h-8 w-8 p-0"
                                  title={t('products.images.setAsFeatured')}
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveImage(index)}
                                className="h-8 w-8 p-0"
                                title={t('products.images.removeImage')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {/* Mobile: always-visible corner buttons */}
                            <div className="absolute top-1 right-1 flex flex-col gap-1 sm:hidden">
                              {index !== 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSetFeaturedImage(index)}
                                  className="h-9 w-9 p-0 bg-background/85 backdrop-blur-sm"
                                  title={t('products.images.setAsFeatured')}
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveImage(index)}
                                className="h-9 w-9 p-0"
                                title={t('products.images.removeImage')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Pending upload tiles with Apple-style conic progress */}
                      {pendingImages.map((pending) => {
                        const degrees = (pending.progress / 100) * 360;
                        const r = 46;
                        const circumference = 2 * Math.PI * r;
                        const strokeDashoffset = circumference * (1 - pending.progress / 100);
                        return (
                          <motion.div
                            key={pending.id}
                            layout
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.04, opacity: 0, transition: { duration: 0.25, ease: "easeOut" } }}
                            transition={{ type: "spring", stiffness: 480, damping: 32 }}
                            className="relative aspect-square rounded-lg overflow-hidden border-2"
                            style={{
                              borderColor: pending.error
                                ? "rgb(239 68 68)"
                                : pending.done
                                ? "rgb(34 197 94)"
                                : "hsl(var(--border))",
                            }}
                          >
                            {/* Local preview image */}
                            <img
                              src={pending.localUrl}
                              alt="Uploading…"
                              className="w-full h-full object-cover"
                              style={{
                                opacity: 0.45 + 0.55 * (pending.progress / 100),
                                transition: "opacity 0.1s ease-out",
                              }}
                            />

                            {/* Apple conic sweep overlay — sweeps away clockwise from top */}
                            {!pending.error && !pending.done && (
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  background: `conic-gradient(from -90deg at 50% 50%, transparent ${degrees}deg, rgba(0,0,0,0.58) ${degrees}deg)`,
                                }}
                              />
                            )}

                            {/* SVG circular stroke ring */}
                            {!pending.error && !pending.done && (
                              <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox="0 0 100 100"
                              >
                                {/* Track */}
                                <circle
                                  cx="50" cy="50" r={r}
                                  fill="none"
                                  stroke="rgba(255,255,255,0.18)"
                                  strokeWidth="3"
                                />
                                {/* Fill */}
                                <circle
                                  cx="50" cy="50" r={r}
                                  fill="none"
                                  stroke="rgba(255,255,255,0.92)"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  transform="rotate(-90 50 50)"
                                  style={{ transition: "stroke-dashoffset 0.1s ease-out" }}
                                />
                              </svg>
                            )}

                            {/* Completion overlay */}
                            {pending.done && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-green-500/15 pointer-events-none"
                              >
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 600, damping: 22 }}
                                  className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-md"
                                >
                                  <CheckCircle className="h-5 w-5 text-green-500" strokeWidth={2} />
                                </motion.div>
                              </motion.div>
                            )}

                            {/* Error overlay */}
                            {pending.error && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-red-500/40 pointer-events-none"
                              >
                                <X className="h-6 w-6 text-white drop-shadow" />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
                <div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const baseTimestamp = Date.now();
                      const newPending: PendingImage[] = files.map((file, i) => ({
                        id: `${baseTimestamp}-${i}`,
                        localUrl: URL.createObjectURL(file),
                        progress: 0,
                        done: false,
                        error: false,
                      }));
                      setPendingImages(prev => [...prev, ...newPending]);
                      files.forEach((file, i) => handleImageUpload(file, baseTimestamp + i, newPending[i].id));
                      if (imageInputRef.current) {
                        imageInputRef.current.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={pendingImages.length > 0}
                    className="w-full h-11 sm:h-10"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {pendingImages.length > 0
                      ? `Uploading ${pendingImages.length} image${pendingImages.length > 1 ? "s" : ""}…`
                      : t('products.images.addImages')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('products.images.featuredHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Metafields */}
            <div className="pt-4 border-t space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base font-semibold">Product metafields</Label>
              </div>

              {categoryMetafields.length > 0 && (
                <div className="pt-2">
                  {renderMetafieldSection(categoryMetafields, "Category metafields", true)}
                </div>
              )}

              {productMetafields.length > 0 && (
                <div className={categoryMetafields.length > 0 ? "pt-2" : ""}>
                  {renderMetafieldSection(productMetafields, "Product metafields")}
                </div>
              )}

              {allApplicableDefinitions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No metafields available. Create one to get started.</p>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-9 w-full sm:w-auto shrink-0"
                  onClick={() => setIsCreatingMetafieldDefinition(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add metafield
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex sm:flex-row sm:justify-end gap-3 pt-4 border-t">
            <Button variant="outline" className="h-11 sm:h-9 w-full sm:w-auto" onClick={onCancel}>
              {t('products.actions.cancel')}
            </Button>
            <Button
              className="h-11 sm:h-9 w-full sm:w-auto"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitDisabled}
            >
              {isPending
                ? (isEditMode ? t('products.actions.updating') : t('products.actions.creating'))
                : (isEditMode ? t('products.actions.update') : t('products.actions.create'))}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isSlugChangeConfirmOpen} onOpenChange={setIsSlugChangeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.slugChangeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.slugChangeDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-row sm:gap-2">
            <AlertDialogAction
              disabled={isPending}
              className="h-12 sm:h-9 w-full sm:w-auto text-base sm:text-sm"
            >
              {t("products.slugChangeDialog.cancel")}
            </AlertDialogAction>
            <AlertDialogCancel
              disabled={isPending}
              className="h-12 sm:h-9 w-full sm:w-auto text-base sm:text-sm"
              onClick={() => {
                void handleSubmit({ skipSlugChangeConfirm: true });
              }}
            >
              {t("products.slugChangeDialog.confirm")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isCreatingMetafieldDefinition && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex w-full max-w-screen-sm gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-12 flex-1 text-base" onClick={onCancel}>
              {t('products.actions.cancel')}
            </Button>
            <Button
              className="h-12 flex-[1.2] text-base"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitDisabled}
            >
              {isPending
                ? (isEditMode ? t('products.actions.updating') : t('products.actions.creating'))
                : (isEditMode ? t('products.actions.update') : t('products.actions.create'))}
            </Button>
          </div>
        </div>
      )}

      {/* Create Metafield Definition Dialog */}
      <Dialog open={isCreatingMetafieldDefinition} onOpenChange={setIsCreatingMetafieldDefinition}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add product metafield</DialogTitle>
            <DialogDescription>
              Create a new metafield definition that can be used across products
            </DialogDescription>
          </DialogHeader>
          <MetafieldDefinitionForm
            onSubmit={handleCreateMetafieldDefinition}
            onCancel={() => setIsCreatingMetafieldDefinition(false)}
            isPending={createMetafieldDefinitionMutation.isPending}
            organizationId={organizationId}
            currentCategory={formData.category}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
