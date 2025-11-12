/**
 * Currency Element Component
 * Standalone currency input element (not a variant of input)
 */

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TemplateElement } from "@/core";
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import CurrencyInputElement from "./currency-input";
import { CurrencyFieldLinking } from "../currency-field-linking";
import { CURRENCIES, getCurrency } from "@/utils/currencies";
import { cn } from "@/lib/utils";

interface CurrencyElementProps {
  element: Extract<TemplateElement, { type: "currency" }>;
  zoom?: number;
}

export default function CurrencyElement({ element, zoom = 1 }: CurrencyElementProps) {
  // Reuse the currency input component but adapt the type
  const adaptedElement = {
    ...element,
    type: "input" as const,
    variant: "currency" as const,
  } as Extract<TemplateElement, { type: "input"; variant: "currency" }>;

  return <CurrencyInputElement element={adaptedElement} zoom={zoom} />;
}

interface CurrencyPropertiesProps {
  element: Extract<TemplateElement, { type: "currency" }>;
  onChange: (partial: Partial<TemplateElement>) => void;
  isNarrow?: boolean;
  allElements?: TemplateElement[];
}

export function CurrencyProperties({
  element,
  onChange,
  isNarrow,
  allElements = [],
}: CurrencyPropertiesProps) {
  const [bindingInput, setBindingInput] = useState(element.binding ?? "");
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false);

  // Check for duplicate bindings
  const hasDuplicateBinding = (binding: string | undefined): boolean => {
    if (!binding) return false;
    return allElements.some((el) => {
      if (el.id === element.id) return false;
      if (el.type === "text" || el.type === "input" || el.type === "image" || el.type === "currency") {
        return el.binding === binding;
      }
      if (el.type === "table") {
        return el.itemsBinding === binding;
      }
      return false;
    });
  };

  // Generate a unique binding suggestion
  const getUniqueBinding = (binding: string): string => {
    if (!binding) return "";
    let counter = 1;
    let suggested = binding;
    while (hasDuplicateBinding(suggested)) {
      suggested = `${binding} (${counter})`;
      counter++;
    }
    return suggested;
  };

  const bindingError = hasDuplicateBinding(bindingInput);
  const suggestedBinding = bindingError ? getUniqueBinding(bindingInput) : null;

  // Sync with element binding when it changes externally
  useEffect(() => {
    setBindingInput(element.binding ?? "");
  }, [element.binding]);

  // Common position/size controls
  const common = (
    <div className={isNarrow ? "grid grid-cols-1 gap-2" : "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2"}>
      <div className="space-y-1">
        <Label className="text-xs">X</Label>
        <Input
          type="number"
          value={element.x}
          onChange={(e) => onChange({ x: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Y</Label>
        <Input
          type="number"
          value={element.y}
          onChange={(e) => onChange({ y: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Width</Label>
        <Input
          type="number"
          value={element.width}
          onChange={(e) => onChange({ width: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Height</Label>
        <Input
          type="number"
          value={element.height}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">Currency</div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Placeholder</Label>
          <Input
            placeholder="Placeholder"
            value={element.placeholder}
            onChange={(e) =>
              onChange({
                ...element,
                placeholder: e.target.value,
              })
            }
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Currency</Label>
          <Popover open={currencyPopoverOpen} onOpenChange={setCurrencyPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-9 text-xs"
              >
                {element.currency
                  ? (() => {
                      const curr = getCurrency(element.currency);
                      return curr
                        ? `${curr.code} - ${curr.name}${curr.symbol ? ` (${curr.symbol})` : ""}`
                        : element.currency;
                    })()
                  : "Select currency..."}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search currency..." />
                <CommandList>
                  <CommandEmpty>No currency found.</CommandEmpty>
                  <CommandGroup>
                    {CURRENCIES.map((curr) => (
                      <CommandItem
                        key={curr.code}
                        value={`${curr.code} ${curr.name} ${curr.symbol || ""}`}
                        onSelect={() => {
                          onChange({
                            ...element,
                            currency: curr.code,
                          });
                          setCurrencyPopoverOpen(false);
                        }}
                        className="text-xs cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            element.currency === curr.code
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="font-medium">{curr.code}</span>
                        <span className="ml-2 text-neutral-500">
                          - {curr.name}
                        </span>
                        {curr.symbol && (
                          <span className="ml-1 text-neutral-400">
                            ({curr.symbol})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Align</Label>
          <Select
            value={element.align}
            onValueChange={(v) =>
              onChange({
                ...element,
                align: v as typeof element.align,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Mode</Label>
          <Select
            value={element.mode || "independent"}
            onValueChange={(v) =>
              onChange({
                ...element,
                mode: v as "independent" | "linked" | "formula",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="independent">Independent</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="formula" disabled>Formula (Coming Soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Binding</Label>
          <div className="space-y-1.5">
            <Input
              placeholder="invoice.total"
              value={bindingInput}
              className={bindingError ? "border-amber-500 focus-visible:ring-amber-500" : ""}
              onChange={(e) => {
                const newValue = e.target.value;
                setBindingInput(newValue);
                onChange({
                  ...element,
                  binding: newValue || undefined,
                });
              }}
            />
            {bindingError && suggestedBinding && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-800 mb-1">
                    This binding is already used by another element
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-amber-700 flex-1 truncate">
                      Suggested: <span className="font-mono font-medium">{suggestedBinding}</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs border-amber-300 bg-white hover:bg-amber-100 shrink-0"
                      onClick={() => {
                        setBindingInput(suggestedBinding);
                        onChange({
                          ...element,
                          binding: suggestedBinding,
                        });
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Use
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Field Linking UI */}
      {element.mode === "linked" && (
        <div className="pt-3 border-t border-neutral-200">
          <CurrencyFieldLinking
            currentField={element}
            allFields={allElements || []}
            onLinkChange={(links) =>
              onChange({
                ...element,
                currencyLinks: links,
              })
            }
          />
        </div>
      )}

      {common}
    </div>
  );
}

