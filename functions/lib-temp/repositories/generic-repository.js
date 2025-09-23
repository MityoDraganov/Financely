"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGenericRepository = void 0;
const firebase_admin_1 = require("firebase-admin");
var FieldPath = firebase_admin_1.firestore.FieldPath;
const getGenericRepository = (getDatabaseCollection, databaseService) => {
    return {
        async get(payload) {
            return databaseService.get(getDatabaseCollection(payload), payload.id);
        },
        async getAll(payload) {
            return databaseService.getAllByFields(getDatabaseCollection(payload), payload.queryConstraints || [], payload.pagination || {}, payload.orderBy);
        },
        async getAllGroup(payload) {
            return databaseService.getAllGroup(getDatabaseCollection(payload), payload.queryConstraints || [], payload.pagination || {}, payload.orderBy);
        },
        async getAllGroupByID(payload) {
            return databaseService.getAllGroup(getDatabaseCollection(payload), [
                {
                    field: FieldPath.documentId(),
                    operator: "==",
                    value: payload.id,
                },
            ], {});
        },
        async create(payload) {
            return databaseService.create(getDatabaseCollection(payload), payload.data);
        },
        async set(payload) {
            return databaseService.set(getDatabaseCollection(payload), payload.id, payload.data);
        },
        batchSet(payload) {
            return databaseService.batchSet(getDatabaseCollection(payload), payload.id, payload.data);
        },
        async update(payload) {
            return databaseService.update(getDatabaseCollection(payload), payload.id, payload.data);
        },
        async delete(payload) {
            return databaseService.delete(getDatabaseCollection(payload), payload.id);
        },
        async increment(payload) {
            for (const field of payload.fields) {
                await databaseService.increment(getDatabaseCollection(payload), payload.id, field.name, field.value);
            }
        },
        async addToSet(payload) {
            return databaseService.addToSet(getDatabaseCollection(payload), payload.id, payload.fieldName, payload.value);
        },
        async removeFromSet(payload) {
            return databaseService.removeFromSet(getDatabaseCollection(payload), payload.id, payload.fieldName, payload.value);
        },
    };
};
exports.getGenericRepository = getGenericRepository;
//# sourceMappingURL=generic-repository.js.map