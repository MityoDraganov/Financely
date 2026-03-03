import { firebase } from "@/infrastructure";
import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  push,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  DataSnapshot,
} from "@firebase/database";

export type RealtimeCallbackFn<T> = (data: T | null) => void;
export type RealtimeUnsubscribeFn = () => void;

function snapshotToData<T>(snapshot: DataSnapshot): T | null {
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.val();
  return {
    ...data,
    id: snapshot.key,
    elements: data.elements || [],
  } as T;
}

function snapshotsToDataArray<T>(snapshot: DataSnapshot): T[] {
  if (!snapshot.exists()) {
    return [];
  }

  const items: T[] = [];
  snapshot.forEach((childSnapshot) => {
    const data = childSnapshot.val();
    
    const normalized = {
      ...data,
      id: childSnapshot.key,
      elements: data.elements || [],
    };
    items.push(normalized as T);
  });

  return items;
}

export const realtimeDatabaseService = {
  async get<T>(path: string, id: string): Promise<T | null> {
    const docRef = ref(firebase.database, `${path}/${id}`);
    const snapshot = await get(docRef);
    return snapshotToData<T>(snapshot);
  },

  async getAll<T>(
    path: string,
    options?: {
      orderBy?: string;
      equalTo?: string | number;
      limit?: number;
    }
  ): Promise<T[]> {
    const queryRef = ref(firebase.database, path);
    
    if (options?.orderBy) {
      let q = query(queryRef, orderByChild(options.orderBy));
      
      if (options.equalTo !== undefined) {
        q = query(q, equalTo(options.equalTo));
      }
      
      if (options.limit) {
        q = query(q, limitToFirst(options.limit));
      }
      
      const snapshot = await get(q);
      return snapshotsToDataArray<T>(snapshot);
    }

    const snapshot = await get(queryRef);
    return snapshotsToDataArray<T>(snapshot);
  },

  async create<T>(path: string, data: T): Promise<string> {
    const listRef = ref(firebase.database, path);
    const newDocRef = push(listRef);
    
    const timestamp = new Date().toISOString();
  
    const hasEmptyElements = data && 
      typeof data === 'object' && 
      'elements' in data && 
      Array.isArray((data as Record<string, unknown>).elements) && 
      ((data as Record<string, unknown>).elements as unknown[]).length === 0;
    
    const dataToStore = {
      ...data,
      ...(hasEmptyElements ? { elements: null } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    try {
      await set(newDocRef, dataToStore);
      return newDocRef.key!;
    } catch (error) {
      console.error("[RTDB] Failed to create document:", error);
      throw error;
    }
  },

  async set<T>(path: string, id: string, data: T): Promise<void> {
    const docRef = ref(firebase.database, `${path}/${id}`);
    const timestamp = new Date().toISOString();
    
    await set(docRef, {
      ...data,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },

  async update<T>(path: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = ref(firebase.database, `${path}/${id}`);
    const timestamp = new Date().toISOString();
    
    await update(docRef, {
      ...data,
      updatedAt: timestamp,
    } as Record<string, unknown>);
  },

  async delete(path: string, id: string): Promise<void> {
    const docRef = ref(firebase.database, `${path}/${id}`);
    await remove(docRef);
  },

  subscribe<T>(
    path: string,
    id: string,
    callback: RealtimeCallbackFn<T>
  ): RealtimeUnsubscribeFn {
    const docRef = ref(firebase.database, `${path}/${id}`);
    
    const unsubscribe = onValue(docRef, (snapshot) => {
      callback(snapshotToData<T>(snapshot));
    });

    return () => {
      unsubscribe();
    };
  },

  subscribeToCollection<T>(
    path: string,
    callback: RealtimeCallbackFn<T[]>,
    options?: {
      orderBy?: string;
      equalTo?: string | number;
      limit?: number;
    }
  ): RealtimeUnsubscribeFn {
    const queryRef = ref(firebase.database, path);
    
    if (options?.orderBy) {
      let q = query(queryRef, orderByChild(options.orderBy));
      
      if (options.equalTo !== undefined) {
        q = query(q, equalTo(options.equalTo));
      }
      
      if (options.limit) {
        q = query(q, limitToFirst(options.limit));
      }

      const unsubscribe = onValue(q, (snapshot) => {
        const data = snapshotsToDataArray<T>(snapshot);
        callback(data);
      }, (error) => {
        console.error("[RTDB] Error in subscription for path:", path, error);
        // Still call callback with empty array to prevent hanging
        callback([]);
      });

      return () => {
        unsubscribe();
      };
    }

    const unsubscribe = onValue(queryRef, (snapshot) => {
      const data = snapshotsToDataArray<T>(snapshot);
      callback(data);
    }, (error) => {
      console.error("[RTDB] Error in subscription for path:", path, error);
      // Still call callback with empty array to prevent hanging
      callback([]);
    });

    return () => {
      unsubscribe();
    };
  },
};
