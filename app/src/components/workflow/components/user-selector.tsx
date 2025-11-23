import { useState } from "react";
import { Check, Search, User } from "lucide-react";
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
import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserSelectorProps {
  value?: string; // User ID
  onValueChange: (userId: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function UserSelector({
  value,
  onValueChange,
  placeholder = "Select user...",
  className,
}: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: organization } = useCurrentOrganization();
  const { data: members = [], isLoading } = useOrganizationMembers(organization?.id);

  const selectedUser = members.find((m) => m.id === value);

  // Filter users based on search query - search by name, email, role
  const filteredUsers = members.filter((user) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedUser ? (
              <>
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={selectedUser.avatarUrl} />
                  <AvatarFallback className="text-xs">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {selectedUser.name}
                </span>
                <span className="text-muted-foreground text-sm truncate hidden sm:inline">
                  ({selectedUser.email})
                </span>
              </>
            ) : (
              <>
                <User className="h-4 w-4 shrink-0 opacity-50" />
                <span className="text-muted-foreground">{placeholder}</span>
              </>
            )}
          </div>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <CommandEmpty>No users found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={`${user.id} ${user.name} ${user.email} ${user.role}`}
                    onSelect={() => {
                      onValueChange(user.id === value ? undefined : user.id);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{user.name}</span>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            user.role === "owner" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                            user.role === "admin" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                            user.role === "member" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                            user.role === "viewer" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          )}>
                            {user.role}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4 shrink-0",
                        value === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


