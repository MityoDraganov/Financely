import { UserPresence } from "@/services/presence/presence-service";
import { cn } from "@/lib/utils";

interface LiveCursorProps {
  user: UserPresence;
  zoom: number;
  className?: string;
}

export function LiveCursor({ user, zoom, className }: LiveCursorProps) {
  if (!user.cursor) {
    return null;
  }

  const { x, y } = user.cursor;

  return (
    <div
      className={cn("absolute pointer-events-none z-50", className)}
      style={{
        left: x * zoom,
        top: y * zoom,
        transform: "translate(-2px, -2px)",
      }}
    >
      {/* Cursor pointer */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        <path
          d="M2 2L8.5 16L12 12L18 18L2 2Z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      
      {/* User label */}
      <div
        className="absolute left-4 top-0 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium whitespace-nowrap"
        style={{
          backgroundColor: `hsl(${user.uid.charCodeAt(0) * 137.5 % 360}, 70%, 50%)`,
        }}
      >
        {user.displayName || user.email.split("@")[0]}
      </div>
    </div>
  );
}
