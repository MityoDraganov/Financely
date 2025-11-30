import {
    CallbackFn,
    QueryConstraint as CoreQueryConstraint,
    DatabaseService,
    OrderByOptions,
    PaginationOptions,
    UnsubscribeFn,
  } from "@/core";
  import { firebase } from "@/infrastructure";
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
   *
   * @param {DocumentData} data
   *
   * @return {DocumentData}
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
   *
   * @template T
   *
   * @param {DocumentSnapshot} snapshot
   *
   * @return {T}
   */
  function snapshotToData<T>(snapshot: DocumentSnapshot) {
    const data = convertTimestampsToDates(snapshot.data()) as T & {
      createdAt: Timestamp;
      updatedAt: Timestamp;
    };
  
    return {
      ...data,
      id: snapshot.id,
      createdAt: data.createdAt ? data.createdAt : null,
      updatedAt: data.updatedAt ? data.updatedAt : null,
    };
  }
  
  /**
   * Database service
   *
   * @export
   * @interface DatabaseService
   */
  export const databaseService: DatabaseService = {
    /**
     * Get a document from a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     *
     * @return {Promise<T | null>}
     */
    async get<T>(collectionName: string, id: string) {
      const collectionRef = collection(firebase.firestore, collectionName);
      const docRef = doc(collectionRef, id);
      const documentSnapshot = await getDoc(docRef);

      if (documentSnapshot.exists()) {
        return snapshotToData<T>(documentSnapshot);
      }

      return null;
    },
  
    /**
     * Get document from a collection by field
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {CoreQueryConstraint[]} queryConstraints
     *
     * @return {Promise<T | null>}
     */
    async getByField<T>(
      collectionName: string,
      queryConstraints: CoreQueryConstraint[],
    ): Promise<T | null> {
      const collectionRef = collection(firebase.firestore, collectionName);

      const constraints: QueryConstraint[] = queryConstraints.map((x) =>
        where(x.field, x.operator, x.value),
      );

      constraints.push(limit(1));

      const q = query(collectionRef, ...constraints);

      const snapshots = await getDocs(q);

      if (snapshots.empty) {
        return null;
      }

      return snapshotToData<T>(snapshots.docs[0]);
    },
  
    /**
     * Get all documents from a collection paginated
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {CoreQueryConstraint[]} queryConstraints
     * @param {PaginationOptions} paginationOptions
     * @param {OrderByOptions} orderByOptions
     *
     * @return {Promise<T[]>}
     */
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
  
    /**
     * Subscribe to changes of a document in a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {(T|null) => void} callback
     *
     * @return {() => void}
     */
    subscribe<T>(
      collectionName: string,
      id: string,
      callback: CallbackFn<T>,
    ): UnsubscribeFn {
      const collectionRef = collection(firebase.firestore, collectionName);
      const docRef = doc(collectionRef, id);

      // Set up subscription - Firestore will handle auth state
      // If not authenticated, the rules will reject and callback(null) will be called
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          return callback(snapshotToData<T>(snapshot));
        }

        callback(null);
      }, (error) => {
        // On permission error, call callback with null
        console.error("Subscription error:", error);
        callback(null);
      });
    },
  
    /**
     * Create a document in a collection
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {T} data
     *
     * @return {Promise<string>} The id of the created document
     */
    async create<T>(collectionName: string, data: T): Promise<string> {
      const collectionReference = collection(firebase.firestore, collectionName);
      const documentReference = await addDoc(collectionReference, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return documentReference.id;
    },
  
    /**
     * Set a document in a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {T} data
     *
     * @return {Promise<void>}
     */
    async set<T>(collectionName: string, id: string, data: T): Promise<void> {
      const documentRef = doc(firebase.firestore, collectionName, id);

      await setDoc(documentRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
  
    /**
     * Update a document in a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {T} data
     *
     * @return {Promise<void>}
     */
    async update<T>(collectionName: string, id: string, data: T): Promise<void> {
      const documentRef = doc(firebase.firestore, collectionName, id);

      await updateDoc(documentRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
  
    /**
     * Add a value to a set field in a document
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} field
     * @param {T} value
     *
     * @return {Promise<void>}
     */
    async addToSet<T>(
      collectionName: string,
      id: string,
      field: string,
      value: T,
    ): Promise<void> {
      const documentRef = doc(firebase.firestore, collectionName, id);

      await updateDoc(documentRef, {
        [field]: arrayUnion(value),
        updatedAt: serverTimestamp(),
      });
    },
  
    /**
     * Remove a value from a set field in a document
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} field
     * @param {T} value
     *
     * @return {Promise<void>}
     */
    async removeFromSet<T>(
      collectionName: string,
      id: string,
      field: string,
      value: T,
    ): Promise<void> {
      const documentRef = doc(firebase.firestore, collectionName, id);

      await updateDoc(documentRef, {
        [field]: arrayRemove(value),
        updatedAt: serverTimestamp(),
      });
    },
  
    /**
     * Delete a document in a collection by id
     *
     * @param {string} collectionName
     * @param {string} id
     *
     * @return {Promise<void>}
     */
    async delete(collectionName: string, id: string): Promise<void> {
      const documentRef = doc(firebase.firestore, collectionName, id);

      await deleteDoc(documentRef);
    },
  };
  