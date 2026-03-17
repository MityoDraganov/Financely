import { MetafieldDefinition } from "@/core";
import { useMetaobject } from "@/hooks/repository-hooks/use-metaobjects";

interface MetafieldDisplayProps {
  metafield: {
    id: string;
    value?: unknown;
  };
  definition: MetafieldDefinition;
}

type SelectOption = {
  label: string;
  value: string;
};

type DateConfig = {
  selectionMode: "single" | "period";
  precision: "date" | "month";
};

type YearMonth = {
  year: number;
  month: number;
};

const PERIOD_SEPARATOR = "..";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseDateValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseYearMonthValue = (value: string): YearMonth | null => {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
};

const formatYearMonth = (value: YearMonth): string => `${MONTH_LABELS[value.month - 1]} ${value.year}`;

export function MetafieldDisplay({ metafield, definition }: MetafieldDisplayProps) {
  const metaobjectId = definition.type === "metaobject_reference" && typeof metafield.value === "string" ? metafield.value : undefined;
  const { data: metaobject } = useMetaobject(metaobjectId);
  const selectOptions = (definition.options?.selectOptions || []) as SelectOption[];
  const dateConfig: DateConfig = {
    selectionMode: definition.options?.dateConfig?.selectionMode || "single",
    precision: definition.options?.dateConfig?.precision || "date",
  };

  const formatDateValue = (value: string): string => {
    if (dateConfig.precision === "month") {
      if (dateConfig.selectionMode === "period" && value.includes(PERIOD_SEPARATOR)) {
        const [startRaw, endRaw] = value.split(PERIOD_SEPARATOR);
        const start = startRaw ? parseYearMonthValue(startRaw) : null;
        const end = endRaw ? parseYearMonthValue(endRaw) : null;
        if (start && end) return `${formatYearMonth(start)} - ${formatYearMonth(end)}`;
      }
      const singleMonth = parseYearMonthValue(value);
      if (singleMonth) return formatYearMonth(singleMonth);
      return value;
    }

    if (dateConfig.selectionMode === "period" && value.includes(PERIOD_SEPARATOR)) {
      const [startRaw, endRaw] = value.split(PERIOD_SEPARATOR);
      const start = startRaw ? parseDateValue(startRaw) : null;
      const end = endRaw ? parseDateValue(endRaw) : null;
      if (start && end) return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }

    const singleDate = parseDateValue(value);
    if (singleDate) return singleDate.toLocaleDateString();
    return value;
  };

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
          return formatDateValue(value);
        }
        return String(value);
      case "date_time":
        if (typeof value === "string") {
          const parsedDateTime = new Date(value);
          if (Number.isNaN(parsedDateTime.getTime())) {
            return value;
          }
          return parsedDateTime.toLocaleString();
        }
        return String(value);
      case "url":
      case "link":
        if (typeof value === "string") {
          return value;
        }
        return String(value);
      case "single_line_text_field_choice_list":
        if (typeof value === "string") {
          const selectedOption = selectOptions.find((option) => option.value === value);
          return selectedOption?.label || value;
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
