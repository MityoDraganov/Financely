import { useState, useRef, useMemo, useCallback } from "react";
import { Search, Package, Eye, Plus, Image as ImageIcon, Tag, Edit, Trash2, Upload, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProductsByOrg, useDeleteProduct, useUpdateProduct } from "@/hooks";
import { useCreateProduct } from "@/hooks/service-hooks/use-product-functions";
import { useOrganizationContext } from "@/contexts/organization-context";
import { CreateProductInput } from "@/core";
import { format } from "date-fns";
import { toast } from "sonner";
import { CURRENCIES, formatCurrency as formatCurrencyUtil } from "@/utils/currencies";
import { useFileUpload } from "@/hooks/use-file-upload";

export default function ProductsPage() {
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<{ id: string } | null>(null);

  const { data: products = [], isLoading, error } = useProductsByOrg(currentOrganization?.id);
  console.log(error);
  console.log(products);
  
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  
  const selectedProductData = selectedProduct 
    ? products.find((p) => p.id === selectedProduct.id)
    : null;
  
  const editingProductData = editingProduct
    ? products.find((p) => p.id === editingProduct.id)
    : null;

  // Form state
  const [formData, setFormData] = useState<Partial<CreateProductInput>>({
    name: "",
    description: "",
    price: 0,
    currency: "USD",
    sku: "",
    stockQuantity: undefined,
    trackInventory: false,
    category: "",
    status: "active",
    images: [],
  });

  const imageUpload = useFileUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = async (file: File) => {
    if (!currentOrganization?.id) {
      toast.error("Organization ID is required");
      return;
    }

    const path = `organizations/${currentOrganization.id}/products/${Date.now()}-${file.name}`;
    const url = await imageUpload.uploadFile(file, path);

    if (url) {
      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), url],
      }));
      toast.success("Image uploaded successfully");
    } else {
      toast.error(imageUpload.error || "Failed to upload image");
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

  const handleCreateProduct = async () => {
    if (!currentOrganization?.id) {
      toast.error("Organization ID is required");
      return;
    }

    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    try {
      const productPayload = {
        organizationId: currentOrganization.id,
        name: formData.name!,
        description: formData.description,
        price: formData.price!,
        currency: formData.currency || "USD",
        sku: formData.sku,
        stockQuantity: formData.stockQuantity,
        trackInventory: formData.trackInventory,
        category: formData.category,
        status: formData.status || "active",
        images: formData.images || [],
      } as CreateProductInput;

      await createProductMutation.mutateAsync(productPayload);

      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        price: 0,
        currency: "USD",
        sku: "",
        stockQuantity: undefined,
        trackInventory: false,
        category: "",
        status: "active",
        images: [],
      });
    } catch (error) {
      toast.error(`Failed to create product: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await deleteProductMutation.mutateAsync(id);
      toast.success("Product deleted successfully");
    } catch (error) {
      toast.error(`Failed to delete product: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleEditProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setEditingProduct({ id: productId });
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price,
        currency: product.currency,
        sku: product.sku || "",
        stockQuantity: product.stockQuantity,
        trackInventory: product.trackInventory,
        lowStockThreshold: product.lowStockThreshold,
        category: product.category || "",
        status: product.status,
        images: product.images || [],
        tags: product.tags || [],
        cost: product.cost,
        taxRate: product.taxRate,
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleEditImageUpload = async (file: File) => {
    if (!currentOrganization?.id) {
      toast.error("Organization ID is required");
      return;
    }

    const path = `organizations/${currentOrganization.id}/products/${Date.now()}-${file.name}`;
    const url = await imageUpload.uploadFile(file, path);

    if (url) {
      setFormData({
        ...formData,
        images: [...(formData.images || []), url],
      });
      toast.success("Image uploaded successfully");
    } else {
      toast.error(imageUpload.error || "Failed to upload image");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct?.id || !currentOrganization?.id) {
      toast.error("Product ID is required");
      return;
    }

    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    // Filter out undefined values - Firestore doesn't accept them
    const updateData: Partial<CreateProductInput> = {
      name: formData.name!,
      price: formData.price!,
      currency: formData.currency || "USD",
      trackInventory: formData.trackInventory,
      status: formData.status || "active",
      images: formData.images || [],
    };

    // Only include optional fields if they have values
    if (formData.description !== undefined) updateData.description = formData.description;
    if (formData.sku !== undefined) updateData.sku = formData.sku;
    if (formData.stockQuantity !== undefined) updateData.stockQuantity = formData.stockQuantity;
    if (formData.lowStockThreshold !== undefined) updateData.lowStockThreshold = formData.lowStockThreshold;
    if (formData.category !== undefined) updateData.category = formData.category;

    try {
      await updateProductMutation.mutateAsync({
        id: editingProduct.id,
        data: updateData,
      });

      toast.success("Product updated successfully");
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        currency: "USD",
        sku: "",
        stockQuantity: undefined,
        trackInventory: false,
        category: "",
        status: "active",
        images: [],
      });
    } catch (error) {
      toast.error(`Failed to update product: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">Manage your products</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading products...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create and manage your product catalog</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col">
            <DialogHeader>
              <DialogTitle>Create New Product</DialogTitle>
              <DialogDescription>
                Add a new product to your catalog
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2 -mr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                    placeholder="Product SKU"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
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
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Product category"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "active" | "inactive" | "archived") => setFormData((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Stock Quantity</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={formData.stockQuantity || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="trackInventory"
                      checked={formData.trackInventory}
                      onChange={(e) => setFormData((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="trackInventory" className="cursor-pointer">Track Inventory</Label>
                  </div>
                </div>
              </div>

              {/* Product Images */}
              <div className="space-y-2">
                <Label>Product Images</Label>
                <div className="space-y-3">
                  {formData.images && formData.images.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                            <img
                              src={image}
                              alt={`Product image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {index === 0 && (
                              <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                <span>Featured</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {index !== 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSetFeaturedImage(index)}
                                  className="h-8 w-8 p-0"
                                  title="Set as featured"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveImage(index)}
                                className="h-8 w-8 p-0"
                                title="Remove image"
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
                      {imageUpload.isUploading ? "Uploading..." : "Add Images"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      First image will be used as featured image. You can reorder by setting a different image as featured.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProduct}
                disabled={createProductMutation.isPending || !formData.name || !formData.price}
              >
                {createProductMutation.isPending ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Product Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            setFormData({
              name: "",
              description: "",
              price: 0,
              currency: "USD",
              sku: "",
              stockQuantity: undefined,
              trackInventory: false,
              category: "",
              status: "active",
              images: [],
            });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Update product information
              </DialogDescription>
            </DialogHeader>
            {editingProductData ? (
              <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2 -mr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Product Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU</Label>
                    <Input
                      id="edit-sku"
                      value={formData.sku}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                      placeholder="Product SKU"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Product description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">Price *</Label>
                    <Input
                      id="edit-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
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
                    <Label htmlFor="edit-category">Category</Label>
                    <Input
                      id="edit-category"
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      placeholder="Product category"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "active" | "inactive" | "archived") => setFormData((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-stockQuantity">Stock Quantity</Label>
                    <Input
                      id="edit-stockQuantity"
                      type="number"
                      min="0"
                      value={formData.stockQuantity || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: e.target.value ? parseInt(e.target.value) : undefined }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-trackInventory"
                        checked={formData.trackInventory}
                        onChange={(e) => setFormData((prev) => ({ ...prev, trackInventory: e.target.checked }))}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="edit-trackInventory" className="cursor-pointer">Track Inventory</Label>
                    </div>
                  </div>
                </div>

                {/* Product Images */}
                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <div className="space-y-3">
                    {formData.images && formData.images.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {formData.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                              <img
                                src={image}
                                alt={`Product image ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              {index === 0 && (
                                <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span>Featured</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {index !== 0 && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleSetFeaturedImage(index)}
                                    className="h-8 w-8 p-0"
                                    title="Set as featured"
                                  >
                                    <Star className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveImage(index)}
                                  className="h-8 w-8 p-0"
                                  title="Remove image"
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
                          files.forEach((file) => handleEditImageUpload(file));
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
                        {imageUpload.isUploading ? "Uploading..." : "Add Images"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        First image will be used as featured image. You can reorder by setting a different image as featured.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading product data...</p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingProduct(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateProduct}
                disabled={updateProductMutation.isPending || !formData.name || !formData.price}
              >
                {updateProductMutation.isPending ? "Updating..." : "Update Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredProducts.length}</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">products</span>
          </div>
        </Card>
      </div>

      {/* Products Table - Desktop */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 px-4">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No products</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm.trim() || statusFilter !== "all"
                  ? "No products match your filters."
                  : "Get started by creating a new product."}
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
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Product</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">SKU</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Price</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Stock</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Category</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Status</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10 hidden lg:table-cell">Created</th>
                        <th className="text-left align-top font-medium px-3 py-2 h-10">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-neutral-100/50 border-b transition-colors">
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
                                  <Badge variant="destructive" className="text-xs shrink-0">Low</Badge>
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
                              {product.status}
                            </Badge>
                          </td>
                          <td className="p-3 align-top hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {product.createdAt
                                ? format(new Date(product.createdAt), "MMM d, yyyy")
                                : "N/A"}
                            </span>
                          </td>
                          <td className="p-3 align-top">
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View product details"
                                onClick={() => setSelectedProduct({ id: product.id })}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit product"
                                onClick={() => handleEditProduct(product.id)}
                                className="h-8 w-8 p-0 shrink-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete product"
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
                <h2 className="text-xl font-semibold">All Products</h2>
                <p className="text-sm text-muted-foreground">
                  {searchTerm.trim() || statusFilter !== "all"
                    ? `Showing ${filteredProducts.length} of ${products.length} products`
                    : `Showing all ${products.length} products`
                  }
                </p>
              </div>
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-lg border bg-card p-4 shadow-sm"
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
                          <span className="text-muted-foreground">Price:</span>
                          <p className="font-medium">{formatCurrency(product.price, product.currency)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <div className="mt-1">
                            <Badge className={getStatusColor(product.status)}>
                              {product.status}
                            </Badge>
                          </div>
                        </div>
                        {product.sku && (
                          <div>
                            <span className="text-muted-foreground">SKU:</span>
                            <p className="font-medium">{product.sku}</p>
                          </div>
                        )}
                        {product.category && (
                          <div>
                            <span className="text-muted-foreground">Category:</span>
                            <p className="font-medium">{product.category}</p>
                          </div>
                        )}
                        {product.trackInventory && (
                          <div>
                            <span className="text-muted-foreground">Stock:</span>
                            <p className="font-medium">
                              {product.stockQuantity ?? 0}
                              {product.stockQuantity !== undefined && product.lowStockThreshold && product.stockQuantity <= product.lowStockThreshold && (
                                <Badge variant="destructive" className="ml-2">Low</Badge>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProduct({ id: product.id })}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProduct(product.id)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deleteProductMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
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
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              View detailed information about this product
            </DialogDescription>
          </DialogHeader>
          {selectedProductData ? (
            <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-2 -mr-2">
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Product Name</Label>
                  <p className="font-medium">{selectedProductData.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SKU</Label>
                  <p className="font-medium">{selectedProductData.sku || "—"}</p>
                </div>
              </div>

              {selectedProductData.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedProductData.description}</p>
                </div>
              )}

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Price</Label>
                  <p className="font-medium text-lg">
                    {formatCurrency(selectedProductData.price, selectedProductData.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currency</Label>
                  <p className="font-medium">{selectedProductData.currency}</p>
                </div>
              </div>

              {/* Inventory */}
              {selectedProductData.trackInventory && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Stock Quantity</Label>
                    <p className="font-medium">
                      {selectedProductData.stockQuantity ?? 0}
                      {selectedProductData.lowStockThreshold && 
                       selectedProductData.stockQuantity !== undefined &&
                       selectedProductData.stockQuantity <= selectedProductData.lowStockThreshold && (
                        <Badge variant="destructive" className="ml-2">Low Stock</Badge>
                      )}
                    </p>
                  </div>
                  {selectedProductData.lowStockThreshold && (
                    <div>
                      <Label className="text-muted-foreground">Low Stock Threshold</Label>
                      <p className="font-medium">{selectedProductData.lowStockThreshold}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedProductData.category || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedProductData.status)}>
                    {selectedProductData.status}
                  </Badge>
                </div>
              </div>

              {/* Images */}
              {selectedProductData.images && selectedProductData.images.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Product Images</Label>
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
                              <span>Featured</span>
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
                    <Label className="text-muted-foreground">Cost</Label>
                    <p className="font-medium">
                      {formatCurrency(selectedProductData.cost, selectedProductData.currency)}
                    </p>
                  </div>
                )}
                {selectedProductData.taxRate !== undefined && (
                  <div>
                    <Label className="text-muted-foreground">Tax Rate</Label>
                    <p className="font-medium">{selectedProductData.taxRate}%</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedProductData.tags && selectedProductData.tags.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedProductData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                {selectedProductData.createdAt && (
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p className="font-medium">
                      {format(new Date(selectedProductData.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
                {selectedProductData.updatedAt && (
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="font-medium">
                      {format(new Date(selectedProductData.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading product details...</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

