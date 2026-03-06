import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, GripVertical, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldTypeSelector } from "@/components/content/field-type-selector";
import { CreateMetaobjectDefinitionInput, UpdateMetaobjectDefinitionInput, MetaobjectFieldDefinition, MetaobjectDefinition, MetaobjectFieldType } from "@/core";

interface MetaobjectDefinitionFormProps {
  initialData?: MetaobjectDefinition;
  onSubmit: (data: CreateMetaobjectDefinitionInput | UpdateMetaobjectDefinitionInput) => Promise<void>;
  onCancel: () => void;
  isPending?: boolean;
}

export function MetaobjectDefinitionForm({
  initialData,
  onSubmit,
  onCancel,
  isPending = false,
}: MetaobjectDefinitionFormProps) {
  const { t } = useTranslation();
  const isEditMode = !!initialData;

  const [formData, setFormData] = useState<Partial<CreateMetaobjectDefinitionInput>>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    fieldDefinitions: initialData?.fieldDefinitions || [],
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.fieldDefinitions || formData.fieldDefinitions.length === 0) {
      return;
    }

    if (isEditMode) {
      await onSubmit({
        name: formData.name,
        description: formData.description,
        fieldDefinitions: formData.fieldDefinitions,
      });
    } else {
      await onSubmit({
        name: formData.name!,
        description: formData.description,
        fieldDefinitions: formData.fieldDefinitions!,
      } as CreateMetaobjectDefinitionInput);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {isEditMode
              ? t("contentPages.metaobjects.form.editTitle", "Edit metaobject definition")
              : t("contentPages.metaobjects.form.addTitle", "Add metaobject definition")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditMode
              ? t(
                  "contentPages.metaobjects.form.editDescription",
                  "Update the metaobject definition and its fields",
                )
              : t(
                  "contentPages.metaobjects.form.addDescription",
                  "Define a new metaobject definition with custom fields",
                )}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t("contentPages.metaobjects.form.nameLabel", "Name *")}</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("contentPages.metaobjects.form.namePlaceholder", "e.g., Product Feature")}
              />
            </div>
            <div>
              <Label htmlFor="description">
                {t("contentPages.metaobjects.form.descriptionLabel", "Description")}
              </Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("contentPages.metaobjects.form.descriptionPlaceholder", "Optional description")}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("contentPages.metaobjects.form.fieldsLabel", "Fields *")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newField: MetaobjectFieldDefinition = {
                      key: `field_${Date.now()}`,
                      name: "",
                      type: MetaobjectFieldType.SINGLE_LINE_TEXT_FIELD,
                      required: false,
                    };
                    setFormData({
                      ...formData,
                      fieldDefinitions: [...(formData.fieldDefinitions || []), newField],
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("contentPages.metaobjects.form.addField", "Add field")}
                </Button>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                {formData.fieldDefinitions?.map((field, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-md bg-muted/30">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label>{t("contentPages.metaobjects.form.fieldLabel", "Field label *")}</Label>
                        <Input
                          value={field.name || ""}
                          onChange={(e) => {
                            const updated = [...(formData.fieldDefinitions || [])];
                            updated[index] = { ...field, name: e.target.value };
                            setFormData({ ...formData, fieldDefinitions: updated });
                          }}
                          placeholder={t("contentPages.metaobjects.form.fieldLabelPlaceholder", "e.g., Title")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t("contentPages.metaobjects.form.cardinalityLabel", "Cardinality")}</Label>
                          <Select
                            value={field.type?.startsWith("list.") ? "list" : "one"}
                            onValueChange={(value) => {
                              const updated = [...(formData.fieldDefinitions || [])];
                              const baseType = field.type?.startsWith("list.")
                                ? field.type.replace("list.", "")
                                : field.type || "single_line_text_field";
                              updated[index] = {
                                ...field,
                                type: (value === "list" ? `list.${baseType}` : baseType) as MetaobjectFieldDefinition["type"],
                              };
                              setFormData({ ...formData, fieldDefinitions: updated });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one">
                                {t("contentPages.metaobjects.form.cardinalityOne", "One value")}
                              </SelectItem>
                              <SelectItem value="list">
                                {t("contentPages.metaobjects.form.cardinalityList", "List of values")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{t("contentPages.metaobjects.form.fieldTypeLabel", "Field type *")}</Label>
                          <FieldTypeSelector
                            value={
                              field.type?.startsWith("list.")
                                ? (field.type.replace("list.", "") as Exclude<MetaobjectFieldDefinition["type"], `list.${string}`>)
                                : (field.type as Exclude<MetaobjectFieldDefinition["type"], `list.${string}`>)
                            }
                            onSelect={(type) => {
                              const updated = [...(formData.fieldDefinitions || [])];
                              const isList = field.type?.startsWith("list.");
                              updated[index] = {
                                ...field,
                                type: (isList ? `list.${type}` : type) as MetaobjectFieldDefinition["type"],
                              };
                              setFormData({ ...formData, fieldDefinitions: updated });
                            }}
                            placeholder={t("contentPages.metaobjects.form.fieldTypePlaceholder", "Select field type")}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`required-${index}`}
                          checked={field.required || false}
                          onChange={(e) => {
                            const updated = [...(formData.fieldDefinitions || [])];
                            updated[index] = { ...field, required: e.target.checked };
                            setFormData({ ...formData, fieldDefinitions: updated });
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`required-${index}`} className="text-sm font-normal cursor-pointer">
                          {t("common.required", "Required")}
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updated = formData.fieldDefinitions?.filter((_, i) => i !== index) || [];
                        setFormData({ ...formData, fieldDefinitions: updated });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!formData.fieldDefinitions || formData.fieldDefinitions.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t(
                      "contentPages.metaobjects.form.noFieldsMessage",
                      'No fields added yet. Click "Add field" to get started.',
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isEditMode
                ? t("contentPages.metaobjects.form.update", "Update")
                : t("contentPages.metaobjects.form.create", "Create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
