import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldTypeSelector } from "@/components/content/field-type-selector";
import { CreateMetafieldDefinitionInput, MetafieldDefinition, UpdateMetafieldDefinitionInput } from "@/core";
import { useMetaobjectDefinitions } from "@/hooks/repository-hooks/use-metaobjects";

interface ProductMetafieldDefinitionFormProps {
  initialData?: MetafieldDefinition;
  onSubmit: (data: CreateMetafieldDefinitionInput | UpdateMetafieldDefinitionInput) => Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
  organizationId: string;
  availableCategories?: string[];
  currentCategory?: string | null;
  showCategories?: boolean;
}

export function ProductMetafieldDefinitionForm({
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
  organizationId,
  availableCategories = [],
  currentCategory,
  showCategories = true,
}: ProductMetafieldDefinitionFormProps) {
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState<Partial<CreateMetafieldDefinitionInput>>({
    name: initialData?.name || "",
    type: initialData?.type || "single_line_text_field",
    description: initialData?.description || "",
    categoryAssignments: initialData?.categoryAssignments || [],
    metaobjectDefinitionId: initialData?.metaobjectDefinitionId,
    options: {
      storefrontApiAccess: initialData?.options?.storefrontApiAccess || false,
    },
  });

  const { data: metaobjectDefinitions = [] } = useMetaobjectDefinitions(organizationId);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        type: initialData.type,
        description: initialData.description,
        categoryAssignments: initialData.categoryAssignments || [],
        metaobjectDefinitionId: initialData.metaobjectDefinitionId,
        options: {
          storefrontApiAccess: initialData.options?.storefrontApiAccess || false,
        },
      });
    }
  }, [initialData]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.type) {
      return;
    }

    if (isEditMode) {
      const updateData: UpdateMetafieldDefinitionInput = {
        name: formData.name,
        type: formData.type,
        description: formData.description,
        categoryAssignments: formData.categoryAssignments,
        metaobjectDefinitionId: formData.metaobjectDefinitionId,
        options: formData.options,
      };
      await onSubmit(updateData);
    } else {
      const createData: CreateMetafieldDefinitionInput = {
        organizationId,
        name: formData.name,
        type: formData.type!,
        description: formData.description,
        categoryAssignments: formData.categoryAssignments || [],
        metaobjectDefinitionId: formData.metaobjectDefinitionId,
        options: formData.options || { storefrontApiAccess: false },
      };
      await onSubmit(createData);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="metafield-name">Name *</Label>
        <Input
          id="metafield-name"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Product Feature"
        />
      </div>
      <div>
        <Label htmlFor="metafield-type">Type *</Label>
        <FieldTypeSelector
          value={formData.type as Exclude<MetafieldDefinition["type"], `list.${string}`>}
          onSelect={(type) => {
            const newType = type as MetafieldDefinition["type"];
            setFormData({ 
              ...formData, 
              type: newType,
              metaobjectDefinitionId: newType === "metaobject_reference" ? formData.metaobjectDefinitionId : undefined,
            });
          }}
        />
      </div>
      {formData.type === "metaobject_reference" && (
        <div>
          <Label htmlFor="metaobject-definition">Metaobject definition *</Label>
          <Select
            value={formData.metaobjectDefinitionId || ""}
            onValueChange={(value) => setFormData({ ...formData, metaobjectDefinitionId: value || undefined })}
          >
            <SelectTrigger id="metaobject-definition">
              <SelectValue placeholder="Select a metaobject definition" />
            </SelectTrigger>
            <SelectContent>
              {metaobjectDefinitions.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No metaobject definitions available</div>
              ) : (
                metaobjectDefinitions.map((def) => (
                  <SelectItem key={def.id} value={def.id}>
                    {def.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Select which metaobject type this metafield will reference
          </p>
        </div>
      )}
      <div>
        <Label htmlFor="metafield-description">Description</Label>
        <Textarea
          id="metafield-description"
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
          rows={3}
        />
      </div>
      {showCategories && (
        <div>
          <Label>Category assignments</Label>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories found. Create products with categories first.</p>
            ) : (
              availableCategories.map((category) => (
                <div key={category} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`category-${category}`}
                    checked={formData.categoryAssignments?.includes(category) || false}
                    onChange={(e) => {
                      const current = formData.categoryAssignments || [];
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          categoryAssignments: [...current, category],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          categoryAssignments: current.filter((c) => c !== category),
                        });
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`category-${category}`} className="text-sm font-normal cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showCategories && currentCategory && (
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <input
            type="checkbox"
            id="assign-to-current-category"
            checked={formData.categoryAssignments?.includes(currentCategory) || false}
            onChange={(e) => {
              const current = formData.categoryAssignments || [];
              if (e.target.checked) {
                setFormData({
                  ...formData,
                  categoryAssignments: [...current, currentCategory],
                });
              } else {
                setFormData({
                  ...formData,
                  categoryAssignments: current.filter((c) => c !== currentCategory),
                });
              }
            }}
            className="rounded border-border"
          />
          <Label htmlFor="assign-to-current-category" className="cursor-pointer">
            Assign to current category ({currentCategory})
          </Label>
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={
            isPending || 
            !formData.name || 
            !formData.type || 
            (formData.type === "metaobject_reference" && !formData.metaobjectDefinitionId)
          }
        >
          {isPending ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update" : "Create")}
        </Button>
      </div>
    </div>
  );
}
