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
};

