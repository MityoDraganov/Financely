import { useState } from "react";
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
import { MetaobjectFieldDefinition } from "@/core";

type BaseFieldType = Exclude<MetaobjectFieldDefinition["type"], `list.${string}`>;

interface FieldTypeOption {
  value: BaseFieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const fieldTypes: FieldTypeOption[] = [
  // Recommended
  { value: "single_line_text_field", label: "Single line text", icon: Type, category: "Recommended" },
  { value: "multi_line_text_field", label: "Multi-line text", icon: AlignLeft, category: "Recommended" },
  { value: "number_integer", label: "Integer", icon: Hash, category: "Recommended" },
  { value: "file_reference_image", label: "Image (File)", icon: File, category: "Recommended" },
  { value: "metaobject_reference", label: "Metaobject", icon: Database, category: "Recommended" },
  
  // Text
  { value: "multi_line_text_field", label: "Multi-line text", icon: AlignLeft, category: "Text" },
  { value: "rich_text_field", label: "Rich text", icon: Type, category: "Text" },
  { value: "single_line_text_field", label: "Single line text", icon: Type, category: "Text" },
  { value: "single_line_text_field_choice_list", label: "Choice list (Single line text)", icon: Type, category: "Text" },
  { value: "single_line_text_field_email", label: "Email (Single line text)", icon: Type, category: "Text" },
  
  // Media
  { value: "file_reference", label: "File", icon: File, category: "Media" },
  { value: "file_reference_image", label: "Image (File)", icon: File, category: "Media" },
  { value: "file_reference_video", label: "Video (File)", icon: File, category: "Media" },
  
  // Reference
  { value: "metaobject_reference", label: "Metaobject", icon: Database, category: "Reference" },
  { value: "product_reference", label: "Product", icon: Database, category: "Reference" },
  { value: "collection_reference", label: "Collection", icon: Database, category: "Reference" },
  { value: "article_reference", label: "Blog post", icon: Database, category: "Reference" },
  { value: "page_reference", label: "Page", icon: Database, category: "Reference" },
  { value: "customer_reference", label: "Customer", icon: Database, category: "Reference" },
  { value: "order_reference", label: "Order", icon: Database, category: "Reference" },
  { value: "company_reference", label: "Company", icon: Database, category: "Reference" },
  { value: "variant_reference", label: "Product variant", icon: Database, category: "Reference" },
  { value: "mixed_reference", label: "Mixed reference", icon: Database, category: "Reference" },
  
  // Number
  { value: "id", label: "ID", icon: Hash, category: "Number" },
  { value: "money", label: "Money", icon: Hash, category: "Number" },
  { value: "number_decimal", label: "Decimal", icon: Hash, category: "Number" },
  { value: "number_integer", label: "Integer", icon: Hash, category: "Number" },
  { value: "rating", label: "Rating", icon: Hash, category: "Number" },
  { value: "weight", label: "Weight", icon: Hash, category: "Number" },
  { value: "volume", label: "Volume", icon: Hash, category: "Number" },
  { value: "dimension", label: "Dimension", icon: Hash, category: "Number" },
  
  // Link
  { value: "link", label: "Link", icon: Link2, category: "Link" },
  { value: "url", label: "URL", icon: Link2, category: "Link" },
  
  // Date and time
  { value: "date", label: "Date", icon: Calendar, category: "Date and time" },
  { value: "date_time", label: "Date and time", icon: Calendar, category: "Date and time" },
  
  // Other
  { value: "boolean", label: "True or false", icon: ToggleLeft, category: "Other" },
  { value: "color", label: "Color", icon: Palette, category: "Other" },
  
  // Advanced
  { value: "json", label: "JSON", icon: Code, category: "Advanced" },
];

interface FieldTypeSelectorProps {
  value?: BaseFieldType;
  onSelect: (type: BaseFieldType) => void;
  placeholder?: string;
}

export function FieldTypeSelector({ value, onSelect, placeholder = "Select field type" }: FieldTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedField = fieldTypes.find((f) => f.value === value);
  const Icon = selectedField?.icon || Type;

  const filteredTypes = fieldTypes.filter((field) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      field.label.toLowerCase().includes(searchLower) ||
      field.category.toLowerCase().includes(searchLower) ||
      field.value.toLowerCase().includes(searchLower)
    );
  });

  const groupedTypes = filteredTypes.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldTypeOption[]>);

  const categories = Object.keys(groupedTypes).sort((a, b) => {
    const order = ["Recommended", "Text", "Media", "Reference", "Number", "Link", "Date and time", "Other", "Advanced"];
    return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b));
  });

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
            <span>{selectedField?.label || placeholder}</span>
          </div>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search field types..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No field type found.</CommandEmpty>
            {categories.map((category) => (
              <CommandGroup key={category} heading={category}>
                {groupedTypes[category].map((field) => {
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
                        <span className="ml-auto text-xs text-muted-foreground">✓</span>
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
