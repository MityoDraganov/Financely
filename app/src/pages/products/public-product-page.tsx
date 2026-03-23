import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	AlertCircle,
	Building2,
	Check,
	ExternalLink,
	Package,
	QrCode,
	Ruler,
	Weight,
	X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildQrCodeServerUrl } from "@/services/qr-code-url";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { projectId } from "@/infrastructure/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── SEO helpers (unchanged) ──────────────────────────────────────────────────

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

// ─── Metafield type helpers ───────────────────────────────────────────────────

function getMetafieldCategory(
	type: string,
):
	| "text"
	| "number"
	| "media"
	| "link"
	| "date"
	| "boolean"
	| "color"
	| "json"
	| "list"
	| "other" {
	if (type.startsWith("list.")) return "list";
	if (
		[
			"single_line_text_field",
			"multi_line_text_field",
			"rich_text_field",
			"single_line_text_field_choice_list",
			"single_line_text_field_email",
		].includes(type)
	)
		return "text";
	if (
		[
			"number_integer",
			"number_decimal",
			"id",
			"money",
			"rating",
			"weight",
			"volume",
			"dimension",
		].includes(type)
	)
		return "number";
	if (
		[
			"file_reference",
			"file_reference_image",
			"file_reference_video",
		].includes(type)
	)
		return "media";
	if (type.includes("_reference") || type === "mixed_reference")
		return "text";
	if (["link", "url"].includes(type)) return "link";
	if (["date", "date_time"].includes(type)) return "date";
	if (type === "boolean") return "boolean";
	if (type === "color") return "color";
	if (type === "json") return "json";
	return "other";
}

