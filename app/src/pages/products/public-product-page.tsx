import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Building2, Package, Ruler, Weight } from "lucide-react";
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
import { projectId } from "@/infrastructure/firebase";

type PublicBreadcrumbItem = {
	label: string;
	path?: string;
};

type PublicListingCard = {
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

type PublicCatalogResponse =
	| {
			kind: "redirect";
			canonicalPath: string;
			canonicalUrl: string;
	  }
	| {
			kind: "org_products";
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
			breadcrumb: PublicBreadcrumbItem[];
			product: {
				id: string;
				state: "published" | "unavailable";
				fields?: {
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
				metafields?: Array<{
					definitionId: string;
					name: string;
					type: string;
					description?: string;
					value?: unknown;
					displayValue: string;
				}>;
			};
	  };

function upsertMeta(name: string, content: string): void {
	let element = document.head.querySelector(
		`meta[name="${name}"]`,
	) as HTMLMetaElement | null;
	if (!element) {
		element = document.createElement("meta");
		element.name = name;
		document.head.appendChild(element);
	}
	element.content = content;
}

function upsertCanonical(href: string): void {
	let element = document.head.querySelector(
		'link[rel="canonical"]',
	) as HTMLLinkElement | null;
	if (!element) {
		element = document.createElement("link");
		element.rel = "canonical";
		document.head.appendChild(element);
	}
	element.href = href;
}

function formatPrice(price: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
		}).format(price);
	} catch {
		return `${price} ${currency}`;
	}
}

function getMetafieldCategory(
	type: string,
):
	| "date"
	| "boolean"
	| "color"
	| "json"
	| "list"
	| "link"
	| "media"
	| "text" {
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
		const positive =
			value === true ||
			displayValue.toLowerCase() === "true" ||
			displayValue.toLowerCase() === "yes";
		return (
			<span
				className={`text-sm ${positive ? "text-emerald-600" : "text-stone-500"}`}
			>
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
				<span className="font-mono text-sm text-stone-700">
					{displayValue}
				</span>
			</div>
		);
	}

	if (category === "json") {
		return (
			<pre className="rounded-md border border-stone-200 bg-stone-50 p-2 text-xs text-stone-700 whitespace-pre-wrap break-words">
				{displayValue}
			</pre>
		);
	}

	if (category === "date") {
		const date = new Date(displayValue);
		if (!isNaN(date.getTime())) {
			return (
				<span className="text-sm text-stone-700">
					{date.toLocaleDateString()}
				</span>
			);
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

function PageSkeleton() {
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
					<img
						src={logoUrl}
						alt={name}
						className="h-7 w-7 rounded-md object-cover"
					/>
				) : (
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900">
						<Building2 className="h-3.5 w-3.5 text-white" />
					</div>
				)}
				<span className="text-sm font-medium text-stone-600">{name}</span>
			</div>
		</header>
	);
}

