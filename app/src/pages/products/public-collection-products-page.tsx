import { usePublicCatalogPage } from "./public-page/use-public-catalog-page";
import { usePublicPageSeo } from "./public-page/use-public-page-seo";
import {
  PublicCatalogListingView,
  PublicPageError,
  PublicPageSkeleton,
} from "./public-page/views";

export default function PublicCollectionProductsPage() {
  const { loading, transitioning, error, data } = usePublicCatalogPage("collection_products");
  usePublicPageSeo(data);

  if (loading) return <PublicPageSkeleton />;
  if (error) return <PublicPageError error={error} />;
  if (!data) return null;

  return <PublicCatalogListingView data={data} transitioning={transitioning} />;
}
