import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, FileText, Mail, Eye, Star, StarOff, Sparkles, Rocket, Pencil, Palette } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminMarketplaceTemplates } from "@/hooks/admin/use-admin-marketplace-templates";
import { useAdminFeatureMarketplaceTemplate } from "@/hooks/admin/use-admin-approve-marketplace-template";
import { useAdminUnfeatureMarketplaceTemplate } from "@/hooks/admin/use-admin-reject-marketplace-template";
import {
  useAdminGenerateOfficialTemplatePack,
  type GenerateOfficialTemplatePackResult,
} from "@/hooks/admin/use-admin-generate-official-template-pack";
import { type PublishOfficialTemplatePackResult } from "@/hooks/admin/use-admin-publish-official-template-pack";
import { MarketplaceTemplate } from "@/core";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { QAReviewDialog } from "@/components/admin/QAReviewDialog";
import { MarketplaceTemplateEditDialog } from "@/components/admin/MarketplaceTemplateEditDialog";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 20;

type OfficialDraftQaState = "pass" | "warn" | "fail" | "unknown";

function resolveOfficialDraftQaState(template: MarketplaceTemplate): OfficialDraftQaState {
  const meta = template.officialGenerationMeta;
  if (!meta) return "unknown";
  if (!meta.hardPass) return "fail";
  return meta.qaWarnings.length > 0 ? "warn" : "pass";
}

