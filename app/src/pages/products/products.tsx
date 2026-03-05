import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Search, Package, Plus, Edit, Trash2, Download, Database, Image as ImageIcon, Tag, Star, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useProductsByOrg, useDeleteProduct } from "@/hooks";
import { useCreateProduct } from "@/hooks/service-hooks/use-product-functions";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateProductInput, CreateProductMetafieldDefinitionInput, UpdateProductMetafieldDefinitionInput } from "@/core";
import { toast } from "sonner";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currencies";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { 
  useProductMetafieldDefinitions, 
  useDeleteProductMetafieldDefinition,
  useProductMetafields
} from "@/hooks/repository-hooks/use-product-metafields";
import { useCreateProductMetafieldDefinition } from "@/hooks/service-hooks/use-product-metafield-functions";
import { ProductForm } from "@/components/products/product-form";
import { MetafieldDisplay } from "@/components/metafields/metafield-display";
import { MetafieldDefinitionForm } from "@/components/metafields/metafield-definition-form";

export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatDateTable, formatDateTime } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string } | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isManagingMetafields, setIsManagingMetafields] = useState(false);
  const [isCreatingMetafield, setIsCreatingMetafield] = useState(false);

  const { data: products = [], isLoading, error } = useProductsByOrg(currentOrganization?.id);
  console.log(error);
  console.log(products);
  
  const createProductMutation = useCreateProduct();
  const deleteProductMutation = useDeleteProduct();
  
  const selectedProductData = selectedProduct
    ? products.find((p) => p.id === selectedProduct.id)
    : null;

  // Filter products - memoized to prevent recalculation on every render
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
    // Status filter
    if (statusFilter !== "all" && product.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const name = (product.name || "").toLowerCase();
      const description = (product.description || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      
      return name.includes(searchLower) || description.includes(searchLower) || sku.includes(searchLower);
    }

    return true;
  });
  }, [products, statusFilter, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return formatCurrencyUtil(amount, currency || "USD");
  };

  const handleCreateProduct = async (data: CreateProductInput | Partial<CreateProductInput>): Promise<{ id: string } | void> => {
    if (!currentOrganization?.id) {
      toast.error(t('products.messages.orgIdRequired'));
      return;
    }

    try {
      const result = await createProductMutation.mutateAsync(data as CreateProductInput);
      toast.success(t('products.messages.productCreated'));
      setIsCreating(false);
      return result;
    } catch (error) {
      toast.error(t('products.messages.createFailed', { error: error instanceof Error ? error.message : "Unknown error" }));
      throw error;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(t('products.messages.deleteConfirm'))) {
      return;
    }

    try {
      await deleteProductMutation.mutateAsync(id);
      toast.success(t('products.messages.productDeleted'));
    } catch (error) {
      toast.error(t('products.messages.deleteFailed', { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  };

  const handleEditProduct = (productId: string) => {
    navigate(`/products/${productId}`);
  };


  const { data: metafieldDefinitions = [], error: metafieldDefinitionsError } = useProductMetafieldDefinitions(currentOrganization?.id);
  if (metafieldDefinitionsError) {
    console.error(metafieldDefinitionsError);
  }
  
  const { data: selectedProductMetafields = [] } = useProductMetafields(
    currentOrganization?.id,
    selectedProduct?.id
  );
  const createMetafieldDefinition = useCreateProductMetafieldDefinition();
  const deleteMetafieldDefinition = useDeleteProductMetafieldDefinition();

  const handleCreateMetafieldDefinition = async (data: CreateProductMetafieldDefinitionInput | UpdateProductMetafieldDefinitionInput) => {
    if (!currentOrganization?.id) {
      toast.error("Organization is required");
      return;
    }

    try {
      if ('organizationId' in data) {
        await createMetafieldDefinition.mutateAsync(data as CreateProductMetafieldDefinitionInput);
      } else {
        throw new Error("Update not supported in this context");
      }
      toast.success("Product metafield definition created successfully");
      setIsCreatingMetafield(false);
    } catch (error) {
      console.error("Failed to create product metafield definition:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create product metafield definition: ${errorMessage}`);
    }
  };

  const handleDeleteMetafieldDefinition = async (id: string) => {
    if (!confirm("Are you sure you want to delete this metafield definition?")) {
      return;
    }

    try {
      await deleteMetafieldDefinition.mutateAsync(id);
      toast.success("Metafield definition deleted successfully");
    } catch {
      toast.error("Failed to delete metafield definition");
    }
  };

  // Get unique categories from products
  const productCategories = useMemo(() => {
    const categories = new Set<string>();
    products.forEach((product) => {
      if (product.category) {
        categories.add(product.category);
      }
    });
    return Array.from(categories).sort();
  }, [products]);

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('products.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('products.manageProducts')}</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t('products.loading')}</div>
        </div>
      </div>
    );
  }

  if (isCreating && currentOrganization?.id) {
    return (
      <ProductForm
        onSubmit={handleCreateProduct}
        onCancel={() => setIsCreating(false)}
        isPending={createProductMutation.isPending}
        organizationId={currentOrganization.id}
      />
    );
  }

  if (isCreatingMetafield) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCreatingMetafield(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add product metafield definition</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define a new metafield that can be added to products
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <MetafieldDefinitionForm
              onSubmit={handleCreateMetafieldDefinition}
              onCancel={() => setIsCreatingMetafield(false)}
              isPending={createMetafieldDefinition.isPending}
              organizationId={currentOrganization?.id || ""}
              availableCategories={productCategories}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isManagingMetafields) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsManagingMetafields(false)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Product metafield definitions</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage custom fields that can be added to products
              </p>
            </div>
          </div>
          <Button onClick={() => setIsCreatingMetafield(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add metafield definition
          </Button>
        </div>

        {metafieldDefinitions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No metafield definitions found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metafieldDefinitions.map((def) => (
              <Card key={def.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{def.name}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMetafieldDefinition(def.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {def.description && (
                    <p className="text-sm text-muted-foreground mb-4">{def.description}</p>
                  )}
                  {def.categoryAssignments && def.categoryAssignments.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Categories:</p>
                      <div className="flex flex-wrap gap-1">
                        {def.categoryAssignments.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-6 pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('products.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsManagingMetafields(true)}>
            <Database className="h-4 w-4 mr-2" />
            Metafields
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('products.newProduct')}
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('products.filters.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('products.filters.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.status.all')}</SelectItem>
            <SelectItem value="active">{t('products.status.active')}</SelectItem>
            <SelectItem value="inactive">{t('products.status.inactive')}</SelectItem>
            <SelectItem value="archived">{t('products.status.archived')}</SelectItem>
          </SelectContent>
        </Select>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredProducts.length}</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">{t('products.filters.product')}</span>
          </div>
        </Card>
      </div>

      {/* Products Table - Desktop */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 px-4">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">{t('products.empty.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim() || statusFilter !== "all"
                  ? t('products.empty.noMatch')
                  : t('products.empty.getStarted')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0 sm:p-6">
              <div className="w-full overflow-hidden">
                <table className="w-full caption-bottom text-sm border-collapse table-auto">
                    <colgroup>
                      <col className="w-auto min-w-[200px] max-w-[350px]" />
                      <col className="w-auto min-w-[80px] max-w-[120px]" />
                      <col className="w-auto min-w-[100px] max-w-[140px]" />
                      <col className="w-auto min-w-[80px] max-w-[120px]" />
                      <col className="w-auto min-w-[100px] max-w-[150px]" />
                      <col className="w-auto min-w-[90px] max-w-[120px]" />
                      <col className="w-auto min-w-[100px] max-w-[130px] hidden lg:table-column" />
                      <col className="w-[120px]" />
                    </colgroup>
                    <thead className="[&_tr]:border-b">
                      <tr className="hover:bg-neutral-100/50 border-b transition-colors">
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.product')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.sku')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.price')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.stock')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.category')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.status')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10 hidden lg:table-cell">{t('products.table.created')}</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">{t('products.table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          className="hover:bg-neutral-100/50 border-b transition-colors cursor-pointer"
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          <td className="p-3 align-top font-medium">
                            <div className="flex items-start gap-2">
                              {product.images && product.images.length > 0 ? (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="h-10 w-10 rounded object-cover shrink-0"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                                  <ImageIcon className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium break-words leading-snug">{product.name}</div>
                                {product.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-2 break-words mt-1">
                                    {product.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            {product.sku ? (
                              <Badge variant="outline" className="break-all text-xs inline-block max-w-full">{product.sku}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm whitespace-nowrap">
                                {formatCurrency(product.price, product.currency)}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            {product.trackInventory ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm">{product.stockQuantity ?? 0}</span>
                                {product.stockQuantity !== undefined && product.lowStockThreshold && product.stockQuantity <= product.lowStockThreshold && (
                                  <Badge variant="destructive" className="text-xs shrink-0">{t('products.labels.low')}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            {product.category ? (
                              <Badge variant="secondary" className="break-words text-xs inline-block max-w-full">
                                <Tag className="h-3 w-3 mr-1 shrink-0 inline" />
                                <span className="break-words">{product.category}</span>
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            <Badge className={getStatusColor(product.status)}>
                              {t(`products.status.${product.status}`)}
                            </Badge>
                          </td>
                          <td className="p-3 align-top hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {product.createdAt
                                ? formatDateTable(product.createdAt)
                                : t('products.details.na')}
                            </span>
                          </td>
                          <td className="p-3 align-top" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                title={t('products.actions.editProduct')}
                                onClick={() => handleEditProduct(product.id)}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={t('products.actions.deleteProduct')}
                                onClick={() => handleDeleteProduct(product.id)}
                                disabled={deleteProductMutation.isPending}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">{t('products.mobile.allProducts')}</h2>
                <p className="text-sm text-muted-foreground">
                  {searchTerm.trim() || statusFilter !== "all"
                    ? t('products.mobile.showing', { count: filteredProducts.length, total: products.length })
                    : t('products.mobile.showingAll', { count: products.length })
                  }
                </p>
              </div>
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border bg-card p-4 shadow-sm cursor-pointer"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {product.images && product.images.length > 0 ? (
                            <div className="relative shrink-0">
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="h-12 w-12 rounded object-cover"
                              />
                              {product.images.length > 1 && (
                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[10px] px-1 py-0.5 rounded">
                                  +{product.images.length - 1}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center shrink-0">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('products.mobile.price')}</span>
                          <p className="font-medium">{formatCurrency(product.price, product.currency)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('products.mobile.status')}</span>
                          <div className="mt-1">
                            <Badge className={getStatusColor(product.status)}>
                              {t(`products.status.${product.status}`)}
                            </Badge>
                          </div>
                        </div>
                        {product.sku && (
                          <div>
                            <span className="text-muted-foreground">{t('products.mobile.sku')}</span>
                            <p className="font-medium">{product.sku}</p>
                          </div>
                        )}
                        {product.category && (
                          <div>
                            <span className="text-muted-foreground">{t('products.mobile.category')}</span>
                            <p className="font-medium">{product.category}</p>
                          </div>
                        )}
                        {product.trackInventory && (
                          <div>
                            <span className="text-muted-foreground">{t('products.mobile.stock')}</span>
                            <p className="font-medium">
                              {product.stockQuantity ?? 0}
                              {product.stockQuantity !== undefined && product.lowStockThreshold && product.stockQuantity <= product.lowStockThreshold && (
                                <Badge variant="destructive" className="ml-2">{t('products.labels.low')}</Badge>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        className="flex items-center justify-end space-x-2 pt-2 border-t"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProduct(product.id)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {t('products.actions.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deleteProductMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('products.actions.delete')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('products.details.title')}</DialogTitle>
            <DialogDescription>
              {t('products.details.description')}
            </DialogDescription>
          </DialogHeader>
          {selectedProductData ? (
            <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-2 -mr-2">
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('products.details.productName')}</Label>
                  <p className="font-medium">{selectedProductData.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('products.details.sku')}</Label>
                  <p className="font-medium">{selectedProductData.sku || "—"}</p>
                </div>
              </div>

              {selectedProductData.description && (
                <div>
                  <Label className="text-muted-foreground">{t('products.details.descriptionLabel')}</Label>
                  <p className="mt-1">{selectedProductData.description}</p>
                </div>
              )}

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('products.details.price')}</Label>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedProductData.price, selectedProductData.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('products.details.currency')}</Label>
                  <p className="font-medium">{selectedProductData.currency}</p>
                </div>
              </div>

              {/* Inventory */}
              {selectedProductData.trackInventory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('products.details.stockQuantity')}</Label>
                    <p className="font-medium">
                      {selectedProductData.stockQuantity ?? 0}
                      {selectedProductData.lowStockThreshold && 
                       selectedProductData.stockQuantity !== undefined &&
                       selectedProductData.stockQuantity <= selectedProductData.lowStockThreshold && (
                        <Badge variant="destructive" className="ml-2">{t('products.details.lowStock')}</Badge>
                      )}
                    </p>
                  </div>
                  {selectedProductData.lowStockThreshold && (
                    <div>
                      <Label className="text-muted-foreground">{t('products.details.lowStockThreshold')}</Label>
                      <p className="font-medium">{selectedProductData.lowStockThreshold}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('products.details.category')}</Label>
                  <p className="font-medium">{selectedProductData.category || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('products.details.status')}</Label>
                  <Badge className={getStatusColor(selectedProductData.status)}>
                    {t(`products.status.${selectedProductData.status}`)}
                  </Badge>
                </div>
              </div>

              {/* Images */}
              {selectedProductData.images && selectedProductData.images.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">{t('products.details.productImages')}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                    {selectedProductData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                          <img
                            src={image}
                            alt={`${selectedProductData.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {index === 0 && (
                            <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              <span>{t('products.images.featured')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedProductData.cost !== undefined && (
                  <div>
                    <Label className="text-muted-foreground">{t('products.details.cost')}</Label>
                    <p className="font-medium">
                      {formatCurrency(selectedProductData.cost, selectedProductData.currency)}
                    </p>
                  </div>
                )}
                {selectedProductData.taxRate !== undefined && (
                  <div>
                    <Label className="text-muted-foreground">{t('products.details.taxRate')}</Label>
                    <p className="font-medium">{selectedProductData.taxRate}%</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedProductData.tags && selectedProductData.tags.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">{t('products.details.tags')}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedProductData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Metafields */}
              {selectedProductMetafields.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground mb-4 block">Metafields</Label>
                  <div className="space-y-4">
                    {selectedProductMetafields.map((metafield) => {
                      const definition = metafieldDefinitions.find((def) => def.id === metafield.definitionId);
                      if (!definition) return null;
                      return (
                        <MetafieldDisplay
                          key={metafield.id}
                          metafield={metafield}
                          definition={definition}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                {selectedProductData.createdAt && (
                  <div>
                    <Label className="text-muted-foreground">{t('products.details.created')}</Label>
                    <p className="font-medium">
                      {formatDateTime(selectedProductData.createdAt)}
                    </p>
                  </div>
                )}
                {selectedProductData.updatedAt && (
                  <div>
                    <Label className="text-muted-foreground">{t('products.details.lastUpdated')}</Label>
                    <p className="font-medium">
                      {formatDateTime(selectedProductData.updatedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('products.details.loading')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>
              {t('products.details.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["products"]}
      />
    </div>
  );
}
