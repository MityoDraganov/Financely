import { getDatabase, Reference, Query, Database } from "firebase-admin/database";

/**
 * Firebase Realtime Database service for backend functions
 * Provides access to Realtime Database from Cloud Functions
 */
let _database: Database | null = null;

const database = (): Database => {
  if (!_database) {
    _database = getDatabase();
  }
  return _database;
};

export interface RealtimeDatabaseService {
  get<T>(path: string, id: string): Promise<T | null>;
  getAll<T>(path: string, options?: {
    orderBy?: string;
    equalTo?: string;
    limitToFirst?: number;
  }): Promise<T[]>;
  create<T>(path: string, data: T): Promise<string>;
  set<T>(path: string, id: string, data: T): Promise<void>;
  update<T>(path: string, id: string, data: Partial<T>): Promise<void>;
  delete(path: string, id: string): Promise<void>;
}

export const realtimeDatabaseService: RealtimeDatabaseService = {
  /**
   * Get a single record from Realtime Database
   */
  async get<T>(path: string, id: string): Promise<T | null> {
    const ref = database().ref(`${path}/${id}`);
    const snapshot = await ref.once("value");
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.val();
    return {
      id,
      ...data,
    } as T;
  },

  /**
   * Get all records from Realtime Database with optional filtering
   */
  async getAll<T>(path: string, options?: {
    orderBy?: string;
    equalTo?: string;
    limitToFirst?: number;
  }): Promise<T[]> {
    let query: Reference | Query = database().ref(path);
    
    if (options?.orderBy && options?.equalTo !== undefined) {
      query = query.orderByChild(options.orderBy).equalTo(options.equalTo);
    } else if (options?.orderBy) {
      query = query.orderByChild(options.orderBy);
    }
    
    if (options?.limitToFirst) {
      query = query.limitToFirst(options.limitToFirst);
    }
    
    const snapshot = await query.once("value");
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const data = snapshot.val();
    
    // Convert object to array
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return Object.entries(data).map(([id, value]) => ({
        id,
        ...(value as object),
      })) as T[];
    }
    
    return Array.isArray(data) ? data : [];
  },

  /**
   * Create a new record in Realtime Database
   */
  async create<T>(path: string, data: T): Promise<string> {
    const listRef = database().ref(path);
    const newDocRef = listRef.push();
    
    const timestamp = new Date().toISOString();
    const dataToStore = {
      ...(data as object),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    await newDocRef.set(dataToStore);
    return newDocRef.key!;
  },

  /**
   * Set a record in Realtime Database (creates or overwrites)
   */
  async set<T>(path: string, id: string, data: T): Promise<void> {
    const docRef = database().ref(`${path}/${id}`);
    const timestamp = new Date().toISOString();
    
    await docRef.set({
      ...(data as object),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },

  /**
   * Update a record in Realtime Database (partial update)
   */
  async update<T>(path: string, id: string, data: Partial<T>): Promise<void> {
    const docRef = database().ref(`${path}/${id}`);
    const timestamp = new Date().toISOString();
    
    await docRef.update({
      ...(data as object),
      updatedAt: timestamp,
    } as Record<string, unknown>);
  },

  /**
   * Delete a record from Realtime Database
   */
  async delete(path: string, id: string): Promise<void> {
    const docRef = database().ref(`${path}/${id}`);
    await docRef.remove();
  },
};

