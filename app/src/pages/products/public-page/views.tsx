import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import i18n from "@/i18n/config";
import { AlertCircle, Building2, ChevronLeft, ChevronRight, Package, Ruler, Weight, X, ZoomIn } from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrency } from "@/utils/currencies";
import {
  PublicBreadcrumbItem,
  PublicCatalogListingData,
  PublicCatalogProductDetailData,
  PublicMultiCurrencyConfig,
} from "./types";

function usePublicT(locale: string) {
  return i18n.getFixedT(locale, "publicCatalog");
}

const CURRENCY_POSITION_OVERRIDES: Partial<Record<string, "prefix" | "suffix">> = {
  BGN: "suffix",
  EUR: "prefix",
};

const imagePreloadCache = new Set<string>();
const imagePreloadInFlight = new Set<string>();

type ImageFetchPriority = "high" | "low" | "auto";

function preloadImage(src?: string, priority: ImageFetchPriority = "auto") {
  if (
    !src ||
    imagePreloadCache.has(src) ||
    imagePreloadInFlight.has(src) ||
    typeof window === "undefined"
  ) {
    return;
  }

  const img = new Image();
  img.decoding = "async";
  imagePreloadInFlight.add(src);
  if ("fetchPriority" in img) {
    (img as HTMLImageElement & { fetchPriority?: ImageFetchPriority }).fetchPriority = priority;
  }

  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    imagePreloadInFlight.delete(src);
    imagePreloadCache.add(src);
  };
  const fail = () => {
    imagePreloadInFlight.delete(src);
  };

  img.onload = finalize;
  img.onerror = fail;
  img.src = src;

  if (typeof img.decode === "function") {
    void img.decode().then(finalize).catch(() => {});
  }
}

function preloadImages(urls: string[], featured?: string) {
  if (typeof window === "undefined") return;

  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (uniqueUrls.length === 0) return;

  const primary = featured && uniqueUrls.includes(featured) ? featured : uniqueUrls[0];
  if (primary) preloadImage(primary, "high");

  const rest = uniqueUrls.filter((url) => url !== primary);
  if (rest.length === 0) return;

  window.setTimeout(() => {
    rest.forEach((url) => preloadImage(url, "low"));
  }, 0);
}

