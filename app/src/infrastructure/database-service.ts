import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  QueryConstraint,
  DocumentSnapshot,
  QuerySnapshot,
  Unsubscribe,
} from "@firebase/firestore";
import { firebase } from "./firebase";
import { DatabaseService, QueryConstraint as CoreQueryConstraint } from "@/core";

const mapCoreQueryConstraint = (constraint: CoreQueryConstraint): QueryConstraint => {
  const { field, operator, value } = constraint;
  
  switch (operator) {
    case "==":
      return where(field, "==", value);
    case "!=":
      return where(field, "!=", value);
    case "<":
      return where(field, "<", value);
    case "<=":
      return where(field, "<=", value);
    case ">":
      return where(field, ">", value);
    case ">=":
      return where(field, ">=", value);
    case "array-contains":
      return where(field, "array-contains", value);
    case "in":
      return where(field, "in", value);
    case "array-contains-any":
      return where(field, "array-contains-any", value);
    case "not-in":
      return where(field, "not-in", value);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
};

export const databaseService: DatabaseService = {
  async get<T>(collectionName: string, id: string): Promise<T | null> {
    const docRef = doc(firebase.firestore, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  },

  async getByField<T>(
    collectionName: string,
    queryConstraints: CoreQueryConstraint[],
  ): Promise<T | null> {
    const constraints = queryConstraints.map(mapCoreQueryConstraint);
    const q = query(collection(firebase.firestore, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as T;
    }
    return null;
  },

  async getPaginated<T>(
    collectionName: string,
    queryConstraints: CoreQueryConstraint[],
    paginationOptions: { limit?: number; cursor?: string },
    orderByOptions?: { field: string; direction: "asc" | "desc" },
  ): Promise<T[]> {
    const constraints: QueryConstraint[] = queryConstraints.map(mapCoreQueryConstraint);
    
    if (orderByOptions) {
      constraints.push(orderBy(orderByOptions.field, orderByOptions.direction));
    }
    
    if (paginationOptions.limit) {
      constraints.push(limit(paginationOptions.limit));
    }
    
    const q = query(collection(firebase.firestore, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  },

  subscribe<T>(
    collectionName: string,
    id: string,
    callback: (data: T | null) => void,
  ): () => void {
    const docRef = doc(firebase.firestore, collectionName, id);
    
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as T);
      } else {
        callback(null);
      }
    });
    
    return unsubscribe;
  },

  async create<T>(collectionName: string, data: T): Promise<string> {
    const docRef = await addDoc(collection(firebase.firestore, collectionName), data);
    return docRef.id;
  },

  async set<T>(collectionName: string, id: string, data: T): Promise<void> {
    const docRef = doc(firebase.firestore, collectionName, id);
    await setDoc(docRef, data);
  },

  async update<T>(
    collectionName: string,
    id: string,
    data: Partial<T>,
  ): Promise<void> {
    const docRef = doc(firebase.firestore, collectionName, id);
    await updateDoc(docRef, data);
  },

  async addToSet<T>(
    collectionName: string,
    id: string,
    field: string,
    value: T,
  ): Promise<void> {
    const docRef = doc(firebase.firestore, collectionName, id);
    await updateDoc(docRef, {
      [field]: arrayUnion(value),
    });
  },

  async removeFromSet<T>(
    collectionName: string,
    id: string,
    field: string,
    value: T,
  ): Promise<void> {
    const docRef = doc(firebase.firestore, collectionName, id);
    await updateDoc(docRef, {
      [field]: arrayRemove(value),
    });
  },

  async delete(collectionName: string, id: string): Promise<void> {
    const docRef = doc(firebase.firestore, collectionName, id);
    await deleteDoc(docRef);
  },
};
