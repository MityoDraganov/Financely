import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [form, setForm] = useState(defaultFormState);
  const isEditMode = mode === "edit";
  const descriptionText = isEditMode
    ? t('siteBuilder.addPageDialog.editDescription')
    : t('siteBuilder.addPageDialog.createDescription');
  const submitLabel = isPending
    ? isEditMode
      ? t('siteBuilder.addPageDialog.saving')
      : t('siteBuilder.addPageDialog.adding')
    : isEditMode
      ? t('siteBuilder.addPageDialog.saveChanges')
      : t('siteBuilder.addPageDialog.addPage');

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
          <DialogTitle>{isEditMode ? t('siteBuilder.addPageDialog.editTitle') : t('siteBuilder.addPageDialog.createTitle')}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('siteBuilder.addPageDialog.title')}</Label>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              placeholder={t('siteBuilder.addPageDialog.titlePlaceholder')}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.addPageDialog.slug')}</Label>
            <Input
              value={form.slug}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  slug: event.target.value,
                }))
              }
              placeholder={t('siteBuilder.addPageDialog.slugPlaceholder')}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.addPageDialog.type')}</Label>
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
                <SelectItem value="standard">{t('siteBuilder.addPageDialog.types.standard')}</SelectItem>
                <SelectItem value="blog">{t('siteBuilder.addPageDialog.types.blog')}</SelectItem>
                <SelectItem value="contact">{t('siteBuilder.addPageDialog.types.contact')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.addPageDialog.description')}</Label>
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder={t('siteBuilder.addPageDialog.descriptionPlaceholder')}
              rows={3}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('siteBuilder.addPageDialog.context')}</Label>
            <Textarea
              value={form.context}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  context: event.target.value,
                }))
              }
              placeholder={t('siteBuilder.addPageDialog.contextPlaceholder')}
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
            {t('siteBuilder.addPageDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || isPending}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
