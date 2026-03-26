import { usePublicCatalogPage } from "./public-page/use-public-catalog-page";
import { usePublicPageSeo } from "./public-page/use-public-page-seo";
import {
  PublicPageError,
  PublicPageSkeleton,
  PublicProductDetailView,
} from "./public-page/views";

export default function PublicProductDetailPage() {
  const { loading, error, data } = usePublicCatalogPage("product_detail");
  usePublicPageSeo(data);

  if (loading) return <PublicPageSkeleton />;
  if (error) return <PublicPageError error={error} />;
  if (!data) return null;

  return <PublicProductDetailView data={data} />;
}
