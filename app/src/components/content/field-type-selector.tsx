import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Type, AlignLeft, Hash, File, Link2, Calendar, ToggleLeft, Palette, Code, Database, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ProductMetafieldDefinition } from "@/core";

type BaseFieldType = Exclude<ProductMetafieldDefinition["type"], `list.${string}`>;

interface FieldTypeOption {
  value: BaseFieldType;
  labelKey: string;
  labelDefault: string;
  icon: React.ComponentType<{ className?: string }>;
  categoryKey: string;
  categoryDefault: string;
  categoryOrder: number;
}

const fieldTypes: FieldTypeOption[] = [
  // Recommended
  { value: "single_line_text_field", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.singleLineText", labelDefault: "Single line text", icon: Type, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.recommended", categoryDefault: "Recommended", categoryOrder: 0 },
  { value: "multi_line_text_field", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.multiLineText", labelDefault: "Multi-line text", icon: AlignLeft, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.recommended", categoryDefault: "Recommended", categoryOrder: 0 },
  { value: "number_integer", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.integer", labelDefault: "Integer", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.recommended", categoryDefault: "Recommended", categoryOrder: 0 },
  { value: "file_reference_image", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.imageFile", labelDefault: "Image (File)", icon: File, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.recommended", categoryDefault: "Recommended", categoryOrder: 0 },
  { value: "metaobject_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.metaobject", labelDefault: "Metaobject", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.recommended", categoryDefault: "Recommended", categoryOrder: 0 },

  // Text
  { value: "multi_line_text_field", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.multiLineText", labelDefault: "Multi-line text", icon: AlignLeft, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.text", categoryDefault: "Text", categoryOrder: 1 },
  { value: "rich_text_field", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.richText", labelDefault: "Rich text", icon: Type, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.text", categoryDefault: "Text", categoryOrder: 1 },
  { value: "single_line_text_field", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.singleLineText", labelDefault: "Single line text", icon: Type, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.text", categoryDefault: "Text", categoryOrder: 1 },
  { value: "single_line_text_field_choice_list", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.choiceListSingleLine", labelDefault: "Choice list (Single line text)", icon: Type, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.text", categoryDefault: "Text", categoryOrder: 1 },
  { value: "single_line_text_field_email", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.emailSingleLine", labelDefault: "Email (Single line text)", icon: Type, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.text", categoryDefault: "Text", categoryOrder: 1 },

  // Media
  { value: "file_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.file", labelDefault: "File", icon: File, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.media", categoryDefault: "Media", categoryOrder: 2 },
  { value: "file_reference_image", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.imageFile", labelDefault: "Image (File)", icon: File, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.media", categoryDefault: "Media", categoryOrder: 2 },
  { value: "file_reference_video", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.videoFile", labelDefault: "Video (File)", icon: File, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.media", categoryDefault: "Media", categoryOrder: 2 },

  // Reference
  { value: "metaobject_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.metaobject", labelDefault: "Metaobject", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "product_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.product", labelDefault: "Product", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "collection_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.collection", labelDefault: "Collection", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "article_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.blogPost", labelDefault: "Blog post", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "page_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.page", labelDefault: "Page", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "customer_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.customer", labelDefault: "Customer", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "order_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.order", labelDefault: "Order", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "company_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.company", labelDefault: "Company", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "variant_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.productVariant", labelDefault: "Product variant", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },
  { value: "mixed_reference", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.mixedReference", labelDefault: "Mixed reference", icon: Database, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.reference", categoryDefault: "Reference", categoryOrder: 3 },

  // Number
  { value: "id", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.id", labelDefault: "ID", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "money", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.money", labelDefault: "Money", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "number_decimal", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.decimal", labelDefault: "Decimal", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "number_integer", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.integer", labelDefault: "Integer", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "rating", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.rating", labelDefault: "Rating", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "weight", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.weight", labelDefault: "Weight", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "volume", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.volume", labelDefault: "Volume", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },
  { value: "dimension", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.dimension", labelDefault: "Dimension", icon: Hash, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.number", categoryDefault: "Number", categoryOrder: 4 },

  // Link
  { value: "link", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.link", labelDefault: "Link", icon: Link2, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.link", categoryDefault: "Link", categoryOrder: 5 },
  { value: "url", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.url", labelDefault: "URL", icon: Link2, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.link", categoryDefault: "Link", categoryOrder: 5 },

  // Date and time
  { value: "date", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.date", labelDefault: "Date", icon: Calendar, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.dateTime", categoryDefault: "Date and time", categoryOrder: 6 },
  { value: "date_time", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.dateTime", labelDefault: "Date and time", icon: Calendar, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.dateTime", categoryDefault: "Date and time", categoryOrder: 6 },

  // Other
  { value: "boolean", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.trueOrFalse", labelDefault: "True or false", icon: ToggleLeft, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.other", categoryDefault: "Other", categoryOrder: 7 },
  { value: "color", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.color", labelDefault: "Color", icon: Palette, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.other", categoryDefault: "Other", categoryOrder: 7 },

  // Advanced
  { value: "json", labelKey: "contentPages.metaobjects.fieldTypeSelector.labels.json", labelDefault: "JSON", icon: Code, categoryKey: "contentPages.metaobjects.fieldTypeSelector.categories.advanced", categoryDefault: "Advanced", categoryOrder: 8 },
];

interface FieldTypeSelectorProps {
  value?: BaseFieldType;
  onSelect: (type: BaseFieldType) => void;
  placeholder?: string;
}

export function FieldTypeSelector({ value, onSelect, placeholder = "Select field type" }: FieldTypeSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const translatedFieldTypes = fieldTypes.map((field) => ({
    ...field,
    label: t(field.labelKey, field.labelDefault),
    category: t(field.categoryKey, field.categoryDefault),
  }));

  const selectedField = translatedFieldTypes.find((f) => f.value === value);
  const Icon = selectedField?.icon || Type;

  const filteredTypes = translatedFieldTypes.filter((field) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      field.label.toLowerCase().includes(searchLower) ||
      field.category.toLowerCase().includes(searchLower) ||
      field.value.toLowerCase().includes(searchLower)
    );
  });

  const groupedTypes = filteredTypes.reduce((acc, field) => {
    if (!acc[field.categoryKey]) {
      acc[field.categoryKey] = {
        label: field.category,
        order: field.categoryOrder,
        items: [],
      };
    }
    acc[field.categoryKey].items.push(field);
    return acc;
  }, {} as Record<string, { label: string; order: number; items: (FieldTypeOption & { label: string; category: string })[] }>);

  const categories = Object.entries(groupedTypes).sort((a, b) => a[1].order - b[1].order);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span>{selectedField?.label || t("contentPages.metaobjects.fieldTypeSelector.placeholder", placeholder)}</span>
          </div>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={t("contentPages.metaobjects.fieldTypeSelector.searchPlaceholder", "Search field types...")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t("contentPages.metaobjects.fieldTypeSelector.empty", "No field type found.")}</CommandEmpty>
            {categories.map(([categoryKey, categoryGroup]) => (
              <CommandGroup key={categoryKey} heading={categoryGroup.label}>
                {categoryGroup.items.map((field) => {
                  const FieldIcon = field.icon;
                  return (
                    <CommandItem
                      key={field.value}
                      value={field.value}
                      onSelect={() => {
                        onSelect(field.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex items-center gap-2"
                    >
                      <FieldIcon className="h-4 w-4" />
                      <span>{field.label}</span>
                      {field.value === value && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {t("contentPages.metaobjects.fieldTypeSelector.selectedMark", "✓")}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
