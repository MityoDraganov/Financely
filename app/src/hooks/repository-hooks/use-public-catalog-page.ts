import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getPublicCatalogRepository } from "@/repositories/public-catalog-repository";
import { PublicCatalogData, PublicCatalogResponse } from "@/pages/products/public-page/types";

type PublicCatalogPageKind = PublicCatalogData["kind"];

type UsePublicCatalogPageResult<TKind extends PublicCatalogPageKind> = {
  loading: boolean;
  transitioning: boolean;
  error: string | null;
  data: Extract<PublicCatalogData, { kind: TKind }> | null;
};

const publicCatalogRepository = getPublicCatalogRepository();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Failed to load page";
}

export function usePublicCatalogPage<TKind extends PublicCatalogPageKind>(
  expectedKind: TKind,
): UsePublicCatalogPageResult<TKind> {
  const { orgSlug = "", productSlug = "", collectionSlug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const pageCursor = new URLSearchParams(location.search).get("cursor") || undefined;
  const queryResult = useQuery({
    queryKey: [
      "public-catalog-page",
      expectedKind,
      orgSlug,
      productSlug,
      collectionSlug,
      pageCursor,
    ],
    queryFn: () =>
      publicCatalogRepository.resolvePublicCatalogPage({
        orgSlug,
        productSlug: productSlug || undefined,
        collectionSlug: collectionSlug || undefined,
        cursor: pageCursor,
      }),
    retry: false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (queryResult.data?.kind !== "redirect") return;
    navigate(queryResult.data.canonicalPath, { replace: true });
  }, [navigate, queryResult.data]);

  const payload: PublicCatalogResponse | undefined = queryResult.data;
  const isRedirecting = payload?.kind === "redirect";
  const typeMismatch =
    payload && payload.kind !== "redirect" && payload.kind !== expectedKind;
  const data =
    payload && payload.kind === expectedKind
      ? (payload as Extract<PublicCatalogData, { kind: TKind }>)
      : null;
  const error = typeMismatch
    ? "Unexpected public page payload type."
    : queryResult.error
      ? getErrorMessage(queryResult.error)
      : null;

  return {
    loading: queryResult.isPending || isRedirecting,
    transitioning: queryResult.isFetching && !queryResult.isPending,
    error,
    data,
  };
}
