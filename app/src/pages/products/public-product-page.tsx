import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { projectId } from "@/infrastructure/firebase";

type PublicProductResponse =
  | {
      kind: "ok";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        image?: string;
        robots: string;
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
        logoUrl?: string;
      };
      product: {
        id: string;
        state: "published";
        fields: {
          name: string;
          description?: string;
          price: number;
          currency: string;
          sku?: string;
          barcode?: string;
          category?: string;
          tags?: string[];
          images?: string[];
          taxRate?: number;
          weight?: number;
          dimensions?: {
            length?: number;
            width?: number;
            height?: number;
            unit?: "cm" | "in" | "m";
          };
        };
        metafields: Array<{
          definitionId: string;
          name: string;
          type: string;
          description?: string;
          value: unknown;
          displayValue: string;
        }>;
        qr?: {
          assetUrl?: string;
          payloadMode?: "hybrid" | "text-only";
          generatedAt?: string;
          payloadHash?: string;
        };
      };
    }
  | {
      kind: "redirect";
      canonicalPath: string;
      canonicalUrl: string;
    }
  | {
      kind: "unavailable";
      canonicalPath: string;
      canonicalUrl: string;
      seo: {
        title: string;
        description: string;
        canonicalUrl: string;
        robots: string;
      };
      organization: {
        id: string;
        name: string;
        orgSlug: string;
      };
      product: {
        id: string;
        state: "unavailable";
      };
    };

function upsertMeta(name: string, content: string): void {
  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

export default function PublicProductPage() {
  const { orgSlug = "", productSlug = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicProductResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const endpoint = useMemo(
    () => `https://us-central1-${projectId}.cloudfunctions.net/getPublicProductPage`,
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = new URL(endpoint);
    url.searchParams.set("orgSlug", orgSlug);
    url.searchParams.set("productSlug", productSlug);
    url.searchParams.set("mode", "json");

    fetch(url.toString())
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || `Failed to load page (${response.status})`);
        }
        return response.json() as Promise<PublicProductResponse>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload.kind === "redirect") {
          navigate(payload.canonicalPath, { replace: true });
          return;
        }
        setData(payload);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load page");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, navigate, orgSlug, productSlug]);

  useEffect(() => {
    if (!data || data.kind === "redirect") return;
    document.title = data.seo.title;
    upsertMeta("description", data.seo.description);
    upsertMeta("robots", data.seo.robots);
    upsertCanonical(data.seo.canonicalUrl);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading product page...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Product page unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (data.kind === "unavailable") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>This product is currently unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.organization.name} has not published this product right now.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.kind !== "ok") return null;

  const { fields, metafields } = data.product;

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-8 space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.organization.name}</p>
                <CardTitle className="text-2xl">{fields.name}</CardTitle>
              </div>
              <Badge>Public Product</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-lg">
                {fields.price} {fields.currency}
              </span>
              {fields.category && <Badge variant="secondary">{fields.category}</Badge>}
              {fields.sku && <Badge variant="outline">SKU: {fields.sku}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.images && fields.images.length > 0 && (
              <img
                src={fields.images[0]}
                alt={fields.name}
                className="w-full max-h-[420px] rounded-md border object-cover"
              />
            )}
            {fields.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{fields.description}</p>}
            {fields.tags && fields.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {fields.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {metafields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {metafields.map((metafield) => (
                <div key={metafield.definitionId} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{metafield.name}</p>
                  {metafield.description && (
                    <p className="text-xs text-muted-foreground mb-1">{metafield.description}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{metafield.displayValue}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.product.qr?.assetUrl && (
          <div className="text-xs text-muted-foreground">
            QR generated: {data.product.qr.generatedAt || "—"} · mode: {data.product.qr.payloadMode || "—"}
          </div>
        )}
      </main>
    </div>
  );
}
