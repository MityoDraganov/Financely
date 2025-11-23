import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatting } from "@/hooks/use-date-formatting";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Edit, FileText, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTemplates } from "@/hooks/repository-hooks/use-templates";
import { useDeleteTemplate } from "@/hooks/repository-hooks/use-delete-template";
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

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { formatDateTable } = useDateFormatting();
  const navigate = useNavigate();
  const { data: currentOrganization } = useCurrentOrganization();
  const { data: templates, isLoading } = useTemplates(currentOrganization?.id);
  const deleteTemplate = useDeleteTemplate();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);

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
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t('templates.createNew')}
        </Button>
      </div>

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
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => handleEdit(template.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{template.name || t('templates.card.untitled')}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {template.description || t('templates.card.noDescription')}
                    </CardDescription>
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
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}

