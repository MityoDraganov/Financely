import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Upload, X, Star, Plus, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateProductInput, Product, CreateProductMetafieldDefinitionInput, UpdateProductMetafieldDefinitionInput } from "@/core";
import { CURRENCIES } from "@/utils/currencies";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useProductMetafieldDefinitions, useProductMetafields, useCreateProductMetafield, useUpdateProductMetafield, useDeleteProductMetafield } from "@/hooks/repository-hooks/use-product-metafields";
import { useCreateProductMetafieldDefinition } from "@/hooks/service-hooks/use-product-metafield-functions";
import { useCreateProduct } from "@/hooks";
import { MetafieldInput } from "@/components/metafields/metafield-input";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";
import { toast } from "sonner";

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: CreateProductInput | Partial<CreateProductInput>) => Promise<void | { id: string } | undefined>;
  onCancel: () => void;
  isPending?: boolean;
  organizationId: string;
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
  organizationId,
}: ProductFormProps) {
  const { t } = useTranslation();
  const isEditMode = !!initialData;
  const imageUpload = useFileUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<CreateProductInput>>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || 0,
    currency: initialData?.currency || "USD",
    sku: initialData?.sku || "",
    stockQuantity: initialData?.stockQuantity,
    trackInventory: initialData?.trackInventory || false,
    category: initialData?.category || "",
    status: initialData?.status || "active",
    images: initialData?.images || [],
    lowStockThreshold: initialData?.lowStockThreshold,
    cost: initialData?.cost,
    taxRate: initialData?.taxRate,
  });

  const { data: metafieldDefinitions = [], error: metafieldDefinitionsError } = useProductMetafieldDefinitions(organizationId);
  if (metafieldDefinitionsError) {
    console.error(metafieldDefinitionsError);
  }
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

  useEffect(() => {
    if (existingMetafields.length > 0) {
      const values: Record<string, unknown> = {};
      existingMetafields.forEach((metafield) => {
        values[metafield.definitionId] = metafield.value;
      });
      setMetafieldValues(values);
    }
  }, [existingMetafields]);

  const { categoryMetafields, productMetafields } = useMemo(() => {
    const productCategory = formData.category;
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

  const handleImageUpload = async (file: File) => {
    const path = `organizations/${organizationId}/products/${Date.now()}-${file.name}`;
    const url = await imageUpload.uploadFile(file, path);

    if (url) {
      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), url],
      }));
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

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      return;
    }

    let productId: string;

    if (isEditMode) {
      const updateData: Partial<CreateProductInput> = {
        name: formData.name!,
        price: formData.price!,
        currency: formData.currency || "USD",
        trackInventory: formData.trackInventory,
        status: formData.status || "active",
        images: formData.images || [],
      };

      if (formData.description !== undefined) updateData.description = formData.description;
      if (formData.sku !== undefined) updateData.sku = formData.sku;
      if (formData.stockQuantity !== undefined) updateData.stockQuantity = formData.stockQuantity;
      if (formData.lowStockThreshold !== undefined) updateData.lowStockThreshold = formData.lowStockThreshold;
      if (formData.category !== undefined) updateData.category = formData.category;
      if (formData.cost !== undefined) updateData.cost = formData.cost;
      if (formData.taxRate !== undefined) updateData.taxRate = formData.taxRate;

      await onSubmit(updateData);
      productId = initialData!.id;
    } else {
      const createData: CreateProductInput = {
        organizationId,
        name: formData.name!,
        description: formData.description,
        price: formData.price!,
        currency: formData.currency || "USD",
        sku: formData.sku,
        stockQuantity: formData.stockQuantity,
        trackInventory: formData.trackInventory ?? false,
        category: formData.category,
        status: formData.status || "active",
        images: formData.images || [],
        tags: [],
        lowStockThreshold: formData.lowStockThreshold,
        cost: formData.cost,
        taxRate: formData.taxRate,
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {isEditMode ? t('products.editTitle') : t('products.createTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditMode ? t('products.editDescription') : t('products.createDescription')}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('products.form.productName')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('products.form.productNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">{t('products.form.sku')}</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  placeholder={t('products.form.skuPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('products.form.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('products.form.descriptionPlaceholder')}
                rows={3}
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
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  placeholder={t('products.form.pricePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('products.form.currency')}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('products.form.currencyPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name} {currency.symbol ? `(${currency.symbol})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t('products.form.category')}</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder={t('products.form.categoryPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t('products.form.status')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "inactive" | "archived") => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
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
                  value={formData.stockQuantity || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder={t('products.form.stockQuantityPlaceholder')}
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="trackInventory"
                    checked={formData.trackInventory}
                    onChange={(e) => setFormData((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <Label htmlFor="trackInventory" className="cursor-pointer">{t('products.form.trackInventory')}</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('products.images.title')}</Label>
              <div className="space-y-3">
                {formData.images && formData.images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-border">
                          <img
                            src={image}
                            alt={t('products.images.imageAlt', { index: index + 1 })}
                            className="w-full h-full object-cover"
                          />
                          {index === 0 && (
                            <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              <span>{t('products.images.featured')}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
                        </div>
                      </div>
                    ))}
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
                      files.forEach((file) => handleImageUpload(file));
                      if (imageInputRef.current) {
                        imageInputRef.current.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUpload.isUploading}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {imageUpload.isUploading ? t('products.images.uploading') : t('products.images.addImages')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('products.images.featuredHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Metafields */}
            <div className="pt-4 border-t space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Product metafields</Label>
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
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              {t('products.actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !formData.name || !formData.price}>
              {isPending
                ? (isEditMode ? t('products.actions.updating') : t('products.actions.creating'))
                : (isEditMode ? t('products.actions.update') : t('products.actions.create'))}
            </Button>
          </div>
        </CardContent>
      </Card>

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
