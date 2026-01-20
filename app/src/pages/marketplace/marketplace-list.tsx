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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
              <Store className="h-7 w-7 sm:h-8 sm:w-8" />
              {t("marketplace.title") || "Template Marketplace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("marketplace.subtitle") || "Discover and download professional templates"}
            </p>
          </div>
          <Button 
            onClick={() => navigate("/marketplace/contributor")}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("marketplace.shareTemplate") || "Share Your Template"}
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs 
            value={typeFilter} 
            onValueChange={(v) => {
              setTypeFilter(v as typeof typeFilter);
              setPage(1); // Reset to first page on filter change
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
              <TabsTrigger value="all" className="text-sm">
                {t("marketplace.filters.all") || "All"}
              </TabsTrigger>
              <TabsTrigger value="invoice" className="text-sm">
                {t("marketplace.filters.invoice") || "Invoice Templates"}
              </TabsTrigger>
              <TabsTrigger value="email" className="text-sm">
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
                  setPage(1); // Reset to first page on search
                }}
                className="pl-9 text-sm"
              />
            </div>
            <Select 
              value={sort} 
              onValueChange={(v) => {
                setSort(v as typeof sort);
                setPage(1); // Reset to first page on sort change
              }}
            >
              <SelectTrigger className="w-[140px] sm:w-[180px] text-sm">
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
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-[400px] rounded-2xl" />
            ))}
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="text-center py-16">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">
              {t("marketplace.noTemplates") || "No templates found"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>

            {/* Pagination */}
            {(hasNextPage || hasPreviousPage) && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!hasPreviousPage}
                >
                  {t("common.previous") || "Previous"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("common.page") || "Page"} {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPage((p) => p + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!hasNextPage}
                >
                  {t("common.next") || "Next"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
