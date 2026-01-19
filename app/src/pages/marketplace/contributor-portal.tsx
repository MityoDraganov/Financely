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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, FileText, Mail, CheckCircle, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ContributorPortalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUser();
  const firebaseAuthUser = useFirebaseAuthUser();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: isContributor = false, isLoading: isLoadingStatus } = useIsContributor();
  const queryClient = useQueryClient();
  
  // Use Firebase Auth UID if available, fallback to Clerk ID (they should be the same)
  const userId = firebaseAuthUser?.uid || user?.id;
  const { data: submissions = [], error: submissionsError } = useMyMarketplaceSubmissions(userId);
  
  console.log("Submissions data:", submissions);
  console.log("Submissions error:", submissionsError);
  console.log("Clerk User ID:", user?.id);
  console.log("Firebase Auth UID:", firebaseAuthUser?.uid);
  console.log("Using User ID for query:", userId);
  
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
    description: "",
    shortDescription: "",
    category: "",
    tags: "",
    language: "",
    country: "",
  });


  const handleRegister = async () => {
    if (!termsAccepted) {
      return;
    }

    try {
      await registerContributor.mutateAsync({ termsAccepted: true });
      setIsRegisterDialogOpen(false);
    } catch {
      // Error handled by hook
    }
  };

  const handleSubmit = async () => {
    if (!formData.sourceTemplateId || !formData.title || !currentOrganization?.id) {
      return;
    }

    try {
      await submitTemplate.mutateAsync({
        sourceTemplateId: formData.sourceTemplateId,
        sourceTemplateType: formData.sourceTemplateType,
        orgId: currentOrganization.id,
        title: formData.title,
        description: formData.description || undefined,
        shortDescription: formData.shortDescription || undefined,
        category: formData.category || undefined,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : undefined,
        language: formData.language || undefined,
        country: formData.country || undefined,
      });
      setIsSubmitDialogOpen(false);
      setFormData({
        sourceTemplateId: "",
        sourceTemplateType: "invoice",
        title: "",
        description: "",
        shortDescription: "",
        category: "",
        tags: "",
        language: "",
        country: "",
      });
    } catch {
      // Error handled by hook
    }
  };

  const getStatusBadge = (template: MarketplaceTemplate) => {
    if (template.isFeatured) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Star className="h-3 w-3" />
          Featured
        </Badge>
      );
    }
    
    switch (template.status) {
      case "published":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Published
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            Draft
          </Badge>
        );
      default:
        return <Badge variant="outline">{template.status}</Badge>;
    }
  };

  if (isLoadingStatus) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
          <h1 className="text-3xl font-bold tracking-tight mt-4">
            {t("marketplace.contributor.title") || "Contributor Portal"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("marketplace.contributor.subtitle") ||
              "Share your templates with the community"}
          </p>
        </div>
      </div>

      {/* Registration Section */}
      {!isContributor && (
        <Card>
          <CardHeader>
            <CardTitle>Become a Contributor</CardTitle>
            <CardDescription>
              Register as a contributor to share your templates with the Financely community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
              <DialogTrigger asChild>
                <Button>Register as Contributor</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Contributor Terms</DialogTitle>
                  <DialogDescription>
                    By registering as a contributor, you agree to:
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li>You own the content you submit</li>
                    <li>You will not submit sensitive or personal data</li>
                    <li>You will not submit copyrighted material without permission</li>
                    <li>Templates will be reviewed before publication</li>
                    <li>Financely may remove templates that violate guidelines</li>
                  </ul>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the contributor terms
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsRegisterDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRegister}
                    disabled={!termsAccepted || registerContributor.isPending}
                  >
                    {registerContributor.isPending ? "Registering..." : "Register"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Submissions Section */}
      {isContributor && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">My Submissions</h2>
            <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Listing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Submit Template to Marketplace</DialogTitle>
                  <DialogDescription>
                    Select a template from your organization to share with the community
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Template Type</Label>
                    <Select
                      value={formData.sourceTemplateType}
                      onValueChange={(v) =>
                        setFormData({ ...formData, sourceTemplateType: v as "invoice" | "email" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">Invoice Template</SelectItem>
                        <SelectItem value="email">Email Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Select Template</Label>
                    <Select
                      value={formData.sourceTemplateId}
                      onValueChange={(v) => setFormData({ ...formData, sourceTemplateId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.sourceTemplateType === "invoice"
                          ? templates?.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>{t.name}</span>
                                </div>
                              </SelectItem>
                            ))
                          : emailTemplates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  <span>{t.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Professional Invoice Template"
                    />
                  </div>

                  <div>
                    <Label htmlFor="shortDescription">Short Description</Label>
                    <Input
                      id="shortDescription"
                      value={formData.shortDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, shortDescription: e.target.value })
                      }
                      placeholder="A modern invoice template for consulting businesses"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Full Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this template is for, how to use it, and any special features..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Professional Services"
                      />
                    </div>
                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Input
                        id="language"
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        placeholder="English"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="invoice, professional, modern"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsSubmitDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !formData.sourceTemplateId ||
                      !formData.title ||
                      submitTemplate.isPending
                    }
                  >
                    {submitTemplate.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {!submissions || submissions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
                <p className="text-muted-foreground mb-6 text-center">
                  Start sharing your templates with the community
                </p>
                <Button onClick={() => setIsSubmitDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Submit Your First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <Card key={submission.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{submission.title}</CardTitle>
                        {submission.shortDescription && (
                          <CardDescription className="mt-1">
                            {submission.shortDescription}
                          </CardDescription>
                        )}
                        {submission.createdAt && (
                          <CardDescription className="mt-1">
                            Published {new Date(submission.createdAt).toLocaleDateString()}
                            {submission.publishedAt && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({new Date(submission.publishedAt).toLocaleDateString()})
                              </span>
                            )}
                          </CardDescription>
                        )}
                      </div>
                      {getStatusBadge(submission)}
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/marketplace/${submission.id}`)}
                    >
                      View in Marketplace
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete "${submission.title}"? This action cannot be undone.`)) {
                          try {
                            const repository = repositoryHost.getMarketplaceTemplatesRepository(serviceHost.getDatabaseService());
                            await repository.delete({ id: submission.id });
                            toast.success("Template deleted successfully");
                            // Refetch submissions
                            queryClient.invalidateQueries({ queryKey: ["marketplaceTemplates", "submissions", userId] });
                          } catch (error) {
                            toast.error("Failed to delete template", {
                              description: error instanceof Error ? error.message : "Unknown error",
                            });
                          }
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
