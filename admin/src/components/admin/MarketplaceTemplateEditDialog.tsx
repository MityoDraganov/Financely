import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { MarketplaceTemplate } from "@/core";
import { useAdminUpdateMarketplaceTemplate } from "@/hooks/admin/use-admin-update-marketplace-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type MarketplaceTemplateEditDialogMode = "published" | "qa";

interface MarketplaceTemplateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MarketplaceTemplate | null;
  mode: MarketplaceTemplateEditDialogMode;
  onTemplateUpdated?: (template: MarketplaceTemplate) => void;
}

function parseTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function MarketplaceTemplateEditDialog({
  open,
  onOpenChange,
  template,
  mode,
  onTemplateUpdated,
}: MarketplaceTemplateEditDialogProps) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [country, setCountry] = useState("");
  const [tags, setTags] = useState("");
  const [templateContentJson, setTemplateContentJson] = useState("{}");
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateTemplate = useAdminUpdateMarketplaceTemplate();

  useEffect(() => {
    if (!open || !template) return;
    setTitle(template.title || "");
    setShortDescription(template.shortDescription || "");
    setDescription(template.description || "");
    setLanguage(template.language || "");
    setCountry(template.country || "");
    setTags((template.tags || []).join(", "));
    setTemplateContentJson(JSON.stringify(template.templateContent || {}, null, 2));
    setValidationError(null);
  }, [open, template]);

  const titleText = mode === "published" ? "Edit Published Official Template" : "Edit Draft in QA";
  const descriptionText = mode === "published"
    ? "Published official templates are editable from this templates list."
    : "Draft official templates are editable during the QA step.";

  const canSave = useMemo(() => {
    return title.trim().length > 0 && !updateTemplate.isPending;
  }, [title, updateTemplate.isPending]);

  const handleSave = async () => {
    if (!template) return;

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setValidationError("Title is required.");
      return;
    }

    let parsedTemplateContent: Record<string, unknown>;
    try {
      const parsed = JSON.parse(templateContentJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setValidationError("Template content must be a JSON object.");
        return;
      }
      parsedTemplateContent = parsed as Record<string, unknown>;
    } catch (error) {
      setValidationError(
        `Template content JSON is invalid: ${error instanceof Error ? error.message : "Unknown parse error"}`,
      );
      return;
    }

    const normalizedShortDescription = shortDescription.trim();
    const normalizedDescription = description.trim();
    const normalizedLanguage = language.trim();
    const normalizedCountry = country.trim();
    const normalizedTags = parseTags(tags);

    const updates = {
      title: normalizedTitle,
      shortDescription: normalizedShortDescription || undefined,
      description: normalizedDescription || undefined,
      language: normalizedLanguage || undefined,
      country: normalizedCountry || undefined,
      tags: normalizedTags,
      templateContent: parsedTemplateContent,
    };

    await updateTemplate.mutateAsync({
      templateId: template.id,
      updates,
    });

    onTemplateUpdated?.({
      ...template,
      ...updates,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {titleText}
            {template?.isOfficial && <Badge variant="outline">Official</Badge>}
          </DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        {template && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-edit-title">Title</Label>
                <Input
                  id="template-edit-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="template-edit-tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="official, invoice, eu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-edit-language">Language</Label>
                <Input
                  id="template-edit-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  placeholder="en"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-edit-country">Country</Label>
                <Input
                  id="template-edit-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="BG"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-edit-short-description">Short Description</Label>
              <Input
                id="template-edit-short-description"
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-edit-description">Description</Label>
              <Textarea
                id="template-edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-edit-content">Template Content JSON</Label>
              <Textarea
                id="template-edit-content"
                value={templateContentJson}
                onChange={(event) => {
                  setTemplateContentJson(event.target.value);
                  setValidationError(null);
                }}
                rows={18}
                className="font-mono text-xs"
              />
            </div>

            {validationError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {updateTemplate.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
