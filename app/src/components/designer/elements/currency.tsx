/**
 * Currency Element Component
 * Standalone currency input element (not a variant of input)
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Check, ChevronsUpDown } from "lucide-react";
import CurrencyInputElement from "./currency-input";
import { CurrencyFieldLinking } from "../currency-field-linking";
import { FormulaBuilder } from "../formula-builder";
import { CURRENCIES, getCurrency } from "@/utils/currencies";
import { cn } from "@/lib/utils";
import { typography, separators, components } from "../design-system";
import { GoogleFontPicker } from "@/components/designer/google-font-picker";
import { FieldCombobox } from "@/components/designer/field-combobox";

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
  const { t } = useTranslation();
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false);

  // Common position/size controls
  const common = (
    <section className={`${components.section} ${separators.subsectionDivider}`}>
      <h4 className={typography.subsectionTitle}>{t('designer.elementProperties.common.positionAndSize')}</h4>
      <div className={isNarrow ? components.gridNarrow : components.grid}>
        <div className={components.field}>
          <Label className={typography.fieldLabel}>{t('designer.elementProperties.common.x')}</Label>
          <Input
            type="number"
            value={element.x}
            onChange={(e) => onChange({ x: Number(e.target.value) })}
            className={components.inputHeight}
          />
        </div>
        <div className={components.field}>
          <Label className={typography.fieldLabel}>{t('designer.elementProperties.common.y')}</Label>
          <Input
            type="number"
            value={element.y}
            onChange={(e) => onChange({ y: Number(e.target.value) })}
            className={components.inputHeight}
          />
        </div>
        <div className={components.field}>
          <Label className={typography.fieldLabel}>{t('designer.elementProperties.common.width')}</Label>
          <Input
            type="number"
            value={element.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
            className={components.inputHeight}
          />
        </div>
        <div className={components.field}>
          <Label className={typography.fieldLabel}>{t('designer.elementProperties.common.height')}</Label>
          <Input
            type="number"
            value={element.height}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
            className={components.inputHeight}
          />
        </div>
      </div>
    </section>
  );

  return (
    <div className={components.section}>
      <h3 className={typography.sectionTitle}>{t('designer.elementProperties.currency.title')}</h3>
      
      {/* Currency Settings */}
      <section className={components.subsection}>
        <h4 className={typography.subsectionTitle}>{t('designer.elementProperties.currency.settings')}</h4>
        <div className={components.grid}>
          <div className={`${components.field} col-span-full`}>
            <Label className={typography.fieldLabel}>{t('designer.elementProperties.currency.placeholder')}</Label>
            <Input
              placeholder={t('designer.elementProperties.currency.placeholder')}
              value={element.placeholder}
              onChange={(e) =>
                onChange({
                  ...element,
                  placeholder: e.target.value,
                })
              }
              className={components.inputHeight}
            />
          </div>

          <div className={components.field}>
            <Label className={typography.fieldLabel}>{t('designer.elementProperties.currency.currency')}</Label>
            <Popover open={currencyPopoverOpen} onOpenChange={setCurrencyPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={`w-full justify-between ${components.inputHeight} text-xs`}
                >
                  {element.currency
                    ? (() => {
                        const curr = getCurrency(element.currency);
                        return curr
                          ? `${curr.code} - ${curr.name}${curr.symbol ? ` (${curr.symbol})` : ""}`
                          : element.currency;
                      })()
                    : t('designer.elementProperties.currency.selectCurrency')}
                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('designer.elementProperties.currency.searchCurrency')} />
                  <CommandList>
                    <CommandEmpty>{t('designer.elementProperties.currency.noCurrencyFound')}</CommandEmpty>
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

          <div className={components.field}>
            <Label className={typography.fieldLabel}>{t('designer.elementProperties.currency.align')}</Label>
            <Select
              value={element.align}
              onValueChange={(v) =>
                onChange({
                  ...element,
                  align: v as typeof element.align,
                })
              }
            >
              <SelectTrigger className={components.inputHeight}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">{t('designer.elementProperties.currency.alignments.left')}</SelectItem>
                <SelectItem value="center">{t('designer.elementProperties.currency.alignments.center')}</SelectItem>
                <SelectItem value="right">{t('designer.elementProperties.currency.alignments.right')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={components.field}>
            <GoogleFontPicker
              value={element.fontFamily}
              onChange={(fontFamily) =>
                onChange({
                  ...element,
                  fontFamily,
                })
              }
              label={t("designer.elementProperties.currency.fontFamily", "Font Family")}
              title={t("designer.elementProperties.currency.fontFamilyDialogTitle", "Choose Currency Font")}
            />
          </div>

          <div className={components.field}>
            <Label className={typography.fieldLabel}>{t('designer.elementProperties.currency.mode')}</Label>
            <Select
              value={element.mode || (element.formula ? "formula" : "independent")}
              onValueChange={(v) =>
                onChange({
                  ...element,
                  mode: v as "independent" | "linked" | "formula",
                })
              }
            >
              <SelectTrigger className={components.inputHeight}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="independent">{t('designer.elementProperties.currency.modes.independent')}</SelectItem>
                <SelectItem value="linked">{t('designer.elementProperties.currency.modes.linked')}</SelectItem>
                <SelectItem value="formula">{t('designer.elementProperties.currency.modes.formula')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={components.field}>
            <Label className={typography.fieldLabel}>{t('designer.elementProperties.binding.dataBinding')}</Label>
            <FieldCombobox
              value={element.binding}
              fieldId={element.fieldId}
              filterElementType="currency"
              onSelect={(fieldId, binding) => {
                onChange({
                  ...element,
                  binding: binding || undefined,
                  fieldId,
                  isCustomBinding: false,
                });
              }}
              onCustomBinding={(binding) => {
                onChange({
                  ...element,
                  binding,
                  fieldId: undefined,
                  isCustomBinding: true,
                });
              }}
            />
          </div>
        </div>
      </section>

      {/* Field Linking UI */}
      {element.mode === "linked" && (
        <section className={`${components.subsection} ${separators.subsectionDivider}`}>
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
        </section>
      )}

      {/* Formula Builder for Formula Mode */}
      {element.mode === "formula" && (
        <section className={`${components.subsection} ${separators.subsectionDivider}`}>
          <FormulaBuilder
            formula={element.formula}
            onChange={(formula) => {
              // If formula is cleared (undefined), also reset mode to independent and remove formula property
              if (formula === undefined) {
                const { formula: _, ...elementWithoutFormula } = element;
                onChange({
                  ...elementWithoutFormula,
                  mode: "independent",
                });
              } else {
              onChange({
                ...element,
                formula,
                });
            }
            }}
            currentElement={element}
            allElements={allElements}
          />
        </section>
      )}

      {common}
    </div>
  );
}
