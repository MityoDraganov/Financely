import { useState } from "react";
import { Plus, X, GripVertical, Image as ImageIcon, File as FileIcon, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MetaobjectDefinition, MetaobjectFieldDefinition, MetaobjectFieldType } from "@/core";
import { toast } from "sonner";
import { SelectFileDialog } from "./select-file-dialog";

interface CreateMetaobjectEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metaobjectDefinition: Pick<MetaobjectDefinition, "id" | "name" | "fieldDefinitions">;
  onSubmit: (fields: Record<string, unknown>) => Promise<void>;
  isPending?: boolean;
  organizationId?: string;
}

export function CreateMetaobjectEntryDialog({
  open,
  onOpenChange,
  metaobjectDefinition,
  onSubmit,
  isPending = false,
  organizationId,
}: CreateMetaobjectEntryDialogProps) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [fileDialogFieldKey, setFileDialogFieldKey] = useState<string | null>(null);
  const [fileDialogFieldType, setFileDialogFieldType] = useState<"file_reference" | "file_reference_image" | "file_reference_video" | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFields({});
    }
    onOpenChange(newOpen);
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const requiredFields = metaobjectDefinition.fieldDefinitions.filter((def) => def.required);
    const missingFields = requiredFields.filter((def) => {
      const value = fields[def.key];
      return value === undefined || value === null || value === "";
    });

    if (missingFields.length > 0) {
      toast.error(`Please fill in required fields: ${missingFields.map((f) => f.name).join(", ")}`);
      return;
    }

    await onSubmit(fields);
    setFields({});
  };

  const renderFieldInput = (fieldDef: MetaobjectFieldDefinition) => {
    const value = fields[fieldDef.key];
    const isListType = fieldDef.type.startsWith("list.");
    const baseType = (isListType ? fieldDef.type.replace("list.", "") : fieldDef.type) as Exclude<MetaobjectFieldDefinition["type"], `list.${string}`>;

    if (isListType) {
      const listValue = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <div className="space-y-2">
          {listValue.map((item, index) => (
            <div key={index} className="flex items-center gap-2 min-w-0">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-move shrink-0" />
              <div className="flex-1 min-w-0">
                {renderSingleFieldInput(baseType, item, (newItem) => {
                  const newList = [...listValue];
                  newList[index] = newItem;
                  handleFieldChange(fieldDef.key, newList);
                }, fieldDef.key, index, true)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newList = listValue.filter((_, i) => i !== index);
                  handleFieldChange(fieldDef.key, newList.length > 0 ? newList : undefined);
                }}
                className="h-10 w-10 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newList = [...listValue, getFieldDefaultValue(baseType)];
              handleFieldChange(fieldDef.key, newList);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </div>
      );
    }

    return renderSingleFieldInput(fieldDef.type, value, (val) => handleFieldChange(fieldDef.key, val), fieldDef.key, -1, false);
  };

  const renderSingleFieldInput = (type: MetaobjectFieldDefinition["type"], currentValue: unknown, onValueChange: (val: unknown) => void, fieldKey: string, listIndex: number, isList: boolean) => {
    switch (type) {
      case MetaobjectFieldType.SINGLE_LINE_TEXT_FIELD:
        return (
          <Input
            type="text"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.MULTI_LINE_TEXT_FIELD:
      case MetaobjectFieldType.RICH_TEXT_FIELD:
        return (
          <Textarea
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            rows={4}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.NUMBER_INTEGER:
        return (
          <Input
            type="number"
            step="1"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseInt(val, 10));
            }}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.NUMBER_DECIMAL:
      case MetaobjectFieldType.MONEY:
        return (
          <Input
            type="number"
            step="0.01"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseFloat(val));
            }}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.FILE_REFERENCE:
      case MetaobjectFieldType.FILE_REFERENCE_IMAGE:
      case MetaobjectFieldType.FILE_REFERENCE_VIDEO: {
        const fileValue = currentValue === null || currentValue === undefined ? undefined : (Array.isArray(currentValue) ? currentValue : typeof currentValue === "string" ? [currentValue] : []);
        const fileUrls = fileValue || [];
        const isImage = type === MetaobjectFieldType.FILE_REFERENCE_IMAGE;
        const isVideo = type === MetaobjectFieldType.FILE_REFERENCE_VIDEO;
        const IconComponent = isImage ? ImageIcon : isVideo ? Video : FileIcon;
        const dialogKey = `${fieldKey}-${listIndex}`;

        return (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFileDialogFieldKey(dialogKey);
                setFileDialogFieldType(type as "file_reference" | "file_reference_image" | "file_reference_video");
                setFileDialogOpen(true);
              }}
              disabled={!organizationId}
              className="w-full"
            >
              <IconComponent className="h-4 w-4 mr-2" />
              Select {isImage ? "image" : isVideo ? "video" : "file"}
            </Button>
            {fileUrls.length > 0 && (
              <div className="space-y-2">
                {fileUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-md min-w-0">
                    {isImage && typeof url === "string" ? (
                      <img src={url} alt="" className="h-10 w-10 object-cover rounded shrink-0" />
                    ) : (
                      <IconComponent className="h-10 w-10 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm truncate">{typeof url === "string" ? url.split("/").pop() : "File"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newUrls = fileUrls.filter((_, i) => i !== index);
                        onValueChange(newUrls.length > 0 ? (isList ? newUrls : newUrls[0]) : undefined);
                      }}
                      className="h-8 w-8 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {organizationId && (
              <SelectFileDialog
                open={fileDialogOpen && fileDialogFieldKey === dialogKey}
                onOpenChange={setFileDialogOpen}
                onSelect={(selected) => {
                  const urls = Array.isArray(selected) ? selected : [selected];
                  onValueChange(urls.length > 0 ? (isList ? urls : urls[0]) : undefined);
                  setFileDialogOpen(false);
                }}
                organizationId={organizationId}
                fieldType={fileDialogFieldType || "file_reference"}
                multiple={isList}
                currentValue={fileUrls}
              />
            )}
          </div>
        );
      }

      case MetaobjectFieldType.METAOBJECT_REFERENCE:
        return (
          <Input
            type="text"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            placeholder="Enter metaobject ID"
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.URL:
        return (
          <Input
            type="url"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.DATE:
        return (
          <Input
            type="date"
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.split("T")[0] : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.DATE_TIME:
        return (
          <Input
            type="datetime-local"
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.slice(0, 16) : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.BOOLEAN:
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={currentValue === true}
              onCheckedChange={(checked) => onValueChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {currentValue === true ? "Yes" : "No"}
            </span>
          </div>
        );

      case MetaobjectFieldType.COLOR:
        return (
          <Input
            type="color"
            value={currentValue === null || currentValue === undefined ? "#000000" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full max-w-full"
          />
        );

      case MetaobjectFieldType.JSON:
        return (
          <Textarea
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onValueChange(parsed);
              } catch {
                onValueChange(e.target.value || undefined);
              }
            }}
            rows={6}
            placeholder='{"key": "value"}'
            className="w-full max-w-full"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className="w-full max-w-full"
          />
        );
    }
  };

  const getFieldDefaultValue = (type: MetaobjectFieldDefinition["type"]): unknown => {
    switch (type) {
      case MetaobjectFieldType.BOOLEAN:
        return false;
      case MetaobjectFieldType.NUMBER_INTEGER:
      case MetaobjectFieldType.NUMBER_DECIMAL:
      case MetaobjectFieldType.MONEY:
        return 0;
      case MetaobjectFieldType.JSON:
        return {};
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add {metaobjectDefinition.name}</DialogTitle>
          <DialogDescription>
            Create a new {metaobjectDefinition.name.toLowerCase()} entry
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          {metaobjectDefinition.fieldDefinitions.map((fieldDef) => (
            <div key={fieldDef.key} className="space-y-2 min-w-0">
              <Label htmlFor={`field-${fieldDef.key}`}>
                {fieldDef.name}
                {fieldDef.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {fieldDef.description && (
                <p className="text-xs text-muted-foreground">{fieldDef.description}</p>
              )}
              <div className="min-w-0">
                {renderFieldInput(fieldDef)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