function getCurrencyToken(currencyCode: string, locale?: string): string {
  const knownCurrency = getCurrency(currencyCode);
  if (knownCurrency?.symbol) return knownCurrency.symbol;

  try {
    return new Intl.NumberFormat(locale ?? "en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

function resolveCurrencyPosition(currencyCode: string, locale?: string): "prefix" | "suffix" {
  const overridden = CURRENCY_POSITION_OVERRIDES[currencyCode];
  if (overridden) return overridden;

  try {
    const parts = new Intl.NumberFormat(locale ?? "en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(1234.56);

    const currencyIndex = parts.findIndex((part) => part.type === "currency");
    const firstNumberIndex = parts.findIndex((part) => part.type === "integer");

    if (currencyIndex >= 0 && firstNumberIndex >= 0) {
      return currencyIndex < firstNumberIndex ? "prefix" : "suffix";
    }
  } catch {
    // Fall through to safe default.
  }

  return "prefix";
}

function formatPrice(price: number, currency: string, locale?: string): string {
  const normalizedCurrency = currency.toUpperCase();
  const knownCurrency = getCurrency(normalizedCurrency);
  const decimals = knownCurrency?.decimalDigits ?? 2;
  const token = getCurrencyToken(normalizedCurrency, locale);

  try {
    const amount = new Intl.NumberFormat(locale ?? "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);

    return resolveCurrencyPosition(normalizedCurrency, locale) === "prefix"
      ? `${token} ${amount}`
      : `${amount} ${token}`;
  } catch {
    return `${price.toFixed(decimals)} ${normalizedCurrency}`;
  }
}

function buildConvertedPrices(
  price: number,
  productCurrency: string,
  multiCurrency: PublicMultiCurrencyConfig,
): Array<{ currency: string; price: number }> {
  return multiCurrency.pairs
    .filter((pair) => pair.from === productCurrency && pair.to !== productCurrency && pair.rate > 0)
    .map((pair) => ({ currency: pair.to, price: price * pair.rate }));
}

/**
 * Renders the base price + any conversion prices at equal font size,
 * in close proximity, each with its currency symbol — satisfying
 * Art. 16 (1) dual-currency display requirements.
 *
 * priceClassName controls the size; all amounts (base + conversions) share it.
 */
function PriceDisplay({
  price,
  productCurrency,
  multiCurrency,
  locale,
  priceClassName,
  taxRate,
  taxLabel,
}: {
  price: number;
  productCurrency: string;
  multiCurrency?: PublicMultiCurrencyConfig;
  locale?: string;
  /** Tailwind classes applied to every price amount (base + conversions). */
  priceClassName: string;
  taxRate?: number | null;
  taxLabel?: string;
}) {
  const conversions = multiCurrency
    ? buildConvertedPrices(price, productCurrency, multiCurrency)
    : [];

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
      <span className={priceClassName}>{formatPrice(price, productCurrency, locale)}</span>
      {conversions.map(({ currency, price: converted }) => (
        <span key={currency} className={priceClassName}>
          ({formatPrice(converted, currency, locale)})
        </span>
      ))}
      {taxRate != null && taxLabel && (
        <span className="text-xs text-stone-400 ml-1">{taxLabel}</span>
      )}
    </div>
  );
}

function getMetafieldCategory(
  type: string,
): "date" | "boolean" | "color" | "json" | "list" | "link" | "media" | "text" {
  if (type.startsWith("list.")) return "list";
  if (type === "boolean") return "boolean";
  if (type === "color") return "color";
  if (type === "json") return "json";
  if (type === "date" || type === "date_time") return "date";
  if (type === "link" || type === "url") return "link";
  if (type.includes("file_reference")) return "media";
  return "text";
}

function MetafieldValue({
  type,
  value,
  displayValue,
}: {
  type: string;
  value: unknown;
  displayValue: string;
}) {
  const category = getMetafieldCategory(type);

  if (category === "boolean") {
    const normalized = displayValue.toLowerCase();
    const positive = value === true || normalized === "true" || normalized === "yes";
    return (
      <span className={`text-sm ${positive ? "text-emerald-600" : "text-stone-500"}`}>
        {positive ? "Yes" : "No"}
      </span>
    );
  }

  if (category === "color") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: displayValue }}
        />
        <span className="font-mono text-sm text-stone-700">{displayValue}</span>
      </div>
    );
  }

  if (category === "json") {
    return (
      <pre className="rounded-md border border-stone-200 bg-stone-50 p-2 text-xs text-stone-700 whitespace-pre-wrap wrap-break-word">
        {displayValue}
      </pre>
    );
  }

  if (category === "date") {
    const date = new Date(displayValue);
    if (!Number.isNaN(date.getTime())) {
      return <span className="text-sm text-stone-700">{date.toLocaleDateString()}</span>;
    }
  }

  if (category === "list") {
    const values = displayValue
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return (
      <div className="flex flex-wrap gap-1.5">
        {values.map((entry) => (
          <span
            key={entry}
            className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
          >
            {entry}
          </span>
        ))}
      </div>
    );
  }

  if (category === "link" || category === "media") {
    const href = typeof value === "string" ? value : displayValue;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-stone-700 underline underline-offset-2"
      >
        {displayValue || href}
      </a>
    );
  }

  return <span className="text-sm text-stone-700">{displayValue}</span>;
}

export function PublicPageSkeleton() {
  return (
    <div className="min-h-screen w-full" style={{ background: "#f9f8f6" }}>
      <div className="border-b border-stone-200 bg-white">
        <div className="w-full px-4 sm:px-10 py-3 flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <main className="w-full px-4 sm:px-10 py-8 sm:py-14 space-y-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}

export function PublicPageError({ error }: { error: string }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: "#f9f8f6" }}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-stone-900 mb-2">Page unavailable</h2>
        <p className="text-sm text-stone-500">{error}</p>
      </div>
    </div>
  );
}

function PageHeader({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4 sm:px-10 py-3 flex items-center gap-2.5">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-[60px] w-auto rounded-md object-cover" />
        ) : (
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-md bg-stone-900">
            <Building2 className="h-6 w-6 text-white" />
          </div>
        )}
        <span className="text-lg font-bold text-stone-900 tracking-tight leading-none">{name}</span>
      </div>
    </header>
  );
}

