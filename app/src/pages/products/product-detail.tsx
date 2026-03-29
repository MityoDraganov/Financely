import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProductsByOrg, useUpdateProduct } from "@/hooks";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { CreateProductInput } from "@/core";
import { ProductForm } from "@/components/products/product-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink, QrCode, Download, ChevronLeft } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { buildQrCodeServerUrl } from "@/services/qr-code-url";

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
      <div className="py-4 sm:py-6 pr-6 pl-0 space-y-6 w-full overflow-x-hidden">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-4 sm:py-6 pr-6 pl-0 space-y-2 w-full overflow-x-hidden">
        <p className="text-sm font-medium text-foreground">{t("products.notFound", "Product not found")}</p>
        <p className="text-sm text-muted-foreground">
          {t("products.notFoundDescription", "This product may have been deleted or you don't have access.")}
        </p>
      </div>
    );
  }

  const qrValue = product.publicPage?.canonicalUrl || null;
  const qrDownloadUrl = qrValue
    ? buildQrCodeServerUrl(qrValue, {
        size: 768,
        level: "M",
        marginSize: 0,
        format: "png",
      })
    : null;

  return (
    <div className="py-4 sm:py-6 pr-6 pl-0 space-y-4 w-full overflow-x-hidden">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => navigate("/products")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{t("products.editTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("products.editDescription")}</p>
        </div>
      </div>

      {/* QR / Public page — no card wrapper */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
        {qrValue ? (
          <div className="shrink-0 flex flex-col items-center gap-1.5 self-center sm:self-start">
            <a
              href={qrDownloadUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title="Download QR code"
              className="block p-2"
            >
              <QRCodeSVG
                value={qrValue}
                size={88}
                level="M"
                marginSize={0}
                title={`${product.name} QR code`}
              />
            </a>
            <a
              href={qrDownloadUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          </div>
        ) : (
          <div className="shrink-0 self-center sm:self-start h-[108px] w-[108px] rounded-xl border border-dashed bg-muted/40 grid place-items-center">
            <QrCode className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Public Product Page</span>
            {product.publicPage?.state && (
              <Badge
                variant={product.publicPage.state === "published" ? "default" : "secondary"}
                className="text-xs"
              >
                {product.publicPage.state}
              </Badge>
            )}
          </div>

          {product.publicPage?.canonicalUrl ? (
            <div className="flex gap-2 min-w-0">
              <Input
                value={product.publicPage.canonicalUrl}
                readOnly
                className="font-mono text-xs min-w-0 h-10"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={handleCopyPublicUrl}
                title="Copy URL"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={() => window.open(product.publicPage?.canonicalUrl, "_blank", "noopener,noreferrer")}
                title="Open public page"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Public page URL will appear after the first product sync.
            </p>
          )}
        </div>
      </div>

      {/* Form — header suppressed since we rendered it above */}
      <ProductForm
        initialData={product}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/products")}
        isPending={updateProductMutation.isPending}
        organizationId={currentOrganization?.id ?? ""}
        hideHeader
      />
    </div>
  );
}
