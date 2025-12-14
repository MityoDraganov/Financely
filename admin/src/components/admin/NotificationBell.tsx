import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAdminNotifications, useAdminUnreadNotifications, useAdminMarkNotificationRead, useAdminMarkAllNotificationsRead, useAdminDeleteNotification } from "@/hooks/admin/use-admin-notifications";
import { Notification } from "@/repositories/notification-repository";
import { formatDistanceToNow } from "date-fns";
import { Check, CheckCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function NotificationItem({ notification }: { notification: Notification }) {
  const markAsRead = useAdminMarkNotificationRead();
  const deleteNotification = useAdminDeleteNotification();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleMarkAsRead = () => {
    if (notification.status === "unread") {
      markAsRead.mutate(notification.id);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteNotification.mutateAsync(notification.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "error":
        return "text-destructive";
      case "warning":
        return "text-yellow-500";
      case "success":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  const createdAt = notification.createdAt
    ? new Date(notification.createdAt)
    : new Date();

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors",
        notification.status === "unread" && "bg-muted/50",
        isDeleting && "opacity-50"
      )}
    >
      <div className={cn("flex-1 min-w-0", getTypeColor(notification.type))}>
        <p className="text-sm font-medium">{notification.message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {notification.status === "unread" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleMarkAsRead}
            disabled={markAsRead.isPending}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleDelete}
          disabled={deleteNotification.isPending || isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const { data: notifications, isLoading } = useAdminNotifications();
  const { data: unreadNotifications } = useAdminUnreadNotifications();
  const markAllAsRead = useAdminMarkAllNotificationsRead();
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = unreadNotifications?.length || 0;
  const hasUnread = unreadCount > 0;

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate(undefined, {
      onSuccess: () => {
        // Keep popover open
      },
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            {hasUnread && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsRead.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