export function AdminMarketplacePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFeatureConfirm, setShowFeatureConfirm] = useState(false);
  const [showUnfeatureConfirm, setShowUnfeatureConfirm] = useState(false);
  const [blueprintIdsRaw, setBlueprintIdsRaw] = useState("");
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [lastGenerationResult, setLastGenerationResult] =
    useState<GenerateOfficialTemplatePackResult | null>(null);
  const [lastPublishResult, setLastPublishResult] =
    useState<PublishOfficialTemplatePackResult | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<MarketplaceTemplate | null>(null);

  // QA Review state
  const [showQADialog, setShowQADialog] = useState(false);
  const [qaTemplateQueue, setQaTemplateQueue] = useState<MarketplaceTemplate[]>([]);

  const { data: templates, isLoading } = useAdminMarketplaceTemplates("published");
  const { data: draftTemplates, isLoading: isDraftTemplatesLoading } =
    useAdminMarketplaceTemplates("draft");
  const featureTemplate = useAdminFeatureMarketplaceTemplate();
  const unfeatureTemplate = useAdminUnfeatureMarketplaceTemplate();
  const generateOfficialTemplatePack = useAdminGenerateOfficialTemplatePack();

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!searchQuery) return templates;
    const searchLower = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.title?.toLowerCase().includes(searchLower) ||
        t.authorName?.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }, [templates, searchQuery]);

  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (searchQuery) setCurrentPage(1);
  }, [searchQuery]);

  const stats = useMemo(() => {
    if (!templates) return { total: 0, featured: 0 };
    return {
      total: templates.length,
      featured: templates.filter((t) => t.isFeatured).length,
    };
  }, [templates]);

  const officialDraftTemplates = useMemo(
    () => (draftTemplates || []).filter((t) => t.isOfficial),
    [draftTemplates]
  );

  const generatedTemplateIds = useMemo(
    () =>
      (lastGenerationResult?.results || [])
        .filter((r) => r.status === "ok")
        .map((r) => r.templateId)
        .filter((id): id is string => typeof id === "string"),
    [lastGenerationResult]
  );
  const officialDraftQaSummary = useMemo(() => {
    return officialDraftTemplates.reduce(
      (acc, template) => {
        const state = resolveOfficialDraftQaState(template);
        acc[state] += 1;
        return acc;
      },
      { pass: 0, warn: 0, fail: 0, unknown: 0 } as Record<OfficialDraftQaState, number>
    );
  }, [officialDraftTemplates]);

  const startQAReview = (templates: MarketplaceTemplate[]) => {
    if (templates.length === 0) {
      toast.info("No templates to review");
      return;
    }
    setQaTemplateQueue(templates);
    setShowQADialog(true);
  };

  const handleQADialogOpenChange = (nextOpen: boolean) => {
    setShowQADialog(nextOpen);
    if (!nextOpen) {
      // Clear reviewed draft queue once QA session is finished/closed.
      setQaTemplateQueue([]);
    }
  };

  const handleQAPublished = (result: PublishOfficialTemplatePackResult) => {
    setLastPublishResult(result);
    // Generated draft review list should reset after publish review flow completes.
    setLastGenerationResult(null);
    setQaTemplateQueue([]);
  };

  const parseBlueprintIds = () => {
    const ids = blueprintIdsRaw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return ids.length > 0 ? ids : undefined;
  };

  const handleGenerateOfficialPack = async (dryRun: boolean) => {
    try {
      const result = await generateOfficialTemplatePack.mutateAsync({
        dryRun,
        overwriteExisting,
        blueprintIds: parseBlueprintIds(),
      });
      setLastGenerationResult(result);
      setLastPublishResult(null);
    } catch {
      // handled by mutation hook
    }
  };

  const handleFeature = async () => {
    if (!selectedTemplate) return;
    try {
      await featureTemplate.mutateAsync({ templateId: selectedTemplate.id });
      setShowFeatureConfirm(false);
      setShowDetailDialog(false);
      setSelectedTemplate(null);
    } catch {
      // handled by hook
    }
  };

  const handleUnfeature = async () => {
    if (!selectedTemplate) return;
    try {
      await unfeatureTemplate.mutateAsync({ templateId: selectedTemplate.id });
      setShowUnfeatureConfirm(false);
      setShowDetailDialog(false);
      setSelectedTemplate(null);
    } catch {
      // handled by hook
    }
  };

  const openDetailDialog = (template: MarketplaceTemplate) => {
    setSelectedTemplate(template);
    setShowDetailDialog(true);
  };

  const canEditPublishedOfficialTemplate = (template: MarketplaceTemplate) =>
    template.isOfficial && template.status === "published";

  const openPublishedTemplateEditor = (template: MarketplaceTemplate) => {
    if (!canEditPublishedOfficialTemplate(template)) {
      toast.info("Only published official templates are editable here.");
      return;
    }
    navigate(`/marketplace/${template.id}/designer`);
  };

  const openPublishedTemplateMetadataEditor = (template: MarketplaceTemplate) => {
    if (!canEditPublishedOfficialTemplate(template)) {
      toast.info("Only published official templates are editable here.");
      return;
    }
    setTemplateToEdit(template);
  };

  const handleEditDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTemplateToEdit(null);
    }
  };

  const handleTemplateUpdated = (updatedTemplate: MarketplaceTemplate) => {
    setTemplateToEdit(updatedTemplate);
    setSelectedTemplate((current) =>
      current?.id === updatedTemplate.id ? updatedTemplate : current,
    );
  };

  const getTypeIcon = (type: string) => (type === "invoice" ? FileText : Mail);
  const getTypeBadgeVariant = (type: string) =>
    type === "invoice" ? ("default" as const) : ("secondary" as const);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and feature marketplace templates
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
            <div className="text-xs text-muted-foreground">published</div>
          </div>
          <Separator orientation="vertical" className="h-10" />
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-yellow-600">{stats.featured}</div>
            <div className="text-xs text-muted-foreground">featured</div>
          </div>
        </div>
      </div>

      {/* Official Template Pack Runner */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Official Template Pack Runner
          </CardTitle>
          <CardDescription>
            Generate official invoice/email templates and publish approved drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="blueprint-ids" className="text-sm">
                Blueprint IDs
                <span className="text-muted-foreground font-normal ml-1">(optional, comma-separated)</span>
              </Label>
              <Input
                id="blueprint-ids"
                value={blueprintIdsRaw}
                onChange={(e) => setBlueprintIdsRaw(e.target.value)}
                placeholder="official-eu-invoice-service-professional-en, ..."
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to generate the full official pack.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Overwrite existing</p>
                  <p className="text-xs text-muted-foreground">Creates next draft versions on rerun.</p>
                </div>
                <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateOfficialPack(true)}
              disabled={generateOfficialTemplatePack.isPending}
            >
              <Rocket className="h-4 w-4" />
              {generateOfficialTemplatePack.isPending ? "Running…" : "Dry-run Generate"}
            </Button>
            <Button
              size="sm"
              onClick={() => handleGenerateOfficialPack(false)}
              disabled={generateOfficialTemplatePack.isPending}
            >
              <Sparkles className="h-4 w-4" />
              {generateOfficialTemplatePack.isPending ? "Running…" : "Generate Draft Pack"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const templates = (draftTemplates || []).filter((t) =>
                  generatedTemplateIds.includes(t.id)
                );
                startQAReview(templates);
              }}
              disabled={generatedTemplateIds.length === 0}
            >
              <Eye className="h-4 w-4" />
              QA Review Generated ({generatedTemplateIds.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startQAReview(officialDraftTemplates)}
              disabled={isDraftTemplatesLoading || officialDraftTemplates.length === 0}
            >
              <Eye className="h-4 w-4" />
              Review All Official Drafts (
              {isDraftTemplatesLoading ? "…" : officialDraftTemplates.length})
            </Button>
          </div>

          {lastGenerationResult && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Generation Result
                    <span className="text-muted-foreground font-mono text-xs ml-2">
                      {lastGenerationResult.runId}
                    </span>
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>requested {lastGenerationResult.summary.requested}</span>
                    <span>generated {lastGenerationResult.summary.generated}</span>
                    <span>QA passed {lastGenerationResult.summary.qaPassed}</span>
                    <span>failed {lastGenerationResult.summary.failed}</span>
                    <span>stored {lastGenerationResult.summary.stored}</span>
                  </div>
                </div>
                <div className="max-h-52 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Blueprint</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>QA</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead>Template ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastGenerationResult.results.map((result) => (
                        <TableRow key={`${result.blueprintId}-${result.language}`}>
                          <TableCell className="font-mono text-xs">{result.blueprintId}</TableCell>
                          <TableCell>
                            <Badge variant={result.status === "ok" ? "default" : "destructive"}>
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {typeof result.qaScore === "number" ? result.qaScore : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {result.styleProfileId || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {result.qaWarnings && result.qaWarnings.length > 0 ? (
                              <Badge variant="secondary">{result.qaWarnings.length} warning(s)</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {result.templateId || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {officialDraftTemplates.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Official Draft QA State
                  <span className="text-muted-foreground font-normal ml-2">
                    pass {officialDraftQaSummary.pass} · warn {officialDraftQaSummary.warn} · fail{" "}
                    {officialDraftQaSummary.fail} · unknown {officialDraftQaSummary.unknown}
                  </span>
                </p>
                <div className="max-h-44 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Draft</TableHead>
                        <TableHead>QA State</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Profile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {officialDraftTemplates.map((template) => {
                        const state = resolveOfficialDraftQaState(template);
                        return (
                          <TableRow key={template.id}>
                            <TableCell className="text-xs">
                              <div className="font-medium">{template.title}</div>
                              <div className="text-muted-foreground">{template.id}</div>
                            </TableCell>
                            <TableCell>
                              {state === "pass" && (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                  pass
                                </Badge>
                              )}
                              {state === "warn" && <Badge variant="secondary">warn</Badge>}
                              {state === "fail" && <Badge variant="destructive">fail</Badge>}
                              {state === "unknown" && <Badge variant="outline">unknown</Badge>}
                            </TableCell>
                            <TableCell className="text-xs">
                              {typeof template.officialGenerationMeta?.qaScore === "number"
                                ? template.officialGenerationMeta.qaScore
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {template.officialGenerationMeta?.styleProfileId || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {lastPublishResult && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Publish Result —{" "}
                  <span className="text-muted-foreground font-normal">
                    {lastPublishResult.published} published · {lastPublishResult.skipped} skipped ·{" "}
                    {lastPublishResult.failed} failed
                  </span>
                </p>
                <div className="max-h-40 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastPublishResult.details.map((detail) => (
                        <TableRow key={`${detail.templateId}-${detail.status}`}>
                          <TableCell className="font-mono text-xs">{detail.templateId}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                detail.status === "published"
                                  ? "default"
                                  : detail.status === "skipped"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {detail.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {detail.reason || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Published Templates Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Published Templates</CardTitle>
              <CardDescription className="mt-0.5">
                {isLoading
                  ? "Loading…"
                  : `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? "s" : ""}${searchQuery ? " (filtered)" : ""}`}
              </CardDescription>
            </div>
            <div className="relative w-72 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, tags…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        {searchQuery ? "No templates match your search." : "No published templates."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTemplates.map((template) => {
                      const TypeIcon = getTypeIcon(template.type);
                      const createdAt = template.createdAt
                        ? new Date(template.createdAt)
                        : new Date();
                      return (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.title}</span>
                              {template.isFeatured && (
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                              )}
                            </div>
                            {template.shortDescription && (
                              <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                                {template.shortDescription}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTypeBadgeVariant(template.type)}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {template.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{template.authorName}</div>
                            {template.isOfficial && (
                              <Badge variant="outline" className="text-xs mt-0.5">
                                Official
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {template.isFeatured ? (
                              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                <Star className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Standard</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {createdAt.toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetailDialog(template)}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                              {canEditPublishedOfficialTemplate(template) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPublishedTemplateMetadataEditor(template)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
                              )}
                              {canEditPublishedOfficialTemplate(template) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPublishedTemplateEditor(template)}
                                >
                                  <Palette className="h-4 w-4" />
                                  Designer
                                </Button>
                              )}
                              {template.isFeatured ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowUnfeatureConfirm(true);
                                  }}
                                  disabled={unfeatureTemplate.isPending}
                                >
                                  <StarOff className="h-4 w-4" />
                                  Unfeature
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setShowFeatureConfirm(true);
                                  }}
                                  disabled={featureTemplate.isPending}
                                >
                                  <Star className="h-4 w-4" />
                                  Feature
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="border-t px-6 py-3">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          size="default"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            size="default"
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          size="default"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Template Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.title}
              {selectedTemplate?.isFeatured && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
            </DialogTitle>
            <DialogDescription>Template details and featuring controls</DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-5 pt-1">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={getTypeBadgeVariant(selectedTemplate.type)}>
                  {selectedTemplate.type}
                </Badge>
                {selectedTemplate.isOfficial && <Badge variant="outline">Official</Badge>}
                {selectedTemplate.isFeatured && (
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[
                  { label: "Author", value: selectedTemplate.authorName },
                  { label: "Category", value: selectedTemplate.category || "—" },
                  { label: "Language", value: selectedTemplate.language || "—" },
                  { label: "Country", value: selectedTemplate.country || "—" },
                  {
                    label: "Downloads",
                    value: (selectedTemplate.downloadCount || 0).toString(),
                  },
                  {
                    label: "Rating",
                    value:
                      selectedTemplate.ratingAverage > 0
                        ? `${selectedTemplate.ratingAverage.toFixed(1)} (${selectedTemplate.ratingCount})`
                        : "—",
                  },
                  {
                    label: "Published",
                    value: selectedTemplate.publishedAt
                      ? new Date(selectedTemplate.publishedAt).toLocaleDateString()
                      : selectedTemplate.createdAt
                      ? new Date(selectedTemplate.createdAt).toLocaleDateString()
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {selectedTemplate.description && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedTemplate.description}
                  </p>
                </div>
              )}

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTemplate.previewImages && selectedTemplate.previewImages.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                    Preview Images
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.previewImages.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="rounded-lg border"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                  Template Content
                </p>
                <div className="rounded-lg border bg-muted/40 p-3 overflow-auto max-h-56">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedTemplate.templateContent, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailDialog(false);
                setSelectedTemplate(null);
              }}
            >
              Close
            </Button>
            {selectedTemplate && canEditPublishedOfficialTemplate(selectedTemplate) && (
              <Button
                variant="outline"
                onClick={() => openPublishedTemplateMetadataEditor(selectedTemplate)}
              >
                <Pencil className="h-4 w-4" />
                Edit Template
              </Button>
            )}
            {selectedTemplate && canEditPublishedOfficialTemplate(selectedTemplate) && (
              <Button
                variant="outline"
                onClick={() => openPublishedTemplateEditor(selectedTemplate)}
              >
                <Palette className="h-4 w-4" />
                Open Designer
              </Button>
            )}
            {selectedTemplate?.isFeatured ? (
              <Button
                variant="outline"
                onClick={() => setShowUnfeatureConfirm(true)}
                disabled={unfeatureTemplate.isPending}
              >
                <StarOff className="h-4 w-4" />
                {unfeatureTemplate.isPending ? "Unfeaturing…" : "Unfeature"}
              </Button>
            ) : (
              <Button
                onClick={() => setShowFeatureConfirm(true)}
                disabled={featureTemplate.isPending}
              >
                <Star className="h-4 w-4" />
                {featureTemplate.isPending ? "Featuring…" : "Feature Template"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={showFeatureConfirm}
        onOpenChange={setShowFeatureConfirm}
        onConfirm={handleFeature}
        title="Feature Template"
        description={`Feature "${selectedTemplate?.title}"? It will appear first in marketplace listings.`}
        confirmText="Feature"
        cancelText="Cancel"
        loading={featureTemplate.isPending}
      />
      <ConfirmDialog
        open={showUnfeatureConfirm}
        onOpenChange={setShowUnfeatureConfirm}
        onConfirm={handleUnfeature}
        title="Unfeature Template"
        description={`Unfeature "${selectedTemplate?.title}"? It will no longer appear first in listings.`}
        confirmText="Unfeature"
        cancelText="Cancel"
        loading={unfeatureTemplate.isPending}
      />

      <QAReviewDialog
        open={showQADialog}
        onOpenChange={handleQADialogOpenChange}
        templateQueue={qaTemplateQueue}
        onPublished={handleQAPublished}
      />

      <MarketplaceTemplateEditDialog
        open={templateToEdit !== null}
        onOpenChange={handleEditDialogOpenChange}
        template={templateToEdit}
        mode="published"
        onTemplateUpdated={handleTemplateUpdated}
      />

    </div>
  );
}
