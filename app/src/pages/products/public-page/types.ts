export type PublicBreadcrumbItem = {
  label: string;
  path?: string;
};

export type PublicListingCard = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  category?: string;
  canonicalPath: string;
  canonicalUrl: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicSeoPayload = {
  title: string;
  description: string;
  canonicalUrl: string;
  image?: string;
  robots: string;
};

export type PublicOrganizationPayload = {
  id: string;
  name: string;
  orgSlug: string;
  logoUrl?: string;
  locale: string;
};

export type PublicProductFields = {
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

export type PublicProductMetafield = {
  definitionId: string;
  name: string;
  type: string;
  description?: string;
  value?: unknown;
  displayValue: string;
  dateDisplayMode?: "numeric" | "localized";
};

export type PublicCatalogResponse =
  | {
      kind: "redirect";
      canonicalPath: string;
      canonicalUrl: string;
    }
  | {
      kind: "org_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      collections: Array<{
        slug: string;
        label: string;
        count: number;
        path: string;
      }>;
      listing: {
        items: PublicListingCard[];
        pagination: {
          limit: number;
          hasMore: boolean;
          nextCursor?: string;
        };
      };
    }
  | {
      kind: "collection_products";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      collection: {
        slug: string;
        label: string;
        path: string;
      };
      collections: Array<{
        slug: string;
        label: string;
        count: number;
        path: string;
      }>;
      listing: {
        items: PublicListingCard[];
        pagination: {
          limit: number;
          hasMore: boolean;
          nextCursor?: string;
        };
      };
    }
  | {
      kind: "product_detail";
      canonicalPath: string;
      canonicalUrl: string;
      seo: PublicSeoPayload;
      organization: PublicOrganizationPayload;
      breadcrumb: PublicBreadcrumbItem[];
      product: {
        id: string;
        state: "published" | "unavailable";
        fields?: PublicProductFields;
        metafields?: PublicProductMetafield[];
      };
    };

export type PublicCatalogData = Exclude<PublicCatalogResponse, { kind: "redirect" }>;
export type PublicCatalogListingData = Extract<
  PublicCatalogData,
  { kind: "org_products" | "collection_products" }
>;
export type PublicCatalogProductDetailData = Extract<
  PublicCatalogData,
  { kind: "product_detail" }
>;