// ─── Metafield value renderer ─────────────────────────────────────────────────

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
		const isTrue =
			value === true ||
			displayValue.toLowerCase() === "true" ||
			displayValue === "1" ||
			displayValue.toLowerCase() === "yes";
		return (
			<span
				className={`inline-flex items-center gap-1.5 text-sm font-medium ${isTrue ? "text-emerald-600" : "text-stone-400"}`}
			>
				{isTrue ? (
					<Check className="h-4 w-4" />
				) : (
					<X className="h-4 w-4" />
				)}
				{isTrue ? "Yes" : "No"}
			</span>
		);
	}

	if (category === "color") {
		return (
			<div className="flex items-center gap-2.5">
				<span
					className="h-5 w-5 rounded-full border border-black/10 shadow-inner shrink-0"
					style={{ background: displayValue }}
				/>
				<span className="font-mono text-sm text-stone-600">
					{displayValue}
				</span>
			</div>
		);
	}

	if (category === "link") {
		const href = typeof value === "string" ? value : displayValue;
		return (
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900 underline underline-offset-2"
			>
				{displayValue || href}
				<ExternalLink className="h-3 w-3 shrink-0" />
			</a>
		);
	}

	if (category === "date") {
		try {
			const date = new Date(displayValue || String(value));
			if (!isNaN(date.getTime())) {
				return (
					<span className="text-sm text-stone-700">
						{date.toLocaleDateString(undefined, {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</span>
				);
			}
		} catch {
			// fall through
		}
		return <span className="text-sm text-stone-700">{displayValue}</span>;
	}

	if (category === "media") {
		const url = typeof value === "string" ? value : displayValue;
		if (url && /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url)) {
			return (
				<img
					src={url}
					alt=""
					className="h-20 w-20 rounded-lg border border-stone-200 object-cover"
				/>
			);
		}
		return (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900 underline underline-offset-2"
			>
				View file <ExternalLink className="h-3 w-3 shrink-0" />
			</a>
		);
	}

	if (category === "json") {
		let formatted = displayValue;
		try {
			const parsed =
				typeof value === "string" ? JSON.parse(value) : value;
			formatted = JSON.stringify(parsed, null, 2);
		} catch {
			// use displayValue
		}
		return (
			<pre className="text-xs bg-stone-50 rounded-lg border border-stone-200 p-3 overflow-x-auto max-h-32 font-mono whitespace-pre-wrap break-words text-stone-700">
				{formatted}
			</pre>
		);
	}

	if (category === "list") {
		let items: string[] = [];
		try {
			if (typeof value === "string") items = JSON.parse(value);
			else if (Array.isArray(value))
				items = (value as unknown[]).map(String);
		} catch {
			items = displayValue
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
		}
		if (items.length > 0) {
			return (
				<div className="flex flex-wrap gap-1.5">
					{items.map((item, i) => (
						<span
							key={i}
							className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600"
						>
							{item}
						</span>
					))}
				</div>
			);
		}
	}

	return (
		<span className="text-sm text-stone-700 whitespace-pre-wrap break-words">
			{displayValue}
		</span>
	);
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
	return (
		<div className="min-h-screen w-full" style={{ background: "#f9f8f6" }}>
			<div className="border-b border-stone-200 bg-white">
				<div className="w-full px-4 sm:px-10 py-3 flex items-center gap-3">
					<Skeleton className="h-7 w-7 rounded-md" />
					<Skeleton className="h-4 w-32" />
				</div>
			</div>
			<main className="w-full px-4 sm:px-10 py-8 sm:py-14">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
					<div className="space-y-3">
						<Skeleton className="aspect-square w-full rounded-2xl" />
						<div className="flex gap-2">
							{[1, 2, 3].map((i) => (
								<Skeleton
									key={i}
									className="h-16 w-16 rounded-lg"
								/>
							))}
						</div>
					</div>
					<div className="space-y-5 pt-2">
						<Skeleton className="h-4 w-20 rounded-full" />
						<Skeleton className="h-12 w-4/5" />
						<Skeleton className="h-8 w-1/3" />
						<Skeleton className="h-px w-full" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					</div>
				</div>
				<div className="my-10 h-px bg-stone-200" />
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5].map((i) => (
						<div
							key={i}
							className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
						>
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-5 w-3/4" />
						</div>
					))}
				</div>
			</main>
		</div>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicProductPage() {
	const { orgSlug = "", productSlug = "" } = useParams();
	const navigate = useNavigate();
	const [data, setData] = useState<PublicProductResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
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

		const url = new URL(endpoint);
		url.searchParams.set("orgSlug", orgSlug);
		url.searchParams.set("productSlug", productSlug);
		url.searchParams.set("mode", "json");

		fetch(url.toString())
			.then(async (response) => {
				if (!response.ok) {
					const body = await response.json().catch(() => null);
					throw new Error(
						body?.error ||
							`Failed to load page (${response.status})`,
					);
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
	}, [endpoint, navigate, orgSlug, productSlug]);

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

	if (!data) return null;

	if (data.kind === "unavailable") {
		return (
			<div
				className="min-h-screen w-full flex items-center justify-center p-6"
				style={{ background: "#f9f8f6" }}
			>
				<div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
						<Package className="h-6 w-6 text-stone-400" />
					</div>
					<h2
						className="text-2xl text-stone-900 mb-2"
						style={{
							fontFamily: "'Cormorant Garamond', Georgia, serif",
							fontWeight: 500,
						}}
					>
						Product Unavailable
					</h2>
					<p className="text-sm text-stone-500">
						{data.organization.name} has not published this product
						right now.
					</p>
				</div>
			</div>
		);
	}

	if (data.kind !== "ok") return null;

	const { fields, metafields } = data.product;
	const { organization } = data;
	const images = fields.images ?? [];
	const activeImage = images[activeImageIdx];
	const hasDimensions =
		fields.dimensions &&
		(fields.dimensions.length != null ||
			fields.dimensions.width != null ||
			fields.dimensions.height != null);
	const hasSpecs = fields.weight != null || hasDimensions;

	const formattedPrice = (() => {
		try {
			return new Intl.NumberFormat(undefined, {
				style: "currency",
				currency: fields.currency,
				minimumFractionDigits: 2,
			}).format(fields.price);
		} catch {
			return `${fields.price} ${fields.currency}`;
		}
	})();

	const qrValue = data.canonicalUrl;
	const qrDownloadUrl = buildQrCodeServerUrl(qrValue, {
		size: 768,
		level: "M",
		marginSize: 0,
		format: "png",
	});

	return (
		<>
			<style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

        .pp-root { font-family: 'DM Sans', system-ui, sans-serif; }
        .pp-serif { font-family: 'Cormorant Garamond', Georgia, serif; }

        @keyframes pp-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pp-fade { animation: pp-in 0.35s ease both; }
        .pp-fade-1 { animation-delay: 0.05s; }
        .pp-fade-2 { animation-delay: 0.12s; }
        .pp-fade-3 { animation-delay: 0.20s; }

        @keyframes pp-img-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .pp-main-img { animation: pp-img-in 0.2s ease; }

        .pp-underline-link {
          position: relative;
          display: inline-block;
        }
        .pp-underline-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -1px;
          width: 100%;
          height: 1px;
          background: currentColor;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.25s ease;
        }
        .pp-underline-link:hover::after {
          transform: scaleX(1);
        }
      `}</style>

			<div
				className="pp-root min-h-screen"
				style={{ background: "#f9f8f6" }}
			>
				{/* Org header */}
				<header className="sticky top-0 z-10 border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
					<div className="w-full px-4 sm:px-10 py-3 flex items-center gap-2.5">
						{organization.logoUrl ? (
							<img
								src={organization.logoUrl}
								alt={organization.name}
								className="h-7 w-7 rounded-md object-cover"
							/>
						) : (
							<div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900">
								<Building2 className="h-3.5 w-3.5 text-white" />
							</div>
						)}
						<span className="text-sm font-medium text-stone-600">
							{organization.name}
						</span>
					</div>
				</header>

				<main className="w-full px-4 sm:px-10 py-8 sm:py-14">
					{/* ── Hero ── */}
					<div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-start">
						{/* Image gallery */}
						<div className="pp-fade space-y-3">
							<div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white aspect-square">
								{activeImage ? (
									<img
										key={activeImage}
										src={activeImage}
										alt={fields.name}
										className="pp-main-img h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center">
										<div className="flex flex-col items-center gap-3 text-stone-300">
											<Package className="h-16 w-16" />
											<span className="text-sm">
												No image
											</span>
										</div>
									</div>
								)}
							</div>

							{images.length > 1 && (
								<div className="flex gap-2 overflow-x-auto pb-1">
									{images.map((img, idx) => (
										<button
											key={idx}
											onClick={() =>
												setActiveImageIdx(idx)
											}
											className={`shrink-0 h-16 w-16 overflow-hidden rounded-lg border-2 transition-all ${
												idx === activeImageIdx
													? "border-stone-800"
													: "border-stone-200 hover:border-stone-400"
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

						{/* Product info */}
						<div className="pp-fade pp-fade-1 space-y-5 lg:pt-2">
							{/* Category badge */}
							{fields.category && (
								<div>
									<span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-0.5 text-xs font-medium text-stone-600">
										{fields.category}
									</span>
								</div>
							)}

							{/* Product name */}
							<h1
								className="pp-serif text-4xl sm:text-5xl leading-tight text-stone-900"
								style={{ fontWeight: 400 }}
							>
								{fields.name}
							</h1>

							{/* Price */}
							<div className="flex items-baseline gap-3">
								<span
									className="pp-serif text-3xl text-stone-900"
									style={{ fontWeight: 600 }}
								>
									{formattedPrice}
								</span>
								{fields.taxRate != null && (
									<span className="text-xs text-stone-400">
										+ {fields.taxRate}% tax
									</span>
								)}
							</div>

							<Separator className="bg-stone-200" />

							{/* Description */}
							{fields.description && (
								<p className="text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">
									{fields.description}
								</p>
							)}

							{/* Tags */}
							{fields.tags && fields.tags.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{fields.tags.map((tag) => (
										<span
											key={tag}
											className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600"
										>
											{tag}
										</span>
									))}
								</div>
							)}

							{/* SKU / Barcode */}
							{(fields.sku || fields.barcode) && (
								<div className="space-y-1.5 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3">
									{fields.sku && (
										<div className="flex items-center justify-between text-xs">
											<span className="uppercase tracking-wide font-medium text-stone-400">
												SKU
											</span>
											<span className="font-mono text-stone-700">
												{fields.sku}
											</span>
										</div>
									)}
									{fields.barcode && (
										<div className="flex items-center justify-between text-xs">
											<span className="uppercase tracking-wide font-medium text-stone-400">
												Barcode
											</span>
											<span className="font-mono text-stone-700">
												{fields.barcode}
											</span>
										</div>
									)}
								</div>
							)}

							{/* Metafields */}
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
													<p className="text-xs text-stone-400 leading-relaxed">
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

					{/* ── Specifications ── */}
					{hasSpecs && (
						<>
							<Separator className="my-10 sm:my-14 bg-stone-200" />
							<div className="pp-fade pp-fade-2 space-y-5">
								<h2
									className="pp-serif text-2xl text-stone-900"
									style={{ fontWeight: 400 }}
								>
									Specifications
								</h2>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
									{fields.weight != null && (
										<div className="rounded-xl border border-stone-200 bg-white p-4">
											<div className="flex items-center gap-1.5 mb-2">
												<Weight className="h-3.5 w-3.5 text-stone-400" />
												<span className="text-xs font-medium uppercase tracking-wide text-stone-400">
													Weight
												</span>
											</div>
											<p className="text-sm font-medium text-stone-800">
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
														<span className="text-xs font-medium uppercase tracking-wide text-stone-400">
															Length
														</span>
													</div>
													<p className="text-sm font-medium text-stone-800">
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
														<span className="text-xs font-medium uppercase tracking-wide text-stone-400">
															Width
														</span>
													</div>
													<p className="text-sm font-medium text-stone-800">
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
														<span className="text-xs font-medium uppercase tracking-wide text-stone-400">
															Height
														</span>
													</div>
													<p className="text-sm font-medium text-stone-800">
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

					{/* ── QR Code ── */}
					{qrValue && (
						<>
							<Separator className="my-10 sm:my-14 bg-stone-200" />
							<div className="pp-fade pp-fade-3 flex items-start gap-5">
								{/* QR image — fixed size with white quiet zone, never cropped */}
								<a
									href={qrDownloadUrl}
									target="_blank"
									rel="noopener noreferrer"
									download={`${fields.name}-qr-client.png`}
									title="Download QR code"
									className="shrink-0 border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
								>
									<div className="h-48 w-48 bg-white grid place-items-center">
										<QRCodeSVG
											value={qrValue}
											size={192}
											level="M"
											marginSize={0}
											title="Product QR code"
										/>
									</div>
								</a>
								<div className="space-y-1 pt-1">
									<div className="flex items-center gap-1.5">
										<QrCode className="h-3.5 w-3.5 text-stone-400" />
										<span className="text-xs font-medium uppercase tracking-wide text-stone-400">
											QR Code
										</span>
									</div>
									<p className="text-sm text-stone-700">
										Point your camera at this code to open
										this page.
									</p>
									<a
										href={qrDownloadUrl}
										target="_blank"
										rel="noopener noreferrer"
										download={`${fields.name}-qr-client.png`}
										title="Download QR code"
                    className="pp-underline-link text-stone-400"
									>
										<p className="text-xs">
											Click to download as PNG.
										</p>
									</a>
									{data.product.qr?.assetUrl && (
										<a
											href={data.product.qr.assetUrl}
											target="_blank"
											rel="noopener noreferrer"
											download={`${fields.name}-qr-server.png`}
											title="Download stored QR asset"
											className="pp-underline-link text-stone-400"
										>
											<p className="text-xs">
												Download stored server PNG.
											</p>
										</a>
									)}
								</div>
							</div>
						</>
					)}

					<div className="mt-16 pb-8 flex items-center justify-center gap-2 text-xs text-stone-300">
						<span>{organization.name}</span>
						<span>·</span>
						<span>Powered by</span>
						<a
							href="https://financely.app"
							target="_blank"
							rel="noopener noreferrer"
						>
							<img
								src="/financely-logo.svg"
								alt="Financely"
								className="h-3.5"
							/>
						</a>
					</div>
				</main>
			</div>
		</>
	);
}
