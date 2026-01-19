import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Edit, FileText, Calendar, Loader2, Mail, Upload, Sparkles, Download, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useEmailTemplates } from "@/hooks/repository-hooks/use-email-templates";
import { useDeleteTemplate } from "@/hooks/repository-hooks/use-delete-template";
import { useBulkDeleteTemplates } from "@/hooks/repository-hooks/use-bulk-delete-templates";
import { useDeleteEmailTemplate } from "@/hooks/repository-hooks/use-delete-email-template";
import { useBulkDeleteEmailTemplates } from "@/hooks/repository-hooks/use-bulk-delete-email-templates";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-import/export-dialog";

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading } = useTemplates(currentOrganization?.id);
  const {
    data: emailTemplates = [],
    isLoading: isLoadingEmailTemplates,
  } = useEmailTemplates(currentOrganization?.id);
  const deleteTemplate = useDeleteTemplate();
  const bulkDeleteTemplates = useBulkDeleteTemplates();
  const deleteEmailTemplate = useDeleteEmailTemplate(currentOrganization?.id);
  const bulkDeleteEmailTemplates = useBulkDeleteEmailTemplates(currentOrganization?.id);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedEmailTemplateIds, setSelectedEmailTemplateIds] = useState<Set<string>>(new Set());
  const [deleteEmailDialogOpen, setDeleteEmailDialogOpen] = useState(false);
  const [emailTemplateToDelete, setEmailTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteEmailDialogOpen, setBulkDeleteEmailDialogOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleDelete = (template: { id: string; name: string }) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleDeleteEmail = (template: { id: string; name: string }) => {
    setEmailTemplateToDelete(template);
    setDeleteEmailDialogOpen(true);
  };

  const confirmDeleteEmail = async () => {
    if (!emailTemplateToDelete) return;

    try {
      await deleteEmailTemplate.mutateAsync(emailTemplateToDelete.id);
      setSelectedEmailTemplateIds((prev) => {
        const next = new Set(prev);
        next.delete(emailTemplateToDelete.id);
        return next;
      });
      setDeleteEmailDialogOpen(false);
      setEmailTemplateToDelete(null);
    } catch {
      setDeleteEmailDialogOpen(false);
    }
  };

  const handleCreateInvoiceTemplate = () => {
    navigate("/designer");
  };

  const handleCreateEmailTemplate = () => {
    navigate("/email-designer", { state: { action: "create" } });
  };

  const handleUploadInvoice = () => {
    navigate("/invoice-upload-flow", { state: { flowType: "template", returnTo: "/templates" } });
  };

  const handleOpenEmailTemplate = (templateId: string) => {
    navigate(`/email-designer/${templateId}`);
  };

  const handleEdit = (templateId: string) => {
    navigate(`/designer/${templateId}`);
  };

  // Selection handlers
  const handleToggleSelect = (templateId: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!templates) return;
    if (selectedTemplateIds.size === templates.length) {
      // Deselect all
      setSelectedTemplateIds(new Set());
    } else {
      // Select all
      setSelectedTemplateIds(new Set(templates.map((t) => t.id)));
    }
  };

  const handleEmailToggleSelect = (templateId: string) => {
    setSelectedEmailTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const handleEmailSelectAll = () => {
    if (emailTemplates.length === 0) return;
    if (selectedEmailTemplateIds.size === emailTemplates.length) {
      setSelectedEmailTemplateIds(new Set());
    } else {
      setSelectedEmailTemplateIds(new Set(emailTemplates.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedTemplateIds.size === 0) return;

    const templateIds = Array.from(selectedTemplateIds);

    try {
      // Delete all selected templates in parallel
      await bulkDeleteTemplates.mutateAsync(templateIds);
      
      setBulkDeleteDialogOpen(false);
      setSelectedTemplateIds(new Set());
      toast.success(
        templateIds.length === 1
          ? t('templates.bulkDelete.success', { count: templateIds.length }) || 
            `Successfully deleted ${templateIds.length} template`
          : t('templates.bulkDelete.success_plural', { count: templateIds.length }) || 
            `Successfully deleted ${templateIds.length} templates`
      );
    } catch {
      // Error is handled by the mutation
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleEmailBulkDelete = () => {
    setBulkDeleteEmailDialogOpen(true);
  };

  const confirmBulkDeleteEmail = async () => {
    if (selectedEmailTemplateIds.size === 0) return;

    const templateIds = Array.from(selectedEmailTemplateIds);

    try {
      await bulkDeleteEmailTemplates.mutateAsync(templateIds);
      setBulkDeleteEmailDialogOpen(false);
      setSelectedEmailTemplateIds(new Set());
      toast.success(
        templateIds.length === 1
          ? t("templates.bulkDelete.success", { count: templateIds.length }) ||
              `Successfully deleted ${templateIds.length} template`
          : t("templates.bulkDelete.success_plural", { count: templateIds.length }) ||
              `Successfully deleted ${templateIds.length} templates`,
      );
    } catch {
      setBulkDeleteEmailDialogOpen(false);
    }
  };

  // Computed values
  const allSelected = useMemo(() => {
    return templates && templates.length > 0 && selectedTemplateIds.size === templates.length;
  }, [templates, selectedTemplateIds]);

  const allEmailSelected = useMemo(() => {
    return emailTemplates && emailTemplates.length > 0 && selectedEmailTemplateIds.size === emailTemplates.length;
  }, [emailTemplates, selectedEmailTemplateIds]);

  if (isLoading) {
    return (
      <div className="py-6 pr-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('templates.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('templates.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/marketplace")}>
            <Store className="mr-2 h-4 w-4" />
            {t("templates.browseMarketplace") || "Browse Marketplace"}
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {selectedTemplateIds.size > 0 && (
            <>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteTemplates.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('templates.bulkDelete.delete', { count: selectedTemplateIds.size }) || `Delete ${selectedTemplateIds.size} selected`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedTemplateIds(new Set())}
              >
                {t('templates.bulkDelete.clear') || 'Clear selection'}
              </Button>
            </>
          )}
          {selectedEmailTemplateIds.size > 0 && (
            <>
              <Button
                variant="destructive"
                onClick={handleEmailBulkDelete}
                disabled={bulkDeleteEmailTemplates.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('templates.bulkDelete.delete', { count: selectedEmailTemplateIds.size }) || `Delete ${selectedEmailTemplateIds.size} selected`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedEmailTemplateIds(new Set())}
              >
                {t('templates.bulkDelete.clear') || 'Clear selection'}
              </Button>
            </>
          )}
          <Button onClick={handleCreateInvoiceTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('templates.actions.createInvoice')}
          </Button>
          <Button variant="outline" onClick={handleUploadInvoice}>
            <Upload className="h-4 w-4 mr-2" />
            <Sparkles className="h-3 w-3 mr-1" />
            Generate from Invoice
          </Button>
          <Button variant="secondary" onClick={handleCreateEmailTemplate}>
            <Mail className="h-4 w-4 mr-2" />
            {t('templates.actions.createEmail')}
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('templates.sections.invoice.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('templates.sections.invoice.description')}</p>
      </div>

      {/* Selection Controls */}
      {templates && templates.length > 0 && (
        <div className="flex items-center gap-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label={allSelected ? "Deselect all" : "Select all"}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-auto p-0 font-normal text-foreground"
            >
              {allSelected
                ? (t('templates.bulkDelete.deselectAll') || 'Deselect all')
                : (t('templates.bulkDelete.selectAll') || 'Select all')}
            </Button>
          </div>
          {selectedTemplateIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedTemplateIds.size} {selectedTemplateIds.size === 1 ? 'template' : 'templates'} selected
            </span>
          )}
        </div>
      )}

      {/* Templates Grid */}
      {!templates || templates.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('templates.empty.title')}</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                {t('templates.empty.description')}
              </p>
              <Button onClick={handleCreateInvoiceTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('templates.empty.createFirst')}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate from Invoice
              </CardTitle>
              <CardDescription>
                Upload an invoice PDF or image and automatically generate a template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Upload invoice PDF or image</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>AI extracts all invoice data automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Template generated with matching bindings</span>
                </li>
              </ul>
              <Button onClick={handleUploadInvoice} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Promotional card for existing templates */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Generate Template from Invoice</h3>
                    <p className="text-xs text-muted-foreground">
                      Upload an invoice PDF or image. We'll extract the data and create a matching template automatically.
                    </p>
                  </div>
                </div>
                <Button onClick={handleUploadInvoice} size="sm" variant="default">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {templates.map((template) => {
            const isSelected = selectedTemplateIds.has(template.id);
            return (
              <Card
                key={template.id}
                className={`flex flex-col h-full w-full hover:shadow-lg transition-all cursor-pointer group overflow-hidden ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={(e) => {
                  // Don't navigate if clicking on checkbox or action buttons
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('button') ||
                    target.closest('[role="checkbox"]') ||
                    target.closest('input[type="checkbox"]')
                  ) {
                    return;
                  }
                  handleEdit(template.id);
                }}
              >
                <CardHeader className="shrink-0 p-4 pb-3 w-full overflow-hidden">
                  <div className="flex items-start justify-between gap-1.5 w-full">
                    <div className="flex items-start gap-2 flex-1 min-w-0 w-full overflow-hidden">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(template.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${template.name || t('templates.card.untitled')}`}
                        className="shrink-0 mt-0.5 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0 w-full overflow-hidden">
                        <CardTitle className="text-sm font-semibold mb-0.5 wrap-break-word leading-tight" title={template.name || t('templates.card.untitled')}>
                          {template.name || t('templates.card.untitled')}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-3 wrap-break-word text-muted-foreground leading-relaxed" title={template.description || t('templates.card.noDescription')}>
                          {template.description || t('templates.card.noDescription')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(template.id);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete({ id: template.id, name: template.name || t('templates.card.untitled') });
                        }}
                        disabled={deleteTemplate.isPending}
                      >
                        {deleteTemplate.isPending && templateToDelete?.id === template.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              <CardContent className="flex-1 flex flex-col p-4 pt-2 w-full overflow-hidden">
                <div className="space-y-2 w-full">
                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap w-full">
                    <Badge variant={template.status === "published" ? "default" : "secondary"} className="shrink-0 text-xs px-1.5 py-0.5 h-auto wrap-break-word">
                      {template.status === "published" ? t('templates.card.published') : t('templates.card.draft')}
                    </Badge>
                    {template.compliance?.region && (
                      <Badge variant="outline" className="shrink-0 max-w-full text-xs px-1.5 py-0.5 h-auto wrap-break-word" title={template.compliance.region}>
                        {template.compliance.region}
                      </Badge>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap w-full">
                    {template.createdAt && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="wrap-break-word">
                          {formatDateTable(template.createdAt)}
                        </span>
                      </div>
                    )}
                    {template.elements && (
                      <span className="shrink-0 wrap-break-word">
                        {template.elements.length === 1
                          ? t('templates.card.elements', { count: template.elements.length })
                          : t('templates.card.elementsPlural', { count: template.elements.length })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
              </Card>
            );
          })}
          </div>
        </>
      )}
      </section>
      <section className="space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{t('templates.sections.email.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('templates.sections.email.description')}
          </p>
        </div>

        {emailTemplates.length > 0 && (
          <div className="flex items-center gap-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allEmailSelected}
                onCheckedChange={handleEmailSelectAll}
                aria-label={allEmailSelected ? "Deselect all email templates" : "Select all email templates"}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEmailSelectAll}
                className="h-auto p-0 font-normal text-foreground"
              >
                {allEmailSelected
                  ? (t('templates.bulkDelete.deselectAll') || 'Deselect all')
                  : (t('templates.bulkDelete.selectAll') || 'Select all')}
              </Button>
            </div>
            {selectedEmailTemplateIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedEmailTemplateIds.size} {selectedEmailTemplateIds.size === 1 ? 'email template' : 'email templates'} selected
              </span>
            )}
          </div>
        )}

        {isLoadingEmailTemplates ? (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
            {[1, 2, 3].map((item) => (
              <Card key={item}>
                <CardContent className="space-y-4 py-6">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : emailTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-14 w-14 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('templates.email.empty.title')}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {t('templates.email.empty.description')}
              </p>
              <Button variant="secondary" onClick={handleCreateEmailTemplate}>
                <Mail className="h-4 w-4 mr-2" />
                {t('templates.email.empty.createFirst')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
            {emailTemplates.map((template) => {
              const isSelected = selectedEmailTemplateIds.has(template.id);
              return (
                <Card
                  key={template.id}
                  className={`flex flex-col h-full w-full hover:shadow-lg transition-all cursor-pointer group overflow-hidden ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('button') ||
                      target.closest('[role="checkbox"]') ||
                      target.closest('input[type="checkbox"]')
                    ) {
                      return;
                    }
                    handleOpenEmailTemplate(template.id);
                  }}
                >
                  <CardHeader className="shrink-0 p-4 pb-3 w-full overflow-hidden">
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      <div className="flex items-start gap-2 flex-1 min-w-0 w-full overflow-hidden">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleEmailToggleSelect(template.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${template.name || t('templates.email.card.untitled')}`}
                          className="shrink-0 mt-0.5 h-4 w-4"
                        />
                        <div className="min-w-0 flex-1 w-full overflow-hidden">
                          <CardTitle className="text-sm font-semibold mb-0.5 wrap-break-word leading-tight" title={template.name || t('templates.email.card.untitled')}>
                            {template.name || t('templates.email.card.untitled')}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-3 wrap-break-word text-muted-foreground leading-relaxed" title={template.subject || t('templates.email.card.noSubject')}>
                            {template.subject || t('templates.email.card.noSubject')}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEmailTemplate(template.id);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmail({ id: template.id, name: template.name || t('templates.email.card.untitled') });
                          }}
                          disabled={deleteEmailTemplate.isPending}
                        >
                          {deleteEmailTemplate.isPending && emailTemplateToDelete?.id === template.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-4 pt-2 pb-3 w-full overflow-hidden">
                    <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1.5 w-full">
                      <Badge variant={template.status === "published" ? "default" : "secondary"} className="shrink-0 text-xs px-1.5 py-0.5 h-auto wrap-break-word">
                        {template.status === "published"
                          ? t('templates.email.status.published')
                          : t('templates.email.status.draft')}
                      </Badge>
                      {(template.updatedAt || template.createdAt) && (
                        <div className="shrink-0 wrap-break-word">
                          {t('templates.email.lastUpdated', {
                            date: formatDateTable(template.updatedAt || template.createdAt || ""),
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <div className="px-4 pb-4 shrink-0 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEmailTemplate(template.id);
                      }}
                    >
                      {t('templates.email.openDesigner')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templates.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.delete.description', { name: templateToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemplate.isPending}>
              {t('templates.delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteTemplate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('templates.delete.deleting')}
                </>
              ) : (
                t('templates.delete.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedTemplateIds.size === 1
                ? t('templates.bulkDelete.title', { count: selectedTemplateIds.size }) || `Delete ${selectedTemplateIds.size} template?`
                : t('templates.bulkDelete.title_plural', { count: selectedTemplateIds.size }) || `Delete ${selectedTemplateIds.size} templates?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTemplateIds.size === 1
                ? t('templates.bulkDelete.description', { count: selectedTemplateIds.size }) || 
                  `Are you sure you want to delete ${selectedTemplateIds.size} selected template? This action cannot be undone.`
                : t('templates.bulkDelete.description_plural', { count: selectedTemplateIds.size }) || 
                  `Are you sure you want to delete ${selectedTemplateIds.size} selected templates? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteTemplates.isPending}>
              {t('templates.delete.cancel') || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteTemplates.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteTemplates.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('templates.bulkDelete.deleting') || 'Deleting...'}
                </>
              ) : (
                selectedTemplateIds.size === 1
                  ? t('templates.bulkDelete.confirm', { count: selectedTemplateIds.size }) || `Delete ${selectedTemplateIds.size} template`
                  : t('templates.bulkDelete.confirm_plural', { count: selectedTemplateIds.size }) || `Delete ${selectedTemplateIds.size} templates`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Delete Confirmation Dialog */}
      <AlertDialog open={deleteEmailDialogOpen} onOpenChange={setDeleteEmailDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templates.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('templates.delete.description', { name: emailTemplateToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEmailTemplate.isPending}>
              {t('templates.delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEmail}
              disabled={deleteEmailTemplate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEmailTemplate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('templates.delete.deleting')}
                </>
              ) : (
                t('templates.delete.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteEmailDialogOpen} onOpenChange={setBulkDeleteEmailDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedEmailTemplateIds.size === 1
                ? t('templates.bulkDelete.title', { count: selectedEmailTemplateIds.size }) || `Delete ${selectedEmailTemplateIds.size} template?`
                : t('templates.bulkDelete.title_plural', { count: selectedEmailTemplateIds.size }) || `Delete ${selectedEmailTemplateIds.size} templates?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEmailTemplateIds.size === 1
                ? t('templates.bulkDelete.description', { count: selectedEmailTemplateIds.size }) ||
                  `Are you sure you want to delete ${selectedEmailTemplateIds.size} selected template? This action cannot be undone.`
                : t('templates.bulkDelete.description_plural', { count: selectedEmailTemplateIds.size }) ||
                  `Are you sure you want to delete ${selectedEmailTemplateIds.size} selected templates? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteEmailTemplates.isPending}>
              {t('templates.delete.cancel') || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDeleteEmail}
              disabled={bulkDeleteEmailTemplates.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteEmailTemplates.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('templates.bulkDelete.deleting') || 'Deleting...'}
                </>
              ) : (
                selectedEmailTemplateIds.size === 1
                  ? t('templates.bulkDelete.confirm', { count: selectedEmailTemplateIds.size }) || `Delete ${selectedEmailTemplateIds.size} template`
                  : t('templates.bulkDelete.confirm_plural', { count: selectedEmailTemplateIds.size }) || `Delete ${selectedEmailTemplateIds.size} templates`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        defaultEntityTypes={["templates"]}
      />
    </div>
  );
}

