import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { repositoryHost } from "@/repositories";
import { serviceHost } from "@/services";
import { Notification } from "@/repositories/notification-repository";

const databaseService = serviceHost.getDatabaseService();
const notificationRepository = repositoryHost.getNotificationsRepository(databaseService);

/**
 * Hook to fetch all notifications for the current admin user
 */
export function useAdminNotifications() {
  const { user } = useUser();
  const userId = user?.id;

  return useQuery<Notification[]>({
    queryKey: ["admin", "notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      return notificationRepository.getAll({
        queryConstraints: [{ field: "userId", operator: "==", value: userId }],
        orderBy: { field: "createdAt", direction: "desc" },
        pagination: { limit: 50 },
      });
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to fetch unread notifications for the current admin user
 */
export function useAdminUnreadNotifications() {
  const { user } = useUser();
  const userId = user?.id;

  return useQuery<Notification[]>({
    queryKey: ["admin", "notifications", "unread", userId],
    queryFn: async () => {
      if (!userId) return [];
      return notificationRepository.getUnreadByUser(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to mark a notification as read
 */
export function useAdminMarkNotificationRead() {
  const { user } = useUser();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await notificationRepository.markAsRead(notificationId);
    },
    onSuccess: () => {
      // Invalidate both all notifications and unread notifications
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "unread", userId] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useAdminMarkAllNotificationsRead() {
  const { user } = useUser();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const { data: unreadNotifications } = useAdminUnreadNotifications();

  return useMutation({
    mutationFn: async () => {
      if (!unreadNotifications || unreadNotifications.length === 0) return;
      await Promise.all(
        unreadNotifications.map((notification) =>
          notificationRepository.markAsRead(notification.id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "unread", userId] });
    },
  });
}

/**
 * Hook to delete a notification
 */
export function useAdminDeleteNotification() {
  const { user } = useUser();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await notificationRepository.delete(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "unread", userId] });
    },
  });
}

