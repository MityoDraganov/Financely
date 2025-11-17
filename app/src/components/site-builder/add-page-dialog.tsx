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
  onAdd: (page: {
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  }) => void;
  isPending?: boolean;
}

export function AddPageDialog({
  open,
  onOpenChange,
  onAdd,
  isPending = false,
}: AddPageDialogProps) {
  const [form, setForm] = useState<{
    title: string;
    slug: string;
    description: string;
    context: string;
    type: PageType;
  }>({
    title: "",
    slug: "",
    description: "",
    context: "",
    type: "standard",
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setForm({
        title: "",
        slug: "",
        description: "",
        context: "",
        type: "standard",
      });
    }
  }, [open]);

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onAdd(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new page</DialogTitle>
          <DialogDescription>
            Provide a title and optional description. The slug determines the URL (e.g. /about).
          </DialogDescription>
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
          <Button
            onClick={handleSubmit}
            disabled={!form.title.trim() || isPending}
          >
            {isPending ? "Adding..." : "Add Page"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

