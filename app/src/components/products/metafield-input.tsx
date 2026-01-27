import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductMetafieldDefinition } from "@/core";
import { useMetaobjects, useMetaobjectDefinitions } from "@/hooks/repository-hooks/use-metaobjects";

interface MetafieldInputProps {
  definition: ProductMetafieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  organizationId?: string;
}

export function MetafieldInput({ definition, value, onChange, error, organizationId }: MetafieldInputProps) {
  const isListType = definition.type.startsWith("list.");
  const baseType = isListType ? definition.type.replace("list.", "") : definition.type;
  
  const { data: metaobjects = [] } = useMetaobjects(organizationId);
  const { data: metaobjectDefinitions = [] } = useMetaobjectDefinitions(organizationId);

  const handleChange = (newValue: unknown) => {
    onChange(newValue);
  };

  const renderInput = () => {
    if (isListType) {
      const listValue = Array.isArray(value) ? value : value ? [value] : [];
      
      return (
        <div className="space-y-2">
          {listValue.map((item, index) => (
            <div key={index} className="flex gap-2">
              {renderSingleInput(baseType, item, (newItem) => {
                const newList = [...listValue];
                newList[index] = newItem;
                handleChange(newList);
              })}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newList = listValue.filter((_, i) => i !== index);
                  handleChange(newList.length > 0 ? newList : undefined);
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
              const newList = [...listValue, getDefaultValue(baseType)];
              handleChange(newList);
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </div>
      );
    }

    return renderSingleInput(definition.type, value, handleChange);
  };

  const renderSingleInput = (type: string, currentValue: unknown, onValueChange: (val: unknown) => void) => {
    switch (type) {
      case "single_line_text_field":
      case "single_line_text_field_email":
      case "single_line_text_field_choice_list":
      case "url":
      case "link":
        return (
          <Input
            type={type === "single_line_text_field_email" ? "email" : type === "url" || type === "link" ? "url" : "text"}
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "multi_line_text_field":
      case "rich_text_field":
        return (
          <Textarea
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            rows={4}
            className={error ? "border-destructive" : ""}
          />
        );

      case "number_integer":
        return (
          <Input
            type="number"
            step="1"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseInt(val, 10));
            }}
            className={error ? "border-destructive" : ""}
          />
        );

      case "number_decimal":
      case "money":
      case "rating":
      case "weight":
      case "volume":
      case "dimension":
        return (
          <Input
            type="number"
            step="0.01"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => {
              const val = e.target.value;
              onValueChange(val === "" ? undefined : parseFloat(val));
            }}
            className={error ? "border-destructive" : ""}
          />
        );

      case "boolean":
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

      case "date":
        return (
          <Input
            type="date"
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.split("T")[0] : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "date_time":
        return (
          <Input
            type="datetime-local"
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue.slice(0, 16) : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "json":
        return (
          <Textarea
            value={currentValue === null || currentValue === undefined ? "" : typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const val = e.target.value.trim();
                if (!val) {
                  onValueChange(undefined);
                  return;
                }
                const parsed = JSON.parse(val);
                onValueChange(parsed);
              } catch {
                onValueChange(e.target.value);
              }
            }}
            rows={6}
            className={`font-mono text-xs ${error ? "border-destructive" : ""}`}
            placeholder='{"key": "value"}'
          />
        );

      case "color":
        return (
          <Input
            type="color"
            value={currentValue === null || currentValue === undefined ? "#000000" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value)}
            className={error ? "border-destructive" : ""}
          />
        );

      case "metaobject_reference":
        if (!organizationId) {
          return (
            <Input
              type="text"
              value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
              onChange={(e) => onValueChange(e.target.value || undefined)}
              placeholder="Enter metaobject ID"
              className={error ? "border-destructive" : ""}
              disabled
            />
          );
        }
        const allowedMetaobjectDefinitionId = definition.metaobjectDefinitionId;
        const filteredMetaobjects = allowedMetaobjectDefinitionId
          ? metaobjects.filter((metaobject) => metaobject.definitionId === allowedMetaobjectDefinitionId)
          : metaobjects;
        
        return (
          <Select
            value={currentValue === null || currentValue === undefined ? "__none__" : String(currentValue)}
            onValueChange={(val) => onValueChange(val === "__none__" ? undefined : val)}
          >
            <SelectTrigger className={error ? "border-destructive" : ""}>
              <SelectValue placeholder="Select a metaobject" />
            </SelectTrigger>
            <SelectContent>
              {filteredMetaobjects.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {allowedMetaobjectDefinitionId 
                    ? "No metaobjects available for this definition" 
                    : "No metaobjects available"}
                </div>
              ) : (
                <>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredMetaobjects.map((metaobject) => {
                    const metaobjectDefinition = metaobjectDefinitions.find((def) => def.id === metaobject.definitionId);
                    const displayName = metaobject.displayNameKey && metaobject.fields && metaobject.fields[metaobject.displayNameKey]
                      ? String(metaobject.fields[metaobject.displayNameKey])
                      : metaobject.id;
                    const typeLabel = metaobjectDefinition?.name;
                    const fullLabel = typeLabel && typeLabel !== displayName 
                      ? `${displayName} (${typeLabel})`
                      : displayName;
                    return (
                      <SelectItem key={metaobject.id} value={metaobject.id}>
                        {fullLabel}
                      </SelectItem>
                    );
                  })}
                </>
              )}
            </SelectContent>
          </Select>
        );

      case "id":
      case "file_reference":
      case "file_reference_image":
      case "file_reference_video":
      case "article_reference":
      case "collection_reference":
      case "company_reference":
      case "customer_reference":
      case "order_reference":
      case "page_reference":
      case "product_reference":
      case "variant_reference":
      case "mixed_reference":
        return (
          <Input
            type="text"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            placeholder="Enter ID"
            className={error ? "border-destructive" : ""}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={currentValue === null || currentValue === undefined ? "" : String(currentValue)}
            onChange={(e) => onValueChange(e.target.value || undefined)}
            className={error ? "border-destructive" : ""}
          />
        );
    }
  };

  const getDefaultValue = (type: string): unknown => {
    switch (type) {
      case "boolean":
        return false;
      case "number_integer":
      case "number_decimal":
      case "money":
      case "rating":
      case "weight":
      case "volume":
      case "dimension":
        return 0;
      case "json":
        return {};
      default:
        return "";
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`metafield-${definition.id}`}>
        {definition.name}
        {definition.description && (
          <span className="text-xs text-muted-foreground ml-2">({definition.description})</span>
        )}
      </Label>
      {renderInput()}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