function BreadcrumbBar({ items }: { items?: PublicBreadcrumbItem[] }) {
  const safeItems = (items ?? []).filter(
    (item): item is PublicBreadcrumbItem =>
      Boolean(item) && typeof item.label === "string" && item.label.trim().length > 0,
  );
  const hasNavigableAncestor = safeItems
    .slice(0, Math.max(0, safeItems.length - 1))
    .some((item) => Boolean(item.path));

  if (safeItems.length === 0 || !hasNavigableAncestor) return null;

  return (
    <Breadcrumb className="rounded-md border border-stone-200 bg-white px-3 py-2 w-fit">
      <BreadcrumbList className="text-xs sm:text-sm text-stone-600">
        {safeItems.map((item, idx) => {
          const last = idx === safeItems.length - 1;
          return (
            <BreadcrumbItem key={`${item.label}-${idx}`}>
              {last || !item.path ? (
                <BreadcrumbPage className="font-medium text-stone-900 dark:text-stone-900">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild className="text-stone-600 hover:text-stone-900 dark:text-stone-600 dark:hover:text-stone-900">
                  <Link to={item.path}>{item.label}</Link>
                </BreadcrumbLink>
              )}
              {!last && <BreadcrumbSeparator className="text-stone-400" />}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function PublicCatalogListingView({ data, transitioning = false }: { data: PublicCatalogListingData; transitioning?: boolean }) {
  const t = usePublicT(data.organization.locale);
  const listing = data.listing.items;
  const multiCurrency = data.organization.multiCurrency;
  const activeCollectionSlug = data.kind === "collection_products" ? data.collection.slug : null;

  const nextCursor = data.listing.pagination.nextCursor;
  const nextPageTo = nextCursor
    ? `${data.canonicalPath}?cursor=${encodeURIComponent(nextCursor)}`
    : null;

  const allProductsPath = data.canonicalPath.replace(/\/c\/[^/]+$/, "");
  const showCollectionFilters = data.collections.length > 0;

  return (
    <div className="min-h-screen w-full" style={{ background: "#f9f8f6" }}>
      <PageHeader name={data.organization.name} logoUrl={data.organization.logoUrl} />
      <main className="w-full px-4 sm:px-10 py-8 sm:py-12">
        <div className="space-y-6">
          <h1 className="text-3xl sm:text-4xl text-stone-900">
            {data.kind === "collection_products" ? data.collection.label : t("allProducts")}
          </h1>

          {showCollectionFilters && (
            <div className="flex flex-wrap gap-2">
              <Link
                to={allProductsPath}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  !activeCollectionSlug
                    ? "border-stone-900 text-stone-900 bg-white"
                    : "border-stone-300 text-stone-700 bg-white"
                }`}
              >
                {t("allProducts")}
              </Link>
              {data.collections.map((collection) => (
                <Link
                  key={collection.slug}
                  to={collection.path}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    activeCollectionSlug === collection.slug
                      ? "border-stone-900 text-stone-900 bg-white"
                      : "border-stone-300 text-stone-700 bg-white"
                  }`}
                >
                  {collection.label} ({collection.count})
                </Link>
              ))}
            </div>
          )}

          <div className={`transition-opacity duration-150 ${transitioning ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            {listing.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-6">
                <h2 className="text-lg text-stone-900 mb-1">{t("noProductsTitle")}</h2>
                <p className="text-sm text-stone-500">{t("noProductsDescription")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {listing.map((product) => (
                  <Link
                    key={product.id}
                    to={product.canonicalPath}
                    className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                  >
                    <div className="aspect-square bg-stone-50">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-stone-300">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-sm text-stone-900">{product.name}</p>
                      <PriceDisplay
                        price={product.price}
                        productCurrency={product.currency}
                        multiCurrency={multiCurrency}
                        locale={data.organization.locale}
                        priceClassName="text-sm font-medium text-stone-800"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {nextPageTo && (
            <div>
              <Link
                to={nextPageTo}
                className="inline-flex rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
              >
                {t("nextPage")}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (images.length === 0) return;
    preloadImages(images, images[idx] ?? images[0]);
    preloadImage(images[(idx + 1) % images.length], "high");
    preloadImage(images[(idx - 1 + images.length) % images.length], "high");
  }, [idx, images]);

  const navigate = useCallback(
    (dir: number) => {
      if (images.length <= 1) return;
      setDirection(dir);
      setIdx((prev) => (prev + dir + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, onClose]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (images.length <= 1) return;
    const deltaX = info.offset.x;
    const deltaY = info.offset.y;
    const horizontalSwipe = Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY);
    if (!horizontalSwipe) return;
    navigate(deltaX < 0 ? 1 : -1);
  };

  const cubicBezier = [0.32, 0.72, 0, 1] as const;
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "55%" : "-55%", opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.28, ease: cubicBezier } },
    exit: (dir: number) => ({
      x: dir > 0 ? "-55%" : "55%",
      opacity: 0,
      transition: { duration: 0.2, ease: cubicBezier },
    }),
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-100 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-stone-950/92 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative z-10 flex h-full w-full items-center justify-center"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-xs text-white/50 tabular-nums select-none">
            {idx + 1} / {images.length}
          </div>
        )}

        {/* Image area */}
        <div className="relative flex h-screen w-screen max-h-screen max-w-screen items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.img
              key={idx}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag={images.length > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              src={images[idx]}
              alt={`Image ${idx + 1}`}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-screen w-screen max-h-screen max-w-screen select-none object-contain touch-pan-y"
              draggable={false}
            />
          </AnimatePresence>
        </div>

        {/* Prev / Next */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(-1); }}
              className="absolute left-4 top-1/2 z-30 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(1); }}
              className="absolute right-4 top-1/2 z-30 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(i > idx ? 1 : -1);
                  setIdx(i);
                }}
                aria-label={`Go to image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === idx ? "w-5 bg-white" : "w-1.5 bg-white/35 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

export function PublicProductDetailView({ data }: { data: PublicCatalogProductDetailData }) {
  const t = usePublicT(data.organization.locale);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fields = data.product.fields;
  const images = useMemo(() => fields?.images ?? [], [fields?.images]);
  const activeImage = images[activeImageIdx] || images[0];

  useEffect(() => {
    if (data.product.state === "unavailable" || !fields || !activeImage) return;

    preloadImages(images, activeImage);
    preloadImage(activeImage, "high");
    if (images.length > 1) {
      preloadImage(images[(activeImageIdx + 1) % images.length], "high");
      preloadImage(images[(activeImageIdx - 1 + images.length) % images.length], "high");
    }
  }, [activeImage, activeImageIdx, data.product.state, fields, images]);

  if (data.product.state === "unavailable") {
    const breadcrumbItems =
      data.breadcrumb && data.breadcrumb.length > 0
        ? data.breadcrumb
        : [{ label: "All Products", path: `/p/${data.organization.orgSlug}` }];

    return (
      <div className="min-h-screen w-full" style={{ background: "#f9f8f6" }}>
        <PageHeader name={data.organization.name} logoUrl={data.organization.logoUrl} />
        <main className="w-full px-4 sm:px-10 py-8 sm:py-12">
          <div className="space-y-6">
            <BreadcrumbBar items={breadcrumbItems} />
            <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                <Package className="h-6 w-6 text-stone-400" />
              </div>
              <h2 className="text-2xl text-stone-900 mb-2">{t("productUnavailable")}</h2>
              <p className="text-sm text-stone-500">
                {t("productUnavailableDescription", { name: data.organization.name })}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!fields) return null;

  const metafields = data.product.metafields ?? [];
  const breadcrumbItems =
    data.breadcrumb && data.breadcrumb.length > 0
      ? data.breadcrumb
      : [
          { label: "All Products", path: `/p/${data.organization.orgSlug}` },
          ...(fields.category && fields.category !== fields.name ? [{ label: fields.category }] : []),
          { label: fields.name },
        ];

  const hasDimensions =
    fields.dimensions &&
    (fields.dimensions.length != null ||
      fields.dimensions.width != null ||
      fields.dimensions.height != null);
  const hasSpecs = fields.weight != null || hasDimensions;

  return (
    <div className="min-h-screen w-full" style={{ background: "#f9f8f6" }}>
      <PageHeader name={data.organization.name} logoUrl={data.organization.logoUrl} />
      <main className="w-full px-4 sm:px-10 py-8 sm:py-12">
        <div className="space-y-6">
          <BreadcrumbBar items={breadcrumbItems} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-start">
            <div className="space-y-3">
              <div
                className={`relative overflow-hidden rounded-2xl border border-stone-200 bg-white ${activeImage ? "cursor-zoom-in" : ""}`}
                onClick={() => activeImage && setLightboxOpen(true)}
              >
                {activeImage ? (
                  <>
                    {images.map((img, idx) => (
                      <img
                        key={`${img}-${idx}`}
                        src={img}
                        alt={idx === activeImageIdx ? fields.name : ""}
                        aria-hidden={idx !== activeImageIdx}
                        className={`w-full h-auto object-contain ${
                          idx === activeImageIdx ? "block" : "hidden"
                        }`}
                        loading="eager"
                        decoding="async"
                        fetchPriority={idx === activeImageIdx ? "high" : "low"}
                        draggable={false}
                      />
                    ))}
                    <div className="absolute inset-0 flex items-start justify-end p-3 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                        <ZoomIn className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="aspect-square flex items-center justify-center text-stone-300">
                    <Package className="h-16 w-16" />
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                        idx === activeImageIdx ? "border-stone-800" : "border-stone-200"
                      }`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5 lg:pt-2">
              {fields.category && (
                <span className="inline-flex rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs text-stone-600">
                  {fields.category}
                </span>
              )}
              <h1 className="text-4xl sm:text-5xl text-stone-900">{fields.name}</h1>
              <div className="space-y-1">
                <PriceDisplay
                  price={fields.price}
                  productCurrency={fields.currency}
                  multiCurrency={data.organization.multiCurrency}
                  locale={data.organization.locale}
                  priceClassName="text-3xl text-stone-900"
                  taxRate={fields.taxRate}
                  taxLabel={
                    fields.taxRate != null
                      ? t("tax", { rate: String(fields.taxRate) })
                      : undefined
                  }
                />
              </div>
              <Separator className="bg-stone-200" />

              {fields.description && (
                <p className="text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">
                  {fields.description}
                </p>
              )}

              {fields.tags && fields.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fields.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {fields.barcode && (
                <div className="space-y-1.5 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wide text-stone-400">{t("barcode")}</span>
                    <span className="font-mono text-stone-700">{fields.barcode}</span>
                  </div>
                </div>
              )}

              {metafields.length > 0 && (
                <>
                  <Separator className="bg-stone-200" />
                  <div className="space-y-3">
                    {metafields.map((mf) => (
                      <div key={mf.definitionId} className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                          {mf.name}
                        </p>
                        {mf.description && <p className="text-xs text-stone-400">{mf.description}</p>}
                        <MetafieldValue
                          type={mf.type}
                          value={mf.value}
                          displayValue={mf.displayValue}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {hasSpecs && (
            <>
              <Separator className="my-2 bg-stone-200" />
              <div className="space-y-4">
                <h2 className="text-2xl text-stone-900">{t("specifications")}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {fields.weight != null && (
                    <div className="rounded-xl border border-stone-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Weight className="h-3.5 w-3.5 text-stone-400" />
                        <span className="text-xs uppercase tracking-wide text-stone-400">{t("weight")}</span>
                      </div>
                      <p className="text-sm text-stone-800">{fields.weight} g</p>
                    </div>
                  )}
                  {hasDimensions && fields.dimensions && (
                    <>
                      {fields.dimensions.length != null && (
                        <div className="rounded-xl border border-stone-200 bg-white p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Ruler className="h-3.5 w-3.5 text-stone-400" />
                            <span className="text-xs uppercase tracking-wide text-stone-400">{t("length")}</span>
                          </div>
                          <p className="text-sm text-stone-800">
                            {fields.dimensions.length} {fields.dimensions.unit ?? "cm"}
                          </p>
                        </div>
                      )}
                      {fields.dimensions.width != null && (
                        <div className="rounded-xl border border-stone-200 bg-white p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Ruler className="h-3.5 w-3.5 text-stone-400" />
                            <span className="text-xs uppercase tracking-wide text-stone-400">{t("width")}</span>
                          </div>
                          <p className="text-sm text-stone-800">
                            {fields.dimensions.width} {fields.dimensions.unit ?? "cm"}
                          </p>
                        </div>
                      )}
                      {fields.dimensions.height != null && (
                        <div className="rounded-xl border border-stone-200 bg-white p-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Ruler className="h-3.5 w-3.5 text-stone-400" />
                            <span className="text-xs uppercase tracking-wide text-stone-400">{t("height")}</span>
                          </div>
                          <p className="text-sm text-stone-800">
                            {fields.dimensions.height} {fields.dimensions.unit ?? "cm"}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <AnimatePresence>
        {lightboxOpen && (
          <ImageLightbox
            images={images}
            initialIndex={activeImageIdx}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
