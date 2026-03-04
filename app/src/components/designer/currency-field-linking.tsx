/**
 * Currency Field Linking UI Component
 * Visual schematic interface for linking currency fields
 */

import { useState, useMemo } from "react";
import { ArrowRight, Link2, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { TemplateElement } from "@/core";
import type { CurrencyFieldLink } from "@/core/entities/currency-field";
import { validateLinking } from "@/services/currency-field-service";

interface CurrencyFieldLinkingProps {
  currentField: Extract<TemplateElement, { type: "currency" }>;
  allFields: TemplateElement[];
  onLinkChange: (links: CurrencyFieldLink[]) => void;
}

export function CurrencyFieldLinking({
  currentField,
  allFields,
  onLinkChange,
}: CurrencyFieldLinkingProps) {
  const [linkType, setLinkType] = useState<CurrencyFieldLink["type"]>("FX_PAIR");
  const [sourceFieldId, setSourceFieldId] = useState<string>("");
  const [multiplier, setMultiplier] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Get available currency fields (excluding current field)
  const availableFields = useMemo(() => {
    if (!allFields || !Array.isArray(allFields)) {
      return [];
    }
    return allFields.filter(
      (f) =>
        f.id !== currentField.id &&
        f.type === "currency"
    ) as Array<Extract<TemplateElement, { type: "currency" }>>;
  }, [allFields, currentField.id]);

  // Get target currency from current field (the field being configured)
  const targetCurrency = currentField.currency || "USD";

  // Validate and add link
  const handleAddLink = () => {
    setError(null);

    let newLink: CurrencyFieldLink;

    if (linkType === "FX_PAIR") {
      if (!sourceFieldId) {
        setError("Please select a source field");
        return;
      }

      // Get source field to check if currencies are different
      const sourceField = availableFields.find((f) => f.id === sourceFieldId);
      if (!sourceField) {
        setError("Source field not found");
        return;
      }

      // Warn if same currency (no conversion needed)
      if (sourceField.currency === targetCurrency) {
        setError(`Both fields use ${targetCurrency}. No conversion needed.`);
        return;
      }

      newLink = {
        type: "FX_PAIR",
        sourceFieldId,
        targetCurrency, // Use the current field's currency as target
        rateSource: "api",
        rateDate: new Date().toISOString(),
      };
    } else if (linkType === "FIXED_MULTIPLIER") {
      if (!multiplier || isNaN(parseFloat(multiplier))) {
        setError("Please enter a valid multiplier");
        return;
      }

      newLink = {
        type: "FIXED_MULTIPLIER",
        multiplier: parseFloat(multiplier),
      };
    } else {
      setError("Formula links not yet implemented");
      return;
    }

    // Validate linking doesn't create cycles
    // For table columns, allFields only contains columns from the same table
    const fieldsForValidation = (allFields || []).map((f) => ({
      id: f.id,
      links:
        f.id === currentField.id
          ? [...(currentField.currencyLinks || []), newLink]
          : f.type === "currency"
          ? (f.currencyLinks || [])
          : [],
    }));

    const validation = validateLinking(fieldsForValidation, {
      fieldId: currentField.id,
      link: newLink,
    });

    if (!validation.valid) {
      setError(validation.error || "Invalid link configuration");
      return;
    }

    // Add link
    const updatedLinks = [...(currentField.currencyLinks || []), newLink];
    onLinkChange(updatedLinks);

    // Reset form
    setSourceFieldId("");
    setMultiplier("");
  };

  const handleRemoveLink = (index: number) => {
    const updatedLinks = currentField.currencyLinks?.filter((_, i) => i !== index) || [];
    onLinkChange(updatedLinks);
  };

  const getSourceFieldName = (fieldId: string): string => {
    const field = availableFields.find((f) => f.id === fieldId);
    // For table columns, prefer header over binding
    if (field && "header" in field && field.header && typeof field.header === "string") {
      return field.header;
    }
    return field?.binding || field?.placeholder || `Field ${fieldId.slice(0, 6)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Currency Field Linking</h3>
      </div>

      {/* Existing Links */}
      {currentField.currencyLinks && currentField.currencyLinks.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-foreground">Active Links</Label>
          {currentField.currencyLinks.map((link, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded border border-border"
            >
              {link.type === "FX_PAIR" && link.sourceFieldId && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {getSourceFieldName(link.sourceFieldId)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{link.targetCurrency}</span>
                    </div>
                    {link.rate && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Rate: {link.rate.toFixed(6)}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => handleRemoveLink(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
              {link.type === "FIXED_MULTIPLIER" && link.multiplier !== undefined && (
                <>
                  <div className="flex-1 text-xs">
                    <span className="font-medium">Multiplier:</span> {link.multiplier}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => handleRemoveLink(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Link */}
      <div className="space-y-3 p-3 bg-muted/50 rounded border border-border">
        <Label className="text-xs text-foreground">Add Link</Label>

        {/* Link Type Selector */}
        <div className="space-y-1">
          <Label className="text-xs text-foreground">Link Type</Label>
          <Select
            value={linkType}
            onValueChange={(v) => setLinkType(v as CurrencyFieldLink["type"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FX_PAIR">Currency Conversion (FX_PAIR)</SelectItem>
              <SelectItem value="FIXED_MULTIPLIER">Fixed Multiplier</SelectItem>
              <SelectItem value="FORMULA" disabled>Formula (Coming Soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* FX_PAIR Configuration */}
        {linkType === "FX_PAIR" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-foreground">Source Field</Label>
              <Select value={sourceFieldId} onValueChange={setSourceFieldId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.length === 0 ? (
                    <SelectItem value="__no-source-fields__" disabled>
                      No other currency columns available in this table
                    </SelectItem>
                  ) : (
                    availableFields.map((field) => {
                      // For table columns, prefer header over binding
                      const displayName: string = ("header" in field && field.header && typeof field.header === "string") 
                        ? field.header 
                        : field.binding || field.placeholder || `Field ${field.id.slice(0, 6)}`;
                      return (
                        <SelectItem key={field.id} value={field.id}>
                          {displayName}
                          {field.currency && ` (${field.currency})`}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Visual Arrow - Show conversion preview */}
            {sourceFieldId && (
              <div className="flex items-center gap-2 p-2 bg-background rounded border border-primary/30 dark:border-primary/50">
                <div className="flex-1 text-xs text-foreground">
                  {(() => {
                    const sourceField = availableFields.find((f) => f.id === sourceFieldId);
                    return sourceField
                      ? `${getSourceFieldName(sourceFieldId)} (${sourceField.currency || "?"})`
                      : getSourceFieldName(sourceFieldId);
                  })()}
                </div>
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 text-xs font-medium text-primary">
                  {currentField.binding || currentField.placeholder || "This field"} ({targetCurrency})
                </div>
              </div>
            )}

            {/* Info about target currency */}
            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              Converting to <span className="font-medium text-foreground">{targetCurrency}</span> (this field's currency)
            </div>
          </>
        )}

        {/* FIXED_MULTIPLIER Configuration */}
        {linkType === "FIXED_MULTIPLIER" && (
          <div className="space-y-1">
            <Label className="text-xs text-foreground">Multiplier</Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="1.5"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {/* Add Button */}
        <Button
          type="button"
          size="sm"
          onClick={handleAddLink}
          className="w-full"
          disabled={
            (linkType === "FX_PAIR" && !sourceFieldId) ||
            (linkType === "FIXED_MULTIPLIER" && !multiplier)
          }
        >
          <Link2 className="h-3 w-3 mr-2" />
          Add Link
        </Button>
      </div>

      {/* Info */}
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Linked fields will automatically convert when the source field changes.
          Cycles are automatically prevented.
        </AlertDescription>
      </Alert>
    </div>
  );
}
