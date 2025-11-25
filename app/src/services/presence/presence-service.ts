import { firebase } from "@/infrastructure";
import { AuthUser } from "@/core";
import { ref, set, update, remove, onValue, off, onDisconnect, serverTimestamp } from "@firebase/database";

export interface UserPresence {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  templateId: string;
  organizationId?: string;
  organizationName?: string;
  cursor?: {
    x: number;
    y: number;
  };
  selectedBlockId?: string;
  lastSeen: number;
  isActive: boolean;
  isOnline?: boolean;
  lastSeenFormatted?: string;
}

export interface PresenceService {
  joinTemplate: (templateId: string, user: AuthUser, organization?: { id: string; name: string }) => Promise<void>;
  leaveTemplate: (templateId: string, user: AuthUser) => Promise<void>;
  updateCursor: (templateId: string, user: AuthUser, cursor: { x: number; y: number }) => Promise<void>;
  updateSelection: (templateId: string, user: AuthUser, selectedBlockId: string | undefined) => Promise<void>;
  subscribeToPresence: (templateId: string, callback: (users: UserPresence[]) => void) => () => void;
}

const PRESENCE_PATH = "presence";

export const presenceService: PresenceService = {
  async joinTemplate(templateId: string, user: AuthUser, organization?: { id: string; name: string }) {
    console.log("PresenceService: Attempting to join template", templateId, "for user", user.uid);
    
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    const connectedRef = ref(firebase.database, '.info/connected');
    
    const presence: UserPresence = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      email: user.email,
      templateId,
      organizationId: organization?.id,
      organizationName: organization?.name,
      lastSeen: Date.now(),
      isActive: true,
    };

    // Use Firebase's built-in presence system
    try {
      // Monitor connection state
      onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
          // User is connected - set their presence
          set(presenceRef, {
            ...presence,
            lastSeen: serverTimestamp(),
            isActive: true,
          });

          // Set up automatic cleanup when user disconnects
          onDisconnect(presenceRef).set({
            ...presence,
            lastSeen: serverTimestamp(),
            isActive: false,
          });

          console.log("PresenceService: User connected and presence set for", user.uid);
        } else {
          // User is disconnected
          console.log("PresenceService: User disconnected", user.uid);
        }
      });

      console.log("PresenceService: Successfully set up presence for", user.uid);
    } catch (error) {
      console.error("PresenceService: Failed to set up presence:", error);
      throw error;
    }
  },

  async leaveTemplate(templateId: string, user: AuthUser) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    try {
      // Cancel any pending disconnect operations
      onDisconnect(presenceRef).cancel();
      
      // Remove presence data
      await remove(presenceRef);
      console.log("PresenceService: Successfully left template presence for", user.uid);
    } catch (error) {
      console.error("PresenceService: Failed to remove presence data:", error);
      throw error;
    }
  },

  async updateCursor(templateId: string, user: AuthUser, cursor: { x: number; y: number }) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    try {
      await update(presenceRef, {
        cursor,
        lastSeen: serverTimestamp(),
        isActive: true,
      });
    } catch (error) {
      console.error("PresenceService: Failed to update cursor:", error);
      throw error;
    }
  },

  async updateSelection(templateId: string, user: AuthUser, selectedBlockId: string | undefined) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}/${user.uid}`);
    
    try {
      await update(presenceRef, {
        selectedBlockId: selectedBlockId || null,
        lastSeen: serverTimestamp(),
        isActive: true,
      });
    } catch (error) {
      console.error("PresenceService: Failed to update selection:", error);
      throw error;
    }
  },

  subscribeToPresence(templateId: string, callback: (users: UserPresence[]) => void) {
    const presenceRef = ref(firebase.database, `${PRESENCE_PATH}/${templateId}`);
    
    const handlePresenceUpdate = (snapshot: { val: () => Record<string, UserPresence> | null }) => {
      const presenceData = snapshot.val();
      
      console.log("PresenceService: Raw presence data received", presenceData);
      
      if (!presenceData) {
        console.log("PresenceService: No presence data, sending empty array");
        callback([]);
        return;
      }

      const allUsers = Object.values(presenceData);
      console.log("PresenceService: Processing", allUsers.length, "total users");

      const users: UserPresence[] = allUsers.filter((user: UserPresence) => {
        // Filter out users who haven't been seen in the last 2 minutes
        const isRecent = Date.now() - user.lastSeen < 120000;
        const isValid = user && user.uid && user.displayName;
        
        if (!isValid) {
          console.log("PresenceService: Filtering out invalid user", user);
        }
        if (!isRecent) {
          console.log("PresenceService: Filtering out stale user", user.uid, "last seen:", new Date(user.lastSeen));
        }
        
        return isValid && isRecent;
      }).map((user: UserPresence) => ({
        ...user,
        // Add computed fields for better display
        isOnline: user.isActive && (Date.now() - user.lastSeen < 30000), // Online if active and seen in last 30 seconds
        lastSeenFormatted: new Date(user.lastSeen).toLocaleString(),
      })) as UserPresence[];

      console.log("PresenceService: Sending update with", users.length, "valid users");
      console.log("PresenceService: Users:", users.map(u => ({ uid: u.uid, name: u.displayName, isOnline: u.isOnline })));
      callback(users);
    };

    console.log("PresenceService: Setting up presence subscription for template", templateId);
    onValue(presenceRef, handlePresenceUpdate);

    // Return unsubscribe function
    return () => {
      console.log("PresenceService: Cleaning up presence subscription");
      off(presenceRef, "value", handlePresenceUpdate);
    };
  },
};
