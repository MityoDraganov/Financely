import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CURRENCIES } from "@/utils/currencies";

interface CurrencyComboboxProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  placeholder?: string;
}

export function CurrencyCombobox({
  value,
  onChange,
  className,
  placeholder = "Select currency",
}: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = CURRENCIES.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal h-9 ${className ?? ""}`}
        >
          <span className="truncate">
            {selected ? (
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-xs">{selected.code}</span>
                <span className="text-muted-foreground">·</span>
                <span>{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command
          filter={(val, search) => {
            const cur = CURRENCIES.find((c) => c.code === val);
            if (!cur) return 0;
            const q = search.toLowerCase();
            return cur.code.toLowerCase().includes(q) ||
              cur.name.toLowerCase().includes(q)
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Search currency…" />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {CURRENCIES.map((cur) => (
                <CommandItem
                  key={cur.code}
                  value={cur.code}
                  onSelect={(code) => {
                    onChange(code.toUpperCase());
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${
                      value === cur.code ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="font-mono text-xs mr-2 w-10 shrink-0">
                    {cur.code}
                  </span>
                  <span className="text-sm truncate">{cur.name}</span>
                  {cur.symbol && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {cur.symbol}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
