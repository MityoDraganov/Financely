import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketplaceTemplate } from "@/core";
import {
  useAdminPublishOfficialTemplatePack,
  type PublishOfficialTemplatePackResult,
} from "@/hooks/admin/use-admin-publish-official-template-pack";
import { useAdminGetTemplatePreviewHtml } from "@/hooks/admin/use-admin-get-template-preview-html";
import { buildEmailPreviewHtml } from "@/utils/email-preview";

interface QAReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateQueue: MarketplaceTemplate[];
  onPublished?: (result: PublishOfficialTemplatePackResult) => void;
}

export function QAReviewDialog({
  open,
  onOpenChange,
  templateQueue,
  onPublished,
}: QAReviewDialogProps) {
  const [qaIndex, setQaIndex] = useState(0);
  const [qaDecisions, setQaDecisions] = useState<Record<string, "approved" | "discarded">>({});
  const [requireQaPass, setRequireQaPass] = useState(true);
  const [previewHtmlCache, setPreviewHtmlCache] = useState<Record<string, string>>({});

  const publishOfficialTemplatePack = useAdminPublishOfficialTemplatePack();
  const getPreviewHtml = useAdminGetTemplatePreviewHtml();

  useEffect(() => {
    if (open) {
      setQaIndex(0);
      setQaDecisions({});
      setPreviewHtmlCache({});
    }
  }, [open]);

  const currentQaTemplate = templateQueue[qaIndex];
  const isQaComplete = qaIndex >= templateQueue.length && templateQueue.length > 0;

  // Fetch invoice preview HTML from server when navigating to an invoice template.
  useEffect(() => {
    if (!currentQaTemplate || currentQaTemplate.type !== "invoice") return;
    if (previewHtmlCache[currentQaTemplate.id] !== undefined) return;
    const id = currentQaTemplate.id;
    getPreviewHtml.mutate(id, {
      onSuccess: (data) => setPreviewHtmlCache((prev) => ({ ...prev, [id]: data.html })),
      onError: () => setPreviewHtmlCache((prev) => ({ ...prev, [id]: "" })),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQaTemplate?.id]);
  const qaApprovedIds = Object.entries(qaDecisions)
    .filter(([, d]) => d === "approved")
    .map(([id]) => id);
  const qaDiscardedCount = Object.values(qaDecisions).filter((d) => d === "discarded").length;

  const emailPreviewHtml = useMemo(() => {
    if (!currentQaTemplate || currentQaTemplate.type !== "email") return null;
    const content = currentQaTemplate.templateContent as Record<string, unknown>;
    return buildEmailPreviewHtml({
      htmlContent: typeof content.htmlContent === "string" ? content.htmlContent : undefined,
      placeholders: Array.isArray(content.placeholders)
        ? (content.placeholders as Parameters<typeof buildEmailPreviewHtml>[0]["placeholders"])
        : undefined,
    });
  }, [currentQaTemplate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecision = (decision: "approved" | "discarded") => {
    if (!currentQaTemplate) return;
    setQaDecisions((prev) => ({ ...prev, [currentQaTemplate.id]: decision }));
    setQaIndex((i) => i + 1);
  };

  const handlePrev = () => setQaIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setQaIndex((i) => Math.min(templateQueue.length - 1, i + 1));

  const handlePublishApproved = async () => {
    if (qaApprovedIds.length === 0) return;
    try {
      const result = await publishOfficialTemplatePack.mutateAsync({
        templateIds: qaApprovedIds,
        requireQaPass,
      });
      onPublished?.(result);
      onOpenChange(false);
    } catch {
      // handled by mutation hook
    }
  };

  const getTypeBadgeVariant = (type: string) =>
    type === "invoice" ? ("default" as const) : ("secondary" as const);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-[80vw] sm:max-w-[80vw] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between gap-6 shrink-0">
          <div>
            <DialogTitle className="text-sm font-semibold">
              {isQaComplete
                ? "Review complete"
                : `Reviewing ${qaIndex + 1} of ${templateQueue.length}`}
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              {isQaComplete
                ? `${qaApprovedIds.length} approved · ${qaDiscardedCount} discarded`
                : "Approve or discard each template before publishing"}
            </DialogDescription>
          </div>
          {!isQaComplete && templateQueue.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrev}
                disabled={qaIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {templateQueue.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => setQaIndex(i)}
                    className="h-1.5 w-5 rounded-full transition-colors focus:outline-none"
                    style={{
                      background:
                        i < qaIndex
                          ? qaDecisions[templateQueue[i].id] === "approved"
                            ? "hsl(142, 71%, 35%)"
                            : "hsl(0, 84%, 60%)"
                          : i === qaIndex
                          ? "hsl(222, 47%, 11%)"
                          : "hsl(220, 13%, 90%)",
                    }}
                  />
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNext}
                disabled={qaIndex >= templateQueue.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Body */}
        {isQaComplete ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Approved
                  </p>
                  <p className="text-4xl font-bold tabular-nums mt-1">{qaApprovedIds.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Discarded
                  </p>
                  <p className="text-4xl font-bold tabular-nums mt-1 text-destructive">
                    {qaDiscardedCount}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm">All decisions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-72 divide-y">
                  {templateQueue.map((t) => (
                    <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[t.language, t.country].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={t.type === "invoice" ? "default" : "secondary"}>
                          {t.type}
                        </Badge>
                        {qaDecisions[t.id] === "approved" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Discarded
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : currentQaTemplate ? (
          <div className="flex-1 overflow-hidden grid grid-cols-2 min-h-0">
            {/* Left: metadata */}
            <div className="overflow-y-auto border-r px-6 py-5 space-y-5">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={getTypeBadgeVariant(currentQaTemplate.type)}>
                  {currentQaTemplate.type}
                </Badge>
                {currentQaTemplate.isOfficial && <Badge variant="outline">Official</Badge>}
                {currentQaTemplate.category && (
                  <Badge variant="secondary">{currentQaTemplate.category}</Badge>
                )}
              </div>

              <div>
                <h3 className="text-base font-semibold leading-snug">{currentQaTemplate.title}</h3>
                {currentQaTemplate.shortDescription && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {currentQaTemplate.shortDescription}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { label: "Language", value: currentQaTemplate.language || "—" },
                  { label: "Country", value: currentQaTemplate.country || "—" },
                  { label: "Version", value: `v${currentQaTemplate.version}` },
                  { label: "Author", value: currentQaTemplate.authorName },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              {currentQaTemplate.description && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentQaTemplate.description}
                  </p>
                </div>
              )}

              {currentQaTemplate.tags && currentQaTemplate.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQaTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                  Template ID
                </p>
                <p className="font-mono text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 break-all">
                  {currentQaTemplate.id}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                  Template Content
                </p>
                <div className="rounded-lg border bg-muted/40 p-3 overflow-auto max-h-48">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(currentQaTemplate.templateContent, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right: preview */}
            <div className="overflow-y-auto p-5 space-y-3 bg-muted/20">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Preview
              </p>
              {currentQaTemplate.previewImages && currentQaTemplate.previewImages.length > 0 ? (
                <div className="space-y-3">
                  {currentQaTemplate.previewImages.map((url, idx) => (
                    <div key={idx} className="rounded-lg border bg-background overflow-hidden">
                      <img
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : currentQaTemplate.type === "email" && emailPreviewHtml ? (
                <div className="rounded-lg border bg-background overflow-hidden">
                  <iframe
                    srcDoc={emailPreviewHtml}
                    className="w-full h-[520px]"
                    title="Email preview"
                  />
                </div>
              ) : currentQaTemplate.type === "invoice" ? (
                previewHtmlCache[currentQaTemplate.id] ? (
                  <div className="rounded-lg border bg-background overflow-hidden">
                    <iframe
                      srcDoc={previewHtmlCache[currentQaTemplate.id]}
                      className="w-full h-[700px]"
                      title="Invoice preview"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Skeleton className="h-[700px] w-full rounded-lg" />
                  </div>
                )
              ) : (
                <div className="rounded-lg border bg-background h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Eye className="h-6 w-6 opacity-40" />
                  <span className="text-xs">No preview available</span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-background shrink-0 flex items-center justify-between gap-3">
          {isQaComplete ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQaIndex(0);
                  setQaDecisions({});
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Re-review
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handlePublishApproved}
                  disabled={qaApprovedIds.length === 0 || publishOfficialTemplatePack.isPending}
                >
                  <UploadCloud className="h-4 w-4" />
                  {publishOfficialTemplatePack.isPending
                    ? "Publishing…"
                    : `Publish ${qaApprovedIds.length} approved`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {Object.keys(qaDecisions).length} of {templateQueue.length} reviewed
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-green-700 font-medium">{qaApprovedIds.length} approved</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-destructive font-medium">{qaDiscardedCount} discarded</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrev}
                  disabled={qaIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  disabled={qaIndex >= templateQueue.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDecision("discarded")}
                  className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                  Discard
                </Button>
                <Button size="sm" onClick={() => handleDecision("approved")}>
                  <CheckCircle className="h-4 w-4" />
                  Approve
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
