import { MetafieldDefinition } from "@/core";
import { useMetaobject } from "@/hooks/repository-hooks/use-metaobjects";

interface MetafieldDisplayProps {
  metafield: {
    id: string;
    value?: unknown;
  };
  definition: MetafieldDefinition;
}

export function MetafieldDisplay({ metafield, definition }: MetafieldDisplayProps) {
  const metaobjectId = definition.type === "metaobject_reference" && typeof metafield.value === "string" ? metafield.value : undefined;
  const { data: metaobject } = useMetaobject(metaobjectId);

  const formatValue = (value: unknown, type: MetafieldDefinition["type"]): string => {
    if (value === null || value === undefined) {
      return "—";
    }

    if (type.startsWith("list.")) {
      if (Array.isArray(value)) {
        return value.length > 0 ? value.join(", ") : "—";
      }
      return "—";
    }

    switch (type) {
      case "boolean":
        return value === true ? "Yes" : value === false ? "No" : "—";
      case "number_integer":
      case "number_decimal":
      case "money":
      case "rating":
      case "weight":
      case "volume":
      case "dimension":
        return typeof value === "number" ? value.toString() : String(value);
      case "date":
        if (typeof value === "string") {
          try {
            return new Date(value).toLocaleDateString();
          } catch {
            return value;
          }
        }
        return String(value);
      case "date_time":
        if (typeof value === "string") {
          try {
            return new Date(value).toLocaleString();
          } catch {
            return value;
          }
        }
        return String(value);
      case "url":
      case "link":
        if (typeof value === "string") {
          return value;
        }
        return String(value);
      case "json":
        return JSON.stringify(value, null, 2);
      case "multi_line_text_field":
      case "rich_text_field":
        return String(value);
      default:
        return String(value);
    }
  };

  let value: string;
  if (definition.type === "metaobject_reference") {
    if (metaobject) {
      // Use first available field value as display name, or fall back to ID
      const firstFieldKey = metaobject.fields ? Object.keys(metaobject.fields)[0] : undefined;
      const displayName = firstFieldKey && metaobject.fields[firstFieldKey]
        ? String(metaobject.fields[firstFieldKey])
        : metaobject.id;
      value = displayName;
    } else if (typeof metafield.value === "string") {
      value = metafield.value;
    } else {
      value = formatValue(metafield.value, definition.type);
    }
  } else {
    value = formatValue(metafield.value, definition.type);
  }

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground">{definition.name}</div>
      {definition.description && (
        <div className="text-xs text-muted-foreground">{definition.description}</div>
      )}
      <div className="text-sm text-muted-foreground">
        {definition.type.startsWith("list.") || definition.type === "multi_line_text_field" || definition.type === "rich_text_field" || definition.type === "json" ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs bg-muted p-2 rounded">{value}</pre>
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}
