import { useEffect, useState, useRef } from "react";
import { presenceService, UserPresence } from "@/services/presence/presence-service";
import { useFirebaseAuthUser } from "@/hooks/service-hooks/auth/use-auth";

export function usePresence(templateId: string | undefined) {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const authUser = useFirebaseAuthUser();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Join/leave template presence
  useEffect(() => {
    if (!templateId || !authUser) {
      return;
    }

    let isMounted = true;

    const joinTemplate = async () => {
      try {
        await presenceService.joinTemplate(templateId, authUser);
        if (isMounted) {
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to join template presence:", error);
      }
    };

    joinTemplate();

    return () => {
      isMounted = false;
      if (authUser) {
        presenceService.leaveTemplate(templateId, authUser).catch(console.error);
      }
    };
  }, [templateId, authUser]);

  // Subscribe to presence updates
  useEffect(() => {
    if (!templateId) {
      return;
    }

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = presenceService.subscribeToPresence(
      templateId,
      (users) => {
        setActiveUsers(users);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [templateId]);

  // Update cursor position
  const updateCursor = async (cursor: { x: number; y: number }) => {
    if (!templateId || !authUser) {
      return;
    }

    try {
      await presenceService.updateCursor(templateId, authUser, cursor);
    } catch (error) {
      console.error("Failed to update cursor:", error);
    }
  };

  return {
    activeUsers,
    isConnected,
    updateCursor,
  };
}
