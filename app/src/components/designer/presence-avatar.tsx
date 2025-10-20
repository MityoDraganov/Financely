import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPresence } from "@/services/presence/presence-service";
import { cn } from "@/lib/utils";

interface PresenceAvatarProps {
  user: UserPresence;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function PresenceAvatar({ 
  user, 
  size = "md", 
  showName = false, 
  className 
}: PresenceAvatarProps) {
  // Don't render if user data is invalid
  if (!user || !user.uid || !user.displayName) {
    return null;
  }

  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-10 w-10",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <Avatar className={cn(
          sizeClasses[size],
          user.isOnline && "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
        )}>
          <AvatarImage src={user.photoURL} alt={user.displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(user.displayName || user.email)}
          </AvatarFallback>
        </Avatar>
        {/* Online/Offline indicator */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
          user.isOnline ? "bg-green-500" : "bg-gray-400"
        )} />
      </div>
      {showName && (
        <span className={cn("font-medium text-foreground", textSizeClasses[size])}>
          {user.displayName || user.email?.split("@")[0]}
        </span>
      )}
    </div>
  );
}
