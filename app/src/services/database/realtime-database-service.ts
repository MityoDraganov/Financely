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
  off,
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
    console.log("[RTDB] Creating document at path:", path, "with data:", data);
    const listRef = ref(firebase.database, path);
    const newDocRef = push(listRef);
    
    const timestamp = new Date().toISOString();
    console.log("[RTDB] Pushing data with key:", newDocRef.key);
  
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
      console.log("[RTDB] Document created successfully with key:", newDocRef.key);
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
      off(docRef, "value", unsubscribe);
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
    console.log("[RTDB] Subscribing to collection:", path, "with options:", options);
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
        console.log("[RTDB] Collection update received:", path, "items:", data.length);
        callback(data);
      });

      return () => {
        console.log("[RTDB] Unsubscribing from collection:", path);
        off(q, "value", unsubscribe);
      };
    }

    const unsubscribe = onValue(queryRef, (snapshot) => {
      const data = snapshotsToDataArray<T>(snapshot);
      console.log("[RTDB] Collection update received:", path, "items:", data.length);
      callback(data);
    });

    return () => {
      console.log("[RTDB] Unsubscribing from collection:", path);
      off(queryRef, "value", unsubscribe);
    };
  },
};