function BreadcrumbBar({ items }: { items?: PublicBreadcrumbItem[] }) {
	const safeItems = (items ?? []).filter(
		(item): item is PublicBreadcrumbItem =>
			Boolean(item) &&
			typeof item.label === "string" &&
			item.label.trim().length > 0,
	);
	if (safeItems.length === 0) return null;
	return (
		<Breadcrumb className="rounded-md border border-stone-200 bg-white px-3 py-2">
			<BreadcrumbList className="text-xs sm:text-sm text-stone-600">
				{safeItems.map((item, idx) => {
					const last = idx === safeItems.length - 1;
					return (
						<BreadcrumbItem key={`${item.label}-${idx}`}>
							{last || !item.path ? (
								<BreadcrumbPage className="font-medium text-stone-900">
									{item.label}
								</BreadcrumbPage>
							) : (
								<BreadcrumbLink
									asChild
									className="text-stone-600 hover:text-stone-900"
								>
									<Link to={item.path}>{item.label}</Link>
								</BreadcrumbLink>
							)}
							{!last && (
								<BreadcrumbSeparator className="text-stone-400" />
							)}
						</BreadcrumbItem>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

export default function PublicProductPage() {
	const { orgSlug = "", productSlug = "", collectionSlug = "" } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const [data, setData] = useState<PublicCatalogResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeImageIdx, setActiveImageIdx] = useState(0);

	const endpoint = useMemo(
		() =>
			`https://us-central1-${projectId}.cloudfunctions.net/getPublicProductPage`,
		[],
	);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		setActiveImageIdx(0);

		const query = new URLSearchParams();
		query.set("orgSlug", orgSlug);
		if (productSlug) query.set("productSlug", productSlug);
		if (collectionSlug) query.set("collectionSlug", collectionSlug);
		const pageCursor = new URLSearchParams(location.search).get("cursor");
		if (pageCursor) query.set("cursor", pageCursor);
		query.set("mode", "json");

		fetch(`${endpoint}?${query.toString()}`)
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					throw new Error(
						body?.error || `Failed to load page (${res.status})`,
					);
				}
				return res.json() as Promise<PublicCatalogResponse>;
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
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "Failed to load page",
				);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [collectionSlug, endpoint, location.search, navigate, orgSlug, productSlug]);

	useEffect(() => {
		if (!data || data.kind === "redirect") return;
		document.title = data.seo.title;
		upsertMeta("description", data.seo.description);
		upsertMeta("robots", data.seo.robots);
		upsertCanonical(data.seo.canonicalUrl);
	}, [data]);

	if (loading) return <PageSkeleton />;

	if (error) {
		return (
			<div
				className="min-h-screen w-full flex items-center justify-center p-6"
				style={{ background: "#f9f8f6" }}
			>
				<div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
						<AlertCircle className="h-6 w-6 text-red-500" />
					</div>
					<h2 className="text-lg font-semibold text-stone-900 mb-2">
						Page unavailable
					</h2>
					<p className="text-sm text-stone-500">{error}</p>
				</div>
			</div>
		);
	}

	if (!data || data.kind === "redirect") return null;

	if (data.kind === "org_products" || data.kind === "collection_products") {
		const listing = data.listing.items;
		const activeCollectionSlug =
			data.kind === "collection_products" ? data.collection.slug : null;
		const breadcrumbItems =
			data.breadcrumb && data.breadcrumb.length > 0
				? data.breadcrumb
				: data.kind === "collection_products"
					? [
							{ label: "Home", path: "/" },
							{
								label: "All Products",
								path: `/p/${data.organization.orgSlug}`,
							},
							{ label: data.collection.label },
						]
					: [
							{ label: "Home", path: "/" },
							{ label: "All Products" },
						];
		const nextCursor = data.listing.pagination.nextCursor;
		const nextPageTo = nextCursor
			? `${data.canonicalPath}?cursor=${encodeURIComponent(nextCursor)}`
			: null;

		return (
			<div className="min-h-screen" style={{ background: "#f9f8f6" }}>
				<PageHeader
					name={data.organization.name}
					logoUrl={data.organization.logoUrl}
				/>
				<main className="w-full px-4 sm:px-10 py-8 sm:py-12">
					<div className="space-y-6">
						<BreadcrumbBar items={breadcrumbItems} />
						<h1 className="text-3xl sm:text-4xl text-stone-900">
							{data.kind === "collection_products"
								? data.collection.label
								: "All Products"}
						</h1>

						<div className="flex flex-wrap gap-2">
							<Link
								to={data.canonicalPath.replace(/\/c\/[^/]+$/, "")}
								className={`rounded-full border px-3 py-1.5 text-sm ${
									activeCollectionSlug
										? "border-stone-300 text-stone-700 bg-white"
										: "border-stone-900 text-stone-900 bg-white"
								}`}
							>
								All Products
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

						{listing.length === 0 ? (
							<div className="rounded-xl border border-stone-200 bg-white p-6">
								<h2 className="text-lg text-stone-900 mb-1">
									No products yet
								</h2>
								<p className="text-sm text-stone-500">
									No public products are available for this
									view.
								</p>
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
										<div className="p-3 space-y-1.5">
											{product.category && (
												<p className="text-[11px] uppercase tracking-wide text-stone-400">
													{product.category}
												</p>
											)}
											<p className="text-sm text-stone-900">
												{product.name}
											</p>
											<p className="text-sm font-medium text-stone-800">
												{formatPrice(
													product.price,
													product.currency,
												)}
											</p>
										</div>
									</Link>
								))}
							</div>
						)}

						{nextPageTo && (
							<div>
								<Link
									to={nextPageTo}
									className="inline-flex rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
								>
									Next page
								</Link>
							</div>
						)}
					</div>
				</main>
			</div>
		);
	}

	if (data.product.state === "unavailable") {
		const breadcrumbItems =
			data.breadcrumb && data.breadcrumb.length > 0
				? data.breadcrumb
				: [
						{ label: "Home", path: "/" },
						{
							label: "All Products",
							path: `/p/${data.organization.orgSlug}`,
						},
					];
		return (
			<div
				className="min-h-screen w-full"
				style={{ background: "#f9f8f6" }}
			>
				<PageHeader
					name={data.organization.name}
					logoUrl={data.organization.logoUrl}
				/>
				<main className="w-full px-4 sm:px-10 py-8 sm:py-12">
					<div className="space-y-6">
						<BreadcrumbBar items={breadcrumbItems} />
						<div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
								<Package className="h-6 w-6 text-stone-400" />
							</div>
							<h2 className="text-2xl text-stone-900 mb-2">
								Product Unavailable
							</h2>
							<p className="text-sm text-stone-500">
								{data.organization.name} has not published this
								product right now.
							</p>
						</div>
					</div>
				</main>
			</div>
		);
	}

	const fields = data.product.fields;
	const metafields = data.product.metafields ?? [];
	if (!fields) return null;
	const breadcrumbItems =
		data.breadcrumb && data.breadcrumb.length > 0
			? data.breadcrumb
			: [
					{ label: "Home", path: "/" },
					{
						label: "All Products",
						path: `/p/${data.organization.orgSlug}`,
					},
					...(fields.category
						? [
								{
									label: fields.category,
								},
							]
						: []),
					{ label: fields.name },
				];

	const images = fields.images ?? [];
	const activeImage = images[activeImageIdx] || images[0];
	const hasDimensions =
		fields.dimensions &&
		(fields.dimensions.length != null ||
			fields.dimensions.width != null ||
			fields.dimensions.height != null);
	const hasSpecs = fields.weight != null || hasDimensions;

	return (
		<div className="min-h-screen" style={{ background: "#f9f8f6" }}>
			<PageHeader
				name={data.organization.name}
				logoUrl={data.organization.logoUrl}
			/>
			<main className="w-full px-4 sm:px-10 py-8 sm:py-12">
				<div className="space-y-6">
					<BreadcrumbBar items={breadcrumbItems} />

					<div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-start">
						<div className="space-y-3">
							<div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white aspect-square">
								{activeImage ? (
									<img
										src={activeImage}
										alt={fields.name}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="h-full w-full flex items-center justify-center text-stone-300">
										<Package className="h-16 w-16" />
									</div>
								)}
							</div>

							{images.length > 1 && (
								<div className="flex gap-2 overflow-x-auto pb-1">
									{images.map((img, idx) => (
										<button
											key={img}
											onClick={() =>
												setActiveImageIdx(idx)
											}
											className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
												idx === activeImageIdx
													? "border-stone-800"
													: "border-stone-200"
											}`}
										>
											<img
												src={img}
												alt=""
												className="h-full w-full object-cover"
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
							<h1 className="text-4xl sm:text-5xl text-stone-900">
								{fields.name}
							</h1>
							<div className="flex items-baseline gap-3">
								<span className="text-3xl text-stone-900">
									{formatPrice(
										fields.price,
										fields.currency,
									)}
								</span>
								{fields.taxRate != null && (
									<span className="text-xs text-stone-400">
										+ {fields.taxRate}% tax
									</span>
								)}
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
										<span className="uppercase tracking-wide text-stone-400">
											Barcode
										</span>
										<span className="font-mono text-stone-700">
											{fields.barcode}
										</span>
									</div>
								</div>
							)}

							{metafields.length > 0 && (
								<>
									<Separator className="bg-stone-200" />
									<div className="space-y-3">
										{metafields.map((mf) => (
											<div
												key={mf.definitionId}
												className="space-y-1"
											>
												<p className="text-xs font-medium uppercase tracking-wide text-stone-400">
													{mf.name}
												</p>
												{mf.description && (
													<p className="text-xs text-stone-400">
														{mf.description}
													</p>
												)}
												<MetafieldValue
													type={mf.type}
													value={mf.value}
													displayValue={
														mf.displayValue
													}
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
								<h2 className="text-2xl text-stone-900">
									Specifications
								</h2>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
									{fields.weight != null && (
										<div className="rounded-xl border border-stone-200 bg-white p-4">
											<div className="flex items-center gap-1.5 mb-2">
												<Weight className="h-3.5 w-3.5 text-stone-400" />
												<span className="text-xs uppercase tracking-wide text-stone-400">
													Weight
												</span>
											</div>
											<p className="text-sm text-stone-800">
												{fields.weight} g
											</p>
										</div>
									)}
									{hasDimensions && fields.dimensions && (
										<>
											{fields.dimensions.length !=
												null && (
												<div className="rounded-xl border border-stone-200 bg-white p-4">
													<div className="flex items-center gap-1.5 mb-2">
														<Ruler className="h-3.5 w-3.5 text-stone-400" />
														<span className="text-xs uppercase tracking-wide text-stone-400">
															Length
														</span>
													</div>
													<p className="text-sm text-stone-800">
														{
															fields.dimensions
																.length
														}{" "}
														{fields.dimensions
															.unit ?? "cm"}
													</p>
												</div>
											)}
											{fields.dimensions.width !=
												null && (
												<div className="rounded-xl border border-stone-200 bg-white p-4">
													<div className="flex items-center gap-1.5 mb-2">
														<Ruler className="h-3.5 w-3.5 text-stone-400" />
														<span className="text-xs uppercase tracking-wide text-stone-400">
															Width
														</span>
													</div>
													<p className="text-sm text-stone-800">
														{
															fields.dimensions
																.width
														}{" "}
														{fields.dimensions
															.unit ?? "cm"}
													</p>
												</div>
											)}
											{fields.dimensions.height !=
												null && (
												<div className="rounded-xl border border-stone-200 bg-white p-4">
													<div className="flex items-center gap-1.5 mb-2">
														<Ruler className="h-3.5 w-3.5 text-stone-400" />
														<span className="text-xs uppercase tracking-wide text-stone-400">
															Height
														</span>
													</div>
													<p className="text-sm text-stone-800">
														{
															fields.dimensions
																.height
														}{" "}
														{fields.dimensions
															.unit ?? "cm"}
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
		</div>
	);
}
