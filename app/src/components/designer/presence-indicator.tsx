import { UserPresence } from "@/services/presence/presence-service";
import { PresenceAvatar } from "./presence-avatar";
import { cn } from "@/lib/utils";

interface PresenceIndicatorProps {
  users: UserPresence[];
  maxVisible?: number;
  className?: string;
}

export function PresenceIndicator({ 
  users, 
  maxVisible = 4, 
  className 
}: PresenceIndicatorProps) {
  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = Math.max(0, users.length - maxVisible);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visibleUsers.map((user) => (
        <PresenceAvatar
          key={user.uid}
          user={user}
          size="sm"
          className="hover:z-10 transition-transform hover:scale-110"
        />
      ))}
      
      {remainingCount > 0 && (
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
