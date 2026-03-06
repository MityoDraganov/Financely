import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/currencies";
import type { Product } from "@/core/entities/product";

interface ProductSelectorProps {
  products: Product[];
  value?: string; // Product ID
  onValueChange: (productId: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function ProductSelector({
  products,
  value,
  onValueChange,
  placeholder,
  className,
}: ProductSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const effectivePlaceholder =
    placeholder || t("productSelector.selectProduct");

  const selectedProduct = products.find((p) => p.id === value);

  // Filter products based on search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedProduct ? selectedProduct.name : effectivePlaceholder}
            </span>
          </div>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("productSelector.searchPlaceholder")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>{t("productSelector.noProductsFound")}</CommandEmpty>
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.id} ${product.name} ${product.sku || ""} ${product.category || ""}`}
                  onSelect={() => {
                    onValueChange(product.id === value ? undefined : product.id);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{product.name}</span>
                        {product.sku && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {t("productSelector.skuLabel", { sku: product.sku })}
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {product.description}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-medium">
                          {formatCurrency(product.price, product.currency)}
                        </span>
                        {product.category && (
                          <span className="text-xs text-muted-foreground">
                            • {product.category}
                          </span>
                        )}
                        {product.trackInventory && product.stockQuantity !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {t("productSelector.stockLabel", {
                              count: product.stockQuantity,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
