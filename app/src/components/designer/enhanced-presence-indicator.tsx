import { UserPresence } from "@/services/presence/presence-service";
import { PresenceAvatar } from "./presence-avatar";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EnhancedPresenceIndicatorProps {
  users: UserPresence[];
  maxVisible?: number;
  className?: string;
}

export function EnhancedPresenceIndicator({ 
  users, 
  maxVisible = 4, 
  className 
}: EnhancedPresenceIndicatorProps) {
  // Filter out invalid users
  const validUsers = users.filter(user => 
    user && 
    user.uid && 
    user.displayName &&
    user.isActive !== false
  );

  if (validUsers.length === 0) {
    return null;
  }

  const visibleUsers = validUsers.slice(0, maxVisible);
  const remainingCount = Math.max(0, validUsers.length - maxVisible);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* User avatars */}
      <div className="flex items-center gap-1">
        {visibleUsers.map((user) => (
          <TooltipProvider key={user.uid}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <PresenceAvatar
                    user={user}
                    size="sm"
                    className="hover:z-10 transition-transform hover:scale-110"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center space-y-1">
                  <p className="font-medium">{user.displayName}</p>
                  {user.organizationName && (
                    <p className="text-xs text-muted-foreground">{user.organizationName}</p>
                  )}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Last viewed: {user.lastSeenFormatted || 'Unknown'}</p>
                    <p className={cn(
                      "font-medium",
                      user.isOnline ? "text-green-600" : "text-gray-500"
                    )}>
                      {user.isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        
        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            +{remainingCount}
          </div>
        )}
      </div>


      {/* User count */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>
          {validUsers.length} {validUsers.length === 1 ? 'person' : 'people'} viewing
        </span>
      </div>
    </div>
  );
}
