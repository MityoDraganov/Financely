import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { languages, searchLanguages } from "@/utils/languages";

interface LanguageSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  excludedLanguages?: string[];
  placeholder?: string;
  className?: string;
}

export function LanguageSelector({
  value,
  onValueChange,
  excludedLanguages = [],
  placeholder = "Select language...",
  className,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedLanguage = value ? languages.find((lang) => lang.code === value) : undefined;
  const availableLanguages = languages.filter(
    (lang) => !excludedLanguages.includes(lang.code)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedLanguage ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedLanguage.flag}</span>
              <span>{selectedLanguage.name}</span>
              <span className="text-muted-foreground text-sm">
                ({selectedLanguage.nativeName})
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search languages by name, code, or country..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {(searchQuery
                ? searchLanguages(searchQuery).filter((lang) => !excludedLanguages.includes(lang.code))
                : availableLanguages
              ).map((lang) => (
                <CommandItem
                  key={lang.code}
                  value={`${lang.code} ${lang.name} ${lang.nativeName} ${lang.countries.join(" ")}`}
                  onSelect={() => {
                    onValueChange(lang.code === value ? "" : lang.code);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xl">{lang.flag}</span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lang.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {lang.code}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">
                        {lang.nativeName}
                      </span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0",
                      value === lang.code ? "opacity-100" : "opacity-0"
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

