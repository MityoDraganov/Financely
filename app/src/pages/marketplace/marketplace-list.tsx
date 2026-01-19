import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMarketplaceTemplates } from "@/hooks/repository-hooks/use-marketplace-templates";
import { TemplateCard } from "@/components/marketplace/template-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Search, Plus } from "lucide-react";

export default function MarketplaceListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<"all" | "invoice" | "email">("all");
  const [sort, setSort] = useState<"popular" | "newest" | "rating">("popular");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: templates, isLoading, error } = useMarketplaceTemplates({
    type: typeFilter === "all" ? undefined : typeFilter,
    search: search || undefined,
    sort,
  });

  console.log("Error:", error);

  const total = templates?.length || 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="h-8 w-8" />
            {t("marketplace.title") || "Template Marketplace"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("marketplace.subtitle") || "Discover and download professional templates"}
          </p>
        </div>
        <Button onClick={() => navigate("/marketplace/contributor")}>
          <Plus className="h-4 w-4 mr-2" />
          {t("marketplace.shareTemplate") || "Share Your Template"}
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <TabsList>
            <TabsTrigger value="all">{t("marketplace.filters.all") || "All"}</TabsTrigger>
            <TabsTrigger value="invoice">
              {t("marketplace.filters.invoice") || "Invoice Templates"}
            </TabsTrigger>
            <TabsTrigger value="email">
              {t("marketplace.filters.email") || "Email Templates"}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("marketplace.searchPlaceholder") || "Search templates..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">
                {t("marketplace.sort.popular") || "Most Popular"}
              </SelectItem>
              <SelectItem value="newest">{t("marketplace.sort.newest") || "Newest"}</SelectItem>
              <SelectItem value="rating">
                {t("marketplace.sort.rating") || "Highest Rated"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {t("marketplace.noTemplates") || "No templates found"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
