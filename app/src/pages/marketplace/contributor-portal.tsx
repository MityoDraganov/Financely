import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useIsContributor } from "@/hooks/use-is-contributor";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";
import { useRegisterContributor } from "@/hooks/use-register-contributor";
import { useSubmitMarketplaceTemplate } from "@/hooks/use-submit-marketplace-template";
import { useMyMarketplaceSubmissions } from "@/hooks/repository-hooks/use-marketplace-templates";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MarketplaceTemplate } from "@/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Plus,
  FileText,
  Mail,
  CheckCircle,
  Star,
  Upload,
  Eye,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/* ── Enrichment badge ──────────────────────────────────────── */
function EnrichmentBadge({ status }: { status?: string }) {
  if (!status || status === "done") return null;
  if (status === "pending" || status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold">
        <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        AI enhancing…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
        Metadata pending
      </span>
    );
  }
  return null;
}

/* ── Status badge ──────────────────────────────────────────── */
function StatusBadge({ template }: { template: MarketplaceTemplate }) {
  if (template.isFeatured) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
        <Star className="h-2.5 w-2.5" />
        Featured
      </span>
    );
  }
  switch (template.status) {
    case "published":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">
          <CheckCircle className="h-2.5 w-2.5" />
          Published
        </span>
      );
    case "draft":
      return (
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
          Draft
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold capitalize">
          {template.status}
        </span>
      );
  }
}

