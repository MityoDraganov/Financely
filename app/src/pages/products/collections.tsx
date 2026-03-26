import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { firebase } from "@/infrastructure/firebase";
import { useOrganizationContext } from "@/hooks/use-organization-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ExternalLink, Package } from "lucide-react";

type CollectionSummary = {
	slug: string;
	label: string;
	count: number;
};

function parseCollectionSummaries(raw: unknown): CollectionSummary[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.map((entry) => {
			const typed = entry as { slug?: unknown; label?: unknown; count?: unknown };
			const slug = typeof typed.slug === "string" ? typed.slug : "";
			const label = typeof typed.label === "string" ? typed.label : "";
			const count =
				typeof typed.count === "number" && Number.isFinite(typed.count) && typed.count >= 0
					? Math.floor(typed.count)
					: 0;
			if (!slug || !label) return null;
			return { slug, label, count };
		})
		.filter((e): e is CollectionSummary => e !== null);
}

export default function CollectionsPage() {
	const { t } = useTranslation();
	const { currentOrganization } = useOrganizationContext();

	const orgId = currentOrganization?.id;
	const orgSlug = currentOrganization?.settings?.publicPages?.orgSlug;

	const { data: collections = [], isLoading } = useQuery({
		queryKey: ["publicCatalogs", orgId],
		queryFn: async () => {
			if (!orgId) return [];
			const snap = await getDoc(doc(firebase.firestore, "publicCatalogs", orgId));
			if (!snap.exists()) return [];
			return parseCollectionSummaries(snap.data()?.collections);
		},
		enabled: !!orgId,
	});

	const displayedCollections = useMemo(
		() => collections.filter((c) => c.slug !== "uncategorized"),
		[collections]
	);

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
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
										<Package className="h-4 w-4 shrink-0" />
										<span>
											{collection.count}{" "}
											{collection.count === 1
												? t("collections.product")
												: t("collections.products")}
										</span>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
