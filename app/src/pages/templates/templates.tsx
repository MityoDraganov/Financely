import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Edit, FileText, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useDeleteTemplate } from "@/hooks/repository-hooks/use-delete-template";
import { useBulkDeleteTemplates } from "@/hooks/repository-hooks/use-bulk-delete-templates";
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

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading } = useTemplates(currentOrganization?.id);
  const deleteTemplate = useDeleteTemplate();
  const bulkDeleteTemplates = useBulkDeleteTemplates();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

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

  const handleCreateNew = () => {
    navigate("/designer");
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

  // Computed values
  const allSelected = useMemo(() => {
    return templates && templates.length > 0 && selectedTemplateIds.size === templates.length;
  }, [templates, selectedTemplateIds]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('templates.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('templates.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t('templates.createNew')}
          </Button>
        </div>
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
              className="h-auto p-0 font-normal"
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">{t('templates.empty.title')}</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              {t('templates.empty.description')}
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              {t('templates.empty.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isSelected = selectedTemplateIds.has(template.id);
            return (
              <Card
                key={template.id}
                className={`hover:shadow-lg transition-all cursor-pointer group ${
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
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(template.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${template.name || t('templates.card.untitled')}`}
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-1">{template.name || t('templates.card.untitled')}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {template.description || t('templates.card.noDescription')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(template.id);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete({ id: template.id, name: template.name || t('templates.card.untitled') });
                        }}
                        disabled={deleteTemplate.isPending}
                      >
                        {deleteTemplate.isPending && templateToDelete?.id === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge variant={template.status === "published" ? "default" : "secondary"}>
                      {template.status === "published" ? t('templates.card.published') : t('templates.card.draft')}
                    </Badge>
                    {template.compliance?.region && (
                      <Badge variant="outline">
                        {template.compliance.region}
                      </Badge>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {template.createdAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDateTable(template.createdAt)}
                        </span>
                      </div>
                    )}
                    {template.elements && (
                      <span>
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
      )}

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
    </div>
  );
}

