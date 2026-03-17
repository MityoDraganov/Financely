import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProductsByOrg, useUpdateProduct } from "@/hooks";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateProductInput } from "@/core";
import { ProductForm } from "@/components/products/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentOrganization } = useOrganizationContext();
  const [copied, setCopied] = useState(false);

  const { data: products = [], isLoading } = useProductsByOrg(currentOrganization?.id);
  const updateProductMutation = useUpdateProduct();

  const product = products.find((p) => p.id === id);

  const handleCopyPublicUrl = async () => {
    if (!product?.publicPage?.canonicalUrl) return;
    try {
      await navigator.clipboard.writeText(product.publicPage.canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Public URL copied");
    } catch {
      toast.error("Failed to copy public URL");
    }
  };

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Public Product Page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {product.publicPage?.canonicalUrl ? (
            <>
              <div className="flex gap-2">
                <Input value={product.publicPage.canonicalUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={handleCopyPublicUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(product.publicPage?.canonicalUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  <div>State: {product.publicPage?.state || "unknown"}</div>
                  <div>Last published: {product.publicPage?.lastPublishedAt || "—"}</div>
                  <div>QR generated: {product.publicPage?.qr?.generatedAt || "—"}</div>
                  <div>QR mode: {product.publicPage?.qr?.payloadMode || "—"}</div>
                </div>
                {product.publicPage?.qr?.assetUrl ? (
                  <a
                    href={product.publicPage.qr.assetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-col items-center gap-2"
                  >
                    <img
                      src={product.publicPage.qr.assetUrl}
                      alt={`${product.name} QR code`}
                      className="h-28 w-28 rounded border object-cover"
                    />
                    <span className="text-xs text-muted-foreground">Open or download QR</span>
                  </a>
                ) : (
                  <div className="text-xs text-muted-foreground">QR asset is being prepared.</div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Public page metadata will appear after product sync finishes.
            </p>
          )}
        </CardContent>
      </Card>

      <ProductForm
        initialData={product}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/products")}
        isPending={updateProductMutation.isPending}
        organizationId={currentOrganization?.id ?? ""}
      />
    </div>
  );
}
