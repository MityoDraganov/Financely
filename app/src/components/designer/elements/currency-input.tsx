/**
 * Currency Input Element Component
 * Displays a currency input field with currency selector
 */

import { TemplateElement } from "@/core";
import { getCurrency } from "@/utils/currencies";

interface CurrencyInputElementProps {
  element: Extract<TemplateElement, { type: "currency" }> | Extract<TemplateElement, { type: "input"; variant: "currency" }>;
  zoom?: number;
}

export default function CurrencyInputElement({
  element,
}: CurrencyInputElementProps) {
  // Handle both currency element type and input variant for backward compatibility
  const currency = "currency" in element && element.currency ? element.currency : 
                   "variant" in element && element.variant === "currency" ? (element as any).currency || "USD" : "USD";
  const currencyInfo = getCurrency(currency);

  return (
    <div className="w-full h-full flex items-center gap-1 px-2 border border-border rounded bg-background">
      {/* Currency Selector */}
      <div className="flex items-center gap-1 text-[10px] text-foreground font-medium shrink-0">
        <span>{currency}</span>
        {currencyInfo?.symbol && (
          <span className="text-muted-foreground">{currencyInfo.symbol}</span>
        )}
      </div>
      
      {/* Input Field */}
      <input
        type="text"
        placeholder={element.placeholder || "0.00"}
        className="flex-1 min-w-0 text-[10px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
        style={{
          textAlign: element.align as React.CSSProperties["textAlign"],
        }}
        readOnly
      />

      {/* Link Indicator */}
      {element.mode === "linked" && element.currencyLinks && element.currencyLinks.length > 0 && (
        <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500" title="Linked field" />
      )}
    </div>
  );
}

