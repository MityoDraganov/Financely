import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PageType = "standard" | "blog" | "contact";

interface AddPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (page: {
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  }) => void;
  isPending?: boolean;
  initialValues?: {
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  } | null;
  mode?: "create" | "edit";
}

const defaultFormState = {
  title: "",
  slug: "",
  description: "",
  context: "",
  type: "standard" as PageType,
};

export function AddPageDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  initialValues = null,
  mode = "create",
}: AddPageDialogProps) {
  const [form, setForm] = useState(defaultFormState);
  const isEditMode = mode === "edit";
  const descriptionText = isEditMode
    ? "Update the details for this page. Changing the slug will update the page URL."
    : "Provide a title and optional description. The slug determines the URL (e.g. /about).";
  const submitLabel = isPending
    ? isEditMode
      ? "Saving..."
      : "Adding..."
    : isEditMode
      ? "Save Changes"
      : "Add Page";

  useEffect(() => {
    if (!open) {
      setForm(defaultFormState);
      return;
    }

    if (isEditMode && initialValues) {
      setForm(initialValues);
      return;
    }

    setForm(defaultFormState);
  }, [open, isEditMode, initialValues]);

  const handleSubmit = () => {
    if (!form.title.trim()) {
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit page" : "Add a new page"}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              placeholder="About"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  slug: event.target.value,
                }))
              }
              placeholder="about"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(value: PageType) =>
                setForm((prev) => ({
                  ...prev,
                  type: value,
                }))
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="blog">Blog / Articles</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Brief description of this page's purpose..."
              rows={3}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Context (optional)</Label>
            <Textarea
              value={form.context}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  context: event.target.value,
                }))
              }
              placeholder="Additional context for AI generation..."
              rows={3}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || isPending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
