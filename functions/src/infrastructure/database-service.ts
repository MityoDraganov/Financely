import { firestore } from "./firebase";
import { FieldValue } from "firebase-admin/firestore";
import { PaginationOptions, OrderByOptions, QueryConstraint } from "../core";

/**
 * Firebase Firestore implementation of DatabaseService
 * This is a minimal implementation that only implements the methods we need
 */
export const databaseService = {
  async get<T>(collection: string, id: string): Promise<T | null> {
    const doc = await firestore.collection(collection).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as T;
  },

  async getAll<T>(
    collection: string, 
    paginationOptions?: PaginationOptions, 
    orderByOptions?: OrderByOptions
  ): Promise<T[]> {
    let query: any = firestore.collection(collection);
    
    // Apply pagination
    if (paginationOptions?.limit) {
      query = query.limit(paginationOptions.limit);
    }
    
    // Apply ordering
    if (orderByOptions) {
      query = query.orderBy(orderByOptions.field, orderByOptions.direction);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
  },

  async getAllByFields<T>(
    collection: string,
    queryConstraints: QueryConstraint[],
    paginationOptions: PaginationOptions,
    orderByOptions?: OrderByOptions
  ): Promise<T[]> {
    let query: any = firestore.collection(collection);
    
    // Apply query constraints
    for (const constraint of queryConstraints) {
      query = query.where(constraint.field, constraint.operator, constraint.value);
    }
    
    // Apply pagination
    if (paginationOptions.limit) {
      query = query.limit(paginationOptions.limit);
    }
    
    // Apply ordering
    if (orderByOptions) {
      query = query.orderBy(orderByOptions.field, orderByOptions.direction);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as T));
  },

  async getAllGroup<T>(
    collection: string,
    queryConstraints: QueryConstraint[],
    paginationOptions: PaginationOptions,
    orderByOptions?: OrderByOptions
  ): Promise<T[]> {
    // For now, just use getAllByFields
    return this.getAllByFields(collection, queryConstraints, paginationOptions, orderByOptions);
  },

  async create<T>(collection: string, data: T): Promise<string> {
    const docRef = await firestore.collection(collection).add(data as any);
    return docRef.id;
  },

  async set<T>(collection: string, id: string, data: T): Promise<void> {
    await firestore.collection(collection).doc(id).set(data as any);
  },

  async batchSet<T>(collection: string, id: string, data: T) {
    return (batch: any) => {
      batch.set(firestore.collection(collection).doc(id), data);
    };
  },

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<void> {
    await firestore.collection(collection).doc(id).update(data);
  },

  async increment(collection: string, id: string, field: string, value: number): Promise<void> {
    await firestore.collection(collection).doc(id).update({
      [field]: FieldValue.increment(value)
    });
  },

  async incrementMany(collection: string, id: string, fields: any[]): Promise<void> {
    const updates: any = {};
    for (const field of fields) {
      updates[field.name] = FieldValue.increment(field.value);
    }
    await firestore.collection(collection).doc(id).update(updates);
  },

  async decrement(collection: string, id: string, field: string, value: number): Promise<void> {
    await firestore.collection(collection).doc(id).update({
      [field]: FieldValue.increment(-value)
    });
  },

  async delete(collection: string, id: string): Promise<void> {
    await firestore.collection(collection).doc(id).delete();
  },

  async executeBatchOperations(operations: any[], batchSize?: number): Promise<void> {
    const batch = firestore.batch();
    for (const operation of operations) {
      operation(batch);
    }
    await batch.commit();
  },

  async addToSet<T>(collection: string, id: string, fieldName: keyof T, value: T[keyof T]): Promise<void> {
    await firestore.collection(collection).doc(id).update({
      [fieldName as string]: FieldValue.arrayUnion(value)
    });
  },

  async removeFromSet<T>(collection: string, id: string, fieldName: keyof T, value: T[keyof T]): Promise<void> {
    await firestore.collection(collection).doc(id).update({
      [fieldName as string]: FieldValue.arrayRemove(value)
    });
  },
} as any;
