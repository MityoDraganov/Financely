"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = void 0;
exports.snapshotToData = snapshotToData;
const firebase_admin_1 = require("firebase-admin");
require("../infrastructure/firebase");
var Timestamp = firebase_admin_1.firestore.Timestamp;
/**
 * Convert a timestamp fields to date fields
 *
 * @param {DocumentData | undefined} documentData
 *
 * @return {DocumentData | undefined}
 */
function convertTimestampsToDates(documentData) {
    // Base case: if the object is null or undefined, return it as-is
    if (documentData === null || documentData === undefined) {
        return documentData;
    }
    // Check if the object is a Firestore Timestamp
    if (documentData instanceof Timestamp) {
        // Transform the Timestamp as needed
        // Here, I'll convert it to a Date object, but you can modify as required
        return documentData.toDate();
    }
    // If the object is an array, map over it and transform its elements
    if (Array.isArray(documentData)) {
        return documentData.map(convertTimestampsToDates);
    }
    // If the object is of type object, traverse its keys and transform them
    if (typeof documentData === "object") {
        const result = {};
        for (const key of Object.keys(documentData)) {
            result[key] = convertTimestampsToDates(documentData[key]);
        }
        return result;
    }
    // If the object doesn't match any of the above conditions, return it as-is
    return documentData;
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
function snapshotToData(snapshot) {
    const data = convertTimestampsToDates(snapshot.data());
    return Object.assign(Object.assign({}, data), { id: snapshot.id, createdAt: data.createdAt ? data.createdAt : null, updatedAt: data.updatedAt ? data.updatedAt : null });
}
/**
 * Database service
 *
 * @export
 * @interface DatabaseService
 */
exports.databaseService = {
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
    async get(collectionName, id) {
        const documentSnapshot = await (0, firebase_admin_1.firestore)()
            .collection(collectionName)
            .doc(id)
            .get();
        if (documentSnapshot.exists) {
            return snapshotToData(documentSnapshot);
        }
        return null;
    },
    /**
     * Get all documents from a collection
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {PaginationOptions} paginationOptions
     * @param {OrderByOptions} orderByOptions
     *
     * @return {Promise<T[]>}
     */
    async getAll(collectionName, paginationOptions = {}, orderByOptions) {
        let query = (0, firebase_admin_1.firestore)().collection(collectionName);
        if (paginationOptions.limit) {
            query = query.limit(paginationOptions.limit);
        }
        if (paginationOptions.cursor) {
            query = query.startAfter(paginationOptions.cursor);
        }
        if (orderByOptions) {
            query = query.orderBy(orderByOptions.field, orderByOptions.direction);
        }
        const querySnapshot = await query.get();
        return querySnapshot.docs.map((snapshotToData));
    },
    /**
     * Get all documents from a collection by fields
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {QueryConstraint[]} queryConstraints
     * @param {PaginationOptions} paginationOptions
     * @param {OrderByOptions} orderByOptions
     *
     * @return {Promise<T[]>}
     */
    async getAllByFields(collectionName, queryConstraints, paginationOptions, orderByOptions) {
        let query = (0, firebase_admin_1.firestore)().collection(collectionName);
        for (const queryConstraint of queryConstraints) {
            query = query.where(queryConstraint.field, queryConstraint.operator, queryConstraint.value);
        }
        if (paginationOptions.limit) {
            query = query.limit(paginationOptions.limit);
        }
        if (paginationOptions.cursor) {
            query = query.startAfter(paginationOptions.cursor);
        }
        if (orderByOptions) {
            query = query.orderBy(orderByOptions.field, orderByOptions.direction);
        }
        const querySnapshot = await query.get();
        return querySnapshot.docs.map((snapshotToData));
    },
    /**
     * Get all documents from a collection group by fields
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {QueryConstraint[]} queryConstraints
     * @param {PaginationOptions} paginationOptions
     * @param {OrderByOptions} orderByOptions
     *
     * @return {Promise<T[]>}
     */
    async getAllGroup(collectionName, queryConstraints, paginationOptions, orderByOptions) {
        let query = (0, firebase_admin_1.firestore)().collectionGroup(collectionName);
        for (const queryConstraint of queryConstraints) {
            query = query.where(queryConstraint.field, queryConstraint.operator, queryConstraint.value);
        }
        if (paginationOptions.limit) {
            query = query.limit(paginationOptions.limit);
        }
        if (paginationOptions.cursor) {
            query = query.startAfter(paginationOptions.cursor);
        }
        if (orderByOptions) {
            query = query.orderBy(orderByOptions.field, orderByOptions.direction);
        }
        const querySnapshot = await query.get();
        return querySnapshot.docs.map((snapshotToData));
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
    async create(collectionName, data) {
        console.log(`Creating document in collection ${collectionName}`, data);
        const response = await (0, firebase_admin_1.firestore)()
            .collection(collectionName)
            .add(Object.assign(Object.assign({}, data), { createdAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(), updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() }));
        return response.id;
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
    async set(collectionName, id, data) {
        console.log(`Setting document ${collectionName}/${id}`, data);
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.set(Object.assign(Object.assign({}, data), { createdAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(), updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() }));
    },
    /**
     * Batch set a document in a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {T} data
     *
     * @return {void}
     */
    batchSet(collectionName, id, data) {
        return (batch) => {
            const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
            batch.set(documentRef, Object.assign(Object.assign({}, data), { createdAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(), updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() }));
        };
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
    async update(collectionName, id, data) {
        console.log(`Updating document ${collectionName}/${id}`, data);
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.update(Object.assign(Object.assign({}, data), { updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() }));
    },
    /**
     * Increment a field in a document in a collection by id
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} field
     * @param {number} value
     *
     * @return {Promise<void>}
     */
    async increment(collectionName, id, field, value = 1) {
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.update({
            [field]: firebase_admin_1.firestore.FieldValue.increment(value),
            updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
        });
    },
    /**
     * Increment a field in a document in a collection by id
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {FieldNameAndValue} fields
     *
     * @return {Promise<void>}
     */
    async incrementMany(collectionName, id, fields) {
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        const updateObject = {};
        for (const field of fields) {
            updateObject[field.name] = firebase_admin_1.firestore.FieldValue.increment(field.value);
        }
        await documentRef.update(Object.assign(Object.assign({}, updateObject), { updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp() }));
    },
    /**
     * Decrement a field in a document in a collection by id
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} field
     * @param {number} value
     */
    async decrement(collectionName, id, field, value = 1) {
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.update({
            [field]: firebase_admin_1.firestore.FieldValue.increment(-value),
            updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
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
    async delete(collectionName, id) {
        console.log(`Deleting document ${collectionName}/${id}`);
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.delete();
    },
    /**
     * Execute batch operations
     *
     * @param {BatchOperation[]} operations
     * @param {number} batchSize
     *
     * @return {Promise<void>}
     */
    async executeBatchOperations(operations, batchSize = 500) {
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = (0, firebase_admin_1.firestore)().batch();
            const chunk = operations.slice(i, i + batchSize);
            for (const operation of chunk) {
                operation(batch);
            }
            await batch.commit();
        }
    },
    /**
     * Add to set a field in a document in a collection by id
     *
     * @template T
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} fieldName
     * @param {T} value
     *
     * @return {Promise<void>}
     */
    async addToSet(collectionName, id, fieldName, value) {
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.update({
            [fieldName]: firebase_admin_1.firestore.FieldValue.arrayUnion(value),
            updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
        });
    },
    /**
     * Remove a value from an array field in a document
     *
     * @param {string} collectionName
     * @param {string} id
     * @param {string} fieldName
     * @param {T} value
     *
     * @return {Promise<void>}
     */
    async removeFromSet(collectionName, id, fieldName, value) {
        const documentRef = (0, firebase_admin_1.firestore)().collection(collectionName).doc(id);
        await documentRef.update({
            [fieldName]: firebase_admin_1.firestore.FieldValue.arrayRemove(value),
            updatedAt: firebase_admin_1.firestore.FieldValue.serverTimestamp(),
        });
    },
};
//# sourceMappingURL=database-service.js.map