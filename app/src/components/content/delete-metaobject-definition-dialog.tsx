import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface DeleteMetaobjectDefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitionName: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteMetaobjectDefinitionDialog({
  open,
  onOpenChange,
  definitionName,
  onConfirm,
  isPending = false,
}: DeleteMetaobjectDefinitionDialogProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");
  const isMatch = confirmText.trim() === definitionName.trim();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm();
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("contentPages.metaobjects.deleteDialog.title", "Delete metaobject definition")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "contentPages.metaobjects.deleteDialog.description",
              "This action cannot be undone. This will permanently delete the metaobject definition and all associated data.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("contentPages.metaobjects.deleteDialog.warningTitle", "Warning")}</AlertTitle>
          <AlertDescription>
            {t(
              "contentPages.metaobjects.deleteDialog.warningDescription",
              "To confirm deletion, please type {{definitionName}} in the field below.",
              { definitionName },
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            {t("contentPages.metaobjects.deleteDialog.definitionNameLabel", "Definition name")}
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={definitionName}
            disabled={isPending}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isMatch || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending
              ? t("contentPages.metaobjects.deleteDialog.deleting", "Deleting...")
              : t("contentPages.metaobjects.deleteDialog.delete", "Delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
