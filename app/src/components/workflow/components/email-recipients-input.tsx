import { useState, useRef, useEffect, useMemo } from "react";
import { Mail, X, ChevronDown, ChevronUp, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useContactsByOrg } from "@/hooks/repository-hooks/use-contacts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EmailRecipientsInputProps {
  value: string[]; // Array of email addresses
  onChange: (emails: string[]) => void;
  placeholder?: string;
  className?: string;
}

interface EmailOption {
  email: string;
  name: string;
  type: "user" | "contact";
  avatarUrl?: string;
}

export function EmailRecipientsInput({
  value,
  onChange,
  placeholder = "Enter email addresses...",
  className,
}: EmailRecipientsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: organization } = useCurrentOrganization();
  const { data: members = [] } = useOrganizationMembers(organization?.id);
  const { data: contacts = [] } = useContactsByOrg(organization?.id);

  // Build email options from members and contacts
  const emailOptions = useMemo<EmailOption[]>(() => {
    const options: EmailOption[] = [];

    // Add organization members
    members.forEach((member) => {
      if (member.email) {
        options.push({
          email: member.email,
          name: member.name,
          type: "user",
          avatarUrl: member.avatarUrl,
        });
      }
    });

    // Add contacts
    contacts.forEach((contact) => {
      const contactData = (contact as any).data || contact;
      if (contactData.email) {
        const firstName = contactData.firstName || "";
        const lastName = contactData.lastName || "";
        const name = `${firstName} ${lastName}`.trim() || contactData.email;
        
        options.push({
          email: contactData.email,
          name,
          type: "contact",
        });
      }
    });

    // Remove duplicates by email
    const uniqueOptions = new Map<string, EmailOption>();
    options.forEach((option) => {
      if (!uniqueOptions.has(option.email.toLowerCase())) {
        uniqueOptions.set(option.email.toLowerCase(), option);
      }
    });

    return Array.from(uniqueOptions.values());
  }, [members, contacts]);

  // Filter options based on input
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim() && !showAll) {
      return [];
    }

    const query = inputValue.trim().toLowerCase();
    const alreadySelected = new Set(value.map((e) => e.toLowerCase()));

    return emailOptions.filter((option) => {
      // Exclude already selected emails
      if (alreadySelected.has(option.email.toLowerCase())) {
        return false;
      }

      // If showAll is true, show all (except selected)
      if (showAll) {
        return true;
      }

      // Otherwise filter by query
      return (
        option.email.toLowerCase().includes(query) ||
        option.name.toLowerCase().includes(query)
      );
    });
  }, [inputValue, emailOptions, value, showAll]);

  // Show suggestions only when focused and (input has value OR showAll is true)
  const shouldShowSuggestions = isFocused && (inputValue.trim().length > 0 || showAll);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowAll(false); // Hide show all when user types
  };

  // Handle selecting an email
  const handleSelectEmail = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!value.some((e) => e.toLowerCase() === normalizedEmail)) {
      onChange([...value, email.trim()]);
    }
    setInputValue("");
    setShowAll(false);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Handle removing an email
  const handleRemoveEmail = (emailToRemove: string) => {
    onChange(value.filter((email) => email.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  // Handle input keydown (Enter to add, Backspace to remove last)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelectEmail(filteredOptions[0].email);
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      handleRemoveEmail(value[value.length - 1]);
    } else if (e.key === "," || e.key === ";") {
      e.preventDefault();
      const email = inputValue.trim();
      if (email && email.includes("@")) {
        handleSelectEmail(email);
      }
    }
  };

  // Handle paste (extract emails from pasted text)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const emails = pastedText
      .split(/[,;\s]+/)
      .map((email) => email.trim())
      .filter((email) => email.includes("@") && email.length > 0);

    if (emails.length > 0) {
      const newEmails = emails.filter(
        (email) => !value.some((e) => e.toLowerCase() === email.toLowerCase())
      );
      if (newEmails.length > 0) {
        onChange([...value, ...newEmails]);
      }
      setInputValue("");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2 min-h-[42px] p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {/* Selected email badges */}
        {value.map((email) => (
          <Badge
            key={email}
            variant="secondary"
            className="flex items-center gap-1.5 px-2 py-1 pr-1"
          >
            <Mail className="w-3 h-3" />
            <span className="text-xs">{email}</span>
            <button
              type="button"
              onClick={() => handleRemoveEmail(email)}
              className="ml-1 rounded-full hover:bg-muted p-0.5 transition-colors"
              onMouseDown={(e) => e.preventDefault()}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        {/* Input and suggestions */}
        <div className="flex-1 min-w-[200px] relative">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => {
              setIsFocused(true);
              if (inputValue.trim().length > 0 || showAll) {
                setOpen(true);
              }
            }}
            onBlur={(e) => {
              // Delay to allow click on suggestion
              setTimeout(() => {
                setIsFocused(false);
                setOpen(false);
              }, 200);
            }}
            placeholder={value.length === 0 ? placeholder : "Add more emails..."}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto p-0 min-w-[120px]"
          />

          {/* Suggestions popover */}
          {shouldShowSuggestions && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <div className="absolute inset-0 pointer-events-none" />
              </PopoverTrigger>
              <PopoverContent
                className="w-[400px] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    {filteredOptions.length === 0 ? (
                      <CommandEmpty>
                        {showAll
                          ? "No emails available"
                          : "No matching emails found"}
                      </CommandEmpty>
                    ) : (
                      <>
                        <CommandGroup heading="Organization Members & Contacts">
                          {filteredOptions.map((option) => (
                            <CommandItem
                              key={`${option.type}-${option.email}`}
                              value={`${option.email} ${option.name}`}
                              onSelect={() => handleSelectEmail(option.email)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={option.avatarUrl} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(option.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-medium truncate">
                                    {option.name}
                                  </span>
                                  <span className="text-sm text-muted-foreground truncate">
                                    {option.email}
                                  </span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {option.type === "user" ? (
                                    <User className="w-3 h-3 mr-1" />
                                  ) : (
                                    <Users className="w-3 h-3 mr-1" />
                                  )}
                                  {option.type === "user" ? "User" : "Contact"}
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Show all button */}
        {!showAll && emailOptions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={() => {
              setShowAll(true);
              setOpen(true);
              inputRef.current?.focus();
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            <span className="text-xs">Show all ({emailOptions.length})</span>
          </Button>
        )}

        {/* Hide all button */}
        {showAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={() => {
              setShowAll(false);
              setOpen(false);
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ChevronUp className="w-4 h-4 mr-1" />
            <span className="text-xs">Hide</span>
          </Button>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {value.length === 0
          ? "Type to search or click 'Show all' to browse emails"
          : `${value.length} recipient${value.length !== 1 ? "s" : ""} selected`}
      </p>
    </div>
  );
}

