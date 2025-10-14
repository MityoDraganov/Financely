import { firebase } from "@/infrastructure";
import { AuthUser } from "@/core";
import { ref, set, update, remove, onValue, off } from "@firebase/database";

export interface UserPresence {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  templateId: string;
  cursor?: {
    x: number;
    y: number;
  };
  lastSeen: number;
  isActive: boolean;
}

export interface PresenceService {
  joinTemplate: (templateId: string, user: AuthUser) => Promise<void>;
  leaveTemplate: (templateId: string, user: AuthUser) => Promise<void>;
  updateCursor: (templateId: string, user: AuthUser, cursor: { x: number; y: number }) => Promise<void>;
  subscribeToPresence: (templateId: string, callback: (users: UserPresence[]) => void) => () => void;
}

const PRESENCE_PATH = "presence";

export const presenceService: PresenceService = {
  async joinTemplate(templateId: string, user: AuthUser) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    const presence: UserPresence = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
      templateId,
      lastSeen: Date.now(),
      isActive: true,
    };

    // Set presence data
    await set(presenceRef, presence);

    // Set up heartbeat to keep presence alive
    const heartbeatInterval = setInterval(async () => {
      try {
        await update(presenceRef, {
          lastSeen: Date.now(),
          isActive: true,
        });
      } catch (error) {
        console.error("Failed to update presence heartbeat:", error);
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Update every 30 seconds

    // Store interval ID for cleanup
    (presenceRef as any)._heartbeatInterval = heartbeatInterval;

    // Set up disconnect handler to mark user as offline
    const disconnectRef = ref(firebase.database, ".info/connected");
    onValue(disconnectRef, (snap) => {
      if (snap.val() === false) {
        update(presenceRef, { isActive: false });
      }
    });
  },

  async leaveTemplate(templateId: string, user: AuthUser) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    // Clear heartbeat interval
    const heartbeatInterval = (presenceRef as any)._heartbeatInterval;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Remove presence
    await remove(presenceRef);
  },

  async updateCursor(templateId: string, user: AuthUser, cursor: { x: number; y: number }) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    await update(presenceRef, {
      cursor,
      lastSeen: Date.now(),
      isActive: true,
    });
  },

  subscribeToPresence(templateId: string, callback: (users: UserPresence[]) => void) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}`);
    
    const handlePresenceUpdate = (snapshot: any) => {
      const presenceData = snapshot.val();
      
      if (!presenceData) {
        callback([]);
        return;
      }

      const users: UserPresence[] = Object.values(presenceData).filter((user: any) => {
        // Filter out users who haven't been seen in the last 2 minutes
        const isRecent = Date.now() - user.lastSeen < 120000;
        return isRecent;
      }) as UserPresence[];

      callback(users);
    };

    onValue(presenceRef, handlePresenceUpdate);

    // Return unsubscribe function
    return () => {
      off(presenceRef, "value", handlePresenceUpdate);
    };
  },
};
