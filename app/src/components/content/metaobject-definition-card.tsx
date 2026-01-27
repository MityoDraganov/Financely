import { useState } from "react";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetaobjectDefinition } from "@/core";
import { DeleteMetaobjectDefinitionDialog } from "./delete-metaobject-definition-dialog";

interface MetaobjectDefinitionCardProps {
  definition: MetaobjectDefinition;
  onDelete: (id: string) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  isDeleting?: boolean;
}

export function MetaobjectDefinitionCard({
  definition,
  onDelete,
  onView,
  onEdit,
  isDeleting = false,
}: MetaobjectDefinitionCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete(definition.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">{definition.name}</h3>
            </div>
            <div className="flex space-x-2">
              {onView && (
                <Button variant="ghost" size="icon" onClick={() => onView(definition.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(definition.id)}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {definition.description && (
            <p className="text-sm text-muted-foreground mb-4">{definition.description}</p>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {definition.fieldDefinitions?.length || 0} field{definition.fieldDefinitions?.length !== 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <DeleteMetaobjectDefinitionDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        definitionName={definition.name}
        onConfirm={handleConfirmDelete}
        isPending={isDeleting}
      />
    </>
  );
}