/* ── Main page ─────────────────────────────────────────────── */
export default function ContributorPortalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const firebaseAuthUser = useFirebaseAuthUser();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: isContributor = false, isLoading: isLoadingStatus } = useIsContributor();
  const queryClient = useQueryClient();

  const userId = firebaseAuthUser?.uid || user?.id;
  const { data: submissions = [] } = useMyMarketplaceSubmissions(userId);

  const registerContributor = useRegisterContributor();
  const submitTemplate = useSubmitMarketplaceTemplate();
  const { data: templates } = useTemplates(currentOrganization?.id);
  const { data: emailTemplates = [] } = useEmailTemplates(currentOrganization?.id);

  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [formData, setFormData] = useState({
    sourceTemplateId: "",
    sourceTemplateType: "invoice" as "invoice" | "email",
    title: "",
  });

  const handleRegister = async () => {
    if (!termsAccepted) return;
    try {
      await registerContributor.mutateAsync({ termsAccepted: true });
      setIsRegisterDialogOpen(false);
    } catch {
      // Error handled by hook
    }
  };

  const handleSubmit = async () => {
    if (!formData.sourceTemplateId || !formData.title || !currentOrganization?.id) return;
    try {
      await submitTemplate.mutateAsync({
        sourceTemplateId: formData.sourceTemplateId,
        sourceTemplateType: formData.sourceTemplateType,
        orgId: currentOrganization.id,
        title: formData.title,
      });
      setIsSubmitDialogOpen(false);
      setFormData({ sourceTemplateId: "", sourceTemplateType: "invoice", title: "" });
    } catch {
      // Error handled by hook
    }
  };

  /* ── Loading ── */
  if (isLoadingStatus) {
    return (
      <div className="min-h-screen" style={{ background: "#f5f5f3" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f5f5f3" }}>
      {/* ── Top nav ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate("/marketplace")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Marketplace
          </button>
          <span className="text-gray-200">/</span>
          <span className="text-sm text-gray-900 font-medium">
            {t("marketplace.contributor.title") || "Contributor Portal"}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Page header ── */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("marketplace.contributor.title") || "Contributor Portal"}
          </h1>
          <p className="text-sm text-gray-500">
            {t("marketplace.contributor.subtitle") ||
              "Share your templates with the Financely community"}
          </p>
        </div>

        {/* ── Contributor status banner ── */}
        {isContributor && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl text-white text-sm"
            style={{
              background:
                "linear-gradient(135deg, hsl(143,64%,18%) 0%, hsl(158,50%,22%) 100%)",
            }}
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-green-300" />
            <div>
              <p className="font-semibold">Verified Contributor</p>
              <p className="text-white/60 text-xs mt-0.5">
                You can submit templates for community review
              </p>
            </div>
          </div>
        )}

        {/* ── Register section (non-contributors) ── */}
        {!isContributor && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Accent strip */}
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(143,64%,22%), hsl(158,50%,28%))",
              }}
            />
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(143,64%,24%,0.08)" }}
                >
                  <Upload className="h-5 w-5" style={{ color: "hsl(143,64%,24%)" }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">
                    Become a Contributor
                  </h2>
                  <p className="text-sm text-gray-500 max-w-md">
                    Register to share your invoice and email templates with thousands of Financely
                    users worldwide.
                  </p>
                </div>
              </div>

              <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="shrink-0 h-9 px-5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                    style={{ background: "hsl(143,64%,22%)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background =
                        "hsl(143,64%,18%)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background =
                        "hsl(143,64%,22%)")
                    }
                  >
                    Get Started
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base">Contributor Terms</DialogTitle>
                    <DialogDescription>
                      Please review and accept before registering
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                      {[
                        "You own the content you submit",
                        "You will not submit sensitive or personal data",
                        "You will not submit copyrighted material without permission",
                        "Templates will be reviewed before publication",
                        "Financely may remove templates that violate guidelines",
                      ].map((term) => (
                        <div key={term} className="flex items-start gap-2.5">
                          <CheckCircle
                            className="h-3.5 w-3.5 mt-0.5 shrink-0"
                            style={{ color: "hsl(143,64%,30%)" }}
                          />
                          <span className="text-xs text-gray-600">{term}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(c) => setTermsAccepted(c === true)}
                      />
                      <Label htmlFor="terms" className="text-sm cursor-pointer">
                        I agree to the contributor terms
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <button
                      onClick={() => setIsRegisterDialogOpen(false)}
                      className="h-9 px-4 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRegister}
                      disabled={!termsAccepted || registerContributor.isPending}
                      className={cn(
                        "h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all",
                        !termsAccepted || registerContributor.isPending
                          ? "opacity-50 cursor-not-allowed bg-gray-400"
                          : "active:scale-95"
                      )}
                      style={
                        termsAccepted && !registerContributor.isPending
                          ? { background: "hsl(143,64%,22%)" }
                          : undefined
                      }
                    >
                      {registerContributor.isPending ? "Registering…" : "Register"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* ── Submissions section (contributors) ── */}
        {isContributor && (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">My Submissions</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {submissions.length} template{submissions.length !== 1 ? "s" : ""} submitted
                </p>
              </div>

              <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    className="flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                    style={{ background: "hsl(143,64%,22%)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background =
                        "hsl(143,64%,18%)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background =
                        "hsl(143,64%,22%)")
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Listing
                  </button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base">Submit Template</DialogTitle>
                    <DialogDescription>
                      Share a template from your organization with the community
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    {/* Template type selector */}
                    <div className="grid grid-cols-2 gap-3">
                      {(["invoice", "email"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() =>
                            setFormData({ ...formData, sourceTemplateType: type, sourceTemplateId: "" })
                          }
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all",
                            formData.sourceTemplateType === type
                              ? "border-green-500 bg-green-50 text-green-800"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {type === "invoice" ? (
                            <FileText className="h-4 w-4 shrink-0" />
                          ) : (
                            <Mail className="h-4 w-4 shrink-0" />
                          )}
                          {type === "invoice" ? "Invoice Template" : "Email Template"}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500 font-medium">Select Template</Label>
                      <Select
                        value={formData.sourceTemplateId}
                        onValueChange={(v) => {
                          const selectedTemplate =
                            formData.sourceTemplateType === "invoice"
                              ? templates?.find((t) => t.id === v)
                              : emailTemplates.find((t) => t.id === v);
                          setFormData({
                            ...formData,
                            sourceTemplateId: v,
                            title: formData.title || selectedTemplate?.name || "",
                          });
                        }}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Choose a template…" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.sourceTemplateType === "invoice"
                            ? templates?.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    {t.name}
                                  </div>
                                </SelectItem>
                              ))
                            : emailTemplates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                    {t.name}
                                  </div>
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="title" className="text-xs text-gray-500 font-medium">
                        Title <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Professional Invoice Template"
                        className="h-10 text-sm"
                      />
                      <p className="text-[11px] text-gray-400">
                        AI will automatically generate the description, tags, and category.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <button
                      onClick={() => setIsSubmitDialogOpen(false)}
                      className="h-9 px-4 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={
                        !formData.sourceTemplateId || !formData.title || submitTemplate.isPending
                      }
                      className={cn(
                        "h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all",
                        !formData.sourceTemplateId || !formData.title || submitTemplate.isPending
                          ? "opacity-50 cursor-not-allowed bg-gray-400"
                          : "active:scale-95"
                      )}
                      style={
                        formData.sourceTemplateId && formData.title && !submitTemplate.isPending
                          ? { background: "hsl(143,64%,22%)" }
                          : undefined
                      }
                    >
                      {submitTemplate.isPending ? "Submitting…" : "Submit for Review"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Empty state */}
            {submissions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 px-6 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "hsl(143,64%,24%,0.07)" }}
                >
                  <FileText className="h-6 w-6" style={{ color: "hsl(143,64%,28%)" }} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">No submissions yet</h3>
                <p className="text-sm text-gray-400 max-w-xs mb-5">
                  Start sharing your templates with the Financely community
                </p>
                <button
                  onClick={() => setIsSubmitDialogOpen(true)}
                  className="flex items-center gap-2 h-9 px-5 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "hsl(143,64%,22%)" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Submit Your First Template
                </button>
              </div>
            ) : (
              /* Submissions list */
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* Type icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        submission.type === "invoice" ? "bg-blue-50" : "bg-violet-50"
                      )}
                    >
                      {submission.type === "invoice" ? (
                        <FileText className="h-4.5 w-4.5 text-blue-600" />
                      ) : (
                        <Mail className="h-4.5 w-4.5 text-violet-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {submission.title}
                        </h3>
                        <StatusBadge template={submission} />
                        <EnrichmentBadge status={submission.aiEnrichmentStatus} />
                      </div>
                      {submission.shortDescription && (
                        <p className="text-xs text-gray-500 truncate">
                          {submission.shortDescription}
                        </p>
                      )}
                      {submission.createdAt && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Submitted{" "}
                          {new Date(submission.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate(`/marketplace/${submission.id}`)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${submission.title}"? This action cannot be undone.`
                            )
                          ) {
                            try {
                              const repository =
                                repositoryHost.getMarketplaceTemplatesRepository(
                                  serviceHost.getDatabaseService()
                                );
                              await repository.delete({ id: submission.id });
                              toast.success("Template deleted successfully");
                              queryClient.invalidateQueries({
                                queryKey: ["marketplaceTemplates", "submissions", userId],
                              });
                            } catch (error) {
                              toast.error("Failed to delete template", {
                                description:
                                  error instanceof Error ? error.message : "Unknown error",
                              });
                            }
                          }
                        }}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
