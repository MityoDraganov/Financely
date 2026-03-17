import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { Search, Package, Plus, Edit, Trash2, Download, Database, Image as ImageIcon, Tag, ExternalLink, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProductsByOrg, useDeleteProduct } from "@/hooks";
import { useCreateProduct } from "@/hooks/service-hooks/use-product-functions";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateProductInput } from "@/core";
import { toast } from "sonner";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currencies";
import { ExportDialog } from "@/components/export-import/export-dialog";
import { ProductForm } from "@/components/products/product-form";
import { functionsService } from "@/services/functions/functions-service";

export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatDateTable } = useDateFormatting();
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [didTriggerPublicPageBackfill, setDidTriggerPublicPageBackfill] = useState(false);
  const [isRegeneratingPublicPages, setIsRegeneratingPublicPages] = useState(false);

  const { data: products = [], isLoading, error } = useProductsByOrg(currentOrganization?.id);
  console.log(error);
  console.log(products);
  
  const createProductMutation = useCreateProduct();
  const deleteProductMutation = useDeleteProduct();

  const productsMissingPublicPage = useMemo(() => {
    return products.filter((product) => {
      const publicPage = product.publicPage;
      if (!publicPage) return true;
      if (!publicPage.slugAliases) return true;
      if (!publicPage.state) return true;
      if (product.status === "active") {
        if (!publicPage.slug || !publicPage.canonicalPath || !publicPage.canonicalUrl) return true;
      }
      return false;
    });
  }, [products]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    if (didTriggerPublicPageBackfill) return;
    if (products.length === 0) return;
    if (productsMissingPublicPage.length === 0) return;

    const sessionKey = `product-public-page-backfill:${currentOrganization.id}`;
    if (sessionStorage.getItem(sessionKey) === "done") {
      setDidTriggerPublicPageBackfill(true);
      return;
    }

    setDidTriggerPublicPageBackfill(true);

    functionsService
      .backfillProductPublicPages({
        organizationId: currentOrganization.id,
        productIds: productsMissingPublicPage.map((product) => product.id),
      })
      .then((result) => {
        sessionStorage.setItem(sessionKey, "done");
        if (result.queuedCount > 0) {
          toast.success(`Queued public page generation for ${result.queuedCount} product(s).`);
        }
      })
      .catch((error) => {
        setDidTriggerPublicPageBackfill(false);
        toast.error(
          `Failed to queue public page generation: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
  }, [
    currentOrganization?.id,
    didTriggerPublicPageBackfill,
    products,
    productsMissingPublicPage,
  ]);

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

  const handleRegeneratePublicPages = async () => {
    if (!currentOrganization?.id) return;
    try {
      setIsRegeneratingPublicPages(true);
      const result = await functionsService.backfillProductPublicPages({
        organizationId: currentOrganization.id,
        force: true,
      });
      if (result.queuedCount > 0) {
        toast.success(`Regeneration queued for ${result.queuedCount} product(s).`);
      } else {
        toast.success("No products needed regeneration.");
      }
    } catch (error) {
      toast.error(
        `Failed to queue regeneration: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsRegeneratingPublicPages(false);
    }
  };

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

  return (
    <div className="py-6 pr-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('products.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRegeneratePublicPages}
            disabled={isRegeneratingPublicPages || !currentOrganization?.id}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            {isRegeneratingPublicPages ? "Regenerating..." : "Regenerate Public Pages"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/products/metafields")}>
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
                              {product.publicPage?.canonicalUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Open public page"
                                  onClick={() => window.open(product.publicPage?.canonicalUrl, "_blank", "noopener,noreferrer")}
                                  className="h-8 w-8 p-0 shrink-0"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
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
                        {product.publicPage?.canonicalUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(product.publicPage?.canonicalUrl, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Public
                          </Button>
                        )}
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

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["products"]}
      />
    </div>
  );
}
