import {
  CallbackFn,
  QueryConstraint as CoreQueryConstraint,
  DatabaseService,
  OrderByOptions,
  PaginationOptions,
  UnsubscribeFn,
} from "@/core";
import { firebase } from "@/infrastructure/firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from "@firebase/firestore";

/**
 * Convert a timestamp fields to date fields
 */
function convertTimestampsToDates(data: DocumentData | undefined) {
  if (!data) {
    return data;
  }

  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate();
    }
  }

  return data;
}

/**
 * Convert a snapshot to data
 */
function snapshotToData<T>(snapshot: DocumentSnapshot) {
  const data = snapshot.data();
  const convertedData = convertTimestampsToDates(data);

  return {
    id: snapshot.id,
    ...convertedData,
    createdAt: data?.createdAt ? data.createdAt : null,
    updatedAt: data?.updatedAt ? data.updatedAt : null,
  } as T;
}

/**
 * Database service for admin panel
 * Uses Firestore directly - admin rules should allow cross-org access
 * Follows the same pattern as app/src/services/database/database-service.ts
 */
export const databaseService: DatabaseService = {
  async get<T>(collectionName: string, id: string) {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    const documentSnapshot = await getDoc(docRef);

    if (documentSnapshot.exists()) {
      return snapshotToData<T>(documentSnapshot);
    }

    return null;
  },

  async getByField<T>(
    collectionName: string,
    queryConstraints: CoreQueryConstraint[],
  ): Promise<T | null> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const constraints: QueryConstraint[] = [];

    for (const x of queryConstraints) {
      constraints.push(where(x.field, x.operator, x.value));
    }

    const q = query(collectionRef, ...constraints);
    const snapshots = await getDocs(q);

    if (snapshots.empty) {
      return null;
    }

    return snapshotToData<T>(snapshots.docs[0]);
  },

  async getPaginated<T>(
    collectionName: string,
    queryConstraints: CoreQueryConstraint[],
    paginationOptions: PaginationOptions = {
      limit: 10,
    },
    orderByOptions: OrderByOptions = {
      field: "createdAt",
      direction: "desc",
    },
  ): Promise<T[]> {
    const collectionRef = collection(firebase.firestore, collectionName);

    const constraints: QueryConstraint[] = [];

    for (const x of queryConstraints) {
      constraints.push(where(x.field, x.operator, x.value));
    }

    if (orderByOptions) {
      constraints.push(orderBy(orderByOptions.field, orderByOptions.direction));
    }

    if (paginationOptions.limit) {
      constraints.push(limit(paginationOptions.limit));
    }

    if (paginationOptions.cursor) {
      const docRef = await getDoc(doc(collectionRef, paginationOptions.cursor));
      constraints.push(startAfter(docRef));
    }

    const q = query(collectionRef, ...constraints);
    const documentsSnapshots = await getDocs(q);

    if (documentsSnapshots.empty) {
      return [];
    }

    return documentsSnapshots.docs
      .filter((x) => x !== null)
      .map((doc) => snapshotToData<T>(doc)) as T[];
  },

  subscribe<T>(
    collectionName: string,
    id: string,
    callback: CallbackFn<T>,
  ): UnsubscribeFn {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshotToData<T>(snapshot));
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error("Error in subscription:", error);
        callback(null);
      },
    );
  },


  async create<T>(collectionName: string, data: T): Promise<string> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const dataWithTimestamps = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collectionRef, dataWithTimestamps);
    return docRef.id;
  },

  async set<T>(collectionName: string, id: string, data: T): Promise<void> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    const dataWithTimestamps = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, dataWithTimestamps);
  },

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    const dataWithTimestamps = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(docRef, dataWithTimestamps);
  },

  async delete(collectionName: string, id: string): Promise<void> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    await deleteDoc(docRef);
  },

  async addToSet(
    collectionName: string,
    id: string,
    fieldName: string,
    value: unknown,
  ): Promise<void> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    await updateDoc(docRef, {
      [fieldName]: arrayUnion(value),
      updatedAt: serverTimestamp(),
    });
  },

  async removeFromSet(
    collectionName: string,
    id: string,
    fieldName: string,
    value: unknown,
  ): Promise<void> {
    const collectionRef = collection(firebase.firestore, collectionName);
    const docRef = doc(collectionRef, id);
    await updateDoc(docRef, {
      [fieldName]: arrayRemove(value),
      updatedAt: serverTimestamp(),
    });
  },
};
