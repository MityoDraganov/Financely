import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { useProductsByOrg } from "@/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink, Package, ChevronDown, ChevronUp } from "lucide-react";
import { slugifyPublicSegment } from "@/utils/slug";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currencies";
import type { Product } from "@/core";

type CollectionSummary = {
	slug: string;
	label: string;
	count: number;
	products: Product[];
};

function normalizeCategoryValue(value: string | undefined): string {
	return (value || "").trim().replace(/\s+/g, " ");
}

function buildCollectionSummariesFromProducts(
	products: Product[],
): CollectionSummary[] {
	const bySlug = new Map<string, { label: string; products: Product[] }>();

	products.forEach((product) => {
		const label = normalizeCategoryValue(product.category);
		if (!label) return;

		const slug = slugifyPublicSegment(label);
		if (!slug) return;

		const existing = bySlug.get(slug);
		if (existing) {
			existing.products.push(product);
			if (!existing.label) {
				existing.label = label;
			}
			return;
		}

		bySlug.set(slug, { label, products: [product] });
	});

	return Array.from(bySlug.entries())
		.map(([slug, entry]) => ({
			slug,
			label: entry.label,
			count: entry.products.length,
			products: entry.products.sort((a, b) =>
				(a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
			),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export default function CollectionsPage() {
	const { t } = useTranslation();
	const { currentOrganization } = useOrganizationContext();
	const [expandedCollectionSlug, setExpandedCollectionSlug] = useState<string | null>(null);

	const orgId = currentOrganization?.id;
	const orgSlug = currentOrganization?.settings?.publicPages?.orgSlug;

	const { data: products = [], isLoading } = useProductsByOrg(orgId);
	const collections = useMemo(
		() => buildCollectionSummariesFromProducts(products),
		[products],
	);

	const displayedCollections = useMemo(
		() => collections.filter((c) => c.slug !== "uncategorized"),
		[collections]
	);
	const formatCurrency = (amount: number, currency: string) =>
		formatCurrencyUtil(amount, currency || "USD");

	if (isLoading) {
		return (
			<div className="py-6 pr-6 space-y-6">
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{t("collections.title")}
					</h1>
					<p className="text-sm text-muted-foreground">{t("collections.subtitle")}</p>
				</div>
				<div className="flex items-center justify-center h-64">
					<div className="text-muted-foreground">{t("collections.loading")}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="py-6 pr-6 space-y-6 w-full overflow-x-hidden">
			{/* Header */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{t("collections.title")}
					</h1>
					<p className="text-sm text-muted-foreground">{t("collections.subtitle")}</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="secondary" className="gap-1.5">
						<Layers className="h-3.5 w-3.5" />
						{displayedCollections.length} {t("collections.count")}
					</Badge>
					<Button variant="outline" asChild>
						<Link to="/products">{t("collections.viewProducts")}</Link>
					</Button>
				</div>
			</div>

			{/* Info callout */}
			<div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
				{t("collections.infoText")}
			</div>

			{/* Collections grid */}
			{displayedCollections.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center py-8 px-4">
							<Layers className="mx-auto h-12 w-12 text-muted-foreground" />
							<h3 className="mt-3 text-sm font-semibold text-foreground">
								{t("collections.empty.title")}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
								{t("collections.empty.description")}
							</p>
							<Button className="mt-4" asChild>
								<Link to="/products">{t("collections.empty.action")}</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{displayedCollections.map((collection) => {
						const isExpanded = expandedCollectionSlug === collection.slug;
						const publicPath = orgSlug
							? `/p/${orgSlug}/c/${collection.slug}`
							: null;

						return (
							<Card
								key={collection.slug}
								className="group hover:shadow-md transition-shadow duration-200"
							>
								<CardHeader className="pb-2">
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="text-base font-semibold leading-snug">
											{collection.label}
										</CardTitle>
										{publicPath && (
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
												asChild
											>
												<a
													href={publicPath}
													target="_blank"
													rel="noopener noreferrer"
													title={t("collections.openPublic")}
												>
													<ExternalLink className="h-3.5 w-3.5" />
												</a>
											</Button>
										)}
									</div>
									<code className="text-xs text-muted-foreground font-mono">
										{collection.slug}
									</code>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
										<Package className="h-4 w-4 shrink-0" />
										<span>
											{collection.count}{" "}
											{collection.count === 1
												? t("collections.product")
												: t("collections.products")}
										</span>
									</div>

									<Button
										type="button"
										variant="outline"
										size="sm"
										className="w-full h-11 justify-between"
										onClick={() =>
											setExpandedCollectionSlug((current) =>
												current === collection.slug ? null : collection.slug,
											)
										}
									>
										<span className="truncate">
											{isExpanded
												? t("collections.hideCategoryProducts")
												: t("collections.showCategoryProducts", {
													count: collection.count,
												})}
										</span>
										{isExpanded ? (
											<ChevronUp className="h-4 w-4 shrink-0" />
										) : (
											<ChevronDown className="h-4 w-4 shrink-0" />
										)}
									</Button>

									{isExpanded ? (
										<div className="mt-3 space-y-2">
											{collection.products.map((product) => (
												<Link
													key={product.id}
													to={`/products/${product.id}`}
													className="flex min-h-12 items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent/50"
												>
													<div className="min-w-0 space-y-1">
														<p className="truncate text-sm font-medium text-foreground">
															{product.name || t("products.table.product")}
														</p>
														<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
															<span>{formatCurrency(product.price || 0, product.currency || "USD")}</span>
															{product.sku ? <span>SKU: {product.sku}</span> : null}
														</div>
													</div>
													<Badge
														variant="secondary"
														className="h-6 shrink-0"
													>
														{t(`products.status.${product.status || "inactive"}`)}
													</Badge>
												</Link>
											))}
										</div>
									) : null}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
