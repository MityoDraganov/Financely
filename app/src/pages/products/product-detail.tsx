import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProductsByOrg, useUpdateProduct } from "@/hooks";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateProductInput } from "@/core";
import { ProductForm } from "@/components/products/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentOrganization } = useOrganizationContext();

  const { data: products = [], isLoading } = useProductsByOrg(currentOrganization?.id);
  const updateProductMutation = useUpdateProduct();

  const product = products.find((p) => p.id === id);

  const handleSubmit = async (data: CreateProductInput | Partial<CreateProductInput>) => {
    if (!id || !currentOrganization?.id) return;
    try {
      await updateProductMutation.mutateAsync({ id, data });
      toast.success(t("products.messages.productUpdated"));
      navigate("/products");
    } catch (error) {
      toast.error(
        t("products.messages.updateFailed", {
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
      throw error;
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

  if (!product) {
    return (
      <div className="p-4 sm:p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">{t("products.notFound", "Product not found")}</p>
        <p className="text-sm text-muted-foreground">
          {t("products.notFoundDescription", "This product may have been deleted or you don't have access.")}
        </p>
      </div>
    );
  }

  return (
    <ProductForm
      initialData={product}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/products")}
      isPending={updateProductMutation.isPending}
      organizationId={currentOrganization?.id ?? ""}
    />
  );
}
