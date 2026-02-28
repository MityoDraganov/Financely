import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMarketplaceTemplates } from "@/hooks/repository-hooks/use-marketplace-templates";
import { TemplateCard } from "@/components/marketplace/template-card";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Search,
	Plus,
	FileText,
	Mail,
	LayoutGrid,
	TrendingUp,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";

export default function MarketplaceListPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "email">(
		"all",
	);
	const [sort, setSort] = useState<"popular" | "newest" | "rating">(
		"popular",
	);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 20;

	const { data: result, isLoading } = useMarketplaceTemplates({
		type: typeFilter === "all" ? undefined : typeFilter,
		search: search || undefined,
		sort,
		page,
		pageSize,
	});

	const templates = result?.templates || [];
	const hasNextPage = result?.hasNextPage || false;
	const hasPreviousPage = result?.hasPreviousPage || false;

	return (
		<div className="min-h-screen" style={{ background: "#f5f5f3" }}>
			{/* ── Hero Section ── */}
			<div
				className="relative overflow-hidden"
				style={{
					background:
						"linear-gradient(135deg, hsl(143,64%,13%) 0%, hsl(143,64%,20%) 55%, hsl(158,50%,18%) 100%)",
				}}
			>
				{/* Dot grid texture */}
				<div
					className="absolute inset-0 opacity-[0.07]"
					style={{
						backgroundImage:
							"radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
						backgroundSize: "28px 28px",
					}}
				/>
				{/* Ambient glows */}
				<div
					className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full pointer-events-none"
					style={{
						background:
							"radial-gradient(circle, hsl(143,70%,45%) 0%, transparent 70%)",
						opacity: 0.12,
					}}
				/>
				<div
					className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full pointer-events-none"
					style={{
						background:
							"radial-gradient(circle, hsl(160,55%,35%) 0%, transparent 70%)",
						opacity: 0.1,
					}}
				/>

				<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
					<div className="flex flex-col items-center text-center gap-5 max-w-2xl mx-auto">
						<h1 className="text-3xl sm:text-[2.6rem] lg:text-5xl font-bold text-white leading-[1.15] tracking-tight">
							{t("marketplace.title") ||
								"Discover Professional Templates"}
						</h1>
						<p className="text-sm sm:text-base text-white/60 max-w-md leading-relaxed">
							{t("marketplace.subtitle") ||
								"Curated invoice and email templates built by the Financely community."}
						</p>

						{/* Hero Search */}
						<div className="w-full max-w-lg mt-1">
							<div className="relative flex items-center bg-white rounded-xl shadow-2xl shadow-black/20 overflow-hidden border border-white/10">
								<Search className="absolute left-4 h-4 w-4 text-gray-400 pointer-events-none z-10 shrink-0" />
								<input
									type="text"
									placeholder={
										t("marketplace.searchPlaceholder") ||
										"Search templates…"
									}
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setPage(1);
									}}
									className="flex-1 pl-11 pr-4 py-3.5 text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
								/>
								<button
									onClick={() =>
										navigate("/marketplace/contributor")
									}
									className="flex items-center gap-1.5 px-4 py-2 mr-1.5 rounded-lg text-white text-xs font-semibold transition-colors shrink-0"
									style={{ background: "hsl(143,64%,22%)" }}
									onMouseEnter={(e) =>
										((
											e.currentTarget as HTMLButtonElement
										).style.background = "hsl(143,64%,18%)")
									}
									onMouseLeave={(e) =>
										((
											e.currentTarget as HTMLButtonElement
										).style.background = "hsl(143,64%,22%)")
									}
								>
									<Plus className="h-3.5 w-3.5" />
									<span className="hidden sm:inline">
										{t("marketplace.shareTemplate") ||
											"Share Template"}
									</span>
								</button>
							</div>
						</div>
						{/* 
            Social proof
            <div className="flex items-center gap-5 text-white/40 text-[11px] tracking-wide">
              <span>500+ Templates</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>50K+ Downloads</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Community Powered</span>
            </div> 
            */}
					</div>
				</div>
			</div>

			{/* ── Sticky Filter Bar ── */}
			<div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between gap-4 py-2.5">
						{/* Type filter segments */}
						<div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-xl">
							{(
								[
									{
										value: "all",
										icon: LayoutGrid,
										label: "All",
									},
									{
										value: "invoice",
										icon: FileText,
										label: "Invoices",
									},
									{
										value: "email",
										icon: Mail,
										label: "Emails",
									},
								] as const
							).map(({ value, icon: Icon, label }) => (
								<button
									key={value}
									onClick={() => {
										setTypeFilter(value);
										setPage(1);
									}}
									className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
										typeFilter === value
											? "bg-white shadow text-gray-900"
											: "text-gray-500 hover:text-gray-700"
									}`}
								>
									<Icon className="h-3.5 w-3.5 shrink-0" />
									{label}
								</button>
							))}
						</div>

						{/* Sort select */}
						<Select
							value={sort}
							onValueChange={(v) => {
								setSort(v as typeof sort);
								setPage(1);
							}}
						>
							<SelectTrigger className="w-[150px] h-8 text-xs border-gray-200 bg-white gap-1.5">
								<TrendingUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="popular">
									{t("marketplace.sort.popular") ||
										"Most Popular"}
								</SelectItem>
								<SelectItem value="newest">
									{t("marketplace.sort.newest") || "Newest"}
								</SelectItem>
								<SelectItem value="rating">
									{t("marketplace.sort.rating") ||
										"Highest Rated"}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* ── Main Content ── */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
				{isLoading ? (
					<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton
								key={i}
								className="h-[360px] rounded-2xl"
							/>
						))}
					</div>
				) : !templates || templates.length === 0 ? (
					/* ── Empty State ── */
					<div className="flex flex-col items-center justify-center py-28 text-center">
						<div
							className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
							style={{ background: "hsl(143,64%,24%,0.07)" }}
						>
							<Search
								className="h-8 w-8"
								style={{ color: "hsl(143,64%,24%)" }}
							/>
						</div>
						<h3 className="text-base font-semibold text-gray-900 mb-2">
							{t("marketplace.noTemplates") ||
								"No templates found"}
						</h3>
						<p className="text-sm text-gray-400 max-w-xs">
							{search
								? `No results for "${search}". Try different keywords.`
								: "Check back later — new templates are added regularly."}
						</p>
						{search && (
							<button
								onClick={() => setSearch("")}
								className="mt-4 text-sm font-medium transition-colors"
								style={{ color: "hsl(143,64%,24%)" }}
							>
								Clear search
							</button>
						)}
					</div>
				) : (
					<>
						{/* Results meta */}
						<div className="flex items-center justify-between">
							<p className="text-xs text-gray-400">
								{templates.length} template
								{templates.length !== 1 ? "s" : ""}
								{search && (
									<>
										{" "}
										for{" "}
										<strong className="text-gray-600 font-medium">
											"{search}"
										</strong>
									</>
								)}
							</p>
						</div>

						{/* Grid */}
						<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
							{templates.map((template) => (
								<TemplateCard
									key={template.id}
									template={template}
								/>
							))}
						</div>

						{/* Pagination */}
						{(hasNextPage || hasPreviousPage) && (
							<div className="flex items-center justify-center gap-2 pt-6">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setPage((p) => Math.max(1, p - 1));
										window.scrollTo({
											top: 0,
											behavior: "smooth",
										});
									}}
									disabled={!hasPreviousPage}
									className="h-9 w-9 p-0 rounded-lg border-gray-200"
								>
									<ChevronLeft className="h-4 w-4" />
								</Button>

								<span
									className="h-9 w-9 flex items-center justify-center rounded-lg text-sm font-semibold text-white"
									style={{ background: "hsl(143,64%,24%)" }}
								>
									{page}
								</span>

								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setPage((p) => p + 1);
										window.scrollTo({
											top: 0,
											behavior: "smooth",
										});
									}}
									disabled={!hasNextPage}
									className="h-9 w-9 p-0 rounded-lg border-gray-200"
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
