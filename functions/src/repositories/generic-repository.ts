import { firestore } from "firebase-admin";
import { DatabaseService } from "../core";
import {
  EmptyPayloadExtender,
  GenericRepository,
} from "../core/ports/repositories/generic-repository";
import FieldPath = firestore.FieldPath;

export const getGenericRepository = <
  TEntity,
  TEntityData,
  TPayloadExtender = EmptyPayloadExtender,
>(
  getDatabaseCollection: (p: TPayloadExtender) => string,
  databaseService: DatabaseService,
): GenericRepository<TEntity, TEntityData, TPayloadExtender> => {
  return {
    async get(payload) {
      return databaseService.get<TEntity>(
        getDatabaseCollection(payload),
        payload.id,
      );
    },
    async getAll(payload) {
      return databaseService.getAllByFields<TEntity>(
        getDatabaseCollection(payload),
        payload.queryConstraints || [],
        payload.pagination || {},
        payload.orderBy,
      );
    },
    async getAllGroup(payload) {
      return databaseService.getAllGroup<TEntity>(
        getDatabaseCollection(payload),
        payload.queryConstraints || [],
        payload.pagination || {},
        payload.orderBy,
      );
    },
    async getAllGroupByID(payload) {
      return databaseService.getAllGroup<TEntity>(
        getDatabaseCollection(payload),
        [
          {
            field: FieldPath.documentId(),
            operator: "==",
            value: payload.id,
          },
        ],
        {},
      );
    },
    async create(payload) {
      return databaseService.create<TEntityData>(
        getDatabaseCollection(payload),
        payload.data,
      );
    },
    async set(payload) {
      return databaseService.set<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.data,
      );
    },
    batchSet(payload) {
      return databaseService.batchSet<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.data,
      );
    },
    async update(payload) {
      return databaseService.update<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.data,
      );
    },
    async delete(payload) {
      return databaseService.delete(getDatabaseCollection(payload), payload.id);
    },
    async increment(payload) {
      for (const field of payload.fields) {
        await databaseService.increment(
          getDatabaseCollection(payload),
          payload.id,
          field.name as string,
          field.value,
        );
      }
    },
    async addToSet(payload) {
      return databaseService.addToSet<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.fieldName,
        payload.value,
      );
    },
    async removeFromSet(payload) {
      return databaseService.removeFromSet<TEntityData>(
        getDatabaseCollection(payload),
        payload.id,
        payload.fieldName,
        payload.value,
      );
    },
  };
};
