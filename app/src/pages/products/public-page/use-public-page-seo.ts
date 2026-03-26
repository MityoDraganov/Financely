import { useEffect } from "react";
import { PublicCatalogData } from "./types";
import { removeOgMeta, upsertCanonical, upsertMeta, upsertOgMeta } from "./meta";

export function usePublicPageSeo(data: PublicCatalogData | null): void {
  useEffect(() => {
    if (!data) return;
    const { seo } = data;

    // Basic
    document.title = seo.title;
    upsertMeta("description", seo.description);
    upsertMeta("robots", seo.robots);
    upsertCanonical(seo.canonicalUrl);

    // Open Graph
    upsertOgMeta("og:title", seo.title);
    upsertOgMeta("og:description", seo.description);
    upsertOgMeta("og:url", seo.canonicalUrl);
    upsertOgMeta("og:type", data.kind === "product_detail" ? "product" : "website");

    const orgName =
      data.kind === "product_detail" || data.kind === "org_products" || data.kind === "collection_products"
        ? data.organization.name
        : "";
    if (orgName) upsertOgMeta("og:site_name", orgName);

    if (seo.image) {
      upsertOgMeta("og:image", seo.image);
      upsertOgMeta("og:image:width", "1200");
      upsertOgMeta("og:image:height", "630");
      upsertMeta("twitter:card", "summary_large_image");
      upsertMeta("twitter:image", seo.image);
    } else {
      removeOgMeta("og:image");
      removeOgMeta("og:image:width");
      removeOgMeta("og:image:height");
      upsertMeta("twitter:card", "summary");
    }

    // Twitter / X Card
    upsertMeta("twitter:title", seo.title);
    upsertMeta("twitter:description", seo.description);
  }, [data]);
}
