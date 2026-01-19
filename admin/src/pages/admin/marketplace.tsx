import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, Store, FileText, Mail, Eye, Star, StarOff } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAdminMarketplaceTemplates } from "@/hooks/admin/use-admin-marketplace-templates";
import { useAdminFeatureMarketplaceTemplate } from "@/hooks/admin/use-admin-approve-marketplace-template";
import { useAdminUnfeatureMarketplaceTemplate } from "@/hooks/admin/use-admin-reject-marketplace-template";
import { MarketplaceTemplate } from "@/core";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

const ITEMS_PER_PAGE = 20;

export function AdminMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFeatureConfirm, setShowFeatureConfirm] = useState(false);
  const [showUnfeatureConfirm, setShowUnfeatureConfirm] = useState(false);

  const { data: templates, isLoading } = useAdminMarketplaceTemplates("published");
  const featureTemplate = useAdminFeatureMarketplaceTemplate();
  const unfeatureTemplate = useAdminUnfeatureMarketplaceTemplate();

  // Filter by search query client-side
  const filteredTemplates = useMemo(() => {
    if (!templates) {
      return [];
    }

    if (!searchQuery) {
      return templates;
    }

    const searchLower = searchQuery.toLowerCase();
    return templates.filter(
      (template) =>
        template.title?.toLowerCase().includes(searchLower) ||
        template.authorName?.toLowerCase().includes(searchLower) ||
        template.description?.toLowerCase().includes(searchLower) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }, [templates, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1);
    }
  }, [searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!templates) {
      return {
        total: 0,
        featured: 0,
      };
    }

    return {
      total: templates.length,
      featured: templates.filter((t) => t.isFeatured).length,
    };
  }, [templates]);

  const handleFeature = async () => {
    if (!selectedTemplate) return;
    try {
      await featureTemplate.mutateAsync({ templateId: selectedTemplate.id });
      setShowFeatureConfirm(false);
      setShowDetailDialog(false);
      setSelectedTemplate(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleUnfeature = async () => {
    if (!selectedTemplate) return;
    try {
      await unfeatureTemplate.mutateAsync({ templateId: selectedTemplate.id });
      setShowUnfeatureConfirm(false);
      setShowDetailDialog(false);
      setSelectedTemplate(null);
    } catch (err) {
      // Error handled by hook
    }
  };

  const openDetailDialog = (template: MarketplaceTemplate) => {
    setSelectedTemplate(template);
    setShowDetailDialog(true);
  };

  const getTypeIcon = (type: string) => {
    return type === "invoice" ? FileText : Mail;
  };

  const getTypeBadgeVariant = (type: string) => {
    return type === "invoice" ? "default" : "secondary";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Store className="h-8 w-8" />
          Marketplace Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage and feature marketplace templates
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates by title, author, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Published Templates</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Published templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured Templates</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.featured}</div>
            <p className="text-xs text-muted-foreground">Featured for visibility</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Published Templates</CardTitle>
          <CardDescription>
            Showing {startIndex + 1}-{Math.min(endIndex, filteredTemplates.length)} of{" "}
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
            {searchQuery && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {filteredTemplates.length === 0
                        ? "No published templates found"
                        : "No templates on this page"}
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
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {template.title}
                              {template.isFeatured && (
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                            {template.shortDescription && (
                              <div className="text-sm text-muted-foreground">
                                {template.shortDescription}
                              </div>
                            )}
                          </div>
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
                            <Badge variant="outline" className="text-xs mt-1">
                              Official
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {template.isFeatured ? (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Star className="h-3 w-3 mr-1" />
                              Featured
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Standard</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {createdAt.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetailDialog(template)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {template.isFeatured ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setShowUnfeatureConfirm(true);
                                }}
                                disabled={unfeatureTemplate.isPending}
                              >
                                <StarOff className="h-4 w-4 mr-1" />
                                Unfeature
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setShowFeatureConfirm(true);
                                }}
                                disabled={featureTemplate.isPending}
                              >
                                <Star className="h-4 w-4 mr-1" />
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.title}
              {selectedTemplate?.isFeatured && (
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              )}
            </DialogTitle>
            <DialogDescription>
              View template details and manage featuring
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Type</Label>
                  <div className="mt-1">
                    <Badge variant={getTypeBadgeVariant(selectedTemplate.type)}>
                      {selectedTemplate.type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Author</Label>
                  <div className="mt-1 text-sm">{selectedTemplate.authorName}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Featured Status</Label>
                  <div className="mt-1">
                    {selectedTemplate.isFeatured ? (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Featured</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="mt-1 text-sm">
                    {selectedTemplate.category || "Not specified"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Language</Label>
                  <div className="mt-1 text-sm">
                    {selectedTemplate.language || "Not specified"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Country</Label>
                  <div className="mt-1 text-sm">
                    {selectedTemplate.country || "Not specified"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Published</Label>
                  <div className="mt-1 text-sm">
                    {selectedTemplate.publishedAt
                      ? new Date(selectedTemplate.publishedAt).toLocaleString()
                      : selectedTemplate.createdAt
                      ? new Date(selectedTemplate.createdAt).toLocaleString()
                      : "Unknown"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Downloads</Label>
                  <div className="mt-1 text-sm">{selectedTemplate.downloadCount || 0}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Rating</Label>
                  <div className="mt-1 text-sm">
                    {selectedTemplate.ratingAverage > 0
                      ? `${selectedTemplate.ratingAverage.toFixed(1)} ⭐ (${selectedTemplate.ratingCount} reviews)`
                      : "No ratings yet"}
                  </div>
                </div>
              </div>

              {selectedTemplate.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedTemplate.description}
                  </div>
                </div>
              )}

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Tags</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
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
                  <Label className="text-sm font-medium">Preview Images</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {selectedTemplate.previewImages.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`Preview ${idx + 1}`}
                        className="rounded-md border"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Template Content</Label>
                <div className="mt-1 p-4 bg-muted rounded-md text-sm font-mono overflow-auto max-h-64">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(selectedTemplate.templateContent, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailDialog(false);
                setSelectedTemplate(null);
              }}
            >
              Close
            </Button>
            {selectedTemplate?.isFeatured ? (
              <Button
                variant="outline"
                onClick={() => {
                  setShowUnfeatureConfirm(true);
                }}
                disabled={unfeatureTemplate.isPending}
              >
                <StarOff className="h-4 w-4 mr-2" />
                {unfeatureTemplate.isPending ? "Unfeaturing..." : "Unfeature"}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowFeatureConfirm(true);
                }}
                disabled={featureTemplate.isPending}
              >
                <Star className="h-4 w-4 mr-2" />
                {featureTemplate.isPending ? "Featuring..." : "Feature Template"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Confirmation Dialog */}
      <ConfirmDialog
        open={showFeatureConfirm}
        onOpenChange={setShowFeatureConfirm}
        onConfirm={handleFeature}
        title="Feature Template"
        description={`Are you sure you want to feature "${selectedTemplate?.title}"? Featured templates appear first in marketplace listings.`}
        confirmText="Feature"
        cancelText="Cancel"
        loading={featureTemplate.isPending}
      />

      {/* Unfeature Confirmation Dialog */}
      <ConfirmDialog
        open={showUnfeatureConfirm}
        onOpenChange={setShowUnfeatureConfirm}
        onConfirm={handleUnfeature}
        title="Unfeature Template"
        description={`Are you sure you want to unfeature "${selectedTemplate?.title}"? It will no longer appear first in marketplace listings.`}
        confirmText="Unfeature"
        cancelText="Cancel"
        loading={unfeatureTemplate.isPending}
      />
    </div>
  );
}
