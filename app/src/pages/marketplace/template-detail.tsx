import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMarketplaceTemplate } from "@/hooks/repository-hooks/use-marketplace-templates";
import { useMarketplaceTemplateVersions } from "@/hooks/repository-hooks/use-marketplace-template-versions";
import { useAddMarketplaceTemplate } from "@/hooks/use-add-marketplace-template";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useIsMarketplaceTemplateAdded } from "@/hooks/use-is-marketplace-template-added";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { usePublishMarketplaceTemplateVersion } from "@/hooks/use-publish-marketplace-template-version";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { ReviewSection } from "@/components/marketplace/review-section";
import { MarketplaceInvoicePreviewCanvas } from "@/components/marketplace/marketplace-invoice-preview-canvas";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ArrowLeft,
	Download,
	Star,
	Check,
	Sparkles,
	Globe,
	Tag,
	Calendar,
	Hash,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmailTemplateData, TemplateData } from "@/core";
import { getDefaultPrintMarginsPx } from "@/utils/print-margins";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function TemplateDetailPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const { data: template, isLoading } = useMarketplaceTemplate(id);
	const {
		data: templateVersions = [],
		isLoading: isLoadingTemplateVersions,
	} = useMarketplaceTemplateVersions(template?.id);
	const { data: currentOrganization } = useCurrentOrganization();
	const authUser = useFirebaseAuthUser();
	const queryClient = useQueryClient();
	const addTemplate = useAddMarketplaceTemplate();
	const publishTemplateVersion = usePublishMarketplaceTemplateVersion();
	const [isAdding, setIsAdding] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [changelog, setChangelog] = useState("");
	const isAdded = useIsMarketplaceTemplateAdded(
		template,
		currentOrganization?.id,
	);

	const handleAddTemplate = async () => {
		if (!currentOrganization?.id || !id || !template) return;
		setIsAdding(true);
		try {
			await addTemplate.mutateAsync({
				templateId: id,
				orgId: currentOrganization.id,
				templateType: template.type,
			});
		} finally {
			setIsAdding(false);
		}
	};

	/* ── Loading ── */
	if (isLoading) {
		return (
			<div className="min-h-screen" style={{ background: "#f5f5f3" }}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
					<Skeleton className="h-6 w-40 rounded-lg" />
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
						<div className="lg:col-span-2 space-y-6">
							<Skeleton className="h-56 rounded-2xl" />
							<Skeleton className="h-72 rounded-2xl" />
						</div>
						<Skeleton className="h-64 rounded-2xl" />
					</div>
				</div>
			</div>
		);
	}

	/* ── Not found ── */
	if (!template) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "#f5f5f3" }}
			>
				<div className="text-center">
					<p className="text-sm text-gray-500 mb-4">
						Template not found
					</p>
					<button
						onClick={() => navigate("/marketplace")}
						className="text-sm font-medium"
						style={{ color: "hsl(143,64%,24%)" }}
					>
						Back to Marketplace
					</button>
				</div>
			</div>
		);
	}

	const authorInitial = (
		template.isOfficial ? "F" : (template.authorName?.[0] ?? "?")
	).toUpperCase();
	const isPublisherOrAdmin = Boolean(
		authUser &&
			(authUser.isTrueAdmin || template.authorId === authUser.uid),
	);
	const isPublisherView =
		isPublisherOrAdmin && searchParams.get("view") === "publisher";
	const hasLockedSource = Boolean(
		template.sourceTemplateId && template.sourceOrgId,
	);

	const handleViewModeChange = (mode: "publisher" | "public") => {
		const next = new URLSearchParams(searchParams);
		next.set("view", mode);
		setSearchParams(next, { replace: true });
	};

	const invalidateMarketplaceQueries = () => {
		queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates"] });
		queryClient.invalidateQueries({
			queryKey: ["marketplaceTemplates", template.id],
		});
		queryClient.invalidateQueries({
			queryKey: ["marketplaceTemplates", "submissions"],
			exact: false,
		});
	};

	const handleTogglePublishStatus = async () => {
		if (!template || !isPublisherOrAdmin || isUpdatingStatus) return;
		const repository = repositoryHost.getMarketplaceTemplatesRepository(
			serviceHost.getDatabaseService(),
		);
		const nextStatus =
			template.status === "published" ? "unpublished" : "published";
		setIsUpdatingStatus(true);
		try {
			await repository.update({
				id: template.id,
				data: {
					status: nextStatus,
					...(nextStatus === "published"
						? { publishedAt: new Date().toISOString() }
						: {}),
				},
			});
			invalidateMarketplaceQueries();
			toast.success(
				nextStatus === "published"
					? "Listing published successfully"
					: "Listing unpublished successfully",
			);
		} catch (error) {
			toast.error("Failed to update listing status", {
				description:
					error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsUpdatingStatus(false);
		}
	};

	const handleDeleteListing = async () => {
		if (!template || !isPublisherOrAdmin || isDeleting) return;
		if (
			!confirm(
				`Delete "${template.title}" from marketplace? This action cannot be undone.`,
			)
		)
			return;
		const repository = repositoryHost.getMarketplaceTemplatesRepository(
			serviceHost.getDatabaseService(),
		);
		setIsDeleting(true);
		try {
			await repository.delete({ id: template.id });
			invalidateMarketplaceQueries();
			toast.success("Listing deleted successfully");
			navigate("/marketplace/contributor");
		} catch (error) {
			toast.error("Failed to delete listing", {
				description:
					error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const handlePublishNewVersion = async () => {
		if (!template || !isPublisherOrAdmin || !hasLockedSource) {
			return;
		}

		await publishTemplateVersion.mutateAsync({
			marketplaceTemplateId: template.id,
			changelog: changelog.trim() || undefined,
		});

		setChangelog("");
	};

	const invoiceTemplateForPreview = (() => {
		if (template.type !== "invoice") return null;
		if (
			!template.templateContent ||
			typeof template.templateContent !== "object"
		)
			return null;
		try {
			const content = template.templateContent as TemplateData;
			if (!Array.isArray(content.elements)) return null;
			return {
				...content,
				id: template.id,
				elements: content.elements,
				pageSize: content.pageSize || "A4",
				brand: content.brand || {
					fonts: [],
					colors: {
						primary: "#000000",
						secondary: "#666666",
						accent: "#000000",
					},
					margins: getDefaultPrintMarginsPx(),
				},
			};
		} catch {
			return null;
		}
	})();

	const canRenderEmailPreview = (() => {
		if (template.type !== "email") return false;
		if (
			!template.templateContent ||
			typeof template.templateContent !== "object"
		)
			return false;
		const content = template.templateContent as EmailTemplateData;
		return (
			typeof content.htmlContent === "string" &&
			content.htmlContent.length > 0
		);
	})();

	return (
		<div className="min-h-screen" style={{ background: "#f5f5f3" }}>
			{/* ── Top nav bar ── */}
			<div className="bg-white border-b border-gray-100">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4 min-w-0">
						<button
							onClick={() => navigate("/marketplace")}
							className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium shrink-0"
						>
							<ArrowLeft className="h-4 w-4" />
							Marketplace
						</button>
						<span className="text-gray-200 shrink-0">/</span>
						<span className="text-sm text-gray-900 font-medium truncate">
							{template.title}
						</span>
					</div>
					{isPublisherOrAdmin && (
						<div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shrink-0">
							<button
								type="button"
								onClick={() =>
									handleViewModeChange("publisher")
								}
								className={cn(
									"px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
									isPublisherView
										? "bg-gray-900 text-white"
										: "text-gray-500 hover:text-gray-700",
								)}
							>
								Publisher View
							</button>
							<button
								type="button"
								onClick={() => handleViewModeChange("public")}
								className={cn(
									"px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
									!isPublisherView
										? "bg-gray-900 text-white"
										: "text-gray-500 hover:text-gray-700",
								)}
							>
								Public View
							</button>
						</div>
					)}
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* ── Main content ── */}
					<div className="lg:col-span-2 space-y-6">
						{/* Header card */}
						<div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
							{/* Badges row */}
							<div className="flex items-center gap-2 flex-wrap">
								<span
									className={cn(
										"inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
										template.type === "invoice"
											? "bg-blue-50 text-blue-700"
											: "bg-violet-50 text-violet-700",
									)}
								>
									<span
										className={cn(
											"w-1.5 h-1.5 rounded-full shrink-0",
											template.type === "invoice"
												? "bg-blue-500"
												: "bg-violet-500",
										)}
									/>
									{template.type === "invoice"
										? "Invoice Template"
										: "Email Template"}
								</span>
								{template.category && (
									<span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
										{template.category}
									</span>
								)}
								{template.language && (
									<span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
										{template.language}
									</span>
								)}
								{template.isFeatured && (
									<span className="px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold flex items-center gap-1">
										<Sparkles className="h-2.5 w-2.5" />
										Featured
									</span>
								)}
								{template.isOfficial && (
									<span
										className="px-2.5 py-1 rounded-full text-white text-[10px] font-bold"
										style={{
											background: "hsl(143,64%,22%)",
										}}
									>
										Official
									</span>
								)}
							</div>

							{/* Title */}
							<div>
								<h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-2">
									{template.title}
								</h1>
								{template.description && (
									<p className="text-sm text-gray-500 leading-relaxed">
										{template.description}
									</p>
								)}
							</div>

							{/* Stats row */}
							<div className="flex items-center gap-6 pt-1">
								{template.ratingCount > 0 && (
									<div className="flex items-center gap-2">
										<div className="flex">
											{Array.from({ length: 5 }).map(
												(_, i) => (
													<Star
														key={i}
														className={cn(
															"h-3.5 w-3.5",
															i <
																Math.round(
																	template.ratingAverage,
																)
																? "fill-amber-400 text-amber-400"
																: "fill-gray-200 text-gray-200",
														)}
													/>
												),
											)}
										</div>
										<span className="text-sm font-semibold text-gray-800">
											{template.ratingAverage.toFixed(1)}
										</span>
										<span className="text-xs text-gray-400">
											({template.ratingCount}{" "}
											{template.ratingCount === 1
												? "review"
												: "reviews"}
											)
										</span>
									</div>
								)}
								<div className="flex items-center gap-1.5 text-sm text-gray-500">
									<Download className="h-3.5 w-3.5 shrink-0" />
									<span>
										{template.downloadCount.toLocaleString()}{" "}
										downloads
									</span>
								</div>
							</div>

							{/* Author */}
							<div className="flex items-center gap-2.5 pt-1 border-t border-gray-100">
								<div
									className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
									style={{ background: "hsl(143,64%,30%)" }}
								>
									{authorInitial}
								</div>
								<div>
									<span className="text-xs text-gray-400">
										by{" "}
									</span>
									<span className="text-xs font-semibold text-gray-700">
										{template.isOfficial
											? "Financely"
											: template.authorName}
									</span>
									{template.publishedAt && (
										<span className="text-xs text-gray-400 ml-2">
											·{" "}
											{new Date(
												template.publishedAt,
											).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									)}
								</div>
							</div>
						</div>

						{/* Preview card */}
						<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
								<h2 className="text-sm font-semibold text-gray-800">
									Template Preview
								</h2>
								{template.type !== "invoice" && (
									<span className="text-[11px] text-gray-400 font-medium">
										Email Layout
									</span>
								)}
							</div>
							<div className="bg-gray-50 p-4 sm:p-6">
								<div className="w-full rounded-xl border border-gray-200 bg-white overflow-hidden">
									{template.type === "invoice" &&
									invoiceTemplateForPreview ? (
										<MarketplaceInvoicePreviewCanvas
											template={invoiceTemplateForPreview}
											mode="original"
											organization={
												currentOrganization ?? undefined
											}
										/>
									) : template.type === "email" &&
									  canRenderEmailPreview ? (
										<iframe
											srcDoc={
												(
													template.templateContent as EmailTemplateData
												).htmlContent || ""
											}
											className="w-full border-0 bg-white"
											style={{ minHeight: 700 }}
											title={`Preview of ${template.title}`}
											sandbox="allow-same-origin"
										/>
									) : template.previewImages &&
									  template.previewImages.length > 0 ? (
										<img
											src={template.previewImages[0]}
											alt={template.title}
											className="w-full h-auto object-contain bg-white"
										/>
									) : (
										<div className="h-72 flex items-center justify-center text-sm text-gray-400">
											Preview unavailable for this
											template
										</div>
									)}
								</div>
							</div>
						</div>

						{/* Details card */}
						<div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
							<h2 className="text-sm font-semibold text-gray-800">
								Details
							</h2>
							<dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{[
									{
										icon: Hash,
										label: "Type",
										value:
											template.type === "invoice"
												? "Invoice Template"
												: "Email Template",
									},
									template.category && {
										icon: Tag,
										label: "Category",
										value: template.category,
									},
									template.language && {
										icon: Globe,
										label: "Language",
										value: template.language,
									},
									template.country && {
										icon: Globe,
										label: "Country",
										value: template.country,
									},
									{
										icon: Hash,
										label: "Version",
										value: template.version,
									},
									template.publishedAt && {
										icon: Calendar,
										label: "Published",
										value: new Date(
											template.publishedAt,
										).toLocaleDateString("en-US", {
											month: "long",
											day: "numeric",
											year: "numeric",
										}),
									},
								]
									.filter(Boolean)
									.map((item) => {
										if (!item) return null;
										const {
											icon: Icon,
											label,
											value,
										} = item as {
											icon: typeof Hash;
											label: string;
											value: string;
										};
										return (
											<div
												key={label}
												className="flex items-start gap-3"
											>
												<div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
													<Icon className="h-3.5 w-3.5 text-gray-400" />
												</div>
												<div>
													<dt className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">
														{label}
													</dt>
													<dd className="text-sm font-medium text-gray-800">
														{value}
													</dd>
												</div>
											</div>
										);
									})}
							</dl>

							{template.tags && template.tags.length > 0 && (
								<div className="pt-4 border-t border-gray-100">
									<p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-3">
										Tags
									</p>
									<div className="flex flex-wrap gap-2">
										{template.tags.map((tag) => (
											<Badge
												key={tag}
												variant="outline"
												className="text-[11px] rounded-full px-2.5 py-0.5 font-medium border-gray-200 text-gray-600"
											>
												{tag}
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>

						{isPublisherView && (
							<div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
								<div className="flex items-center justify-between gap-3">
									<h2 className="text-sm font-semibold text-gray-800">
										Versioning
									</h2>
									<span className="text-xs font-semibold text-gray-500">
										Current: v{template.version}
									</span>
								</div>

								<div className="space-y-1">
									<label className="text-xs text-gray-500 font-medium">
										Change Notes (optional)
									</label>
									<input
										value={changelog}
										onChange={(event) =>
											setChangelog(event.target.value)
										}
										placeholder="e.g. Updated footer and payment terms"
										className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800"
									/>
									<p className="text-[11px] text-gray-400">
										Source template is locked to this
										listing and cannot be changed between
										versions.
									</p>
								</div>

								<div className="flex justify-end">
									<button
										type="button"
										onClick={handlePublishNewVersion}
										disabled={
											publishTemplateVersion.isPending ||
											!hasLockedSource
										}
										className={cn(
											"h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all",
											publishTemplateVersion.isPending ||
												!hasLockedSource
												? "bg-gray-400 cursor-not-allowed"
												: "active:scale-[0.98]",
										)}
										style={
											!publishTemplateVersion.isPending &&
											hasLockedSource
												? {
														background:
															"hsl(143,64%,22%)",
													}
												: undefined
										}
									>
										{publishTemplateVersion.isPending
											? "Publishing version..."
											: "Publish New Version"}
									</button>
								</div>
								{!hasLockedSource && (
									<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
										This listing was created before source
										locking. Create a new listing to enable
										publishing versions.
									</p>
								)}

								<div className="pt-2 border-t border-gray-100 space-y-2">
									<p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
										Version History
									</p>
									{isLoadingTemplateVersions ? (
										<p className="text-sm text-gray-400">
											Loading versions...
										</p>
									) : templateVersions.length === 0 ? (
										<p className="text-sm text-gray-400">
											No version history yet.
										</p>
									) : (
										<div className="space-y-2">
											{templateVersions.map(
												(versionItem) => (
													<div
														key={versionItem.id}
														className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2"
													>
														<div>
															<p className="text-sm font-semibold text-gray-800">
																v
																{
																	versionItem.version
																}
															</p>
															<p className="text-xs text-gray-500">
																{new Date(
																	versionItem.publishedAt,
																).toLocaleDateString(
																	"en-US",
																	{
																		month: "short",
																		day: "numeric",
																		year: "numeric",
																	},
																)}
															</p>
														</div>
														<p className="text-xs text-gray-600 text-right max-w-[60%]">
															{versionItem.changelog ||
																"No change notes"}
														</p>
													</div>
												),
											)}
										</div>
									)}
								</div>
							</div>
						)}

						{/* Reviews */}
						{!isPublisherView && (
							<ReviewSection templateId={template.id} />
						)}
					</div>

					{/* ── Sidebar ── */}
					<div className="lg:col-span-1">
						<div className="sticky top-6 space-y-4">
							{/* CTA card */}
							<div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
								{/* Card header accent */}
								<div
									className="h-1.5 w-full"
									style={{
										background: isPublisherView
											? "linear-gradient(90deg, hsl(204,80%,42%), hsl(176,70%,34%))"
											: isAdded
												? "hsl(143,64%,30%)"
												: "linear-gradient(90deg, hsl(143,64%,22%), hsl(158,50%,28%))",
									}}
								/>
								<div className="p-5 space-y-5">
									<div>
										<p className="text-xs text-gray-400 mb-1 font-medium">
											Template
										</p>
										<p className="text-base font-bold text-gray-900 leading-snug">
											{template.title}
										</p>
									</div>

									{/* Author mini */}
									<div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl">
										<div
											className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
											style={{
												background: "hsl(143,64%,30%)",
											}}
										>
											{authorInitial}
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-800">
												{template.isOfficial
													? "Financely"
													: template.authorName}
											</p>
											{template.publishedAt && (
												<p className="text-[10px] text-gray-400">
													Published{" "}
													{new Date(
														template.publishedAt,
													).toLocaleDateString(
														"en-US",
														{
															month: "short",
															year: "numeric",
														},
													)}
												</p>
											)}
										</div>
									</div>

									{/* Stats */}
									<div className="grid grid-cols-2 gap-3">
										<div className="p-3 bg-gray-50 rounded-xl text-center">
											<p className="text-lg font-bold text-gray-900">
												{template.downloadCount.toLocaleString()}
											</p>
											<p className="text-[10px] text-gray-400 font-medium mt-0.5">
												Downloads
											</p>
										</div>
										<div className="p-3 bg-gray-50 rounded-xl text-center">
											<p className="text-lg font-bold text-gray-900">
												{template.ratingCount > 0
													? template.ratingAverage.toFixed(
															1,
														)
													: "—"}
											</p>
											<p className="text-[10px] text-gray-400 font-medium mt-0.5">
												{template.ratingCount > 0
													? "Avg rating"
													: "No reviews"}
											</p>
										</div>
									</div>

									{isPublisherView ? (
										<div className="space-y-2.5">
											<button
												type="button"
												onClick={
													handleTogglePublishStatus
												}
												disabled={isUpdatingStatus}
												className={cn(
													"w-full h-10 rounded-xl text-sm font-semibold transition-colors",
													template.status ===
														"published"
														? "border border-amber-200 text-amber-700 hover:bg-amber-50"
														: "border border-emerald-200 text-emerald-700 hover:bg-emerald-50",
													isUpdatingStatus &&
														"opacity-60 cursor-not-allowed",
												)}
											>
												{isUpdatingStatus
													? "Updating..."
													: template.status ===
														  "published"
														? "Unpublish Listing"
														: "Publish Listing"}
											</button>
											<button
												type="button"
												onClick={handleDeleteListing}
												disabled={isDeleting}
												className={cn(
													"w-full h-10 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors",
													isDeleting &&
														"opacity-60 cursor-not-allowed",
												)}
											>
												{isDeleting
													? "Deleting..."
													: "Delete Listing"}
											</button>
										</div>
									) : (
										<>
											{/* Action button */}
											<button
												onClick={handleAddTemplate}
												disabled={
													isAdding ||
													!currentOrganization?.id ||
													isAdded
												}
												className={cn(
													"w-full h-11 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2",
													isAdded
														? "bg-green-50 text-green-700 border border-green-200 cursor-default"
														: !currentOrganization?.id
															? "bg-gray-100 text-gray-400 cursor-not-allowed"
															: "text-white active:scale-[0.98]",
												)}
												style={
													!isAdded &&
													currentOrganization?.id
														? {
																background:
																	"linear-gradient(135deg, hsl(143,64%,22%) 0%, hsl(158,50%,26%) 100%)",
															}
														: undefined
												}
											>
												{isAdded ? (
													<>
														<Check className="h-4 w-4" />
														Added to Organization
													</>
												) : isAdding ? (
													"Adding…"
												) : (
													<>
														<Download className="h-4 w-4" />
														Add to My Organization
													</>
												)}
											</button>

											{!currentOrganization?.id && (
												<p className="text-[11px] text-gray-400 text-center">
													Select an organization to
													add this template
												</p>
											)}
										</>
									)}
								</div>
							</div>

							{/* Version info card */}
							<div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
								<p className="text-[11px] text-gray-400 font-medium uppercase tracking-widest">
									Info
								</p>
								<div className="space-y-2.5">
									{[
										{
											label: "Version",
											value: template.version,
										},
										isPublisherView && {
											label: "Status",
											value: template.status,
										},
										{
											label: "Type",
											value:
												template.type === "invoice"
													? "Invoice"
													: "Email",
										},
										template.language && {
											label: "Language",
											value: template.language,
										},
										template.country && {
											label: "Country",
											value: template.country,
										},
									]
										.filter(Boolean)
										.map((item) => {
											if (!item) return null;
											const { label, value } = item as {
												label: string;
												value: string;
											};
											return (
												<div
													key={label}
													className="flex items-center justify-between"
												>
													<span className="text-xs text-gray-400">
														{label}
													</span>
													<span className="text-xs font-semibold text-gray-700">
														{value}
													</span>
												</div>
											);
										})}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
